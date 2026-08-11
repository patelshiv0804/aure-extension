// ──────────────────────────────────────────────────────────────
// API Types — Request/Response contracts
// ──────────────────────────────────────────────────────────────

import type { EnhancementMode, PromptCategory, EnhancementMetrics } from '@/types/enhancement';

// ── Enhance API ─────────────────────────────────────────────

export interface EnhanceApiRequest {
  prompt: string;
  mode: EnhancementMode;
  role?: string;
  variables?: Record<string, string>;
  apply_style?: boolean;
  style_profile_id?: string;
  context?: {
    platform?: string;
    previousPrompts?: string[];
    customTemplate?: string;
  };
}

export interface EnhanceApiResponse {
  success?: boolean;
  message?: string;
  data?: BackendEnhanceData;
  enhanced_prompt: string;
  original_prompt: string;
  mode: EnhancementMode;
  category: PromptCategory;
  metrics: {
    clarity: number;
    specificity: number;
    context: number;
    success_probability: number;
    word_count_original: number;
    word_count_enhanced: number;
    token_count_original: number;
    token_count_enhanced: number;
    readability_original: number;
    readability_enhanced: number;
  };
  suggestions: string[];
  prompt_id: string;
}

export interface BackendEnhanceData {
  original_prompt: string;
  enhanced_prompt: string;
  analysis?: {
    overall_score?: number;
    grade?: string;
  };
  comparison?: {
    before_score?: number;
    after_score?: number;
    grade_before?: string;
    grade_after?: string;
    improvements?: string[];
  };
  template?: {
    id?: string;
    title?: string;
    similarity?: number;
  };
  version?: {
    prompt_id?: string;
    version_number?: number;
  };
  tool_recommendations?: BackendToolRecommendation;
  original_analysis?: Record<string, unknown>;
  enhanced_analysis?: Record<string, unknown>;
}

// ── Save Version API ────────────────────────────────────────

export interface SaveVersionApiRequest {
  prompt_id: string;
  text: string;
  version: number;
  source: 'user' | 'enhanced' | 'edited';
  mode?: EnhancementMode;
  metadata?: Record<string, unknown>;
}

export interface SaveVersionApiResponse {
  success?: boolean;
  message?: string;
  data?: {
    id: string;
  };
  version_id: string;
}

// ── Get Versions API ────────────────────────────────────────

export interface GetVersionsApiResponse {
  success?: boolean;
  message?: string;
  data?: Array<{
    id: string;
    version_number: number;
    version_type?: 'user' | 'enhanced' | 'edited' | string;
    content?: string;
    change_summary?: string;
    created_at: string;
  }>;
  versions: Array<{
    id: string;
    prompt_id: string;
    version: number;
    text: string;
    source: 'user' | 'enhanced' | 'edited';
    mode?: EnhancementMode;
    created_at: string;
    metadata?: Record<string, unknown>;
  }>;
}

// ── Prompt History API ──────────────────────────────────────

export interface HistoryApiRequest {
  page?: number;
  limit?: number;
  time_range?: 'today' | 'week' | 'month' | 'all';
  category?: PromptCategory;
  ai_model?: string;
  search?: string;
}

export interface HistoryApiResponse {
  success?: boolean;
  message?: string;
  data?: BackendPromptSummary[];
  page_size?: number;
  prompts: Array<{
    id: string;
    title: string;
    original_text: string;
    enhanced_text?: string;
    category: PromptCategory;
    mode: EnhancementMode;
    platform: string;
    ai_model: string;
    created_at: string;
    updated_at: string;
    is_favorite: boolean;
    is_pinned: boolean;
    success_score?: number;
    tags?: string[];
  }>;
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface BackendPromptSummary {
  id: string;
  title?: string;
  original_prompt?: string;
  template?: {
    role?: string;
    mode?: string;
    title?: string;
  };
  ai_model?: {
    model_name?: string;
    provider?: string;
  };
  current_version?: {
    content?: string;
    version_number?: number;
    version_type?: string;
    created_at?: string;
  };
  old_analysis?: Record<string, unknown>;
  new_analysis?: Record<string, unknown>;
  grade?: string;
  tool_recommendations?: BackendToolRecommendation;
  created_at: string;
  updated_at: string;
}

// ── Recommend Model API ─────────────────────────────────────

export interface RecommendModelApiRequest {
  prompt: string;
  category: string;
  current_model: string;
}

export interface RecommendModelApiResponse {
  matched_task?: string;
  match_type?: string;
  match_confidence?: number;
  tools?: Array<{
    name: string;
    rank: number;
  }>;
  current_model: string;
  recommended_model: string;
  confidence: number;
  reason: string;
  url: string;
}

export interface BackendToolRecommendation {
  matched_task: string;
  match_type: string;
  match_confidence: number;
  tools: Array<{
    name: string;
    rank: number;
  }>;
}
