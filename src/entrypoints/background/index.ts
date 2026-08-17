// ──────────────────────────────────────────────────────────────
// Background Service Worker
// Central hub for API routing, message handling, and commands
// ──────────────────────────────────────────────────────────────

import { initMessageListener, onMessage } from '@/lib/messaging';
import { migrateStorageIfNeeded, getSettings, updateSettings } from '@/lib/storage';
import { enhancePrompt, enhancePromptStream, reenhancePrompt, saveEnhancedPrompt } from '@/api/enhance';
import { saveVersion, getVersions } from '@/api/versions';
import { getPromptHistory, deletePrompt } from '@/api/history';
import { recommendModel } from '@/api/recommend';

export default defineBackground(() => {
  console.log('[AURE] Service Worker started');

  // Initialize storage migration
  migrateStorageIfNeeded().catch(console.error);

  // Initialize the message router
  initMessageListener();

  // ── Active Request Abort Controllers ───────────────────────
  let activeEnhanceController: AbortController | null = null;
  let activeReenhanceController: AbortController | null = null;

  // ── Message Handlers ────────────────────────────────────────

  onMessage('ENHANCE_PROMPT', async (payload, sender) => {
    // If a previous enhance request was running, cancel it
    if (activeEnhanceController) {
      activeEnhanceController.abort('New enhance request started');
    }
    activeEnhanceController = new AbortController();
    const currentController = activeEnhanceController;

    try {
      const result = await enhancePromptStream(
        {
          prompt: payload.prompt,
          mode: payload.mode,
          role: payload.role,
          context: { platform: payload.platform },
        },
        (progress, stage, message) => {
          if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
              type: 'ENHANCE_PROGRESS',
              payload: { progress, stage, message },
            }).catch(() => {});
          }
        },
        currentController.signal
      );

      if (currentController.signal.aborted) {
        throw new Error('Enhancement cancelled');
      }

      return result;
    } catch (err: any) {
      if (currentController.signal.aborted || err?.code === 'CANCELLED' || err?.name === 'AbortError') {
        console.log('[AURE Background] Enhancement request cleanly aborted.');
        throw new Error('Enhancement cancelled');
      }
      throw err;
    } finally {
      if (activeEnhanceController === currentController) {
        activeEnhanceController = null;
      }
    }
  });

  onMessage('SAVE_ENHANCED_PROMPT', async (payload) => {
    const result = await saveEnhancedPrompt(payload);
    try {
      chrome.runtime.sendMessage({ type: 'HISTORY_UPDATED', payload: { promptId: result.prompt_id } }).catch(() => {});
      chrome.storage.local.set({ last_history_update: Date.now() }).catch(() => {});
    } catch {}
    return { success: result.success, prompt_id: result.prompt_id };
  });

  onMessage('REENHANCE_PROMPT', async (payload) => {
    if (activeReenhanceController) {
      activeReenhanceController.abort('New reenhance request started');
    }
    activeReenhanceController = new AbortController();
    const currentController = activeReenhanceController;

    try {
      const result = await reenhancePrompt(
        payload.promptId,
        {
          prompt: payload.prompt || '',
          mode: payload.mode || 'general',
        },
        currentController.signal
      );

      if (currentController.signal.aborted) {
        console.log('[AURE Background] Re-enhancement was aborted by user.');
        throw new Error('Re-enhancement cancelled');
      }

      return result;
    } catch (err: any) {
      if (currentController.signal.aborted || err?.code === 'CANCELLED' || err?.name === 'AbortError') {
        console.log('[AURE Background] Re-enhancement request cleanly aborted.');
        throw new Error('Re-enhancement cancelled');
      }
      throw err;
    } finally {
      if (activeReenhanceController === currentController) {
        activeReenhanceController = null;
      }
    }
  });

  onMessage('CANCEL_ENHANCE', async () => {
    console.log('[AURE Background] CANCEL_ENHANCE received. Aborting active network stream.');
    if (activeEnhanceController) {
      activeEnhanceController.abort('User cancelled enhancement');
      activeEnhanceController = null;
    }
    if (activeReenhanceController) {
      activeReenhanceController.abort('User cancelled re-enhancement');
      activeReenhanceController = null;
    }
    return { success: true };
  });

  onMessage('SAVE_VERSION', async (payload) => {
    const result = await saveVersion({
      prompt_id: payload.promptId,
      text: payload.version.text,
      version: payload.version.version,
      source: payload.version.source,
      mode: payload.version.mode,
    });

    try {
      chrome.runtime.sendMessage({ type: 'HISTORY_UPDATED', payload: result }).catch(() => {});
      chrome.storage.local.set({ last_history_update: Date.now() }).catch(() => {});
    } catch {}

    return { success: result.success, versionId: result.versionId };
  });

  onMessage('GET_VERSIONS', async (payload) => {
    const versions = await getVersions(payload.promptId);
    return { versions };
  });

  onMessage('GET_HISTORY', async (payload) => {
    return await getPromptHistory(payload);
  });

  onMessage('DELETE_PROMPT', async (payload) => {
    const success = await deletePrompt(payload.promptId);
    try {
      chrome.runtime.sendMessage({ type: 'HISTORY_UPDATED', payload: { promptId: payload.promptId } }).catch(() => {});
      chrome.storage.local.set({ last_history_update: Date.now() }).catch(() => {});
    } catch {}
    return { success };
  });

  onMessage('RECOMMEND_MODEL', async (payload) => {
    return await recommendModel({
      prompt: payload.prompt,
      category: payload.category,
      current_model: payload.currentModel,
    });
  });

  onMessage('GET_SETTINGS', async () => {
    return await getSettings();
  });

  onMessage('UPDATE_SETTINGS', async (payload) => {
    return await updateSettings(payload);
  });

  onMessage('OPEN_SIDE_PANEL', async (_payload, sender) => {
    try {
      if (sender.tab?.windowId) {
        await chrome.sidePanel.open({ windowId: sender.tab.windowId });
      } else {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (currentTab?.windowId) {
          await chrome.sidePanel.open({ windowId: currentTab.windowId });
        }
      }
    } catch (err) {
      console.warn('[AURE Background] Failed to open side panel:', err);
    }
    return { success: true };
  });

  onMessage('FILL_PROMPT', async (payload) => {
    // 1. Query all open tabs across windows
    const allTabs = await chrome.tabs.query({});

    // 2. Find active HTTP/HTTPS webpage tab (excluding chrome-extension://)
    let targetTab = allTabs.find(
      (t) => t.active && t.url && (t.url.startsWith('http://') || t.url.startsWith('https://'))
    );

    // 3. If not found, find any open tab on ChatGPT, Claude, Gemini, etc.
    if (!targetTab) {
      targetTab = allTabs.find(
        (t) =>
          t.url &&
          (t.url.includes('chatgpt.com') ||
            t.url.includes('chat.openai.com') ||
            t.url.includes('claude.ai') ||
            t.url.includes('gemini.google.com') ||
            t.url.includes('perplexity.ai') ||
            t.url.includes('grok.com') ||
            t.url.includes('deepseek.com'))
      );
    }

    // 4. Final fallback: active tab
    if (!targetTab) {
      const activeTabs = await chrome.tabs.query({ active: true });
      targetTab = activeTabs.find((t) => t.url && !t.url.startsWith('chrome-extension://')) ?? activeTabs[0];
    }

    if (!targetTab?.id) {
      return { success: false, error: 'No active webpage tab found' };
    }

    try {
      const response = await chrome.tabs.sendMessage(targetTab.id, {
        type: 'FILL_PROMPT',
        payload: { text: payload.text },
      });
      return response ?? { success: true };
    } catch (err) {
      console.warn('[AURE Background] Send FILL_PROMPT to tab failed:', err);
      return { success: false, error: String(err) };
    }
  });

  // ── Chrome Commands (Keyboard Shortcuts) ────────────────────

  chrome.commands.onCommand.addListener(async (command, tab) => {
    if (!tab?.id) return;

    try {
      switch (command) {
        case 'enhance-prompt':
          await chrome.tabs.sendMessage(tab.id, {
            type: 'SHORTCUT_ENHANCE',
            payload: undefined,
            requestId: `cmd-${Date.now()}`,
          });
          break;
        case 'change-mode':
          await chrome.tabs.sendMessage(tab.id, {
            type: 'SHORTCUT_MODE',
            payload: undefined,
            requestId: `cmd-${Date.now()}`,
          });
          break;
        case 'open-history':
          if (tab.windowId) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
          }
          break;
      }
    } catch (error) {
      console.error('[AURE] Command error:', error);
    }
  });

  // ── Install / Update Lifecycle ──────────────────────────────

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('[AURE] Extension installed');
      // Set default badge
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
    }
    if (details.reason === 'update') {
      console.log('[AURE] Extension updated to', chrome.runtime.getManifest().version);
    }
  });
});
