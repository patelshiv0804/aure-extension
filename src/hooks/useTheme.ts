// ──────────────────────────────────────────────────────────────
// useTheme — App-wide theme hook matching Prompt_Enhancer-FE
// Powered by useThemeStore for universal cross-context sync
// (Popup ⇄ Sidepanel ⇄ Content Scripts ⇄ Settings)
// ──────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/theme.store';
import { D, L } from '@/theme/tokens';
import type { ThemePreference, Theme } from '@/theme/tokens';

export function useTheme() {
  const preference = useThemeStore((s) => s.preference);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const isDark = useThemeStore((s) => s.isDark);
  const setPreference = useThemeStore((s) => s.setPreference);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const initTheme = useThemeStore((s) => s.initTheme);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return {
    preference,
    resolvedTheme,
    theme: resolvedTheme,
    isDark,
    setPreference,
    setTheme: setPreference,
    toggleTheme,
    D,
    L,
  };
}

export { D, L };
export type { ThemePreference, Theme };
