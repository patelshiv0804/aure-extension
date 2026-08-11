// ──────────────────────────────────────────────────────────────
// Version API — POST /save-version, GET /versions/:id
// ──────────────────────────────────────────────────────────────

import { apiRequest } from './client';
import type {
  SaveVersionApiRequest,
  SaveVersionApiResponse,
  GetVersionsApiResponse,
} from './types';
import type { PromptVersion } from '@/types/prompt';

/**
 * Save a new prompt version to the backend.
 */
export async function saveVersion(
  request: SaveVersionApiRequest
): Promise<{ success: boolean; versionId: string }> {
  const response = await apiRequest<SaveVersionApiResponse>({
    method: 'POST',
    path: '/prompt-versions',
    params: { prompt_id: request.prompt_id },
    body: {
      version_number: request.version,
      version_type: request.source,
      content: request.text,
      change_summary: request.metadata?.change_summary as string | undefined,
    },
    rateLimitKey: 'version',
  });

  return {
    success: response.success ?? true,
    versionId: response.data?.id ?? response.version_id,
  };
}

/**
 * Get all versions for a prompt.
 */
export async function getVersions(promptId: string): Promise<PromptVersion[]> {
  try {
    const response = await apiRequest<GetVersionsApiResponse>({
      method: 'GET',
      path: `/prompts/${encodeURIComponent(promptId)}/versions`,
      rateLimitKey: 'version',
    });

    if (response?.data?.length) {
      return response.data.map((v) => ({
        id: v.id,
        promptId,
        version: v.version_number,
        text: v.content ?? v.change_summary ?? '',
        source: normalizeVersionSource(v.version_type),
        createdAt: new Date(v.created_at).getTime(),
      }));
    }

    if (response && response.versions && response.versions.length > 0) {
      return response.versions.map((v) => ({
        id: v.id,
        promptId: v.prompt_id,
        version: v.version,
        text: v.text,
        source: v.source,
        mode: v.mode,
        createdAt: new Date(v.created_at).getTime(),
        metadata: v.metadata,
      }));
    }
  } catch (error) {
    console.warn('[AURE] API versions fetch fallback to dummy data:', error);
  }

  // Fallback to dummy version history for UI testing
  return [
    {
      id: `${promptId}-v1`,
      promptId,
      version: 1,
      text: 'Act as a creative content strategist with expertise in crafting engaging content.',
      source: 'user',
      createdAt: Date.now() - 1000 * 60 * 45,
    },
    {
      id: `${promptId}-v2`,
      promptId,
      version: 2,
      text: 'Act as a Senior Creative Content Strategist. Formulate a 30-day content calendar for an AI SaaS product launch. Include buyer personas, content formats, and KPIs.',
      source: 'enhanced',
      mode: 'creator',
      createdAt: Date.now() - 1000 * 60 * 35,
    },
    {
      id: `${promptId}-v3`,
      promptId,
      version: 3,
      text: 'Act as a Senior Creative Content Strategist. Your objective is to formulate a comprehensive 30-day content calendar for an AI SaaS product launch. Include target buyer personas, key messaging pillars, content formats (blog, LinkedIn, video), and KPIs to track engagement.',
      source: 'edited',
      mode: 'creator',
      createdAt: Date.now() - 1000 * 60 * 30,
    },
  ];
}

function normalizeVersionSource(source?: string): 'user' | 'enhanced' | 'edited' {
  if (source === 'user' || source === 'enhanced' || source === 'edited') return source;
  if (source === 'original') return 'user';
  return 'enhanced';
}
