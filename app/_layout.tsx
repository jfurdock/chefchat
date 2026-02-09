import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { doc, getDoc, getFirestore } from '@react-native-firebase/firestore';
import { useAuthListener, useAuth } from '@/src/hooks/useAuth';
import { useAuthStore } from '@/src/stores/authStore';
import { useSubscriptionStore } from '@/src/stores/subscriptionStore';
import Colors from '@/constants/Colors';
import 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);
  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);
  const hydrateSubscription = useSubscriptionStore((s) => s.hydrate);
  const resetSubscription = useSubscriptionStore((s) => s.reset);
  const segments = useSegments();
  const router = useRouter();

  // Fetch onboarding status when user changes
  useEffect(() => {
    if (!user) {
      setOnboardingCompleted(null);
      return;
    }

    let mounted = true;
    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(getFirestore(), 'users', user.uid));
        if (!mounted) return;
        const data = snap.data();
        setOnboardingCompleted(data?.onboardingCompleted === true);
      } catch {
        if (mounted) setOnboardingCompleted(false);
      }
    };

    void fetchProfile();
    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user) {
      resetSubscription();
      return;
    }
    void hydrateSubscription(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && onboardingCompleted === null) return; // still loading profile

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      if (onboardingCompleted === false) {
        router.replace('/(onboarding)/welcome');
      } else {
        router.replace('/(main)');
      }
    } else if (isAuthenticated && !inOnboardingGroup && onboardingCompleted === false) {
      router.replace('/(onboarding)/welcome');
    } else if (isAuthenticated && inOnboardingGroup && onboardingCompleted === true) {
      router.replace('/(main)');
    }
  }, [isAuthenticated, isLoading, onboardingCompleted, segments]);

  useEffect(() => {
    if (!isLoading && (onboardingCompleted !== null || !isAuthenticated)) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, onboardingCompleted, isAuthenticated]);

  if (isLoading || (isAuthenticated && onboardingCompleted === null)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.brand.sageDark} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  useAuthListener();

  return (
    <>
      <StatusBar style="auto" />
      <AuthGate />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.brand.cream,
  },
});
