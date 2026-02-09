import { create } from 'zustand';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface AuthState {
  user: FirebaseAuthTypes.User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  onboardingCompleted: boolean | null; // null = not yet loaded
  setUser: (user: FirebaseAuthTypes.User | null) => void;
  setLoading: (loading: boolean) => void;
  setOnboardingCompleted: (completed: boolean | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  onboardingCompleted: null,
  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
}));
