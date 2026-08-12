// ──────────────────────────────────────────────────────────────
// History API — GET /prompt-history
// ──────────────────────────────────────────────────────────────

import { apiRequest } from './client';
import { historyCache } from '@/lib/cache';
import type { HistoryApiResponse } from './types';
import type { Prompt, PromptHistoryFilters, PromptHistoryResult } from '@/types/prompt';
import type { EnhancementMode, PromptCategory } from '@/types/enhancement';

export const DUMMY_PROMPTS: Prompt[] = [
  {
    id: 'dummy-1',
    title: 'Creative Content Strategy for Product Launch',
    originalText: 'Act as a creative content strategist with expertise in crafting engaging content.',
    enhancedText: 'Act as a Senior Creative Content Strategist. Your objective is to formulate a comprehensive 30-day content calendar for an AI SaaS product launch. Include target buyer personas, key messaging pillars, content formats (blog, LinkedIn, video), and KPIs to track engagement.',
    category: 'marketing',
    mode: 'creator',
    platform: 'ChatGPT',
    aiModel: 'gpt-4o',
    createdAt: Date.now() - 1000 * 60 * 30, // 30 mins ago
    updatedAt: Date.now() - 1000 * 60 * 30,
    isFavorite: true,
    isPinned: true,
    successScore: 94,
    tags: ['Content', 'SaaS', 'Marketing'],
  },
  {
    id: 'dummy-2',
    title: 'React & TypeScript Code Refactoring & Optimization',
    originalText: 'Refactor this React component to improve performance and code clarity.',
    enhancedText: 'Act as a Principal Frontend Engineer specializing in React 19 and TypeScript. Audit the provided component for unnecessary re-renders, memory leaks, and state mutations. Refactor it using useCallback, useMemo, and custom hooks where appropriate. Provide clean, production-ready code with inline documentation.',
    category: 'coding',
    mode: 'developer',
    platform: 'Claude',
    aiModel: 'claude-3-5-sonnet',
    createdAt: Date.now() - 1000 * 60 * 60 * 3, // 3 hours ago
    updatedAt: Date.now() - 1000 * 60 * 60 * 3,
    isFavorite: false,
    isPinned: false,
    successScore: 98,
    tags: ['React', 'TypeScript', 'Performance'],
  },
  {
    id: 'dummy-3',
    title: 'Market Analysis & Competitive Breakdown',
    originalText: 'Compare top 3 AI productivity extensions and write a report.',
    enhancedText: 'Act as a Lead Market Analyst. Conduct a detailed competitive analysis of the top 3 AI browser extensions in 2026. Focus on key differentiators, feature sets, pricing models, user sentiment, and growth strategies. Present findings in a structured Markdown matrix with executive summary.',
    category: 'analysis',
    mode: 'analyst',
    platform: 'Gemini',
    aiModel: 'gemini-1.5-pro',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    isFavorite: true,
    isPinned: false,
    successScore: 91,
    tags: ['Research', 'Market', 'Strategy'],
  },
  {
    id: 'dummy-4',
    title: 'Executive Email Pitch for B2B Partnership',
    originalText: 'Write a short email to pitch our new API to enterprise clients.',
    enhancedText: "Act as an Executive Business Copywriter. Draft a concise, high-converting cold email tailored for VP of Engineering leads. Highlight our API's 99.99% SLA uptime, 3x faster response speed, and seamless integration process. Keep it under 150 words with a compelling Call to Action.",
    category: 'business',
    mode: 'writer',
    platform: 'Grok',
    aiModel: 'grok-2',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5, // 5 days ago
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    isFavorite: false,
    isPinned: false,
    successScore: 89,
    tags: ['Email', 'B2B', 'Sales'],
  },
  {
    id: 'dummy-5',
    title: 'Quantum Computing & Neural Networks Research Summary',
    originalText: 'Explain quantum machine learning to a university student.',
    enhancedText: 'Act as an Expert Educator and Quantum Physicist. Explain the foundational concepts of Quantum Machine Learning (QML) for a computer science undergraduate. Breakdown quantum bits (qubits), superposition, entanglement, and variational quantum circuits using intuitive analogies and mathematical formulations.',
    category: 'education',
    mode: 'student',
    platform: 'Perplexity',
    aiModel: 'sonar-pro',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 15, // 15 days ago
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 15,
    isFavorite: true,
    isPinned: false,
    successScore: 96,
    tags: ['Quantum', 'AI', 'Education'],
  },
  {
    id: 'dummy-6',
    title: 'Design System Token Architecture & UI Kit',
    originalText: 'Help me design dark mode color palette for modern web application.',
    enhancedText: 'Act as a Design System Architect. Create a futuristic, accessible dark-mode color system tailored for modern web apps. Define core brand colors, glassmorphism surface tokens, semantic background layers, and WCAG AAA compliant text contrast ratios.',
    category: 'general',
    mode: 'designer',
    platform: 'ChatGPT',
    aiModel: 'gpt-4o',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 25, // 25 days ago
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 25,
    isFavorite: false,
    isPinned: false,
    successScore: 92,
    tags: ['Design', 'UI', 'Theme'],
  },
];

