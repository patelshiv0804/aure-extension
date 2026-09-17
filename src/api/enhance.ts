import { apiRequest, apiStreamRequest } from './client';
import { enhanceCache, historyCache } from '@/lib/cache';
import { formatPromptText } from '@/lib/formatter';
import type { EnhanceApiRequest, EnhanceApiResponse } from './types';
import type { EnhanceResult, PromptCategory, EnhancementMode } from '@/types/enhancement';
import { MODEL_MAP, AI_MODELS } from '@/constants/models';

export interface EnhanceStreamCallbacks {
  onProgress?: (progress: number, stage: string, message: string) => void;
  onToken?: (token: string, accumulated: string) => void;
  /** Called immediately when the raw stream tokens finish, BEFORE slow analysis polling.
   *  The result may lack quality analysis scores (they are filled in by subsequent polling).
   *  The background uses this to notify the content script early so it can show the UI
   *  without waiting for the analysis-polling phase which can time out the message port. */
  onStreamDone?: (result: EnhanceResult) => void;
}

export type EnhanceProgressCallback = (progress: number, stage: string, message: string) => void;

/**
 * Call the streaming enhancement API (POST /enhance/stream) with real-time SSE token delivery.
 */
export async function enhancePromptStream(
  request: EnhanceApiRequest,
  callbacksOrProgress: EnhanceStreamCallbacks | EnhanceProgressCallback,
  signal?: AbortSignal
): Promise<EnhanceResult> {
  const onProgress =
    typeof callbacksOrProgress === 'function'
      ? callbacksOrProgress
      : callbacksOrProgress?.onProgress;
  const onToken =
    typeof callbacksOrProgress === 'object'
      ? callbacksOrProgress?.onToken
      : undefined;
  const onStreamDone =
    typeof callbacksOrProgress === 'object'
      ? callbacksOrProgress?.onStreamDone
      : undefined;

  onProgress?.(10, 'INIT', 'Analyzing Requirements...');

  let accumulatedText = '';
  let metaData: any = null;
  let doneData: any = null;

  try {
    await apiStreamRequest(
      {
        method: 'POST',
        path: '/enhance/stream',
        body: {
          prompt: request.prompt,
          role: request.role ?? request.mode,
          mode: request.mode,
          variables: request.variables,
          apply_style: request.apply_style,
          style_profile_id: request.style_profile_id,
          enhancement_level: request.enhancement_level,
        },
        rateLimitKey: 'enhance',
        timeout: 90_000,
        signal,
      },
      (event) => {
        if (event.event === 'meta') {
          metaData = event.data;
          const templateTitle = metaData?.template?.title;
          onProgress?.(
            30,
            'TEMPLATE',
            templateTitle ? `Matched: ${templateTitle}` : 'Matching Template...'
          );
        } else if (event.event === 'token') {
          const delta =
            typeof event.data === 'object' && event.data !== null
              ? event.data.text ?? ''
              : String(event.data || '');
          if (delta) {
            accumulatedText += delta;
            onToken?.(delta, accumulatedText);
            const tokenPct = Math.min(94, 35 + Math.floor((accumulatedText.length / 300) * 55));
            onProgress?.(tokenPct, 'OPTIMIZING', 'Optimizing Prompt...');
          }
        } else if (event.event === 'done') {
          doneData = event.data;
          onProgress?.(96, 'SCORING', 'Evaluating Quality...');
        } else if (event.event === 'error') {
          const errDetail =
            event.data?.detail || event.data?.message || 'Streaming enhancement failed';
          throw new Error(typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail));
        }
      }
    );

    if (doneData) {
      const formattedOriginal = formatPromptText(doneData.original_prompt || request.prompt);
      const finalRawEnhanced = doneData.enhanced_prompt || accumulatedText;
      const formattedEnhanced = formatPromptText(finalRawEnhanced);
      const originalWords = formattedOriginal.split(/\s+/).filter(Boolean).length;
      const enhancedWords = formattedEnhanced.split(/\s+/).filter(Boolean).length;

      const promptId =
        doneData.version?.prompt_id ??
        (doneData as any).prompt_id ??
        undefined;

      let origAnalysis = (doneData.original_analysis ?? (doneData as any).old_analysis) as any;
      let enhAnalysis = (doneData.enhanced_analysis ?? (doneData as any).new_analysis) as any;
      let toolRecommendations: any = doneData.tool_recommendations;

      const rawTools = toolRecommendations?.tools ?? [];
      const toolRecs = rawTools.map((t: any) => {
        const name = t.name ?? 'AI Tool';
        const info =
          MODEL_MAP[name.toLowerCase()] ??
          AI_MODELS.find((m) => m.name.toLowerCase() === name.toLowerCase());
        return {
          name,
          rank: t.rank ?? 1,
          url: info?.url ?? `https://www.google.com/search?q=${encodeURIComponent(name + ' AI')}`,
        };
      });

      // ── Fire onStreamDone IMMEDIATELY with what we have so far ───────────
      // The content-script UI transitions to 'comparing' without waiting for
      // the slow analysis-polling phase which can take up to 36 s and causes
      // the Chrome message-port to close, triggering a false 'error' state.
      if (onStreamDone) {
        const earlyBeforeScore = normalizeScore(
          origAnalysis?.overall_score ?? doneData.comparison?.before_score ?? 0
        );
        const earlyAfterScore = normalizeScore(
          enhAnalysis?.overall_score ?? doneData.comparison?.after_score ?? (earlyBeforeScore || 85)
        );
        const earlyImprovement = Math.max(0, earlyAfterScore - earlyBeforeScore);
        onStreamDone({
          promptId,
          originalPrompt: formattedOriginal,
          enhancedPrompt: formattedEnhanced,
          mode: request.mode,
          metrics: {
            clarity: earlyAfterScore,
            specificity: Math.min(100, earlyAfterScore + Math.round(earlyImprovement / 2)),
            context: Math.min(100, earlyAfterScore + Math.round(earlyImprovement / 3)),
            successProbability: earlyAfterScore,
            wordCountOriginal: originalWords,
            wordCountEnhanced: enhancedWords,
            tokenCountOriginal: Math.ceil(originalWords * 1.3),
            tokenCountEnhanced: Math.ceil(enhancedWords * 1.3),
            readabilityOriginal: earlyBeforeScore,
            readabilityEnhanced: earlyAfterScore,
          },
          category: detectCategory(formattedOriginal),
          suggestions: doneData.comparison?.improvements ?? [],
          timestamp: Date.now(),
          originalAnalysis: origAnalysis,
          enhancedAnalysis: enhAnalysis,
          toolRecommendations: toolRecs,
        });
      }

      // Quality scores are processed in background task: poll DB until ready
      if (promptId && !hasAnalysis(enhAnalysis) && !signal?.aborted) {
        const fetched = await fetchEnhancedAnalysis(promptId, signal);
        if (fetched) {
          if (hasAnalysis(fetched.old_analysis)) origAnalysis = fetched.old_analysis;
          if (hasAnalysis(fetched.new_analysis)) enhAnalysis = fetched.new_analysis;
          if (fetched.tool_recommendations) toolRecommendations = fetched.tool_recommendations;
        }
      }

      const beforeScore = normalizeScore(
        origAnalysis?.overall_score ?? doneData.comparison?.before_score ?? 0
      );
      const afterScore = normalizeScore(
        enhAnalysis?.overall_score ?? doneData.comparison?.after_score ?? (beforeScore || 85)
      );
      const improvementScore = Math.max(0, afterScore - beforeScore);

      const finalToolRecs = (toolRecommendations?.tools ?? []).map((t: any) => {
        const name = t.name ?? 'AI Tool';
        const info =
          MODEL_MAP[name.toLowerCase()] ??
          AI_MODELS.find((m) => m.name.toLowerCase() === name.toLowerCase());
        return {
          name,
          rank: t.rank ?? 1,
          url: info?.url ?? `https://www.google.com/search?q=${encodeURIComponent(name + ' AI')}`,
        };
      });

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
        suggestions: doneData.comparison?.improvements ?? [],
        timestamp: Date.now(),
        originalAnalysis: origAnalysis,
        enhancedAnalysis: enhAnalysis,
        toolRecommendations: finalToolRecs,
        versionNumber: doneData.version?.version_number ?? 1,
        versionId: doneData.version?.id,
        detectedLevel: doneData.detected_level || metaData?.detected_level || request.enhancement_level || 'standard',
        levelReason: doneData.level_reason || metaData?.level_reason,
      };

      onProgress?.(100, 'COMPLETE', 'Prompt enhanced successfully');
      historyCache.clear();
      return result;
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('[AURE] /enhance/stream error, attempting fallback:', err);
    if (accumulatedText.length > 0) {
      // If we already accumulated tokens, use them
      const formattedOriginal = formatPromptText(request.prompt);
      const formattedEnhanced = formatPromptText(accumulatedText);
      return {
        promptId: undefined,
        originalPrompt: formattedOriginal,
        enhancedPrompt: formattedEnhanced,
        mode: request.mode,
        metrics: {
          clarity: 88,
          specificity: 90,
          context: 86,
          successProbability: 88,
          wordCountOriginal: formattedOriginal.split(/\s+/).filter(Boolean).length,
          wordCountEnhanced: formattedEnhanced.split(/\s+/).filter(Boolean).length,
          tokenCountOriginal: Math.ceil(formattedOriginal.length / 4),
          tokenCountEnhanced: Math.ceil(formattedEnhanced.length / 4),
          readabilityOriginal: 60,
          readabilityEnhanced: 88,
        },
        category: detectCategory(formattedOriginal),
        suggestions: [],
        timestamp: Date.now(),
      };
    }
  }

  // Graceful fallback to blocking endpoint if stream didn't produce tokens
  return await enhancePrompt(request, signal);
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
      enhancement_level: request.enhancement_level,
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

    const promptId =
      backendData.version?.prompt_id ??
      (backendData as any).prompt_id ??
      response.prompt_id ??
      undefined;

    // Analyses/tools as returned directly by /enhance (present on older backends).
    let origAnalysis = (backendData.original_analysis ?? (backendData as any).old_analysis) as any;
    let enhAnalysis = (backendData.enhanced_analysis ?? (backendData as any).new_analysis) as any;
    let toolRecommendations: any = backendData.tool_recommendations;

    // The /enhance endpoint now computes quality scores in a background task and
    // returns null analysis immediately. When that happens, fetch the real
    // scores from the DB by polling GET /prompts/{prompt_id} until the
    // background analysis lands. (Re-enhance is unaffected — it returns its
    // scores inline and never reaches this path.)
    if (promptId && !hasAnalysis(enhAnalysis) && !signal?.aborted) {
      const fetched = await fetchEnhancedAnalysis(promptId, signal);
      if (fetched) {
        if (hasAnalysis(fetched.old_analysis)) origAnalysis = fetched.old_analysis;
        if (hasAnalysis(fetched.new_analysis)) enhAnalysis = fetched.new_analysis;
        if (fetched.tool_recommendations) toolRecommendations = fetched.tool_recommendations;
      }
    }

    const beforeScore = normalizeScore(
      origAnalysis?.overall_score ?? backendData.comparison?.before_score ?? backendData.analysis?.overall_score ?? 0
    );
    const afterScore = normalizeScore(
      enhAnalysis?.overall_score ?? backendData.comparison?.after_score ?? beforeScore
    );
    const improvementScore = Math.max(0, afterScore - beforeScore);

    const rawTools = toolRecommendations?.tools ?? [];
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
      detectedLevel: (backendData as any).detected_level || request.enhancement_level || 'standard',
      levelReason: (backendData as any).level_reason,
    };

    // Only cache once the real scores have resolved, so a timed-out fetch does
    // not pin fallback scores for the full cache TTL. Never cache a cancelled run.
    if (!signal?.aborted && hasAnalysis(enhAnalysis)) {
      enhanceCache.set(cacheKey, result);
    }
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
          versionNumber: backendData.version_number ?? 2,
          versionId: backendData.version_id,
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

