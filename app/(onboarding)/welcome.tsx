import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import BrandLockup from '@/src/components/BrandLockup';
import Colors from '@/constants/Colors';

export default function WelcomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] || 'Chef';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <BrandLockup size="lg" />
        <Text style={styles.headline}>Welcome, {firstName}!</Text>
        <Text style={styles.subtitle}>
          Your personal cooking assistant {'\u2014'} let's get you set up.
        </Text>
      </View>
      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/(onboarding)/voice-feature')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottom: {
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  button: {
    height: 52,
    backgroundColor: Colors.brand.sage,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.brand.cream,
    fontSize: 17,
    fontWeight: '600',
  },
});
