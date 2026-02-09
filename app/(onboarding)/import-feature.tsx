import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OnboardingScreen from '@/src/components/onboarding/OnboardingScreen';
import Colors from '@/constants/Colors';

const METHODS = [
  { icon: 'link-outline' as const, label: 'URL' },
  { icon: 'pencil-outline' as const, label: 'Manual' },
];

export default function ImportFeatureScreen() {
  const router = useRouter();

  return (
    <OnboardingScreen
      onNext={() => router.push('/(onboarding)/favorites-feature')}
      showSkip
      currentStep={2}
    >
      <View style={styles.center}>
        <Text style={styles.headline}>Bring your recipes</Text>
        <Text style={styles.body}>
          Import recipes from anywhere {'\u2014'} paste a URL or type one in yourself.
        </Text>
        <View style={styles.methods}>
          {METHODS.map((m) => (
            <View key={m.label} style={styles.method}>
              <View style={styles.methodIcon}>
                <Ionicons name={m.icon} size={28} color={Colors.brand.sage} />
              </View>
              <Text style={styles.methodLabel}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
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
    marginBottom: 32,
  },
  methods: {
    flexDirection: 'row',
    gap: 24,
  },
  method: {
    alignItems: 'center',
    gap: 8,
  },
  methodIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
});
