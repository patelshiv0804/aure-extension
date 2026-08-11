// ──────────────────────────────────────────────────────────────
// Client-Side Prompt Analytics
// ──────────────────────────────────────────────────────────────

export interface PromptAnalytics {
  wordCount: number;
  sentenceCount: number;
  charCount: number;
  tokenCount: number;
  readabilityScore: number;
  complexityScore: number;
  avgSentenceLength: number;
  vocabularyDiversity: number;
}

/**
 * Compute analytics for a prompt string.
 */
export function analyzePrompt(text: string): PromptAnalytics {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      charCount: 0,
      tokenCount: 0,
      readabilityScore: 0,
      complexityScore: 0,
      avgSentenceLength: 0,
      vocabularyDiversity: 0,
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const charCount = trimmed.length;
  const wordCount = words.length;
  const sentenceCount = Math.max(sentences.length, 1);

  // Estimated token count (approximation: ~1.3 tokens per word for English)
  const tokenCount = Math.ceil(wordCount * 1.3);

  // Syllable estimation for readability
  const totalSyllables = words.reduce((sum, word) => sum + estimateSyllables(word), 0);

  // Flesch-Kincaid Readability (0-100 scale, higher = easier to read)
  const avgSentenceLength = wordCount / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / Math.max(wordCount, 1);
  const readabilityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord)
    )
  );

  // Vocabulary diversity (unique words / total words)
  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z]/g, '')));
  const vocabularyDiversity = Math.round((uniqueWords.size / Math.max(wordCount, 1)) * 100);

  // Complexity score (0-100 based on sentence length variance + vocab diversity)
  const sentenceLengths = sentences.map((s) => s.trim().split(/\s+/).length);
  const sentenceLengthVariance = calculateVariance(sentenceLengths);
  const complexityScore = Math.min(
    100,
    Math.round(
      (avgSentenceLength * 2 + avgSyllablesPerWord * 15 + sentenceLengthVariance * 0.5) * 1.2
    )
  );

  return {
    wordCount,
    sentenceCount,
    charCount,
    tokenCount,
    readabilityScore,
    complexityScore,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    vocabularyDiversity,
  };
}

/**
 * Compare two prompts and calculate improvement metrics.
 */
export function calculateImprovements(
  original: PromptAnalytics,
  enhanced: PromptAnalytics
): Record<string, number> {
  return {
    clarity: calculateImprovement(original.readabilityScore, enhanced.readabilityScore),
    specificity: calculateImprovement(original.wordCount, enhanced.wordCount),
    context: calculateImprovement(original.sentenceCount * 10, enhanced.sentenceCount * 10),
    successProbability: Math.min(
      95,
      Math.round(
        (enhanced.readabilityScore * 0.3 +
          enhanced.vocabularyDiversity * 0.3 +
          Math.min(enhanced.wordCount / 2, 50) * 0.4)
      )
    ),
  };
}

// ── Helpers ──────────────────────────────────────────────────

function estimateSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length <= 3) return 1;

  let count = 0;
  const vowels = 'aeiouy';
  let prevVowel = false;

  for (const char of cleaned) {
    const isVowel = vowels.includes(char);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  // Adjust for silent 'e'
  if (cleaned.endsWith('e') && count > 1) count--;
  // Words like "le" at end
  if (cleaned.endsWith('le') && cleaned.length > 2 && !vowels.includes(cleaned[cleaned.length - 3])) {
    count++;
  }

  return Math.max(count, 1);
}

function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  return numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
}

function calculateImprovement(original: number, enhanced: number): number {
  if (original === 0) return enhanced > 0 ? 100 : 0;
  return Math.round(((enhanced - original) / original) * 100);
}
