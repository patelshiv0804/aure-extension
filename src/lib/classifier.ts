// ──────────────────────────────────────────────────────────────
// Client-Side Prompt Classifier
// Lightweight keyword-based categorization for instant UI feedback.
// The backend provides authoritative classification.
// ──────────────────────────────────────────────────────────────

import type { PromptCategory, EnhancementMode, CategoryClassification } from '@/types/enhancement';

interface CategoryRule {
  category: PromptCategory;
  keywords: string[];
  weight: number;
  suggestedMode: EnhancementMode;
  suggestedModel: string;
}

const RULES: CategoryRule[] = [
  {
    category: 'coding',
    keywords: [
      'code', 'function', 'api', 'debug', 'error', 'bug', 'implement', 'class',
      'typescript', 'javascript', 'python', 'react', 'sql', 'html', 'css',
      'algorithm', 'data structure', 'refactor', 'compile', 'build', 'deploy',
      'docker', 'kubernetes', 'git', 'database', 'backend', 'frontend', 'fix',
      'programming', 'software', 'component', 'module', 'import', 'export',
    ],
    weight: 1,
    suggestedMode: 'developer',
    suggestedModel: 'claude',
  },
  {
    category: 'storytelling',
    keywords: [
      'story', 'novel', 'character', 'plot', 'narrative', 'fiction', 'fantasy',
      'horror', 'romance', 'thriller', 'chapter', 'scene', 'dialogue', 'write',
      'creative', 'poem', 'script', 'screenplay', 'worldbuilding', 'protagonist',
      'villain', 'arc', 'setting', 'lore', 'tale', 'myth', 'legend', 'emotional',
    ],
    weight: 1,
    suggestedMode: 'writer',
    suggestedModel: 'claude',
  },
  {
    category: 'research',
    keywords: [
      'research', 'study', 'paper', 'journal', 'academic', 'thesis', 'hypothesis',
      'experiment', 'data', 'analysis', 'survey', 'methodology', 'literature',
      'review', 'citation', 'source', 'peer', 'scientific', 'evidence', 'findings',
      'explore', 'investigate', 'examine', 'compare', 'contrast',
    ],
    weight: 1,
    suggestedMode: 'researcher',
    suggestedModel: 'perplexity',
  },
  {
    category: 'marketing',
    keywords: [
      'marketing', 'ad', 'advertisement', 'campaign', 'seo', 'content',
      'copywriting', 'brand', 'audience', 'engagement', 'conversion', 'social media',
      'email', 'newsletter', 'headline', 'slogan', 'tagline', 'landing page',
      'cta', 'click', 'funnel', 'roi', 'growth', 'viral',
    ],
    weight: 1,
    suggestedMode: 'marketer',
    suggestedModel: 'chatgpt',
  },
  {
    category: 'business',
    keywords: [
      'business', 'proposal', 'report', 'meeting', 'strategy', 'plan',
      'executive', 'summary', 'stakeholder', 'revenue', 'profit', 'kpi',
      'presentation', 'slide', 'pitch', 'investor', 'memo', 'policy',
      'process', 'workflow', 'management', 'leadership', 'team',
    ],
    weight: 1,
    suggestedMode: 'consultant',
    suggestedModel: 'chatgpt',
  },
  {
    category: 'legal',
    keywords: [
      'legal', 'law', 'contract', 'agreement', 'clause', 'term', 'liability',
      'compliance', 'regulation', 'policy', 'rights', 'copyright', 'patent',
      'trademark', 'lawsuit', 'court', 'attorney', 'lawyer', 'dispute',
    ],
    weight: 1,
    suggestedMode: 'consultant',
    suggestedModel: 'claude',
  },
  {
    category: 'education',
    keywords: [
      'teach', 'learn', 'explain', 'tutorial', 'lesson', 'course', 'student',
      'teacher', 'curriculum', 'quiz', 'exam', 'assignment', 'homework',
      'grade', 'school', 'university', 'college', 'lecture', 'educate',
    ],
    weight: 1,
    suggestedMode: 'educator',
    suggestedModel: 'chatgpt',
  },
  {
    category: 'brainstorming',
    keywords: [
      'brainstorm', 'idea', 'suggest', 'list', 'options', 'alternatives',
      'creative', 'think', 'possibilities', 'inspiration', 'concept',
      'innovate', 'explore', 'what if', 'imagine', 'generate',
    ],
    weight: 0.8,
    suggestedMode: 'creator',
    suggestedModel: 'grok',
  },
  {
    category: 'image_generation',
    keywords: [
      'image', 'picture', 'photo', 'draw', 'illustration', 'art',
      'visual', 'design', 'graphic', 'logo', 'icon', 'render',
      'midjourney', 'dall-e', 'stable diffusion', 'generate image',
    ],
    weight: 1.2,
    suggestedMode: 'designer',
    suggestedModel: 'gemini',
  },
  {
    category: 'video_generation',
    keywords: [
      'video', 'animation', 'clip', 'footage', 'motion', 'film',
      'cinematic', 'edit video', 'generate video', 'sora', 'veo',
    ],
    weight: 1.2,
    suggestedMode: 'creator',
    suggestedModel: 'gemini',
  },
  {
    category: 'analysis',
    keywords: [
      'analyze', 'analysis', 'evaluate', 'assess', 'review', 'compare',
      'metrics', 'statistics', 'trend', 'insight', 'pattern', 'data',
      'chart', 'graph', 'performance', 'benchmark', 'optimize',
    ],
    weight: 1,
    suggestedMode: 'analyst',
    suggestedModel: 'chatgpt',
  },
];

