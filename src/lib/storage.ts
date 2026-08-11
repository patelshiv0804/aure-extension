// ──────────────────────────────────────────────────────────────
// Typed Chrome Storage Wrapper
// ──────────────────────────────────────────────────────────────

import type { ExtensionSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

/** Keys and their types for chrome.storage */
interface StorageSchema {
  settings: ExtensionSettings;
  apiToken: string;
  floatingButtonPosition: { x: number; y: number };
  lastSyncTimestamp: number;
  promptCache: Record<string, unknown>;
  schemaVersion: number;
}

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Get a value from chrome.storage.local with type safety and defaults.
 */
export async function getStorage<K extends keyof StorageSchema>(
  key: K
): Promise<StorageSchema[K] | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as StorageSchema[K] | undefined;
}

/**
 * Set a value in chrome.storage.local with type safety.
 */
export async function setStorage<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

/**
 * Remove a value from chrome.storage.local.
 */
export async function removeStorage<K extends keyof StorageSchema>(
  key: K
): Promise<void> {
  await chrome.storage.local.remove(key);
}

/**
 * Get settings with defaults applied for any missing keys.
 */
export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await getStorage('settings');
  if (!stored) return { ...DEFAULT_SETTINGS };

  // Deep merge with defaults to handle newly added settings
  return deepMerge(DEFAULT_SETTINGS as any, stored as any) as ExtensionSettings;
}

/**
 * Update settings (partial update, merged with existing).
 */
export async function updateSettings(
  partial: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const updated = deepMerge(current as any, partial as any) as ExtensionSettings;
  await setStorage('settings', updated);
  return updated;
}

/**
 * Listen for storage changes.
 */
export function onStorageChange<K extends keyof StorageSchema>(
  key: K,
  callback: (newValue: StorageSchema[K] | undefined, oldValue: StorageSchema[K] | undefined) => void
): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (key in changes) {
      callback(
        changes[key].newValue as StorageSchema[K] | undefined,
        changes[key].oldValue as StorageSchema[K] | undefined
      );
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Migrate storage schema if needed.
 */
export async function migrateStorageIfNeeded(): Promise<void> {
  const version = await getStorage('schemaVersion');
  if (version === CURRENT_SCHEMA_VERSION) return;

  // Future migrations go here
  // if (!version || version < 2) { ... }

  await setStorage('schemaVersion', CURRENT_SCHEMA_VERSION);
}

// ── Helpers ──────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(
  target: any,
  source: any
): any {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (isPlainObject(source[key]) && isPlainObject(target[key])) {
      output[key] = deepMerge(
        target[key],
        source[key]
      );
    } else {
      output[key] = source[key];
    }
  }
  return output;
}
