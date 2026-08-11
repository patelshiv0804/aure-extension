// ──────────────────────────────────────────────────────────────
// AI Model Metadata
// ──────────────────────────────────────────────────────────────

export interface AIModelInfo {
  id: string;
  name: string;
  provider: string;
  icon: string;
  color: string;
  url: string;
  strengths: string[];
  hostnames: string[];
}

export const AI_MODELS: AIModelInfo[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    provider: 'OpenAI',
    icon: '🟢',
    color: '#10a37f',
    url: 'https://chatgpt.com/',
    strengths: ['reasoning', 'coding', 'general', 'analysis'],
    hostnames: ['chat.openai.com', 'chatgpt.com'],
  },
  {
    id: 'claude',
    name: 'Claude',
    provider: 'Anthropic',
    icon: '🟤',
    color: '#d4a574',
    url: 'https://claude.ai/',
    strengths: ['creative writing', 'coding', 'analysis', 'long-form'],
    hostnames: ['claude.ai'],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    provider: 'Google',
    icon: '🔵',
    color: '#4285f4',
    url: 'https://gemini.google.com/',
    strengths: ['multimodal', 'reasoning', 'research', 'coding'],
    hostnames: ['gemini.google.com'],
  },
  {
    id: 'grok',
    name: 'Grok',
    provider: 'xAI',
    icon: '⚡',
    color: '#1d9bf0',
    url: 'https://grok.com/',
    strengths: ['brainstorming', 'humor', 'real-time', 'creative'],
    hostnames: ['x.com', 'grok.com'],
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    provider: 'Perplexity AI',
    icon: '🔍',
    color: '#20808d',
    url: 'https://www.perplexity.ai/',
    strengths: ['research', 'search', 'factual', 'citations'],
    hostnames: ['www.perplexity.ai', 'perplexity.ai'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    provider: 'DeepSeek',
    icon: '🐋',
    color: '#4f6ef7',
    url: 'https://chat.deepseek.com/',
    strengths: ['coding', 'reasoning', 'math', 'analysis'],
    hostnames: ['chat.deepseek.com'],
  },
  {
    id: 'copilot',
    name: 'Copilot',
    provider: 'Microsoft',
    icon: '🪟',
    color: '#0078d4',
    url: 'https://copilot.microsoft.com/',
    strengths: ['general', 'search', 'productivity', 'coding'],
    hostnames: ['copilot.microsoft.com'],
  },
];

export const MODEL_MAP = Object.fromEntries(
  AI_MODELS.map((m) => [m.id, m])
) as Record<string, AIModelInfo>;

/**
 * Find which AI model the user is currently on based on hostname.
 */
export function detectCurrentModel(hostname: string): AIModelInfo | undefined {
  return AI_MODELS.find((m) =>
    m.hostnames.some((h) => hostname.includes(h))
  );
}
