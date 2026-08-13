// ──────────────────────────────────────────────────────────────
// Content Script Entry Point
// Mounts the React UI directly into document.body
// ──────────────────────────────────────────────────────────────

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ContentRoot } from '@/components/content/ContentRoot';
import { resolveAdapter } from '@/adapters/registry';
import contentStyles from './style.css?inline';

export default defineContentScript({
  matches: [
    'https://chat.openai.com/*',
    'https://chatgpt.com/*',
    'https://claude.ai/*',
    'https://gemini.google.com/*',
    'https://x.com/i/grok*',
    'https://grok.com/*',
    'https://www.perplexity.ai/*',
    'https://chat.deepseek.com/*',
    'https://copilot.microsoft.com/*',
  ],
  // document_end fires as soon as DOM is parsed — no waiting for images/fonts/API calls.
  // This dramatically reduces the time before the AURE button appears.
  runAt: 'document_end',

  async main(_ctx) {
    // Resolve the site adapter for the current page
    const adapter = resolveAdapter();
    console.log(`[AURE] Adapter resolved: ${adapter.name}`);

    // Inject CSS into the document head (not shadow DOM) so styles apply
    const styleEl = document.createElement('style');
    styleEl.id = 'pe-content-styles';
    styleEl.textContent = contentStyles;
    (document.head ?? document.documentElement).appendChild(styleEl);

    // Add Google Fonts
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
    (document.head ?? document.documentElement).appendChild(fontLink);

    // Create a container div appended directly to body — no shadow DOM
    const appContainer = document.createElement('div');
    appContainer.id = 'pe-app';
    appContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;';
    document.body.appendChild(appContainer);

    // Mount React
    const root = ReactDOM.createRoot(appContainer);
    root.render(React.createElement(ContentRoot, { adapter }));

    // Message listener for auto-filling prompt in input textarea
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'FILL_PROMPT' && message.payload?.text) {
        const promptText = message.payload.text;
        
        (async () => {
          try {
            await adapter.injectPrompt(promptText);
            sendResponse({ success: true });
          } catch (err) {
            console.warn('[AURE Content] Adapter injectPrompt failed, trying fallback search:', err);
            // Universal Fallback Search
            const fallbackEl = document.querySelector<HTMLElement>(
              '#prompt-textarea, textarea, div[contenteditable="true"], div[role="textbox"]'
            );
            if (fallbackEl) {
              fallbackEl.focus();
              fallbackEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              if (fallbackEl instanceof HTMLTextAreaElement || fallbackEl instanceof HTMLInputElement) {
                const nativeSetter = Object.getOwnPropertyDescriptor(
                  Object.getPrototypeOf(fallbackEl),
                  'value'
                )?.set;
                if (nativeSetter) {
                  nativeSetter.call(fallbackEl, promptText);
                } else {
                  fallbackEl.value = promptText;
                }
                fallbackEl.dispatchEvent(new Event('input', { bubbles: true }));
                fallbackEl.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(fallbackEl);
                selection?.removeAllRanges();
                selection?.addRange(range);
                document.execCommand('insertText', false, promptText);
                fallbackEl.dispatchEvent(
                  new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: promptText })
                );
              }
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: 'Input element not found' });
            }
          }
        })();
        return true;
      }
    });

    // Cleanup on context invalidation
    _ctx.onInvalidated(() => {
      root.unmount();
      appContainer.remove();
      styleEl.remove();
    });
  },
});
