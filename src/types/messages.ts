// ──────────────────────────────────────────────────────────────
// Message Protocol Types
// Type-safe inter-context messaging for Chrome extension
// ──────────────────────────────────────────────────────────────

import type { EnhancementMode, EnhanceResult, CategoryClassification } from './enhancement';
import type { PromptHistoryFilters, PromptHistoryResult, PromptVersion } from './prompt';
import type { ExtensionSettings } from './settings';

/**
 * Discriminated union of all message types.
 * Each key maps to { payload, response } for compile-time safety.
 */
export interface MessageMap {
  // Enhancement
  ENHANCE_PROMPT: {
    payload: { prompt: string; mode: EnhancementMode; role?: string; platform: string };
    response: EnhanceResult;
  };

  // Versioning
  SAVE_VERSION: {
    payload: { promptId: string; version: PromptVersion };
    response: { success: boolean; versionId: string };
  };
  GET_VERSIONS: {
    payload: { promptId: string };
    response: { versions: PromptVersion[] };
  };

  // History
  GET_HISTORY: {
    payload: PromptHistoryFilters;
    response: PromptHistoryResult;
  };
  DELETE_PROMPT: {
    payload: { promptId: string };
    response: { success: boolean };
  };

  // Model Recommendation
  RECOMMEND_MODEL: {
    payload: { prompt: string; category: string; currentModel: string };
    response: ModelRecommendation;
  };

  // Classification
  CLASSIFY_PROMPT: {
    payload: { prompt: string };
    response: CategoryClassification;
  };

  // Settings
  GET_SETTINGS: {
    payload: undefined;
    response: ExtensionSettings;
  };
  UPDATE_SETTINGS: {
    payload: Partial<ExtensionSettings>;
    response: ExtensionSettings;
  };

  // UI Actions
  OPEN_SIDE_PANEL: {
    payload: undefined;
    response: { success: boolean };
  };
  INJECT_PROMPT: {
    payload: { text: string; tabId: number };
    response: { success: boolean };
  };
  FILL_PROMPT: {
    payload: { text: string };
    response: { success: boolean };
  };
}

export interface ModelRecommendation {
  currentModel: string;
  recommendedModel: string;
  confidence: number;
  reason: string;
  url: string;
  topTools?: Array<{
    name: string;
    rank: number;
    url?: string;
  }>;
}

export type MessageType = keyof MessageMap;

export interface Message<T extends MessageType = MessageType> {
  type: T;
  payload: MessageMap[T]['payload'];
  requestId: string;
}

export interface MessageResponse<T extends MessageType = MessageType> {
  success: boolean;
  data?: MessageMap[T]['response'];
  error?: string;
  requestId: string;
}
