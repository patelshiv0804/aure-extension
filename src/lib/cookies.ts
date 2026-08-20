// ──────────────────────────────────────────────────────────────
// Cookie Management — HTTP Cookie storage for promptiq_access_token
// ──────────────────────────────────────────────────────────────

import { getStorage } from '@/lib/storage';

const DEFAULT_API_URL = 'http://127.0.0.1:8000';
const COOKIE_NAME = 'promptiq_access_token';

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

/**
 * Resolve cookie target origin URL dynamically from settings.
 * Enforces HTTPS for all remote / non-loopback endpoints (AURE-02).
 */
async function getCookieUrl(): Promise<string> {
  try {
    const settings = await getStorage('settings');
    const endpoint = (settings?.advanced as any)?.apiEndpoint || DEFAULT_API_URL;
    const url = new URL(endpoint);

    // Enforce HTTPS for non-loopback hosts
    if (!isLoopbackHost(url.hostname) && url.protocol !== 'https:') {
      console.warn(`[AURE Security] Insecure non-loopback endpoint rejected for cookies: ${endpoint}`);
      return 'https://' + url.host;
    }

    return url.origin;
  } catch {
    return DEFAULT_API_URL;
  }
}

/**
 * Get candidate URLs for cookie matching (handles 127.0.0.1 / localhost).
 */
async function getCandidateUrls(): Promise<string[]> {
  const primary = await getCookieUrl();
  const candidates = [primary];
  if (primary.includes('127.0.0.1')) {
    candidates.push(primary.replace('127.0.0.1', 'localhost'));
  } else if (primary.includes('localhost')) {
    candidates.push(primary.replace('localhost', '127.0.0.1'));
  }
  return candidates;
}

/**
 * Get the promptiq_access_token from HTTP cookie using secure chrome.cookies API.
 */
export async function getAuthCookie(): Promise<string | null> {
  // 1. Primary: Use chrome.cookies.getAll to search for promptiq_access_token across allowed origins
  try {
    if (typeof chrome !== 'undefined' && chrome.cookies) {
      const cookies = await chrome.cookies.getAll({ name: COOKIE_NAME });
      if (cookies && cookies.length > 0) {
        const validCookie = cookies.find((c) => c.value && c.value.trim() !== '');
        if (validCookie?.value) return validCookie.value;
      }
    }
  } catch (err) {
    console.warn('[AURE] chrome.cookies.getAll check failed:', err);
  }

  // 2. Fallback: Search candidate origin URLs directly via chrome.cookies
  const candidateUrls = await getCandidateUrls();
  for (const url of candidateUrls) {
    try {
      if (typeof chrome !== 'undefined' && chrome.cookies) {
        const cookie = await chrome.cookies.get({
          url,
          name: COOKIE_NAME,
        });
        if (cookie?.value) return cookie.value;
      }
    } catch {
      // Continue checking next candidate
    }
  }

  return null;
}

/**
 * Set the promptiq_access_token HTTP cookie via chrome.cookies API.
 */
export async function setAuthCookie(token: string, expirationDays = 30): Promise<void> {
  const candidateUrls = await getCandidateUrls();
  const primaryUrl = candidateUrls[0];

  try {
    if (typeof chrome !== 'undefined' && chrome.cookies) {
      const expirationDate = Math.floor(Date.now() / 1000) + expirationDays * 24 * 60 * 60;
      const isSecure = primaryUrl.startsWith('https://');
      await chrome.cookies.set({
        url: primaryUrl,
        name: COOKIE_NAME,
        value: token,
        path: '/',
        expirationDate,
        secure: isSecure,
        sameSite: 'lax',
      });
    }
  } catch (err) {
    console.warn('[AURE] Failed to set cookie via chrome.cookies:', err);
  }
}

/**
 * Remove the promptiq_access_token HTTP cookie via chrome.cookies API.
 */
export async function removeAuthCookie(): Promise<void> {
  const candidateUrls = await getCandidateUrls();

  for (const url of candidateUrls) {
    try {
      if (typeof chrome !== 'undefined' && chrome.cookies) {
        await chrome.cookies.remove({
          url,
          name: COOKIE_NAME,
        });
      }
    } catch (err) {
      console.warn(`[AURE] Failed to remove cookie via chrome.cookies for ${url}:`, err);
    }
  }
}
