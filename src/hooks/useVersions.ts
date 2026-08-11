// ──────────────────────────────────────────────────────────────
// useVersions — Hook for prompt versions
// ──────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { sendMessage } from '@/lib/messaging';
import type { PromptVersion } from '@/types/prompt';

export function useVersions(promptId?: string) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchVersions = useCallback(async (id?: string) => {
    const targetId = id ?? promptId;
    if (!targetId) return;

    setIsLoading(true);
    try {
      const result = await sendMessage('GET_VERSIONS', { promptId: targetId });
      setVersions(result.versions);
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [promptId]);

  const saveVersion = useCallback(async (version: PromptVersion) => {
    try {
      const result = await sendMessage('SAVE_VERSION', {
        promptId: version.promptId,
        version,
      });
      if (result.success) {
        setVersions((prev) => [...prev, version]);
      }
      return result;
    } catch (error) {
      console.error('Failed to save version:', error);
      throw error;
    }
  }, []);

  return { versions, isLoading, fetchVersions, saveVersion };
}
