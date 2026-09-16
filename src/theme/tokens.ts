// ──────────────────────────────────────────────────────────────
// Theme Design Tokens & System Theme Utilities
// Mirrors Prompt_Enhancer-FE palette and semantics
// ──────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'aure-theme-preference';

/**
 * Dark-mode design tokens. Directly ported from Prompt_Enhancer-FE.
 * Tuned for a sleek dark surface: near-black canvas (#0A0A0F) with
 * faint violet undertone, layered surfaces, and high-contrast text.
 */
export const D = {
  /* Canvas & surfaces */
  bg: '#0A0A0F',
  bgSoft: '#0D0C14',
  surface: '#141320',
  surfaceElevated: '#1A1827',
  surface2: '#211E30',

  /* Text */
  textPrimary: '#F5F4F8',
  textSecondary: '#ABA9BC',
  textMuted: '#77748A',

  /* Lines & Borders */
  border: 'rgba(255, 255, 255, 0.09)',
  borderSubtle: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(167, 139, 250, 0.20)',

  /* High-contrast pill CTA */
  ctaBg: '#F5F4F8',
  ctaText: '#0A0A0F',
  ctaShadow: '0 6px 24px rgba(0, 0, 0, 0.55)',

  /* Glass chrome */
  glassTop: 'rgba(14, 13, 20, 0.85)',
  glassScrolled: 'rgba(14, 13, 20, 0.92)',
  glassBorder: 'rgba(167, 139, 250, 0.14)',

  /* Brand accents */
  violet: '#8B5CF6',
  purple: '#7C3AED',
  purpleLight: '#A855F7',
  indigo: '#6366F1',
  pink: '#EC4899',
  blue: '#60A5FA',
} as const;

/**
 * Light-mode design tokens matching Prompt_Enhancer-FE.
 */
export const L = {
  /* Canvas & surfaces */
  bg: '#FAFAFE',
  bgSoft: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surface2: '#F1F5F9',

  /* Text */
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',

  /* Lines & Borders */
  border: '#ECE9FF',
  borderSubtle: '#E2E8F0',
  borderStrong: 'rgba(124, 58, 237, 0.25)',

  /* High-contrast pill CTA */
  ctaBg: '#0F172A',
  ctaText: '#FFFFFF',
  ctaShadow: '0 6px 24px rgba(0, 0, 0, 0.08)',

  /* Glass chrome */
  glassTop: 'rgba(250, 250, 254, 0.85)',
  glassScrolled: 'rgba(250, 250, 254, 0.95)',
  glassBorder: 'rgba(124, 58, 237, 0.12)',

  /* Brand accents */
  violet: '#8B5CF6',
  purple: '#7C3AED',
  purpleLight: '#A855F7',
  indigo: '#6366F1',
  pink: '#EC4899',
  blue: '#60A5FA',
} as const;

/** Read OS colour-scheme preference (SSR/fallback safe) and host page theme */
export function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';

  // Check if host website (e.g. ChatGPT, Claude) is explicitly in dark mode
  if (typeof document !== 'undefined') {
    const docEl = document.documentElement;
    const body = document.body;
    if (
      docEl?.classList.contains('dark') ||
      body?.classList.contains('dark') ||
      docEl?.getAttribute('data-theme') === 'dark' ||
      body?.getAttribute('data-theme') === 'dark' ||
      docEl?.style.colorScheme === 'dark' ||
      body?.style.colorScheme === 'dark'
    ) {
      return 'dark';
    }
  }

  if (!window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Resolve a stored preference ('light' | 'dark' | 'system') to the active paint theme */
export function resolveTheme(preference: ThemePreference): Theme {
  return preference === 'system' ? getSystemTheme() : preference;
}

