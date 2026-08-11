// ──────────────────────────────────────────────────────────────
// Enhancement Types
// ──────────────────────────────────────────────────────────────

export type EnhancementMode =
  | 'general'
  | 'creator'
  | 'analyst'
  | 'student'
  | 'designer'
  | 'writer'
  | 'entrepreneur'
  | 'educator'
  | 'developer'
  | 'marketer'
  | 'consultant'
  | 'researcher'
  | 'custom'
  | (string & {});

export interface EnhancementModeConfig {
  id: EnhancementMode;
  label: string;
  icon: string;
  color: string;
  colorClass: string;
  description: string;
  examples: string[];
}

export interface EnhanceRequest {
  prompt: string;
  mode: EnhancementMode;
  context?: {
    platform: string;
    previousPrompts?: string[];
    customTemplate?: string;
  };
}

export interface DimensionDetail {
  score: number;
  explanation?: string;
  suggestions?: string[];
  weight?: number;
}

export interface PromptAnalysisData {
  overall_score?: number;
  grade?: string;
  summary?: string;
  dimensions?: {
    clarity?: DimensionDetail;
    context?: DimensionDetail;
    role_definition?: DimensionDetail;
    role?: DimensionDetail;
    output_format?: DimensionDetail;
    format?: DimensionDetail;
    constraints?: DimensionDetail;
    examples?: DimensionDetail;
    [key: string]: DimensionDetail | undefined;
  };
}

export interface RecommendedToolItem {
  name: string;
  rank: number;
  url?: string;
}

export interface EnhanceResult {
  originalPrompt: string;
  enhancedPrompt: string;
  mode: EnhancementMode;
  metrics: EnhancementMetrics;
  category: PromptCategory;
  suggestions: string[];
  timestamp: number;
  originalAnalysis?: PromptAnalysisData;
  enhancedAnalysis?: PromptAnalysisData;
  toolRecommendations?: RecommendedToolItem[];
}

export interface EnhancementMetrics {
  clarity: number;      // 0-100 improvement percentage
  specificity: number;
  context: number;
  successProbability: number;
  wordCountOriginal: number;
  wordCountEnhanced: number;
  tokenCountOriginal: number;
  tokenCountEnhanced: number;
  readabilityOriginal: number;
  readabilityEnhanced: number;
}

export type PromptCategory =
  | 'coding'
  | 'storytelling'
  | 'research'
  | 'marketing'
  | 'business'
  | 'legal'
  | 'education'
  | 'brainstorming'
  | 'image_generation'
  | 'video_generation'
  | 'analysis'
  | 'general';

export interface CategoryClassification {
  category: PromptCategory;
  confidence: number;
  recommendedModel: string;
  enhancementMode: EnhancementMode;
}

export type EnhanceFlowState =
  | 'idle'
  | 'selecting'
  | 'enhancing'
  | 'comparing'
  | 'injected'
  | 'error';
