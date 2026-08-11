// ──────────────────────────────────────────────────────────────
// Recommend Model API — POST /recommend-model
// ──────────────────────────────────────────────────────────────

import { apiRequest } from './client';
import { recommendCache } from '@/lib/cache';
import type { RecommendModelApiRequest, RecommendModelApiResponse } from './types';
import type { ModelRecommendation } from '@/types/messages';

import { MODEL_MAP, AI_MODELS } from '@/constants/models';

/**
 * Get a model recommendation based on prompt content.
 */
export async function recommendModel(
  request: RecommendModelApiRequest
): Promise<ModelRecommendation> {
  const cacheKey = `recommend:${request.category}:${request.prompt.slice(0, 100)}`;
  const cached = recommendCache.get(cacheKey) as ModelRecommendation | undefined;
  if (cached) return cached;

  const response = await apiRequest<RecommendModelApiResponse>({
    method: 'POST',
    path: '/tools/recommend',
    body: {
      prompt: request.prompt,
      mode: request.category,
    },
    rateLimitKey: 'recommend',
  });

  if (response.tools?.length) {
    const sortedTools = [...response.tools].sort((a, b) => a.rank - b.rank);
    const topTool = sortedTools[0];

    const topTools = sortedTools.map((t) => {
      const info = MODEL_MAP[t.name.toLowerCase()] ?? AI_MODELS.find(m => m.name.toLowerCase() === t.name.toLowerCase());
      return {
        name: t.name,
        rank: t.rank,
        url: info?.url ?? `https://www.google.com/search?q=${encodeURIComponent(t.name + ' AI')}`,
      };
    });

    const topInfo = MODEL_MAP[topTool.name.toLowerCase()] ?? AI_MODELS.find(m => m.name.toLowerCase() === topTool.name.toLowerCase());

    const result: ModelRecommendation = {
      currentModel: request.current_model,
      recommendedModel: topTool.name,
      confidence: Math.round((response.match_confidence ?? 0.7) * 100),
      reason: `Best match for ${response.matched_task ?? request.category}.`,
      url: topInfo?.url ?? '',
      topTools,
    };

    recommendCache.set(cacheKey, result);
    return result;
  }

  const result: ModelRecommendation = {
    currentModel: response.current_model,
    recommendedModel: response.recommended_model,
    confidence: response.confidence,
    reason: response.reason,
    url: response.url,
  };

  recommendCache.set(cacheKey, result);
  return result;
}
