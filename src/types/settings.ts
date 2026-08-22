// ──────────────────────────────────────────────────────────────
// Settings Types
// ──────────────────────────────────────────────────────────────

import type { EnhancementMode } from './enhancement';

export interface ExtensionSettings {
  // General
  general: {
    autoEnhance: boolean;
    askBeforeEnhance: boolean;
    defaultMode: EnhancementMode;
  };

  // UI
  ui: {
    theme: 'dark' | 'light' | 'system';
    animationsEnabled: boolean;
    floatingIconPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    compactMode: boolean;
  };

  // AI
  ai: {
    preferredModels: string[];
    recommendationSensitivity: number; // 0-100
    showRecommendations: boolean;
  };

  // Advanced
  advanced: {
    customSelectors: Record<string, string[]>;
    customPromptTemplates: CustomPromptTemplate[];
    apiEndpoint?: string;
    currentUserEmail?: string;
    debugMode: boolean;
  };
}

export interface CustomPromptTemplate {
  id: string;
  name: string;
  template: string;
  description: string;
  createdAt: number;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  general: {
    autoEnhance: false,
    askBeforeEnhance: true,
    defaultMode: 'creator',
  },
  ui: {
    theme: 'light',
    animationsEnabled: true,
    floatingIconPosition: 'bottom-right',
    compactMode: false,
  },
  ai: {
    preferredModels: ['claude', 'chatgpt', 'gemini'],
    recommendationSensitivity: 70,
    showRecommendations: true,
  },
  advanced: {
    customSelectors: {},
    customPromptTemplates: [],
    debugMode: false,
  },
};
