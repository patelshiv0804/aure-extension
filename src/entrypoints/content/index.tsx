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
  runAt: 'document_idle',

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

    // Cleanup on context invalidation
    _ctx.onInvalidated(() => {
      root.unmount();
      appContainer.remove();
      styleEl.remove();
    });
  },
});
