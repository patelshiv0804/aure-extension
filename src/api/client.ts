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
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT = 120_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000;

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

/**
 * Get the configured API base URL.
 * Enforces HTTPS for all remote endpoints (AURE-02).
 */
async function getBaseUrl(): Promise<string> {
  const settings = await getStorage('settings');
  const endpoint = (settings?.advanced as any)?.apiEndpoint || 'http://127.0.0.1:8000/api/v1';
  try {
    const url = new URL(endpoint);
    if (!isLoopbackHost(url.hostname) && url.protocol !== 'https:') {
      console.warn(`[AURE Security] Enforcing HTTPS for non-loopback API endpoint: ${endpoint}`);
      return `https://${url.host}${url.pathname}`.replace(/\/$/, '');
    }
  } catch {}
  return endpoint.replace(/\/$/, '');
}

/**
 * Get the stored API token from storage or HTTP cookie.
 */
async function getApiToken(): Promise<string | undefined> {
  const storedToken = (await getStorage('promptiq_token')) || (await getStorage('apiToken'));
  if (storedToken && typeof storedToken === 'string' && storedToken.trim() !== '') {
    return storedToken.trim();
  }
  const cookieToken = await getAuthCookie();
  if (cookieToken && typeof cookieToken === 'string' && cookieToken.trim() !== '') {
    return cookieToken.trim();
  }
  return undefined;
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
    if (config.signal?.aborted) {
      throw new ApiError('Request cancelled by user', 499, 'CANCELLED');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        config.timeout ?? DEFAULT_TIMEOUT
      );

      const onUserAbort = () => {
        controller.abort(config.signal?.reason || 'User cancelled');
      };

      if (config.signal) {
        config.signal.addEventListener('abort', onUserAbort, { once: true });
      }

      let response: Response;
      try {
        response = await fetch(url, {
          method: config.method,
          headers,
          body: config.body ? (isFormBody ? (config.body as BodyInit) : JSON.stringify(config.body)) : undefined,
          credentials: 'include',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
        if (config.signal) {
          config.signal.removeEventListener('abort', onUserAbort);
        }
      }

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
        if (attempt < retries && !config.signal?.aborted) {
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

      if (config.signal?.aborted) {
        throw new ApiError('Request cancelled by user', 499, 'CANCELLED');
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        if (attempt < retries) {
          await sleep(RETRY_BASE_DELAY * Math.pow(2, attempt));
          continue;
        }
        throw new ApiError('Request timed out', 408, 'TIMEOUT');
      }

      if (attempt < retries && !config.signal?.aborted) {
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

export interface StreamEvent {
  event: string;
  data: any;
}

/**
 * Make an authenticated SSE Streaming API request with real-time event dispatching.
 */
export async function apiStreamRequest(
  config: RequestConfig,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const baseUrl = await getBaseUrl();
  const token = await getApiToken();
  const storedEmail = await getStorage('currentUserEmail');
  const profile = await getStorage('userProfile');
  const currentUserEmail =
    typeof storedEmail === 'string' && storedEmail.trim() ? storedEmail.trim() : profile?.email;

  let url = `${baseUrl}${config.path}`;
  if (config.params) {
    const searchParams = new URLSearchParams(config.params);
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...config.headers,
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (currentUserEmail) headers['X-Current-User'] = currentUserEmail;

  if (config.signal?.aborted) {
    throw new ApiError('Request cancelled by user', 499, 'CANCELLED');
  }

  const response = await fetch(url, {
    method: config.method,
    headers,
    body: config.body ? JSON.stringify(config.body) : undefined,
    credentials: 'include',
    signal: config.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let errorMessage = `API error: ${response.status}`;
    try {
      const parsed = JSON.parse(errorBody);
      errorMessage = parsed.detail ?? parsed.message ?? parsed.error ?? errorMessage;
    } catch {}
    throw new ApiError(errorMessage, response.status);
  }

  if (!response.body) {
    throw new ApiError('No response body for streaming request', 500);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (config.signal?.aborted) {
        await reader.cancel();
        throw new ApiError('Request cancelled by user', 499, 'CANCELLED');
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = 'message';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.slice(6).trim();
        } else if (trimmed.startsWith('data:')) {
          const rawData = trimmed.slice(5).trim();
          try {
            const parsedData = JSON.parse(rawData);
            onEvent({ event: currentEvent, data: parsedData });
          } catch {
            onEvent({ event: currentEvent, data: rawData });
          }
        }
      }
    }
  } catch (err) {
    if (config.signal?.aborted) {
      throw new ApiError('Request cancelled by user', 499, 'CANCELLED');
    }
    throw err;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
