import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  outDir: 'dist',
  manifest: {
    name: 'AURE',
    description: 'Enhance your AI prompts across ChatGPT, Claude, Gemini, and more.',
    version: '1.0.0',
    permissions: ['storage', 'activeTab', 'sidePanel', 'cookies', 'tabs', 'scripting'],
    host_permissions: [
      'https://chat.openai.com/*',
      'https://chatgpt.com/*',
      'https://claude.ai/*',
      'https://gemini.google.com/*',
      'https://x.com/i/grok*',
      'https://grok.com/*',
      'https://www.perplexity.ai/*',
      'https://chat.deepseek.com/*',
      'https://copilot.microsoft.com/*',
      'http://127.0.0.1:8000/*',
      'http://localhost:8000/*',
    ],
    commands: {
      'enhance-prompt': {
        suggested_key: { default: 'Alt+E' },
        description: 'Enhance current prompt',
      },
      'change-mode': {
        suggested_key: { default: 'Alt+M' },
        description: 'Change enhancement mode',
      },
      'open-history': {
        suggested_key: { default: 'Alt+H' },
        description: 'Open prompt history',
      },
    },
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    web_accessible_resources: [
      {
        resources: ['logo.png', 'icons/*'],
        matches: ['*://*/*'],
      },
    ],
  },
  vite: () => ({
    build: {
      target: 'esnext',
      minify: 'esbuild',
      modulePreload: false,
    },
  }),
});
