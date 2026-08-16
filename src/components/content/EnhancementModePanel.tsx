// ──────────────────────────────────────────────────────────────
// EnhancementModePanel — Role & Mode Selection Overlay
// ──────────────────────────────────────────────────────────────

import React, { useCallback, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SiteAdapter } from '@/types/adapter';
import { useEnhanceStore } from '@/stores/enhance.store';
import { ROLES, ROLE_MODES, getModeIconName } from '@/constants/modes';
import type { EnhancementMode } from '@/types/enhancement';
import { RoleIcon } from '../common/RoleIcon';

interface EnhancementModePanelProps {
  adapter: SiteAdapter;
  onSelectMode: (mode: EnhancementMode, role?: string, roleMode?: string) => void;
}

export const EnhancementModePanel: React.FC<EnhancementModePanelProps> = ({
  adapter,
  onSelectMode,
}) => {
  const {
    currentPrompt,
    flowState,
    selectedRole,
    setSelectedRole,
    selectedRoleMode,
    setSelectedRoleMode,
    reset,
  } = useEnhanceStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modesSectionRef = React.useRef<HTMLDivElement>(null);

  // Filter roles based on searchQuery
  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return ROLES;
    const q = searchQuery.toLowerCase();
    return ROLES.filter(
      (r) => r.label.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Active role object (Default: General)
  const activeRoleObj = useMemo(() => {
    return ROLES.find((r) => r.id === selectedRole) || ROLES[0];
  }, [selectedRole]);

  // Modes available for active role
  const activeRoleModes = useMemo(() => {
    return ROLE_MODES[activeRoleObj.id] || [];
  }, [activeRoleObj]);

  // Clicking a role card selects the role and scrolls smoothly to mode selection
  const handleRoleClick = useCallback(
    (roleId: string) => {
      setSelectedRole(roleId);
      const modes = ROLE_MODES[roleId] || [];
      if (modes.length > 0) {
        if (!modes.includes(selectedRoleMode)) {
          setSelectedRoleMode(modes[0]);
        }
        setTimeout(() => {
          modesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 60);
      } else {
        setSelectedRoleMode('');
      }
    },
    [setSelectedRole, selectedRoleMode, setSelectedRoleMode]
  );

  // Explicitly trigger prompt enhancement
  const handleEnhanceClick = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isSubmitting || flowState === 'enhancing') return;
      setIsSubmitting(true);
      onSelectMode(activeRoleObj.id as EnhancementMode, activeRoleObj.id, selectedRoleMode);
    },
    [onSelectMode, activeRoleObj, selectedRoleMode, isSubmitting, flowState]
  );

  const inputRect = adapter.getInputRect();
  if (!inputRect) return null;

  const panelWidth = 440;
  const panelMaxHeight = 520;
  const leftPos = Math.max(
    12,
    Math.min(
      inputRect.left + inputRect.width / 2 - panelWidth / 2,
      window.innerWidth - panelWidth - 12
    )
  );
  const topPos = Math.max(12, inputRect.top - panelMaxHeight - 8);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="pe-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={() => reset()}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2147483646,
          background: 'rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <motion.div
        key="pe-role-panel"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        style={{
          position: 'fixed',
          left: leftPos,
          top: topPos,
          zIndex: 2147483647,
          pointerEvents: 'auto',
          width: panelWidth,
          maxHeight: panelMaxHeight,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          background: '#FFFFFF',
          borderRadius: 20,
          border: '1px solid #ECE9FF',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(124, 92, 252, 0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px 12px',
            background: 'linear-gradient(135deg, #FAFAFE 0%, #F5F3FF 100%)',
            borderBottom: '1px solid #ECE9FF',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src={chrome.runtime.getURL('logo.png')}
                alt="AURE"
                style={{ width: 30, height: 30, objectFit: 'contain' }}
              />
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1a1a2e', letterSpacing: '-0.01em' }}>
                  Select your Role
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#8E8EA0', fontWeight: 400 }}>
                  AURE optimizes your prompt based on the selected role and mode
                </p>
              </div>
            </div>
            <button
              onClick={() => reset()}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: '1px solid #ECE9FF',
                background: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8E8EA0',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F5F3FF';
                e.currentTarget.style.color = '#7C5CFC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.color = '#8E8EA0';
              }}
            >
              <RoleIcon name="X" size={14} strokeWidth={2} />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginTop: 10 }}>
            <span
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#8E8EA0',
                pointerEvents: 'none',
                display: 'flex',
              }}
            >
              <RoleIcon name="Search" size={14} strokeWidth={1.75} />
            </span>
            <input
              type="text"
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: 10,
                border: '1px solid #ECE9FF',
                background: 'white',
                fontSize: 12,
                color: '#1a1a2e',
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#A78BFA';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124, 92, 252, 0.08)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#ECE9FF';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
        </div>

        {/* Scrollable Content (Roles Grid + Mode Selector) */}
        <div className="pe-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Roles 4x3 Grid */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8EA0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingLeft: 2 }}>
              Choose Target Role
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {filteredRoles.map((role, i) => {
                const isSelected = activeRoleObj.id === role.id;
                const isHovered = hoveredId === role.id;
                const modeCount = ROLE_MODES[role.id]?.length ?? 0;

                return (
                  <motion.button
                    key={role.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.18 }}
                    onClick={() => handleRoleClick(role.id)}
                    onMouseEnter={() => setHoveredId(role.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 4px 8px',
                      borderRadius: 12,
                      border: isSelected
                        ? '2px solid #7C5CFC'
                        : isHovered
                        ? '1px solid #ECE9FF'
                        : '1px solid transparent',
                      background: isSelected
                        ? '#F5F3FF'
                        : isHovered
                        ? '#FAFAFE'
                        : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                      boxShadow: isSelected
                        ? '0 4px 12px rgba(124, 92, 252, 0.16)'
                        : isHovered
                        ? '0 2px 8px rgba(0,0,0,0.03)'
                        : 'none',
                      outline: 'none',
                    }}
                  >
                    {/* Role Icon */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 4,
                        background: isSelected
                          ? 'linear-gradient(135deg, #7C5CFC, #9D7BFF)'
                          : `${role.color}12`,
                        color: isSelected ? '#ffffff' : role.color,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <RoleIcon name={role.icon} size={16} strokeWidth={isSelected ? 2.2 : 1.8} />
                    </div>

                    {/* Role Label */}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: isSelected ? 700 : 600,
                        color: isSelected ? '#7C5CFC' : '#1a1a2e',
                        lineHeight: 1.1,
                      }}
                    >
                      {role.label}
                    </span>

                    {/* Mode Count */}
                    {modeCount > 0 && (
                      <span style={{ fontSize: 9.5, color: isSelected ? '#7C5CFC' : '#8E8EA0', marginTop: 2 }}>
                        {modeCount} modes
                      </span>
                    )}

                    {/* Selected Checkmark Badge */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          background: '#7C5CFC',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                        }}
                      >
                        <RoleIcon name="Check" size={8} strokeWidth={3} />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Modes for Selected Role */}
          {activeRoleModes.length > 0 && (
            <div ref={modesSectionRef} style={{ paddingTop: 8, borderTop: '1px solid #ECE9FF' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#7C5CFC', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {activeRoleObj.label} Modes ({activeRoleModes.length})
                </span>
                <span style={{ fontSize: 10, color: '#8E8EA0' }}>
                  Selected: <strong style={{ color: '#1a1a2e' }}>{selectedRoleMode}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {activeRoleModes.map((modeName) => {
                  const isModeSelected = selectedRoleMode === modeName;
                  const iconName = getModeIconName(modeName);
                  return (
                    <button
                      key={modeName}
                      type="button"
                      onClick={() => setSelectedRoleMode(modeName)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '5px 10px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: isModeSelected ? 700 : 500,
                        border: isModeSelected ? '1px solid #7C5CFC' : '1px solid #ECE9FF',
                        background: isModeSelected ? '#7C5CFC' : '#FAFAFE',
                        color: isModeSelected ? '#FFFFFF' : '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <RoleIcon name={iconName} size={12} strokeWidth={isModeSelected ? 2 : 1.5} />
                      <span>{modeName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredRoles.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#8E8EA0', fontSize: 12 }}>
              No roles match "<strong>{searchQuery}</strong>"
            </div>
          )}
        </div>

        {/* Action Button & Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #ECE9FF',
            background: 'linear-gradient(135deg, #FAFAFE, #F5F3FF)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Prominent Enhance Button */}
          <button
            onClick={handleEnhanceClick}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            disabled={isSubmitting || flowState === 'enhancing'}
            style={{
              width: '100%',
              padding: '11px 16px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #7C5CFC, #9D7BFF)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: isSubmitting || flowState === 'enhancing' ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || flowState === 'enhancing' ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(124, 92, 252, 0.3)',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting && flowState !== 'enhancing') {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(124, 92, 252, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(124, 92, 252, 0.3)';
            }}
          >
            {isSubmitting || flowState === 'enhancing' ? (
              <>
                <span className="pe-spinner" style={{ display: 'inline-flex' }}>
                  <RoleIcon name="Loader2" size={16} strokeWidth={2.2} />
                </span>
                <span>Enhancing Prompt…</span>
              </>
            ) : (
              <>
                <RoleIcon name="Sparkles" size={16} strokeWidth={2} />
                <span>
                  Enhance Prompt as {activeRoleObj.label}{selectedRoleMode ? ` (${selectedRoleMode})` : ''}
                </span>
              </>
            )}
          </button>

          {/* Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: currentPrompt ? '#34D399' : '#c4c4d4',
                  flexShrink: 0,
                  boxShadow: currentPrompt ? '0 0 6px rgba(52, 211, 153, 0.4)' : 'none',
                }}
              />
              <p
                style={{
                  margin: 0,
                  fontSize: 10.5,
                  color: '#8E8EA0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentPrompt
                  ? currentPrompt.length > 35
                    ? currentPrompt.slice(0, 35) + '…'
                    : currentPrompt
                  : 'Waiting for prompt…'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <kbd
                style={{
                  padding: '2px 5px',
                  borderRadius: 4,
                  background: '#F0EDF9',
                  border: '1px solid #ECE9FF',
                  fontSize: 9,
                  fontFamily: 'inherit',
                  color: '#8E8EA0',
                  fontWeight: 500,
                }}
              >
                Esc
              </kbd>
              <span style={{ fontSize: 10, color: '#c4c4d4' }}>to close</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
