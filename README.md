# PromptEnhancer AI — Chrome Extension

> 🚀 AI Prompt Enhancement Chrome Extension — enhance prompts across ChatGPT, Claude, Gemini, Grok, Perplexity, DeepSeek, and Copilot.

## Quick Start

```bash
# Install dependencies
npm install

# Development (with HMR)
npm run dev

# Build for production
npm run build

# Type check
npm run check
```

## Load the Extension

1. Run `npm run build`
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `.output/chrome-mv3` directory

## Architecture

- **WXT** — Build framework for Manifest V3 extensions
- **React 19** — UI framework
- **TypeScript** — Type safety
- **TailwindCSS** — Styling
- **Zustand** — State management
- **Framer Motion** — Animations
- **Shadow DOM** — Content script style isolation

## Supported Platforms

| Platform   | Status |
|-----------|--------|
| ChatGPT    | ✅      |
| Claude     | ✅      |
| Gemini     | ✅      |
| Grok       | ✅      |
| Perplexity | ✅      |
| DeepSeek   | ✅      |
| Copilot    | ✅      |
| Custom     | ✅ via JSON selectors |

## License

Private — All rights reserved.
