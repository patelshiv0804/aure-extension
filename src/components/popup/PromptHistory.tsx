// ──────────────────────────────────────────────────────────────
// PromptHistory — Popup history tab
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { sendMessage } from '@/lib/messaging';
import type { Prompt, PromptHistoryFilters } from '@/types/prompt';
import { MODE_MAP } from '@/constants/modes';
import { RoleIcon } from '../common/RoleIcon';

export const PromptHistory: React.FC = () => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<PromptHistoryFilters['timeRange']>('all');

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await sendMessage('GET_HISTORY', {
        timeRange: timeFilter,
        search: searchQuery || undefined,
        limit: 20,
      });
      setPrompts(result.prompts);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setPrompts([]);
    } finally {
      setIsLoading(false);
    }
  }, [timeFilter, searchQuery]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <input
          type="text"
          placeholder="Search prompts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 outline-none focus:border-primary-500/40 transition-colors"
        />
      </div>

      {/* Filter chips */}
      <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto">
        {(['all', 'today', 'week', 'month'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setTimeFilter(filter)}
            className={`
              px-2.5 py-1 text-[10px] font-medium rounded-full whitespace-nowrap transition-colors
              ${timeFilter === filter
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'bg-white text-slate-500 hover:text-slate-600 border border-slate-200/60'
              }
            `}
          >
            {filter === 'all' ? 'All Time' : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* History List */}
      <div className="flex-1 overflow-auto px-4 pb-3">
        {isLoading ? (
          <div className="space-y-2 pt-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-white animate-pulse"
              />
            ))}
          </div>
        ) : prompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-12 text-center">
            <div className="text-2xl mb-2">📝</div>
            <p className="text-xs text-slate-500">No prompts yet</p>
            <p className="text-[10px] text-slate-400/60 mt-1">
              Enhanced prompts will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 pt-1">
            {prompts.map((prompt, i) => {
              const modeConfig = MODE_MAP[prompt.mode];
              return (
                <motion.div
                  key={prompt.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="p-2.5 rounded-lg bg-white border border-slate-200/60 hover:bg-slate-50/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5"
                      style={{
                        background: modeConfig ? `${modeConfig.color}15` : 'rgba(0,0,0,0.03)',
                        border: `1px solid ${modeConfig?.color ?? '#e2e8f0'}20`,
                        color: modeConfig?.color,
                      }}
                    >
                      {modeConfig ? <RoleIcon name={modeConfig.icon} size={12} /> : '📝'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-800 line-clamp-1 font-medium">
                        {prompt.title || prompt.originalText.slice(0, 50)}
                      </p>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {prompt.originalText}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400/60">
                          {prompt.platform}
                        </span>
                        <span className="text-[10px] text-slate-900/10">•</span>
                        <span className="text-[10px] text-slate-400/60">
                          {formatTime(prompt.createdAt)}
                        </span>
                        {prompt.successScore && (
                          <>
                            <span className="text-[10px] text-slate-900/10">•</span>
                            <span className="text-[10px] text-success-500/60">
                              {prompt.successScore}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
