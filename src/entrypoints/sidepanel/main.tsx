import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidePanelRoot } from '@/components/sidepanel/SidePanelRoot';
import { THEME_STORAGE_KEY, resolveTheme, ThemePreference } from '@/theme/tokens';
import './style.css';

// Immediate pre-hydration theme setup
try {
  const localPref = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
  if (localPref) {
    const active = resolveTheme(localPref);
    document.documentElement.classList.toggle('dark', active === 'dark');
    document.documentElement.classList.toggle('light', active === 'light');
    document.documentElement.style.colorScheme = active;
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanelRoot />
  </React.StrictMode>
);
