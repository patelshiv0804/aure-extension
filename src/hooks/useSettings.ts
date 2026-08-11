// ──────────────────────────────────────────────────────────────
// useSettings — Hook for extension settings
// ──────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings.store';

export function useSettings() {
  const store = useSettingsStore();

  useEffect(() => {
    if (!store.isLoaded) {
      store.loadSettings();
    }
  }, [store.isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  return store;
}
