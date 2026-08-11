// ──────────────────────────────────────────────────────────────
// Adapter Registry — Resolves the correct adapter for the current site
// ──────────────────────────────────────────────────────────────

import type { SiteAdapter, SiteConfig } from '@/types/adapter';
import { ChatGPTAdapter } from './chatgpt.adapter';
import { ClaudeAdapter } from './claude.adapter';
import { GeminiAdapter } from './gemini.adapter';
import { GrokAdapter } from './grok.adapter';
import { PerplexityAdapter } from './perplexity.adapter';
import { DeepSeekAdapter } from './deepseek.adapter';
import { CopilotAdapter } from './copilot.adapter';
import { GenericAdapter } from './generic.adapter';

// Built-in adapters
const BUILT_IN_ADAPTERS: Array<() => SiteAdapter> = [
  () => new ChatGPTAdapter(),
  () => new ClaudeAdapter(),
  () => new GeminiAdapter(),
  () => new GrokAdapter(),
  () => new PerplexityAdapter(),
  () => new DeepSeekAdapter(),
  () => new CopilotAdapter(),
];

/**
 * Resolve the appropriate SiteAdapter for the current page.
 * Checks hostname against all registered adapters, falls back to GenericAdapter.
 */
export function resolveAdapter(
  hostname?: string,
  customConfigs?: Record<string, SiteConfig>
): SiteAdapter {
  const host = hostname ?? window.location.hostname;

  // Check built-in adapters
  for (const createAdapter of BUILT_IN_ADAPTERS) {
    const adapter = createAdapter();
    if (adapter.hostnames.some((h) => host.includes(h))) {
      return adapter;
    }
  }

  // Check custom configs from user settings
  if (customConfigs) {
    for (const config of Object.values(customConfigs)) {
      if (config.hostnames.some((h: string) => host.includes(h))) {
        return new GenericAdapter(config);
      }
    }
  }

  // Fallback to generic adapter
  return new GenericAdapter({ hostnames: [host], name: host });
}

/**
 * Get all supported site names.
 */
export function getSupportedSites(): string[] {
  return BUILT_IN_ADAPTERS.map((create) => create().name);
}

/**
 * Check if the current site is a known AI chat platform.
 */
export function isKnownSite(hostname?: string): boolean {
  const host = hostname ?? window.location.hostname;
  return BUILT_IN_ADAPTERS.some((create) => {
    const adapter = create();
    return adapter.hostnames.some((h) => host.includes(h));
  });
}