/**
 * Call the backend re-enhancement streaming API: POST /api/v1/prompts/{prompt_id}/reenhance/stream
 */
export async function reenhancePromptStream(
  promptId: string,
  fallback?: { prompt: string; mode: EnhancementMode; role?: string },
  callbacks?: EnhanceStreamCallbacks,
  signal?: AbortSignal
): Promise<EnhanceResult> {
  if (promptId) {
    let accumulatedText = '';
    let doneData: any = null;

    try {
      await apiStreamRequest(
        {
          method: 'POST',
          path: `/prompts/${promptId}/reenhance/stream`,
          body: {},
          rateLimitKey: 'enhance',
          timeout: 90_000,
          signal,
        },
        (event) => {
          if (event.event === 'token') {
            const delta =
              typeof event.data === 'object' && event.data !== null
                ? event.data.text ?? ''
                : String(event.data || '');
            if (delta) {
              accumulatedText += delta;
              callbacks?.onToken?.(delta, accumulatedText);
              const tokenPct = Math.min(94, 30 + Math.floor((accumulatedText.length / 300) * 60));
              callbacks?.onProgress?.(tokenPct, 'OPTIMIZING', 'Re-enhancing Prompt...');
            }
          } else if (event.event === 'done') {
            doneData = event.data;
            callbacks?.onProgress?.(96, 'SCORING', 'Evaluating Quality...');
          } else if (event.event === 'error') {
            const errDetail =
              event.data?.detail || event.data?.message || 'Streaming re-enhancement failed';
            throw new Error(typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail));
          }
        }
      );

      if (doneData && (doneData.enhanced_prompt || accumulatedText)) {
        const rawEnhanced = doneData.enhanced_prompt || accumulatedText;
        const formattedEnhanced = formatPromptText(rawEnhanced);
        const enhancedWords = formattedEnhanced.split(/\s+/).filter(Boolean).length;
        const origAnalysis = doneData.old_analysis;
        const enhAnalysis = doneData.new_analysis;

        const beforeScore = normalizeScore(origAnalysis?.overall_score ?? 0);
        const afterScore = normalizeScore(enhAnalysis?.overall_score ?? beforeScore);
        const improvementScore = Math.max(0, afterScore - beforeScore);

        const rawTools = doneData.tool_recommendations?.tools ?? [];
        const toolRecs = rawTools.map((t: any) => {
          const name = t.name ?? 'AI Tool';
          const info =
            MODEL_MAP[name.toLowerCase()] ??
            AI_MODELS.find((m) => m.name.toLowerCase() === name.toLowerCase());
          return {
            name,
            rank: t.rank ?? 1,
            url: info?.url ?? `https://www.google.com/search?q=${encodeURIComponent(name + ' AI')}`,
          };
        });

        const originalText = fallback?.prompt ? formatPromptText(fallback.prompt) : '';
        const originalWords = originalText ? originalText.split(/\s+/).filter(Boolean).length : enhancedWords;

        const result: EnhanceResult = {
          promptId: doneData.prompt_id || promptId,
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
          versionNumber: doneData.version_number ?? 2,
          versionId: doneData.version_id,
        };

        callbacks?.onProgress?.(100, 'COMPLETE', 'Re-enhanced successfully');
        historyCache.clear();
        return result;
      }
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn('[AURE] /prompts/{id}/reenhance/stream error, falling back to blocking:', err);
    }
  }

  return await reenhancePrompt(promptId, fallback, signal);
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
  // The backend scores every dimension and the overall score on a 0–100 scale
  // (see prompt_analysis_service.py). Round and clamp only — do NOT rescale
  // values <= 10, or a genuine low score like 10/100 wrongly becomes 100.
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * True when an analysis object carries real quality data (an overall score or
 * scored dimensions). Used to detect the background-task-pending state where
 * the /enhance response returns null/empty analysis.
 */
