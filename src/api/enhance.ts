// ──────────────────────────────────────────────────────────────
// Enhance API — POST /enhance
// ──────────────────────────────────────────────────────────────

import { apiRequest } from './client';
import { enhanceCache } from '@/lib/cache';
import type { EnhanceApiRequest, EnhanceApiResponse } from './types';
import type { EnhanceResult, PromptCategory } from '@/types/enhancement';
import { MODEL_MAP, AI_MODELS } from '@/constants/models';

/**
 * Call the enhancement API to improve a prompt.
 * Results are cached by prompt+mode for 10 minutes.
 */
export async function enhancePrompt(request: EnhanceApiRequest): Promise<EnhanceResult> {
  const cacheKey = `enhance:${request.mode}:${request.prompt}`;
  const cached = enhanceCache.get(cacheKey) as EnhanceResult | undefined;
  if (cached) return cached;

  const response = await apiRequest<EnhanceApiResponse>({
    method: 'POST',
    path: '/enhance',
    body: {
      prompt: request.prompt,
      role: request.role ?? request.mode,
      mode: request.mode,
      variables: request.variables,
      apply_style: request.apply_style,
      style_profile_id: request.style_profile_id,
    },
    rateLimitKey: 'enhance',
    timeout: 90_000,
  });

  const backendData = response.data;
  if (backendData) {
    const originalWords = backendData.original_prompt.split(/\s+/).filter(Boolean).length;
    const enhancedWords = backendData.enhanced_prompt.split(/\s+/).filter(Boolean).length;
    const origAnalysis = (backendData.original_analysis ?? (backendData as any).old_analysis) as any;
    const enhAnalysis = (backendData.enhanced_analysis ?? (backendData as any).new_analysis) as any;

    const beforeScore = normalizeScore(
      origAnalysis?.overall_score ?? backendData.comparison?.before_score ?? backendData.analysis?.overall_score ?? 0
    );
    const afterScore = normalizeScore(
      enhAnalysis?.overall_score ?? backendData.comparison?.after_score ?? beforeScore
    );
    const improvementScore = Math.max(0, afterScore - beforeScore);

    const rawTools = backendData.tool_recommendations?.tools ?? [];
    const toolRecs = rawTools.map((t: any) => {
      const name = t.name ?? 'AI Tool';
      const info = MODEL_MAP[name.toLowerCase()] ?? AI_MODELS.find((m) => m.name.toLowerCase() === name.toLowerCase());
      return {
        name,
        rank: t.rank ?? 1,
        url: info?.url ?? `https://www.google.com/search?q=${encodeURIComponent(name + ' AI')}`,
      };
    });

    const result: EnhanceResult = {
      originalPrompt: backendData.original_prompt,
      enhancedPrompt: backendData.enhanced_prompt,
      mode: request.mode,
      metrics: {
        clarity: afterScore,
        specificity: Math.min(100, afterScore + Math.round(improvementScore / 2)),
        context: Math.min(100, afterScore + Math.round(improvementScore / 3)),
        successProbability: afterScore,
        wordCountOriginal: originalWords,
        wordCountEnhanced: enhancedWords,
        tokenCountOriginal: Math.ceil(originalWords * 1.3),
        tokenCountEnhanced: Math.ceil(enhancedWords * 1.3),
        readabilityOriginal: beforeScore,
        readabilityEnhanced: afterScore,
      },
      category: detectCategory(backendData.original_prompt),
      suggestions: backendData.comparison?.improvements ?? [],
      timestamp: Date.now(),
      originalAnalysis: origAnalysis,
      enhancedAnalysis: enhAnalysis,
      toolRecommendations: toolRecs,
    };

    enhanceCache.set(cacheKey, result);
    return result;
  }

  if (!response.enhanced_prompt) {
    throw new Error('Backend did not return an enhanced prompt.');
  }

  const result: EnhanceResult = {
    originalPrompt: response.original_prompt,
    enhancedPrompt: response.enhanced_prompt,
    mode: response.mode,
    metrics: {
      clarity: response.metrics.clarity,
      specificity: response.metrics.specificity,
      context: response.metrics.context,
      successProbability: response.metrics.success_probability,
      wordCountOriginal: response.metrics.word_count_original,
      wordCountEnhanced: response.metrics.word_count_enhanced,
      tokenCountOriginal: response.metrics.token_count_original,
      tokenCountEnhanced: response.metrics.token_count_enhanced,
      readabilityOriginal: response.metrics.readability_original,
      readabilityEnhanced: response.metrics.readability_enhanced,
    },
    category: response.category,
    suggestions: response.suggestions,
    timestamp: Date.now(),
  };

  enhanceCache.set(cacheKey, result);
  return result;
}

function detectCategory(prompt: string): PromptCategory {
  const lower = prompt.toLowerCase();
  if (/\b(code|function|api|debug|programming|javascript|python|react)\b/.test(lower)) return 'coding';
  if (/\b(story|write|essay|article|blog|creative|poem)\b/.test(lower)) return 'storytelling';
  if (/\b(research|study|analyze|paper|journal|science)\b/.test(lower)) return 'research';
  if (/\b(market|brand|campaign|advertis|social media|seo)\b/.test(lower)) return 'marketing';
  if (/\b(business|startup|revenue|strategy|plan|pitch)\b/.test(lower)) return 'business';
  if (/\b(image|design|logo|visual|draw|illustration|art)\b/.test(lower)) return 'image_generation';
  if (/\b(video|animation|clip|footage|film|cinematic)\b/.test(lower)) return 'video_generation';
  if (/\b(learn|teach|explain|course|lesson|education|student)\b/.test(lower)) return 'education';
  return 'general';
}

function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score <= 10 ? Math.round(score * 10) : Math.round(score)));
}
