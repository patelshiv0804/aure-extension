// ──────────────────────────────────────────────────────────────
// API Client — Centralized HTTP client with retry & interceptors
// ──────────────────────────────────────────────────────────────

import { getAuthCookie } from '@/lib/cookies';
import { resolveApiBaseUrl } from '@/lib/endpoint';
import { getToken } from '@/lib/token-store';
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

/**
 * Get the validated API base URL. The endpoint is resolved through the
 * allow-list in lib/endpoint.ts, which rejects untrusted hosts and enforces
 * HTTPS for remote endpoints (AURE-07 / AURE-02).
 */
async function getBaseUrl(): Promise<string> {
  return resolveApiBaseUrl();
}

/**
 * Get the stored API token from the secure session store or HTTP cookie.
 */
async function getApiToken(): Promise<string | undefined> {
  const sessionToken = await getToken();
  if (sessionToken) return sessionToken;

  const cookieToken = await getAuthCookie();
  if (cookieToken && typeof cookieToken === 'string' && cookieToken.trim() !== '') {
    return cookieToken.trim();
  }
  return undefined;
}

/**
 * Detect whether this code is running inside a content script injected into a
 * web page — as opposed to the background service worker or an extension page
 * (popup / side panel / options).
 *
 * Why it matters for CORS:
 *  - Background service worker: no `window` (ServiceWorkerGlobalScope). Its
 *    fetches to hosts in `host_permissions` BYPASS CORS entirely.
 *  - Extension pages: origin is `chrome-extension://<id>`, allowed by the
 *    backend's CORS_ORIGIN_REGEX.
 *  - Content script: runs in the host page (e.g. https://gemini.google.com), so
 *    the browser attaches the PAGE's origin and enforces CORS. That origin is
 *    not allowed by the backend, so a direct credentialed fetch fails the
 *    preflight with 400. Such requests must be proxied through the background.
 */
function isContentScriptContext(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof location !== 'undefined' &&
      location.protocol !== 'chrome-extension:' &&
      typeof chrome !== 'undefined' &&
      !!chrome.runtime?.id
    );
  } catch {
    return false;
  }
}

type SerializedBody = { kind: 'none' | 'json' | 'form'; value?: unknown };

/** Package a request body into a form that survives chrome.runtime messaging. */
function serializeBody(body: unknown): SerializedBody {
  if (body === undefined || body === null) return { kind: 'none' };
  if (body instanceof URLSearchParams) return { kind: 'form', value: body.toString() };
  if (body instanceof FormData) {
    const obj: Record<string, string> = {};
    body.forEach((v, k) => {
      obj[k] = String(v);
    });
    return { kind: 'form', value: new URLSearchParams(obj).toString() };
  }
  return { kind: 'json', value: body };
}

/**
 * Forward an API request to the background service worker, which performs the
 * actual (CORS-free) fetch. ApiError status codes are preserved across the
 * messaging boundary so callers (e.g. auth 401 handling) keep working.
 */
async function proxyRequestThroughBackground<T>(config: RequestConfig): Promise<T> {
  const body = serializeBody(config.body);
  const message = {
    type: 'API_REQUEST' as const,
    payload: {
      method: config.method,
      path: config.path,
      body: body.value,
      bodyKind: body.kind,
      params: config.params,
      headers: config.headers,
      rateLimitKey: config.rateLimitKey,
      retries: config.retries,
      timeout: config.timeout,
    },
    requestId: `api-${Date.now()}`,
  };

  const MAX_SEND_ATTEMPTS = 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      const response: any = await chrome.runtime.sendMessage(message);
      if (!response) throw new Error('No response from background service worker');
      if (!response.success) {
        throw new ApiError(response.error ?? 'Background messaging failed', 0, 'MESSAGING_ERROR');
      }
      const envelope = response.data as {
        ok: boolean;
        data?: unknown;
        error?: { message: string; status: number; code?: string; retryAfter?: number };
      };
      if (!envelope?.ok) {
        const e = envelope?.error ?? { message: 'API request failed', status: 0 };
        throw new ApiError(e.message, e.status ?? 0, e.code, e.retryAfter);
      }
      return envelope.data as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const portClosed =
        msg.includes('message port closed') ||
        msg.includes('Could not establish connection') ||
        msg.includes('Receiving end does not exist');
      if (portClosed && attempt < MAX_SEND_ATTEMPTS) {
        await sleep(300);
        continue;
      }
      throw new ApiError(msg, 0, 'NETWORK_ERROR');
    }
  }
  throw new ApiError(
    lastErr instanceof Error ? lastErr.message : 'Proxy failed',
    0,
    'NETWORK_ERROR'
  );
}

/**
 * Make an authenticated API request with retry logic and cookie credentials.
 */
export async function apiRequest<T>(config: RequestConfig): Promise<T> {
  // Content scripts run in the host page's origin (e.g. https://gemini.google.com)
  // and are subject to CORS. Forward to the background service worker, whose
  // fetches bypass CORS. No-op in the background / extension pages.
  if (isContentScriptContext()) {
    return proxyRequestThroughBackground<T>(config);
  }

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
