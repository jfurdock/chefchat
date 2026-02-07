import { create } from 'zustand';
import { Recipe } from '../types/recipe';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

interface CookingSession {
  recipe: Recipe | null;
  currentStep: number;
  isActive: boolean;
  voiceState: VoiceState;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  substitutionsMade: { original: string; replacement: string }[];
}

interface CookingActions {
  startSession: (recipe: Recipe) => void;
  endSession: () => void;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  setVoiceState: (state: VoiceState) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  addSubstitution: (original: string, replacement: string) => void;
}

export const useCookingStore = create<CookingSession & CookingActions>((set, get) => ({
  // State
  recipe: null,
  currentStep: 1,
  isActive: false,
  voiceState: 'idle',
  conversationHistory: [],
  substitutionsMade: [],

  // Actions
  startSession: (recipe) =>
    set({
      recipe,
      currentStep: 1,
      isActive: true,
      voiceState: 'idle',
      conversationHistory: [],
      substitutionsMade: [],
    }),

  endSession: () =>
    set({
      recipe: null,
      currentStep: 1,
      isActive: false,
      voiceState: 'idle',
      conversationHistory: [],
      substitutionsMade: [],
    }),

  setCurrentStep: (step) => set({ currentStep: step }),

  nextStep: () => {
    const { currentStep, recipe } = get();
    if (recipe && currentStep < recipe.steps.length) {
      set({ currentStep: currentStep + 1 });
    }
  },

  previousStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) {
      set({ currentStep: currentStep - 1 });
    }
  },

  setVoiceState: (voiceState) => set({ voiceState }),

  addMessage: (role, content) =>
    set((state) => ({
      conversationHistory: [...state.conversationHistory, { role, content }],
    })),

  addSubstitution: (original, replacement) =>
    set((state) => ({
      substitutionsMade: [...state.substitutionsMade, { original, replacement }],
    })),
}));
