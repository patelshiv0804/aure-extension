// ──────────────────────────────────────────────────────────────
// API Client — Centralized HTTP client with retry & interceptors
// ──────────────────────────────────────────────────────────────

import { getStorage } from '@/lib/storage';
import { getAuthCookie } from '@/lib/cookies';
import { checkRateLimit, getRetryAfter } from '@/lib/rate-limiter';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
  rateLimitKey?: string;
  retries?: number;
}

const DEFAULT_TIMEOUT = 120_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000;

/**
 * Get the configured API base URL.
 */
async function getBaseUrl(): Promise<string> {
  const settings = await getStorage('settings');
  const endpoint = (settings?.advanced as any)?.apiEndpoint || 'http://127.0.0.1:8000/api/v1';
  return endpoint.replace(/\/$/, '');
}

/**
 * Get the stored API token from HTTP cookie or storage.
 */
async function getApiToken(): Promise<string | undefined> {
  const cookieToken = await getAuthCookie();
  if (cookieToken) return cookieToken;
  const promptiqToken = await getStorage('promptiq_token');
  if (promptiqToken) return promptiqToken;
  const storageToken = await getStorage('apiToken');
  return storageToken;
}

/**
 * Make an authenticated API request with retry logic and cookie credentials.
 */
export async function apiRequest<T>(config: RequestConfig): Promise<T> {
  // Rate limit check
  if (config.rateLimitKey && !checkRateLimit(config.rateLimitKey)) {
    const retryAfter = getRetryAfter(config.rateLimitKey);
    throw new ApiError(
      `Rate limit exceeded. Try again in ${Math.ceil(retryAfter / 1000)}s.`,
      429,
      'RATE_LIMITED',
      retryAfter
    );
  }

  const baseUrl = await getBaseUrl();
  const token = await getApiToken();
  const storedEmail = await getStorage('currentUserEmail');
  const profile = await getStorage('userProfile');
  const currentUserEmail = (typeof storedEmail === 'string' && storedEmail.trim())
    ? storedEmail.trim()
    : profile?.email;

  let url = `${baseUrl}${config.path}`;

  // Append query params
  if (config.params) {
    const searchParams = new URLSearchParams(config.params);
    url += `?${searchParams.toString()}`;
  }

  const isFormBody = config.body instanceof URLSearchParams || config.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormBody ? {} : { 'Content-Type': 'application/json' }),
    ...config.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (currentUserEmail) {
    headers['X-Current-User'] = currentUserEmail;
  }

  const retries = config.retries ?? MAX_RETRIES;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        config.timeout ?? DEFAULT_TIMEOUT
      );

      const response = await fetch(url, {
        method: config.method,
        headers,
        body: config.body ? (isFormBody ? (config.body as BodyInit) : JSON.stringify(config.body)) : undefined,
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let errorMessage = `API error: ${response.status}`;
        try {
          const parsed = JSON.parse(errorBody);
          const detail = parsed.detail ?? parsed.message ?? parsed.error;
          errorMessage = typeof detail === 'string' ? detail : JSON.stringify(detail ?? errorMessage);
        } catch {
          // use default error message
        }

        // Don't retry on client errors (except 429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new ApiError(errorMessage, response.status);
        }

        // Retry on 429 and 5xx
        if (attempt < retries) {
          const delay = response.status === 429
            ? parseInt(response.headers.get('Retry-After') ?? '5') * 1000
            : RETRY_BASE_DELAY * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        throw new ApiError(errorMessage, response.status);
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      if (error instanceof DOMException && error.name === 'AbortError') {
        if (attempt < retries) {
          await sleep(RETRY_BASE_DELAY * Math.pow(2, attempt));
          continue;
        }
        throw new ApiError('Request timed out', 408, 'TIMEOUT');
      }

      if (attempt < retries) {
        await sleep(RETRY_BASE_DELAY * Math.pow(2, attempt));
        continue;
      }

      throw new ApiError(
        error instanceof Error ? error.message : 'Unknown network error',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  throw new ApiError('Max retries exceeded', 0, 'MAX_RETRIES');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
