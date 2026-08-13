// ──────────────────────────────────────────────────────────────
// Cookie Management — HTTP Cookie storage for promptiq_access_token
// ──────────────────────────────────────────────────────────────

import { getStorage } from '@/lib/storage';

const DEFAULT_API_URL = 'http://127.0.0.1:8000';
const COOKIE_NAME = 'promptiq_access_token';

/**
 * Resolve cookie target origin URL dynamically from settings.
 */
async function getCookieUrl(): Promise<string> {
  try {
    const settings = await getStorage('settings');
    const endpoint = (settings?.advanced as any)?.apiEndpoint || DEFAULT_API_URL;
    const url = new URL(endpoint);
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
 * Get the promptiq_access_token from HTTP cookie.
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

  // 2. Fallback: Search candidate origin URLs directly
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

  // 3. Fallback: document.cookie
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
}

/**
 * Set the promptiq_access_token HTTP cookie.
 */
export async function setAuthCookie(token: string, expirationDays = 30): Promise<void> {
  const candidateUrls = await getCandidateUrls();
  const primaryUrl = candidateUrls[0];

  try {
    if (typeof chrome !== 'undefined' && chrome.cookies) {
      const expirationDate = Math.floor(Date.now() / 1000) + expirationDays * 24 * 60 * 60;
      await chrome.cookies.set({
        url: primaryUrl,
        name: COOKIE_NAME,
        value: token,
        path: '/',
        expirationDate,
        sameSite: 'lax',
      });
    }
  } catch (err) {
    console.warn('[AURE] Failed to set cookie via chrome.cookies:', err);
  }

  // Also write to document.cookie as secondary fallback
  if (typeof document !== 'undefined') {
    const expires = new Date(Date.now() + expirationDays * 864e5).toUTCString();
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; expires=${expires}; path=/; SameSite=Lax`;
  }
}

/**
 * Remove the promptiq_access_token HTTP cookie.
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

  if (typeof document !== 'undefined') {
    document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}
