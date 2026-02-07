import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipe } from '@/src/hooks/useRecipes';
import { useCookingStore } from '@/src/stores/cookingStore';
import { useVoice } from '@/src/hooks/useVoice';
import VoiceIndicator from '@/src/components/VoiceIndicator';
import Colors from '@/constants/Colors';

/**
 * Cooking Session Screen
 *
 * This is the hands-free cooking interface. For Phase 1, it shows the
 * step-by-step UI with manual controls. Voice integration comes in Phase 2-3.
 */
export default function CookingSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, loading } = useRecipe(id);
  const router = useRouter();
  const autoVoiceStartedRef = useRef(false);
  const lastAnnouncedStepRef = useRef<number | null>(null);

  const {
    currentStep,
    isActive,
    startSession,
    endSession,
    nextStep,
    previousStep,
  } = useCookingStore();
  const {
    voiceState,
    transcriptText,
    assistantText,
    error: voiceError,
    startVoiceLoop,
    stopVoiceLoop,
    toggleVoiceLoop,
    interruptAndListen,
    announceCurrentStep,
    isVoiceLoopActive,
  } = useVoice();

  // Start the cooking session when recipe loads
  useEffect(() => {
    if (recipe && !isActive) {
      startSession(recipe);
    }
  }, [recipe]);

  // Start voice mode automatically once per cooking session.
  useEffect(() => {
    if (recipe && isActive && !autoVoiceStartedRef.current) {
      autoVoiceStartedRef.current = true;
      void startVoiceLoop();
    }
  }, [recipe, isActive, startVoiceLoop]);

  useEffect(() => {
    if (!isActive) {
      autoVoiceStartedRef.current = false;
      lastAnnouncedStepRef.current = null;
    }
  }, [isActive]);

  // If the step changes while voice mode is active (manual tap or command),
  // read the new step out loud so users can stay hands-free.
  useEffect(() => {
    if (!recipe || !isActive || !isVoiceLoopActive) return;

    if (lastAnnouncedStepRef.current === null) {
      lastAnnouncedStepRef.current = currentStep;
      return;
    }

    if (lastAnnouncedStepRef.current !== currentStep) {
      lastAnnouncedStepRef.current = currentStep;
      void announceCurrentStep();
    }
  }, [announceCurrentStep, currentStep, isActive, isVoiceLoopActive, recipe]);

  function handleEndSession() {
    Alert.alert('End Cooking?', 'Are you sure you want to stop cooking?', [
      { text: 'Keep Cooking', style: 'cancel' },
      {
        text: 'End Session',
        style: 'destructive',
        onPress: async () => {
          await stopVoiceLoop();
          endSession();
          router.back();
        },
      },
    ]);
  }

  if (loading || !recipe) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Preparing your recipe...</Text>
      </View>
    );
  }

  const step = recipe.steps.find((s) => s.number === currentStep);
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === recipe.steps.length;

  return (
    <>
      <Stack.Screen
        options={{
          title: recipe.title,
          headerLeft: () => (
            <TouchableOpacity onPress={handleEndSession} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={Colors.light.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        {/* Step progress indicator */}
        <View style={styles.progressBar}>
          {recipe.steps.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.progressDot,
                idx + 1 <= currentStep && styles.progressDotActive,
                idx + 1 === currentStep && styles.progressDotCurrent,
              ]}
            />
          ))}
        </View>

        {/* Step counter */}
        <Text style={styles.stepCounter}>
          Step {currentStep} of {recipe.steps.length}
        </Text>

        {/* Step instruction */}
        <View style={styles.stepCard}>
          <Text style={styles.stepInstruction}>{step?.instruction}</Text>

          {step?.duration && (
            <View style={styles.timer}>
              <Ionicons name="timer-outline" size={18} color={Colors.brand.sageDark} />
              <Text style={styles.timerText}>
                {step.duration >= 60
                  ? `${Math.floor(step.duration / 60)} minutes`
                  : `${step.duration} seconds`}
              </Text>
            </View>
          )}

          {step?.tips && (
            <View style={styles.tipBox}>
              <Ionicons name="bulb-outline" size={16} color={Colors.brand.sageDark} />
              <Text style={styles.tipText}>{step.tips}</Text>
            </View>
          )}
        </View>

        <VoiceIndicator
          voiceState={voiceState}
          transcriptText={transcriptText}
          assistantText={assistantText}
          error={voiceError}
          onPress={() => {
            if (voiceState === 'speaking') {
              void interruptAndListen();
            } else {
              void toggleVoiceLoop();
            }
          }}
        />

        {/* Manual navigation controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.navButton, isFirstStep && styles.navButtonDisabled]}
            onPress={previousStep}
            disabled={isFirstStep}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={isFirstStep ? Colors.light.border : Colors.light.text}
            />
            <Text
              style={[styles.navButtonText, isFirstStep && styles.navButtonTextDisabled]}
            >
              Previous
            </Text>
          </TouchableOpacity>

          {isLastStep ? (
            <TouchableOpacity
              style={styles.finishButton}
              onPress={async () => {
                await stopVoiceLoop();
                endSession();
                Alert.alert('Well done!', 'You finished cooking. Enjoy your meal!', [
                  { text: 'Thanks!', onPress: () => router.back() },
                ]);
              }}
            >
              <Ionicons name="checkmark-circle" size={24} color={Colors.brand.cream} />
              <Text style={styles.finishButtonText}>Done!</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
              <Text style={styles.nextButtonText}>Next Step</Text>
              <Ionicons name="chevron-forward" size={24} color={Colors.brand.cream} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  progressDot: {
    height: 4,
    flex: 1,
    maxWidth: 40,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
  },
  progressDotActive: {
    backgroundColor: Colors.brand.sage,
  },
  progressDotCurrent: {
    backgroundColor: Colors.brand.sageDark,
  },
  stepCounter: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 20,
  },
  stepCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  stepInstruction: {
    fontSize: 20,
    color: Colors.light.text,
    lineHeight: 30,
    fontWeight: '500',
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: Colors.brand.cream,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timerText: {
    fontSize: 14,
    color: Colors.brand.sageDark,
    fontWeight: '600',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.brand.cream,
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  tipText: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
    lineHeight: 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: 20,
    gap: 12,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500',
  },
  navButtonTextDisabled: {
    color: Colors.light.border,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.sage,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 6,
  },
  nextButtonText: {
    fontSize: 16,
    color: Colors.brand.cream,
    fontWeight: '600',
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.sageDark,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 6,
  },
  finishButtonText: {
    fontSize: 16,
    color: Colors.brand.cream,
    fontWeight: '600',
  },
});
