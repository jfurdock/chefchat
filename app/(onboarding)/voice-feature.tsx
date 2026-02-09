import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OnboardingScreen from '@/src/components/onboarding/OnboardingScreen';
import Colors from '@/constants/Colors';

export default function VoiceFeatureScreen() {
  const router = useRouter();

  return (
    <OnboardingScreen
      onNext={() => router.push('/(onboarding)/voice-select')}
      showSkip
      currentStep={0}
    >
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="mic-outline" size={64} color={Colors.brand.sage} />
        </View>
        <Text style={styles.headline}>Cook hands-free</Text>
        <Text style={styles.body}>
          ChefChat guides you through every step with voice. Just say "next" to move forward, or ask questions while you cook.
        </Text>
        <Text style={styles.trial}>Includes 7-day free trial - no payment required.</Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  trial: {
    fontSize: 14,
    color: Colors.brand.sage,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 12,
  },
});
