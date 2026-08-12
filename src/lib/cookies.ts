// ──────────────────────────────────────────────────────────────
// Cookie Management — HTTP Cookie storage for promptiq_token
// ──────────────────────────────────────────────────────────────

const API_COOKIE_URL = 'http://127.0.0.1:8000';
const COOKIE_NAME = 'promptiq_token';

/**
 * Get the promptiq_token from HTTP cookie.
 */
export async function getAuthCookie(): Promise<string | null> {
  try {
    if (typeof chrome !== 'undefined' && chrome.cookies) {
      const cookie = await chrome.cookies.get({
        url: API_COOKIE_URL,
        name: COOKIE_NAME,
      });
      if (cookie?.value) return cookie.value;
    }
  } catch (err) {
    console.warn('[AURE] Failed to read cookie via chrome.cookies:', err);
  }

  // Fallback to document.cookie if available
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
}

/**
 * Set the promptiq_token HTTP cookie.
 */
export async function setAuthCookie(token: string, expirationDays = 30): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.cookies) {
      const expirationDate = Math.floor(Date.now() / 1000) + expirationDays * 24 * 60 * 60;
      await chrome.cookies.set({
        url: API_COOKIE_URL,
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
 * Remove the promptiq_token HTTP cookie.
 */
export async function removeAuthCookie(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.cookies) {
      await chrome.cookies.remove({
        url: API_COOKIE_URL,
        name: COOKIE_NAME,
      });
    }
  } catch (err) {
    console.warn('[AURE] Failed to remove cookie via chrome.cookies:', err);
  }

  if (typeof document !== 'undefined') {
    document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}
