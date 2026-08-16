// ──────────────────────────────────────────────────────────────
// Enhancement Flow Store
// ──────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type {
  EnhanceFlowState,
  EnhancementMode,
  EnhanceResult,
} from '@/types/enhancement';
import type { ModelRecommendation } from '@/types/messages';

interface EnhanceState {
  // Flow state machine
  flowState: EnhanceFlowState;
  setFlowState: (state: EnhanceFlowState) => void;

  // Current prompt
  currentPrompt: string;
  setCurrentPrompt: (prompt: string) => void;

  // Selected mode & role
  selectedMode: EnhancementMode;
  setSelectedMode: (mode: EnhancementMode) => void;

  selectedRole: string;
  setSelectedRole: (role: string) => void;

  selectedRoleMode: string;
  setSelectedRoleMode: (mode: string) => void;

  // Enhancement result
  enhanceResult: EnhanceResult | null;
  setEnhanceResult: (result: EnhanceResult | null) => void;

  // Model recommendation
  recommendation: ModelRecommendation | null;
  setRecommendation: (rec: ModelRecommendation | null) => void;
  showRecommendation: boolean;
  setShowRecommendation: (show: boolean) => void;

  // Error state
  error: string | null;
  setError: (error: string | null) => void;

  // Active input element ref
  activeInput: HTMLElement | null;
  setActiveInput: (el: HTMLElement | null) => void;

  // Button visibility
  showButton: boolean;
  setShowButton: (show: boolean) => void;

  // Suggestions
  suggestions: string[];
  setSuggestions: (suggestions: string[]) => void;

  // Undone state
  isUndone: boolean;
  setIsUndone: (isUndone: boolean) => void;

  // Reset
  reset: () => void;
}

export const useEnhanceStore = create<EnhanceState>((set) => ({
  flowState: 'idle',
  setFlowState: (flowState) => set({ flowState }),

  currentPrompt: '',
  setCurrentPrompt: (currentPrompt) => set({ currentPrompt }),

  selectedMode: 'general',
  setSelectedMode: (selectedMode) => set({ selectedMode }),

  selectedRole: 'general',
  setSelectedRole: (selectedRole) => set({ selectedRole }),

  selectedRoleMode: '',
  setSelectedRoleMode: (selectedRoleMode) => set({ selectedRoleMode }),

  enhanceResult: null,
  setEnhanceResult: (enhanceResult) => set({ enhanceResult }),

  recommendation: null,
  setRecommendation: (recommendation) => set({ recommendation, showRecommendation: !!recommendation }),
  showRecommendation: false,
  setShowRecommendation: (showRecommendation) => set({ showRecommendation }),

  error: null,
  setError: (error) => set({ error }),

  activeInput: null,
  setActiveInput: (activeInput) => set({ activeInput }),

  showButton: false,
  setShowButton: (showButton) => set({ showButton }),

  suggestions: [],
  setSuggestions: (suggestions) => set({ suggestions }),

  isUndone: false,
  setIsUndone: (isUndone) => set({ isUndone }),

  reset: () =>
    set({
      flowState: 'idle',
      currentPrompt: '',
      enhanceResult: null,
      recommendation: null,
      showRecommendation: false,
      error: null,
      suggestions: [],
      isUndone: false,
    }),
}));
