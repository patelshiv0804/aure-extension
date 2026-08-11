// ──────────────────────────────────────────────────────────────
// VersionTimeline — Prompt version history timeline
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sendMessage } from '@/lib/messaging';
import type { PromptVersion } from '@/types/prompt';

interface VersionTimelineProps {
  promptId: string;
}

export const VersionTimeline: React.FC<VersionTimelineProps> = ({ promptId }) => {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  useEffect(() => {
    const fetchVersions = async () => {
      setIsLoading(true);
      try {
        const result = await sendMessage('GET_VERSIONS', { promptId });
        setVersions(result.versions);
      } catch (error) {
        console.error('Failed to fetch versions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVersions();
  }, [promptId]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-white animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-slate-600 mb-3">Version History</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-primary-500 via-secondary-500 to-transparent" />

        <div className="space-y-3">
          {versions.map((version, i) => (
            <motion.div
              key={version.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`
                relative pl-8 cursor-pointer group
                ${selectedVersion === version.id ? 'bg-primary-500/5 -mx-2 px-10 py-2 rounded-lg' : ''}
              `}
              onClick={() => setSelectedVersion(
                selectedVersion === version.id ? null : version.id
              )}
            >
              {/* Timeline dot */}
              <div
                className={`
                  absolute left-1.5 top-2 w-3 h-3 rounded-full border-2
                  ${version.source === 'enhanced'
                    ? 'bg-primary-500 border-primary-400'
                    : version.source === 'edited'
                      ? 'bg-secondary-500 border-secondary-400'
                      : 'bg-slate-200 border-slate-300'
                  }
                `}
              />

              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-800">
                  V{version.version}
                </span>
                <span
                  className={`
                    px-1.5 py-0.5 text-[9px] font-medium rounded-full
                    ${version.source === 'enhanced'
                      ? 'bg-primary-500/15 text-primary-400'
                      : version.source === 'edited'
                        ? 'bg-secondary-500/15 text-secondary-400'
                        : 'bg-slate-100 text-slate-500'
                    }
                  `}
                >
                  {version.source}
                </span>
                <span className="text-[10px] text-slate-400/60">
                  {new Date(version.createdAt).toLocaleTimeString()}
                </span>
              </div>

              <p className={`
                text-xs text-slate-500 leading-relaxed
                ${selectedVersion === version.id ? '' : 'line-clamp-2'}
              `}>
                {version.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
