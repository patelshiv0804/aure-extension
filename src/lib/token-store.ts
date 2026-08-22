// ──────────────────────────────────────────────────────────────
// Auth Token Store (AURE-01)
//
// The JWT bearer token is a high-value secret. Previous builds wrote it in
// plaintext to chrome.storage.local (persisted to disk, survives forensic
// dumps) under TWO duplicated keys. This module is the single source of truth
// for the token and stores it in chrome.storage.session — an in-memory area
// that is (a) never written to disk and (b) cleared when the browser closes.
//
// Durability across browser restarts is provided by the persistent, httpOnly,
// Secure auth cookie (see lib/cookies.ts), which only the privileged
// chrome.cookies API can read — not page JavaScript. On restart the session
// area is empty, so loadAuth() restores the token from that cookie.
//
// Access levels: chrome.storage.session defaults to TRUSTED_CONTEXTS, so
// content scripts cannot read it. That is fine — content scripts never handle
// the token directly; they proxy all API calls through the background service
// worker, which is a trusted context.
// ──────────────────────────────────────────────────────────────

/** Canonical (single) key for the bearer token in chrome.storage.session. */
const TOKEN_KEY = 'authToken';

/** Legacy plaintext keys left in chrome.storage.local by older builds. */
const LEGACY_LOCAL_KEYS = ['promptiq_token', 'apiToken'];

function sessionArea(): chrome.storage.StorageArea | undefined {
  try {
    return chrome.storage?.session;
  } catch {
    return undefined;
  }
}

/** Best-effort removal of any legacy plaintext tokens from on-disk local storage. */
async function wipeLegacyLocalTokens(): Promise<void> {
  try {
    await chrome.storage.local.remove(LEGACY_LOCAL_KEYS);
  } catch {
    /* ignore */
  }
}

/**
 * Read the bearer token. Order:
 *   1. chrome.storage.session (primary, in-memory).
 *   2. One-time migration of any legacy plaintext token from storage.local:
 *      promote it into session (in trusted contexts) and wipe the local copy.
 * Returns undefined if no token is available.
 */
export async function getToken(): Promise<string | undefined> {
  const area = sessionArea();
  if (area) {
    try {
      const res = await area.get(TOKEN_KEY);
      const value = res?.[TOKEN_KEY];
      if (typeof value === 'string' && value.trim() !== '') return value.trim();
    } catch {
      /* session not accessible in this context */
    }
  }

  // Legacy migration: older builds stored the token in storage.local.
  try {
    const res = await chrome.storage.local.get(LEGACY_LOCAL_KEYS);
    const legacy = res?.[LEGACY_LOCAL_KEYS[0]] ?? res?.[LEGACY_LOCAL_KEYS[1]];
    if (typeof legacy === 'string' && legacy.trim() !== '') {
      const token = legacy.trim();
      // Only wipe the local copy once we've successfully promoted it to session,
      // so a context that can't write session (content script) doesn't destroy
      // the only surviving copy.
      if (area) {
        try {
          await area.set({ [TOKEN_KEY]: token });
          await wipeLegacyLocalTokens();
        } catch {
          /* couldn't promote — leave legacy copy in place */
        }
      }
      return token;
    }
  } catch {
    /* ignore */
  }

  return undefined;
}

/** Store the bearer token in memory-only session storage (single key). */
export async function setToken(token: string): Promise<void> {
  const area = sessionArea();
  if (area) {
    try {
      await area.set({ [TOKEN_KEY]: token });
    } catch {
      /* ignore */
    }
  }
  // Clear any legacy plaintext copies left on disk by older builds.
  await wipeLegacyLocalTokens();
}

/** Remove the bearer token from all storage areas. */
export async function clearToken(): Promise<void> {
  const area = sessionArea();
  if (area) {
    try {
      await area.remove(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }
  await wipeLegacyLocalTokens();
}
