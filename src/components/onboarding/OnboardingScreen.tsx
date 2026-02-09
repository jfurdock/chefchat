import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';

type OnboardingScreenProps = {
  children: React.ReactNode;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
  showSkip?: boolean;
  showProgress?: boolean;
  currentStep?: number; // 0-indexed, steps 0-5 for screens 2-7
  totalSteps?: number;
};

export default function OnboardingScreen({
  children,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  showBack = true,
  showSkip = false,
  showProgress = true,
  currentStep = 0,
  totalSteps = 6,
}: OnboardingScreenProps) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar: back arrow + skip */}
      <View style={styles.topBar}>
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
        {showSkip ? (
          <TouchableOpacity onPress={onNext} hitSlop={12}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>{children}</View>

      {/* Bottom: progress dots + next button */}
      <View style={styles.bottom}>
        {showProgress ? (
          <View style={styles.dots}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentStep && styles.dotActive]}
              />
            ))}
          </View>
        ) : (
          <View style={styles.dots} />
        )}
        <TouchableOpacity
          style={[styles.nextButton, nextDisabled && styles.nextButtonDisabled]}
          onPress={onNext}
          disabled={nextDisabled}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>{nextLabel}</Text>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  skipText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  bottom: {
    paddingHorizontal: 32,
    paddingBottom: 24,
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    minHeight: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.border,
  },
  dotActive: {
    backgroundColor: Colors.brand.sage,
    width: 24,
  },
  nextButton: {
    height: 52,
    backgroundColor: Colors.brand.sage,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    color: Colors.brand.cream,
    fontSize: 17,
    fontWeight: '600',
  },
});
