import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  preparation?: string;
  isOptional: boolean;
  category: 'produce' | 'protein' | 'dairy' | 'pantry' | 'spice' | 'other';
}

export interface Step {
  number: number;
  instruction: string;
  duration?: number; // estimated seconds
  timerRequired: boolean;
  tips?: string;
}

export interface Substitution {
  name: string;
  ratio: string;
  notes: string;
}

export interface SubstitutionMap {
  [ingredientName: string]: Substitution[];
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  cuisine: string;
  tags: string[];
  ingredients: Ingredient[];
  steps: Step[];
  substitutions: SubstitutionMap;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

export interface CookingRecord {
  recipeId: string;
  completedAt: FirebaseFirestoreTypes.Timestamp;
  rating?: number;
  notes?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  phoneNumber?: string;
  favorites: string[];
  dietaryPreferences: string[];
  cookingHistory: CookingRecord[];
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | null;
  preferredVoiceName?: string | null;
  onboardingCompleted: boolean;
  subscriptionPlan?: 'free' | 'trial' | 'pro';
  subscriptionStatus?: 'inactive' | 'trialing' | 'active' | 'canceled';
  trialEndsAt?: FirebaseFirestoreTypes.Timestamp;
  trialStartedAt?: FirebaseFirestoreTypes.Timestamp;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export interface UserRecipe extends Recipe {
  createdBy: string;
  importMethod: 'manual' | 'url';
  sourcePhotos?: string[];
}