function getFilteredDummyPrompts(filters: PromptHistoryFilters): Prompt[] {
  const now = Date.now();
  return DUMMY_PROMPTS.filter((p) => {
    // Time filter
    if (filters.timeRange === 'today') {
      if (now - p.createdAt > 24 * 60 * 60 * 1000) return false;
    } else if (filters.timeRange === 'week') {
      if (now - p.createdAt > 7 * 24 * 60 * 60 * 1000) return false;
    } else if (filters.timeRange === 'month') {
      if (now - p.createdAt > 30 * 24 * 60 * 60 * 1000) return false;
    }

    // Search filter
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase();
      const titleMatch = p.title.toLowerCase().includes(q);
      const origMatch = p.originalText.toLowerCase().includes(q);
      const enhMatch = p.enhancedText ? p.enhancedText.toLowerCase().includes(q) : false;
      if (!titleMatch && !origMatch && !enhMatch) return false;
    }

    return true;
  });
}

/**
 * Fetch prompt history with filters.
 */
export async function getPromptHistory(
  filters: PromptHistoryFilters
): Promise<PromptHistoryResult> {
  const cacheKey = `history:${JSON.stringify(filters)}`;
  const cached = historyCache.get(cacheKey) as PromptHistoryResult | undefined;
  if (cached) return cached;

  try {
    const params: Record<string, string> = {};
    if (filters.page) params.page = String(filters.page);
    if (filters.limit) params.page_size = String(filters.limit);
    params.sort_by = 'created_at';
    params.sort_order = 'desc';

    const response = await apiRequest<HistoryApiResponse>({
      method: 'GET',
      path: '/prompts/',
      params,
      rateLimitKey: 'history',
    });

    if (response?.data) {
      const mappedPrompts = response.data.map((p) => {
        const originalText = p.original_prompt ?? p.title ?? 'Untitled prompt';
        const enhancedText = p.current_version?.content;
        const category = normalizeCategory(
          p.template?.role ?? p.template?.mode ?? p.title?.split(' - ')[0]
        );
        const mode = normalizeMode(p.template?.role ?? p.title?.split(' - ')[0]);
        const beforeScore = normalizeScore(
          (p.old_analysis?.overall_score as number | undefined) ??
          ((p as any).comparison?.before_score as number | undefined) ??
          65
        );
        const afterScore = normalizeScore(
          (p.new_analysis?.overall_score as number | undefined) ??
          ((p as any).comparison?.after_score as number | undefined) ??
          94
        );

        const oldAn = (p.old_analysis as any) ?? {};
        const newAn = (p.new_analysis as any) ?? {};

        const dimensions = [
          {
            name: 'Clarity',
            before: normalizeScore(oldAn.clarity ?? oldAn.metrics?.clarity ?? 85),
            after: normalizeScore(newAn.clarity ?? newAn.metrics?.clarity ?? 95),
          },
          {
            name: 'Context',
            before: normalizeScore(oldAn.context ?? oldAn.metrics?.context ?? 40),
            after: normalizeScore(newAn.context ?? newAn.metrics?.context ?? 100),
          },
          {
            name: 'Role',
            before: normalizeScore(oldAn.role ?? oldAn.metrics?.role ?? 10),
            after: normalizeScore(newAn.role ?? newAn.metrics?.role ?? 100),
          },
          {
            name: 'Format',
            before: normalizeScore(oldAn.format ?? oldAn.output_structure ?? 30),
            after: normalizeScore(newAn.format ?? newAn.output_structure ?? 100),
          },
          {
            name: 'Constraints',
            before: normalizeScore(oldAn.constraints ?? oldAn.metrics?.constraints ?? 20),
            after: normalizeScore(newAn.constraints ?? newAn.metrics?.constraints ?? 98),
          },
          {
            name: 'Examples',
            before: normalizeScore(oldAn.examples ?? oldAn.metrics?.examples ?? 0),
            after: normalizeScore(newAn.examples ?? newAn.metrics?.examples ?? 100),
          },
        ];

        const recsFromApi = (p as any).tool_recommendations?.tools ?? [
          { name: 'Claude', rank: 1, url: 'https://claude.ai/' },
          { name: 'ChatGPT', rank: 2, url: 'https://chatgpt.com/' },
          { name: 'Gemini', rank: 3, url: 'https://gemini.google.com/' },
        ];

        return {
          id: String(p.id),
          title: p.title ?? originalText.slice(0, 80),
          originalText,
          enhancedText,
          category,
          mode,
          platform: p.ai_model?.provider ?? 'PromptIQ',
          aiModel: p.ai_model?.model_name ?? 'PromptIQ',
          createdAt: new Date(p.created_at).getTime(),
          updatedAt: new Date(p.updated_at).getTime(),
          isFavorite: false,
          isPinned: false,
          successScore: afterScore || undefined,
          analysisData: {
            beforeScore,
            afterScore,
            dimensions,
            recommendations: recsFromApi.map((r: any) => ({
              name: r.name ?? 'AI Tool',
              rank: r.rank ?? 1,
              url: r.url ?? `https://www.google.com/search?q=${encodeURIComponent((r.name ?? 'AI Tool') + ' AI')}`,
            })),
            improvements: (p as any).comparison?.improvements ?? [
              'Enhanced clarity and domain role targeting',
              'Structured context, key objectives, and specific constraints',
              'Added clear formatting guidelines and multi-step output instructions',
            ],
          },
          tags: [category, mode].filter(Boolean),
        };
      }).filter((p) => {
        if (filters.timeRange && filters.timeRange !== 'all') {
          const maxAgeByRange = {
            today: 24 * 60 * 60 * 1000,
            week: 7 * 24 * 60 * 60 * 1000,
            month: 30 * 24 * 60 * 60 * 1000,
          } as const;
          if (Date.now() - p.createdAt > maxAgeByRange[filters.timeRange]) return false;
        }
        if (filters.category && p.category !== filters.category) return false;
        if (filters.aiModel && p.aiModel !== filters.aiModel) return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          return (
            p.title.toLowerCase().includes(q) ||
            p.originalText.toLowerCase().includes(q) ||
            p.enhancedText?.toLowerCase().includes(q)
          );
        }
        return true;
      });

      const result: PromptHistoryResult = {
        prompts: mappedPrompts,
        total: response.total,
        page: response.page,
        limit: response.page_size ?? filters.limit ?? 20,
        hasMore: response.page * (response.page_size ?? filters.limit ?? 20) < response.total,
      };

      historyCache.set(cacheKey, result);
      return result;
    }
  } catch (error) {
    console.warn('[AURE] API history fetch fallback to dummy data:', error);
  }

  // Return empty history when unauthenticated or fetch fails
  const result: PromptHistoryResult = {
    prompts: [],
    total: 0,
    page: 1,
    limit: 20,
    hasMore: false,
  };

  return result;
}

