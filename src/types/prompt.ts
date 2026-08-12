// ──────────────────────────────────────────────────────────────
// Prompt & Version Types
// ──────────────────────────────────────────────────────────────

import type { EnhancementMode, PromptCategory } from './enhancement';

export interface DimensionScore {
  name: string;
  before: number;
  after: number;
  score?: number;
}

export interface PromptToolRecommendation {
  name: string;
  rank: number;
  url?: string;
}

export interface PromptAnalysisData {
  beforeScore: number;
  afterScore: number;
  gradeBefore?: string;
  gradeAfter?: string;
  dimensions: DimensionScore[];
  recommendations: PromptToolRecommendation[];
  improvements?: string[];
}

export interface Prompt {
  id: string;
  title: string;
  originalText: string;
  enhancedText?: string;
  category: PromptCategory;
  mode: EnhancementMode;
  platform: string;
  aiModel: string;
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  isPinned: boolean;
  successScore?: number;
  analysisData?: PromptAnalysisData;
  tags?: string[];
}

export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  text: string;
  source: 'user' | 'enhanced' | 'edited';
  mode?: EnhancementMode;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface PromptHistoryFilters {
  timeRange?: 'today' | 'week' | 'month' | 'all';
  category?: PromptCategory;
  aiModel?: string;
  mode?: EnhancementMode;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PromptHistoryResult {
  prompts: Prompt[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface PromptDiff {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}
