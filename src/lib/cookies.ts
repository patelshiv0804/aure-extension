// ──────────────────────────────────────────────────────────────
// Cookie Management — HTTP Cookie storage for promptiq_access_token
// ──────────────────────────────────────────────────────────────

import { resolveApiOrigin } from '@/lib/endpoint';

const COOKIE_NAME = 'promptiq_access_token';

/**
 * Get candidate origin URLs for cookie matching (handles 127.0.0.1 / localhost).
 * The primary origin is resolved through the allow-list in lib/endpoint.ts, so
 * the auth cookie is only ever read from / written to a trusted origin
 * (AURE-07 / AURE-02).
 */
async function getCandidateUrls(): Promise<string[]> {
  const primary = await resolveApiOrigin();
  const candidates = [primary];
  if (primary.includes('127.0.0.1')) {
    candidates.push(primary.replace('127.0.0.1', 'localhost'));
  } else if (primary.includes('localhost')) {
    candidates.push(primary.replace('localhost', '127.0.0.1'));
  }
  return candidates;
}

/**
 * Get the promptiq_access_token from HTTP cookie using the secure chrome.cookies
 * API. Only the allow-listed backend origins are queried — the previous
 * unscoped chrome.cookies.getAll({ name }) pass, which searched EVERY origin's
 * cookie jar for a cookie of this name (and could pick up an unrelated /
 * attacker-planted cookie), has been removed (AURE-06).
 */
export async function getAuthCookie(): Promise<string | null> {
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
        // httpOnly blocks page JavaScript (document.cookie) from reading the
        // token; the extension still reads it via the privileged chrome.cookies
        // API, which is unaffected by httpOnly (AURE-01).
        httpOnly: true,
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
