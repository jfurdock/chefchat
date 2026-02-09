import { create } from 'zustand';
import { Ingredient, Step } from '../types/recipe';

export type ImportMethod = 'photo' | 'manual' | 'url';
export type ImportStep =
  | 'method'
  | 'photo-ingredients'
  | 'photo-instructions'
  | 'photo-review'
  | 'manual-title'
  | 'manual-ingredients'
  | 'manual-instructions'
  | 'review';

interface ImportState {
  isActive: boolean;
  method: ImportMethod | null;
  currentStep: ImportStep;

  // Recipe data being built
  title: string;
  description: string;
  imageUri: string | null;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: Ingredient[];
  steps: Step[];

  // Photo capture state
  ingredientPhotoUri: string | null;
  instructionPhotoUri: string | null;
  ingredientOcrText: string;
  instructionOcrText: string;
  ocrLoading: boolean;
  ocrError: string | null;
}

interface ImportActions {
  startImport: () => void;
  cancelImport: () => void;

  setMethod: (method: ImportMethod) => void;
  setCurrentStep: (step: ImportStep) => void;

  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setImageUri: (uri: string | null) => void;
  setPrepTimeMinutes: (minutes: number) => void;
  setCookTimeMinutes: (minutes: number) => void;

  setIngredients: (ingredients: Ingredient[]) => void;
  addIngredient: (ingredient: Ingredient) => void;
  removeIngredient: (index: number) => void;
  updateIngredient: (index: number, ingredient: Ingredient) => void;

  setSteps: (steps: Step[]) => void;
  addStep: (step: Step) => void;
  removeStep: (index: number) => void;
  updateStep: (index: number, step: Step) => void;

  setIngredientPhotoUri: (uri: string | null) => void;
  setInstructionPhotoUri: (uri: string | null) => void;
  setIngredientOcrText: (text: string) => void;
  setInstructionOcrText: (text: string) => void;
  setOcrLoading: (loading: boolean) => void;
  setOcrError: (error: string | null) => void;
}

const defaultState: ImportState = {
  isActive: false,
  method: null,
  currentStep: 'method',

  title: '',
  description: '',
  imageUri: null,
  prepTimeMinutes: 0,
  cookTimeMinutes: 0,
  ingredients: [],
  steps: [],

  ingredientPhotoUri: null,
  instructionPhotoUri: null,
  ingredientOcrText: '',
  instructionOcrText: '',
  ocrLoading: false,
  ocrError: null,
};

export const useImportStore = create<ImportState & ImportActions>((set) => ({
  ...defaultState,

  startImport: () => set({ ...defaultState, isActive: true }),

  cancelImport: () => set(defaultState),

  setMethod: (method) => set({ method }),

  setCurrentStep: (step) => set({ currentStep: step }),

  setTitle: (title) => set({ title }),

  setDescription: (description) => set({ description }),

  setImageUri: (uri) => set({ imageUri: uri }),

  setPrepTimeMinutes: (minutes) => set({ prepTimeMinutes: Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0 }),

  setCookTimeMinutes: (minutes) => set({ cookTimeMinutes: Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0 }),

  setIngredients: (ingredients) => set({ ingredients }),

  addIngredient: (ingredient) =>
    set((state) => ({ ingredients: [...state.ingredients, ingredient] })),

  removeIngredient: (index) =>
    set((state) => ({
      ingredients: state.ingredients.filter((_, i) => i !== index),
    })),

  updateIngredient: (index, ingredient) =>
    set((state) => {
      const newIngredients = [...state.ingredients];
      newIngredients[index] = ingredient;
      return { ingredients: newIngredients };
    }),

  setSteps: (steps) => set({ steps }),

  addStep: (step) => set((state) => ({ steps: [...state.steps, step] })),

  removeStep: (index) =>
    set((state) => ({
      steps: state.steps.filter((_, i) => i !== index),
    })),

  updateStep: (index, step) =>
    set((state) => {
      const newSteps = [...state.steps];
      newSteps[index] = step;
      return { steps: newSteps };
    }),

  setIngredientPhotoUri: (uri) => set({ ingredientPhotoUri: uri }),

  setInstructionPhotoUri: (uri) => set({ instructionPhotoUri: uri }),

  setIngredientOcrText: (text) => set({ ingredientOcrText: text }),

  setInstructionOcrText: (text) => set({ instructionOcrText: text }),

  setOcrLoading: (loading) => set({ ocrLoading: loading }),

  setOcrError: (error) => set({ ocrError: error }),
}));
