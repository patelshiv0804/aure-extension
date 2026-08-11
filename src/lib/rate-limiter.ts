// ──────────────────────────────────────────────────────────────
// Token Bucket Rate Limiter
// ──────────────────────────────────────────────────────────────

interface RateLimitConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  enhance: { maxTokens: 10, refillRate: 0.167 },      // 10 per minute
  history: { maxTokens: 30, refillRate: 0.5 },         // 30 per minute
  recommend: { maxTokens: 15, refillRate: 0.25 },      // 15 per minute
  version: { maxTokens: 20, refillRate: 0.333 },       // 20 per minute
  default: { maxTokens: 60, refillRate: 1 },           // 60 per minute
};

/**
 * Check if an action is allowed under rate limiting.
 * Returns true if allowed, false if rate-limited.
 */
export function checkRateLimit(action: string): boolean {
  const config = DEFAULT_CONFIGS[action] ?? DEFAULT_CONFIGS.default;
  const now = Date.now();

  let bucket = buckets.get(action);
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now };
    buckets.set(action, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

/**
 * Get the time in ms until the next token is available.
 */
export function getRetryAfter(action: string): number {
  const config = DEFAULT_CONFIGS[action] ?? DEFAULT_CONFIGS.default;
  const bucket = buckets.get(action);

  if (!bucket) return 0;

  const tokensNeeded = 1 - bucket.tokens;
  if (tokensNeeded <= 0) return 0;

  return Math.ceil((tokensNeeded / config.refillRate) * 1000);
}

/**
 * Reset rate limit for an action (e.g., after auth refresh).
 */
export function resetRateLimit(action: string): void {
  buckets.delete(action);
}
