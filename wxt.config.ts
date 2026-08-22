import { defineConfig } from 'wxt';

// AI platform origins where the content-script UI renders. Shared by
// host_permissions and web_accessible_resources so both stay in sync.
const AI_HOST_MATCHES = [
  'https://chat.openai.com/*',
  'https://chatgpt.com/*',
  'https://claude.ai/*',
  'https://gemini.google.com/*',
  'https://x.com/i/grok*',
  'https://grok.com/*',
  'https://www.perplexity.ai/*',
  'https://chat.deepseek.com/*',
  'https://copilot.microsoft.com/*',
];

// Local backend origins — only needed for local development. Added to
// host_permissions in dev builds only, never shipped to production (AURE-03).
const DEV_HOST_PERMISSIONS = [
  'http://127.0.0.1:8000/*',
  'http://localhost:8000/*',
];

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  outDir: 'dist',
  // `command` is 'serve' for `wxt` (dev) and 'build' for `wxt build` (production).
  manifest: ({ command }) => ({
    name: 'AURE',
    description: 'Enhance your AI prompts across ChatGPT, Claude, Gemini, and more.',
    version: '1.0.0',
    // Least-privilege permissions (AURE-03):
    //  • 'tabs' removed — host_permissions already expose tab URLs for the
    //    supported AI hosts, which is all the tab-querying code needs.
    //  • 'scripting' removed — its only use was the executeScript fallback in
    //    VersionTimeline, which has been removed (AURE-05).
    permissions: ['storage', 'activeTab', 'sidePanel', 'cookies'],
    host_permissions: [
      ...AI_HOST_MATCHES,
      // Local backend access is granted in dev builds only.
      ...(command === 'serve' ? DEV_HOST_PERMISSIONS : []),
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
        // Expose assets only to the AI platforms where the content UI renders,
        // instead of every site (`*://*/*`), which let any page detect and
        // fingerprint the extension (AURE-04).
        matches: AI_HOST_MATCHES,
      },
    ],
  }),
  vite: () => ({
    build: {
      target: 'esnext',
      minify: 'esbuild',
      modulePreload: false,
    },
  }),
});