/**
 * Classify a prompt into a category using keyword matching.
 * Returns instant feedback for UI; backend has authoritative classifier.
 */
export function classifyPrompt(prompt: string): CategoryClassification {
  const lower = prompt.toLowerCase();
  const words = lower.split(/\s+/);
  const scores: Record<string, number> = {};
  let maxScore = 0;
  let bestRule: CategoryRule = RULES[RULES.length - 1];

  for (const rule of RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (keyword.includes(' ')) {
        // Multi-word keyword: check substring
        if (lower.includes(keyword)) {
          score += 2 * rule.weight;
        }
      } else {
        // Single-word: check word boundary
        if (words.includes(keyword)) {
          score += 1 * rule.weight;
        }
      }
    }
    scores[rule.category] = score;

    if (score > maxScore) {
      maxScore = score;
      bestRule = rule;
    }
  }

  // Calculate confidence based on score relative to total keywords
  const totalKeywords = bestRule.keywords.length;
  const confidence = maxScore > 0
    ? Math.min(95, Math.round((maxScore / (totalKeywords * 0.3)) * 100))
    : 10;

  return {
    category: maxScore > 0 ? bestRule.category : 'general',
    confidence: maxScore > 0 ? confidence : 10,
    recommendedModel: maxScore > 0 ? bestRule.suggestedModel : 'chatgpt',
    enhancementMode: maxScore > 0 ? bestRule.suggestedMode : 'creator',
  };
}

/**
 * Get missing prompt elements and inline suggestions.
 */
export function getPromptSuggestions(prompt: string): string[] {
  const suggestions: string[] = [];
  const lower = prompt.toLowerCase();

  if (lower.length < 20) {
    suggestions.push('Add more detail to your prompt');
  }

  if (!/(for|audience|target|aimed at|users|readers)/i.test(lower)) {
    suggestions.push('Add target audience');
  }

  if (!/(format|structure|style|tone|voice)/i.test(lower)) {
    suggestions.push('Add desired output format');
  }

  if (!/(example|such as|like|e\.g\.|for instance)/i.test(lower)) {
    suggestions.push('Add examples for clarity');
  }

  if (!/(constraint|limit|avoid|don't|must not|should not|restrict)/i.test(lower)) {
    suggestions.push('Add constraints or boundaries');
  }

  if (!/(length|word|short|long|brief|detailed|comprehensive)/i.test(lower)) {
    suggestions.push('Specify desired length');
  }

  if (!/(step|first|then|next|finally|process)/i.test(lower)) {
    suggestions.push('Add step-by-step instructions');
  }

  return suggestions.slice(0, 5); // Max 5 suggestions
}