function normalizeMode(value?: string): EnhancementMode {
  const mode = value?.toLowerCase().trim();
  const modes: EnhancementMode[] = [
    'creator',
    'analyst',
    'student',
    'designer',
    'writer',
    'entrepreneur',
    'educator',
    'developer',
    'marketer',
    'consultant',
    'researcher',
    'custom',
  ];
  return modes.includes(mode as EnhancementMode) ? mode as EnhancementMode : 'custom';
}

function normalizeCategory(value?: string): PromptCategory {
  const category = value?.toLowerCase().trim().replace(/\s+/g, '_');
  const categories: PromptCategory[] = [
    'coding',
    'storytelling',
    'research',
    'marketing',
    'business',
    'legal',
    'education',
    'brainstorming',
    'image_generation',
    'video_generation',
    'analysis',
    'general',
  ];
  if (categories.includes(category as PromptCategory)) return category as PromptCategory;
  if (category === 'developer') return 'coding';
  if (category === 'marketer') return 'marketing';
  if (category === 'educator' || category === 'student') return 'education';
  if (category === 'analyst' || category === 'researcher') return 'analysis';
  if (category === 'entrepreneur' || category === 'consultant') return 'business';
  return 'general';
}

function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score <= 10 ? Math.round(score * 10) : Math.round(score)));
}
