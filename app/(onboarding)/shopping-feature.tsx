import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OnboardingScreen from '@/src/components/onboarding/OnboardingScreen';
import Colors from '@/constants/Colors';

export default function ShoppingFeatureScreen() {
  const router = useRouter();

  return (
    <OnboardingScreen
      onNext={() => router.push('/(onboarding)/personalization')}
      showSkip
      currentStep={4}
    >
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="cart-outline" size={56} color={Colors.brand.sage} />
        </View>
        <Text style={styles.headline}>Plan your week</Text>
        <Text style={styles.body}>
          Add recipes to your menu and ChefChat builds your shopping list automatically {'\u2014'} grouped by category.
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
