import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OnboardingScreen from '@/src/components/onboarding/OnboardingScreen';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import Colors from '@/constants/Colors';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Keto', 'None'];

const SKILL_LEVELS = [
  { key: 'beginner' as const, label: 'Beginner', desc: 'I follow recipes closely' },
  { key: 'intermediate' as const, label: 'Intermediate', desc: "I'm comfortable improvising" },
  { key: 'advanced' as const, label: 'Advanced', desc: 'I cook by instinct' },
];

export default function PersonalizationScreen() {
  const router = useRouter();
  const { dietaryPreferences, skillLevel, toggleDietaryPreference, setSkillLevel } =
    useOnboardingStore();

  return (
    <OnboardingScreen
      onNext={() => router.push('/(onboarding)/all-set')}
      nextDisabled={!skillLevel}
      showSkip={false}
      currentStep={5}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Dietary preferences */}
        <Text style={styles.sectionTitle}>Any dietary needs?</Text>
        <View style={styles.chips}>
          {DIETARY_OPTIONS.map((opt) => {
            const selected = dietaryPreferences.includes(opt);
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleDietaryPreference(opt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Skill level */}
        <Text style={[styles.sectionTitle, { marginTop: 36 }]}>
          How comfortable are you in the kitchen?
        </Text>
        <View style={styles.skillCards}>
          {SKILL_LEVELS.map((level) => {
            const selected = skillLevel === level.key;
            return (
              <TouchableOpacity
                key={level.key}
                style={[styles.skillCard, selected && styles.skillCardSelected]}
                onPress={() => setSkillLevel(level.key)}
                activeOpacity={0.7}
              >
                <View style={styles.skillCardText}>
                  <Text style={[styles.skillLabel, selected && styles.skillLabelSelected]}>
                    {level.label}
                  </Text>
                  <Text style={styles.skillDesc}>{level.desc}</Text>
                </View>
                {selected && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.brand.sageDark} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  chipSelected: {
    backgroundColor: Colors.brand.sage,
    borderColor: Colors.brand.sage,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  chipTextSelected: {
    color: Colors.brand.cream,
  },
  skillCards: {
    gap: 12,
  },
  skillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.light.card,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  skillCardSelected: {
    borderColor: Colors.brand.sage,
    backgroundColor: Colors.brand.cream,
  },
  skillCardText: {
    flex: 1,
    paddingRight: 12,
  },
  skillLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  skillLabelSelected: {
    color: Colors.brand.sageDark,
  },
  skillDesc: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
});
