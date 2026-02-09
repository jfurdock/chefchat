import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OnboardingScreen from '@/src/components/onboarding/OnboardingScreen';
import Colors from '@/constants/Colors';

export default function FavoritesFeatureScreen() {
  const router = useRouter();

  return (
    <OnboardingScreen
      onNext={() => router.push('/(onboarding)/shopping-feature')}
      showSkip
      currentStep={3}
    >
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="heart-outline" size={48} color={Colors.brand.sage} />
          <View style={styles.cardOverlay}>
            <Ionicons name="search-outline" size={20} color={Colors.light.textSecondary} />
          </View>
        </View>
        <Text style={styles.headline}>Find what you're craving</Text>
        <Text style={styles.body}>
          Browse recipes by protein, search by name, and save your favorites for quick access.
        </Text>
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
  cardOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brand.cream,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
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
});
