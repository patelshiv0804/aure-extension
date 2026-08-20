import { apiRequest, apiStreamRequest } from './client';
import { enhanceCache, historyCache } from '@/lib/cache';
import { formatPromptText } from '@/lib/formatter';
import type { EnhanceApiRequest, EnhanceApiResponse } from './types';
import type { EnhanceResult, PromptCategory, EnhancementMode } from '@/types/enhancement';
import { MODEL_MAP, AI_MODELS } from '@/constants/models';

export interface EnhanceProgressCallback {
  (progress: number, stage: string, message: string): void;
}

/**
 * Call the enhancement API (POST /enhance) with real-time UI progress stages.
 */
export async function enhancePromptStream(
  request: EnhanceApiRequest,
  onProgress: EnhanceProgressCallback,
  signal?: AbortSignal
): Promise<EnhanceResult> {
  // Smooth simulated progress stages for UI responsiveness while backend processes
  onProgress(15, 'INIT', 'Analyzing Requirements...');
  const timer1 = setTimeout(() => {
    if (!signal?.aborted) onProgress(40, 'TEMPLATE', 'Matching Template...');
  }, 400);
  const timer2 = setTimeout(() => {
    if (!signal?.aborted) onProgress(70, 'OPTIMIZING', 'Optimizing Prompt...');
  }, 1200);
  const timer3 = setTimeout(() => {
    if (!signal?.aborted) onProgress(88, 'SCORING', 'Evaluating Quality...');
  }, 2200);

  try {
    const result = await enhancePrompt(request, signal);
    clearTimeout(timer1);
    clearTimeout(timer2);
    clearTimeout(timer3);
    onProgress(100, 'COMPLETE', 'Prompt enhanced successfully');
    return result;
  } catch (err) {
    clearTimeout(timer1);
    clearTimeout(timer2);
    clearTimeout(timer3);
    throw err;
  }
}

/**
 * Explicitly save an enhanced prompt to the database vault.
 */
export async function saveEnhancedPrompt(data: {
  original_prompt: string;
  enhanced_prompt: string;
  template_id?: string;
  title?: string;
  old_analysis?: any;
  new_analysis?: any;
  grade?: string;
  tool_recommendations?: any;
  role?: string;
  mode?: string;
}): Promise<{ success: boolean; prompt_id: string }> {
  const response = await apiRequest<{ success: boolean; message: string; prompt_id: string }>({
    method: 'POST',
    path: '/save',
    body: data,
    rateLimitKey: 'save',
  });
  historyCache.clear();
  return { success: response.success, prompt_id: response.prompt_id };
}

/**
 * Call the enhancement API to improve a prompt.
 * Results are cached by prompt+mode for 10 minutes.
 */
export async function enhancePrompt(request: EnhanceApiRequest, signal?: AbortSignal): Promise<EnhanceResult> {
  const cacheKey = `enhance:${request.mode}:${request.prompt}`;
  const cached = enhanceCache.get(cacheKey) as EnhanceResult | undefined;
  if (cached && !signal?.aborted) return cached;

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
      auto_save: false,
    },
    rateLimitKey: 'enhance',
    timeout: 90_000,
    signal,
  });

  const backendData = response.data;
  if (backendData) {
    const formattedOriginal = formatPromptText(backendData.original_prompt);
    const formattedEnhanced = formatPromptText(backendData.enhanced_prompt);
    const originalWords = formattedOriginal.split(/\s+/).filter(Boolean).length;
    const enhancedWords = formattedEnhanced.split(/\s+/).filter(Boolean).length;
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

    const promptId =
      backendData.version?.prompt_id ??
      (backendData as any).prompt_id ??
      response.prompt_id ??
      undefined;

    const result: EnhanceResult = {
      promptId,
      originalPrompt: formattedOriginal,
      enhancedPrompt: formattedEnhanced,
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
      category: detectCategory(formattedOriginal),
      suggestions: backendData.comparison?.improvements ?? [],
      timestamp: Date.now(),
      originalAnalysis: origAnalysis,
      enhancedAnalysis: enhAnalysis,
      toolRecommendations: toolRecs,
    };

    enhanceCache.set(cacheKey, result);
    historyCache.clear();
    return result;
  }

  if (!response.enhanced_prompt) {
    throw new Error('Backend did not return an enhanced prompt.');
  }

  const formattedOriginal = formatPromptText(response.original_prompt);
  const formattedEnhanced = formatPromptText(response.enhanced_prompt);

  const result: EnhanceResult = {
    promptId: response.prompt_id || undefined,
    originalPrompt: formattedOriginal,
    enhancedPrompt: formattedEnhanced,
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
  historyCache.clear();
  return result;
}

/**
 * Call the backend re-enhancement API: POST /api/v1/prompts/{prompt_id}/reenhance
 */
export async function reenhancePrompt(
  promptId: string,
  fallback?: { prompt: string; mode: EnhancementMode; role?: string },
  signal?: AbortSignal
): Promise<EnhanceResult> {
  if (promptId) {
    try {
      const response = await apiRequest<{
        success?: boolean;
        message?: string;
        data?: {
          prompt_id: string;
          version_id: string;
          version_number: number;
          enhanced_prompt: string;
          template_id?: string;
          old_analysis?: any;
          new_analysis?: any;
          tool_recommendations?: any;
        };
      }>({
        method: 'POST',
        path: `/prompts/${promptId}/reenhance`,
        body: {},
        rateLimitKey: 'enhance',
        timeout: 90_000,
        signal,
      });

      const backendData = response.data;
      if (backendData && backendData.enhanced_prompt) {
        const formattedEnhanced = formatPromptText(backendData.enhanced_prompt);
        const enhancedWords = formattedEnhanced.split(/\s+/).filter(Boolean).length;
        const origAnalysis = backendData.old_analysis;
        const enhAnalysis = backendData.new_analysis;

        const beforeScore = normalizeScore(origAnalysis?.overall_score ?? 0);
        const afterScore = normalizeScore(enhAnalysis?.overall_score ?? beforeScore);
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

        const originalText = fallback?.prompt ? formatPromptText(fallback.prompt) : '';
        const originalWords = originalText ? originalText.split(/\s+/).filter(Boolean).length : enhancedWords;

        const result: EnhanceResult = {
          promptId: backendData.prompt_id,
          originalPrompt: originalText,
          enhancedPrompt: formattedEnhanced,
          mode: fallback?.mode ?? 'general',
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
          category: detectCategory(formattedEnhanced),
          suggestions: [],
          timestamp: Date.now(),
          originalAnalysis: origAnalysis,
          enhancedAnalysis: enhAnalysis,
          toolRecommendations: toolRecs,
        };

        historyCache.clear();
        return result;
      }
    } catch (err) {
      console.warn('[AURE] Re-enhance via /prompts/{id}/reenhance failed, falling back to enhancePrompt:', err);
      if (!fallback || !fallback.prompt) throw err;
    }
  }

  if (fallback && fallback.prompt) {
    return await enhancePrompt({
      prompt: fallback.prompt,
      mode: fallback.mode,
      role: fallback.role,
    });
  }

  throw new Error('Cannot re-enhance prompt: missing prompt data');
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
