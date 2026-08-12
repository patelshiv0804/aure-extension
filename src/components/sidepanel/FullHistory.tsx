// ──────────────────────────────────────────────────────────────
// FullHistory — Premium side panel history view
// ──────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendMessage } from '@/lib/messaging';
import { useAuthStore } from '@/stores/auth.store';
import { VersionTimeline } from '@/components/popup/VersionTimeline';
import type { Prompt, PromptHistoryFilters } from '@/types/prompt';
import { MODE_MAP } from '@/constants/modes';
import { RoleIcon } from '../common/RoleIcon';

export const FullHistory: React.FC = () => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<PromptHistoryFilters['timeRange']>('all');
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const { isAuthenticated, loadAuth } = useAuthStore();

  useEffect(() => {
    loadAuth();

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (
        areaName === 'local' &&
        (changes['userProfile'] || changes['promptiq_token'] || changes['apiToken'] || changes['currentUserEmail'])
      ) {
        loadAuth();
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
  }, [loadAuth]);

  const fetchHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setPrompts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const result = await sendMessage('GET_HISTORY', {
        timeRange: timeFilter,
        search: searchQuery || undefined,
        limit: 50,
      });
      setPrompts(result.prompts || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [timeFilter, searchQuery, isAuthenticated]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filters = [
    { value: 'all' as const, label: 'All' },
    { value: 'today' as const, label: 'Today' },
    { value: 'week' as const, label: 'Week' },
    { value: 'month' as const, label: 'Month' },
  ];

  return (
    <div className="p-5 space-y-4">
      {/* Search */}
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#8E8EA0' }}>
          <RoleIcon name="Search" size={15} strokeWidth={1.75} />
        </div>
        <input
          type="text"
          placeholder="Search prompts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-all duration-200"
          style={{
            background: '#FFFFFF',
            border: '1px solid #ECE9FF',
            color: '#1a1a2e',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#A78BFA'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124, 92, 252, 0.08)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#ECE9FF'; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>

      {/* Filter Pills */}
      <div className="flex gap-1.5">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setTimeFilter(f.value)}
            className="transition-all duration-200"
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: timeFilter === f.value ? 600 : 500,
              cursor: 'pointer',
              border: 'none',
              background: timeFilter === f.value
                ? 'linear-gradient(135deg, #7C5CFC, #9D7BFF)'
                : 'transparent',
              color: timeFilter === f.value ? '#FFFFFF' : '#8E8EA0',
              boxShadow: timeFilter === f.value
                ? '0 2px 6px rgba(124, 92, 252, 0.2)'
                : '0 0 0 1px #ECE9FF inset',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {!isAuthenticated ? (
        <div className="text-center py-14 px-4 flex flex-col items-center gap-3.5 bg-white border border-[#ECE9FF] rounded-2xl shadow-xs">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: '#F5F3FF', color: '#7C5CFC' }}
          >
            <RoleIcon name="User" size={22} />
          </div>
          <div className="space-y-1">
            <p className="text-[14px] font-bold text-[#1a1a2e]">Sign In Required</p>
            <p className="text-[12px] text-[#8E8EA0] max-w-[220px]">
              Please sign in to view your prompt history and sync prompts across devices.
            </p>
          </div>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="mt-1 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all"
            style={{ background: 'linear-gradient(135deg, #7C5CFC, #9D7BFF)' }}
          >
            Sign In to AURE
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl animate-pulse"
              style={{ background: '#F0EDF9' }}
            />
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: '#F5F3FF', color: '#A78BFA' }}
          >
            <RoleIcon name="FileText" size={22} />
          </div>
          <div>
            <p className="text-[14px] font-medium" style={{ color: '#1a1a2e' }}>No prompts found</p>
            <p className="text-[12px] mt-1" style={{ color: '#8E8EA0' }}>
              Enhanced prompts will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {prompts.map((prompt, i) => {
            const modeConfig = MODE_MAP[prompt.mode];
            const isSelected = selectedPromptId === prompt.id;

            return (
              <motion.div
                key={prompt.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <div
                  onClick={() => setSelectedPromptId(isSelected ? null : prompt.id)}
                  className="rounded-xl transition-all duration-200 cursor-pointer"
                  style={{
                    padding: '14px 16px',
                    background: isSelected ? '#F5F3FF' : '#FFFFFF',
                    border: `1px solid ${isSelected ? '#A78BFA' : '#ECE9FF'}`,
                    boxShadow: isSelected ? '0 2px 8px rgba(124, 92, 252, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#FAFAFE';
                      e.currentTarget.style.borderColor = '#DDD6FE';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#FFFFFF';
                      e.currentTarget.style.borderColor = '#ECE9FF';
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-[13.5px] font-semibold line-clamp-1"
                        style={{ color: '#1a1a2e', letterSpacing: '-0.01em' }}
                      >
                        {prompt.title || prompt.originalText.slice(0, 60)}
                      </h3>
                      <p
                        className="text-[12px] line-clamp-1 mt-1"
                        style={{ color: '#8E8EA0' }}
                      >
                        {prompt.originalText}
                      </p>
                      <div className="flex items-center gap-2.5 mt-2.5">
                        {modeConfig && (
                          <span
                            className="text-[11px] font-medium flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg"
                            style={{
                              background: '#F5F3FF',
                              border: '1px solid #ECE9FF',
                              color: '#7C5CFC',
                            }}
                          >
                            <RoleIcon name={modeConfig.icon} size={11} />
                            {modeConfig.label}
                          </span>
                        )}
                        <span className="text-[11px] font-medium" style={{ color: '#8E8EA0' }}>
                          {prompt.platform}
                        </span>
                        <span className="text-[10px]" style={{ color: '#C4C4D4' }}>•</span>
                        <span className="text-[11px]" style={{ color: '#8E8EA0' }}>
                          {new Date(prompt.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div style={{ color: '#C4C4D4' }} className="flex-shrink-0 mt-0.5">
                      <RoleIcon name={isSelected ? 'ChevronDown' : 'ChevronRight'} size={15} />
                    </div>
                  </div>
                </div>

                {/* Expanded version timeline */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                      style={{
                        marginTop: -1,
                        borderLeft: '1px solid #ECE9FF',
                        borderRight: '1px solid #ECE9FF',
                        borderBottom: '1px solid #ECE9FF',
                        borderRadius: '0 0 12px 12px',
                        background: '#FFFFFF',
                      }}
                    >
                      <VersionTimeline promptId={prompt.id} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
