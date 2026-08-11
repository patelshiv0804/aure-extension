// ──────────────────────────────────────────────────────────────
// useSiteAdapter — Hook to get the current site adapter
// ──────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { resolveAdapter, isKnownSite } from '@/adapters/registry';
import type { SiteAdapter } from '@/types/adapter';

export function useSiteAdapter(): {
  adapter: SiteAdapter;
  isKnown: boolean;
  platformName: string;
} {
  const adapter = useMemo(() => resolveAdapter(), []);
  const isKnown = useMemo(() => isKnownSite(), []);

  return {
    adapter,
    isKnown,
    platformName: adapter.getPlatformName(),
  };
}
