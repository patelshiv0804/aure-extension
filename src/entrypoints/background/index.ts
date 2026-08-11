// ──────────────────────────────────────────────────────────────
// Background Service Worker
// Central hub for API routing, message handling, and commands
// ──────────────────────────────────────────────────────────────

import { initMessageListener, onMessage } from '@/lib/messaging';
import { migrateStorageIfNeeded, getSettings, updateSettings } from '@/lib/storage';
import { enhancePrompt } from '@/api/enhance';
import { saveVersion, getVersions } from '@/api/versions';
import { getPromptHistory } from '@/api/history';
import { recommendModel } from '@/api/recommend';

export default defineBackground(() => {
  console.log('[AURE] Service Worker started');

  // Initialize storage migration
  migrateStorageIfNeeded().catch(console.error);

  // Initialize the message router
  initMessageListener();

  // ── Message Handlers ────────────────────────────────────────

  onMessage('ENHANCE_PROMPT', async (payload) => {
    const result = await enhancePrompt({
      prompt: payload.prompt,
      mode: payload.mode,
      role: payload.role,
      context: { platform: payload.platform },
    });
    return result;
  });

  onMessage('SAVE_VERSION', async (payload) => {
    const result = await saveVersion({
      prompt_id: payload.promptId,
      text: payload.version.text,
      version: payload.version.version,
      source: payload.version.source,
      mode: payload.version.mode,
    });
    return { success: result.success, versionId: result.versionId };
  });

  onMessage('GET_VERSIONS', async (payload) => {
    const versions = await getVersions(payload.promptId);
    return { versions };
  });

  onMessage('GET_HISTORY', async (payload) => {
    return await getPromptHistory(payload);
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
    if (sender.tab?.windowId) {
      await chrome.sidePanel.open({ windowId: sender.tab.windowId });
    }
    return { success: true };
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