function hasAnalysis(analysis: any): boolean {
  if (!analysis || typeof analysis !== 'object') return false;
  if (typeof analysis.overall_score === 'number') return true;
  if (
    analysis.dimensions &&
    typeof analysis.dimensions === 'object' &&
    Object.keys(analysis.dimensions).length > 0
  ) {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PromptDetailData {
  old_analysis?: any;
  new_analysis?: any;
  grade?: string;
  tool_recommendations?: any;
}

/**
 * Poll GET /prompts/{prompt_id} until the background quality analysis has been
 * written to the DB, then return it. Returns null if the analysis never lands
 * within the polling window or the request is cancelled — the caller then keeps
 * whatever the /enhance response provided.
 *
 * Deliberately omits a rateLimitKey so this internal polling never consumes the
 * user-facing enhance/history rate-limit budget, and swallows transient errors
 * (network/5xx/not-ready) so a single hiccup doesn't abort the whole flow.
 */
async function fetchEnhancedAnalysis(
  promptId: string,
  signal?: AbortSignal
): Promise<PromptDetailData | null> {
  const MAX_ATTEMPTS = 24;
  const INTERVAL_MS = 1500;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) return null;

    try {
      const response = await apiRequest<{ success?: boolean; data?: PromptDetailData }>({
        method: 'GET',
        path: `/prompts/${encodeURIComponent(promptId)}`,
        timeout: 20_000,
        retries: 0,
        signal,
      });

      const data = response?.data;
      if (data && hasAnalysis(data.new_analysis)) {
        return data;
      }
    } catch (err: any) {
      // Cancelled mid-poll — stop immediately so the caller can finish and the
      // background service worker can clean up the persisted record.
      if (signal?.aborted || err?.code === 'CANCELLED') return null;
      // Otherwise a transient/not-ready error: fall through and retry.
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(INTERVAL_MS);
    }
  }

  return null;
}
