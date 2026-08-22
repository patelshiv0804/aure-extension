// ──────────────────────────────────────────────────────────────
// API Endpoint Resolution & Allow-list (AURE-07)
//
// settings.advanced.apiEndpoint is user-settable. Without validation, a
// malicious or mistaken value would cause the extension to attach the bearer
// token (and credentialed auth cookie) to an arbitrary host — a token
// exfiltration vector. Every consumer resolves the endpoint through this
// module, which rejects any host that is not explicitly allow-listed and
// falls back to the safe default instead.
// ──────────────────────────────────────────────────────────────

import { getStorage } from '@/lib/storage';

export const DEFAULT_API_BASE = 'http://127.0.0.1:8000/api/v1';
export const DEFAULT_API_ORIGIN = 'http://127.0.0.1:8000';

export function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

// Non-loopback hosts the extension is permitted to talk to (and attach the
// bearer token / auth cookie to). A host matches if it equals an entry or is a
// subdomain of one (e.g. api.aure.ai matches 'aure.ai').
//
// ⚠️ DEPLOYMENT: add your production API host here. If the production backend
// lives on a different domain than the ones below, requests to it will be
// rejected and silently fall back to the localhost default.
const ALLOWED_REMOTE_HOSTS = ['aure.ai'];

export function isAllowedApiHost(hostname: string): boolean {
  if (isLoopbackHost(hostname)) return true;
  return ALLOWED_REMOTE_HOSTS.some(
    (host) => hostname === host || hostname.endsWith('.' + host)
  );
}

/** Read the user-configured endpoint (may be undefined / untrusted). */
async function getConfiguredEndpoint(): Promise<string | undefined> {
  const settings = await getStorage('settings');
  const endpoint = (settings?.advanced as { apiEndpoint?: string } | undefined)?.apiEndpoint;
  return typeof endpoint === 'string' && endpoint.trim() !== '' ? endpoint.trim() : undefined;
}

/**
 * Resolve the configured API endpoint to a validated absolute base URL.
 * Rejects non-allow-listed hosts (returns the default) and enforces HTTPS for
 * remote hosts, so the bearer token is never sent to an untrusted origin.
 */
export async function resolveApiBaseUrl(): Promise<string> {
  const configured = await getConfiguredEndpoint();
  if (!configured) return DEFAULT_API_BASE;

  try {
    const url = new URL(configured);
    if (!isAllowedApiHost(url.hostname)) {
      console.warn(
        `[AURE Security] Ignoring non-allow-listed API endpoint "${configured}"; using default.`
      );
      return DEFAULT_API_BASE;
    }
    // Enforce HTTPS for remote (non-loopback) hosts (AURE-02).
    if (!isLoopbackHost(url.hostname) && url.protocol !== 'https:') {
      return `https://${url.host}${url.pathname}`.replace(/\/$/, '');
    }
    return configured.replace(/\/$/, '');
  } catch {
    return DEFAULT_API_BASE;
  }
}

/**
 * Resolve the validated origin (scheme://host[:port]) of the API endpoint.
 * Used for cookie targeting. Guaranteed to be an allow-listed origin.
 */
export async function resolveApiOrigin(): Promise<string> {
  const base = await resolveApiBaseUrl();
  try {
    return new URL(base).origin;
  } catch {
    return DEFAULT_API_ORIGIN;
  }
}
