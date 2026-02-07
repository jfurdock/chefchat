import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { useAuthStore } from '../stores/authStore';

/**
 * Hook that subscribes to Firebase auth state and syncs it to Zustand.
 * Call this once in the root layout.
 */
export function useAuthListener() {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      setUser(user);
    });

    return unsubscribe;
  }, [setUser]);
}

/**
 * Hook that returns the current auth state for components.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return { user, isLoading, isAuthenticated };
}
