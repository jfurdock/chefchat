import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import VoiceIndicator from '@/src/components/VoiceIndicator';
import Colors from '@/constants/Colors';
import { interruptAndSpeak, stopSpeaking } from '@/src/services/ttsService';
import type { VoiceState } from '@/src/stores/cookingStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useAuthStore } from '@/src/stores/authStore';
import { formatFirstName } from '@/src/utils/formatFirstName';
import { hasWakePhrase, stripLeadingWakePhrase } from '@/src/utils/wakePhraseUtils';

type OnboardingPhase =
  | 'welcome'
  | 'wake-tutorial'
  | 'features'
  | 'dietary'
  | 'skill'
  | 'all-set';

type OnboardingCard = 'features' | 'dietary' | 'skill' | 'start-exploring';

type OnboardingMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  card?: OnboardingCard;
};

type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

const WAKE_NUDGE_TIMEOUT_MS = 8000;
const WAKE_AUTO_ADVANCE_TIMEOUT_MS = 8000;

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Keto',
  'None',
] as const;

const SKILL_LEVELS: Array<{ key: SkillLevel; label: string; desc: string }> = [
  { key: 'beginner', label: 'Beginner', desc: 'I follow recipes closely' },
  { key: 'intermediate', label: 'Intermediate', desc: "I'm comfortable improvising" },
  { key: 'advanced', label: 'Advanced', desc: 'I cook by instinct' },
];

const FEATURE_ITEMS = [
  {
    key: 'import',
    icon: 'link-outline' as const,
    title: 'Import',
    subtitle: 'Pull recipes from websites',
  },
  {
    key: 'favorites',
    icon: 'heart-outline' as const,
    title: 'Favorites',
    subtitle: 'Save go-to meals',
  },
  {
    key: 'shopping',
    icon: 'cart-outline' as const,
    title: 'Shopping',
    subtitle: 'Auto-build grocery lists',
  },
];

function primaryTranscript(event: ExpoSpeechRecognitionResultEvent): string {
  const results = event.results;
  if (!results?.length) return '';
  const latest = results[results.length - 1];
  return (latest?.transcript || '').trim();
}

function FeatureCards() {
  return (
    <View style={styles.featureCardsRow}>
      {FEATURE_ITEMS.map((item) => (
        <View key={item.key} style={styles.featureCard}>
          <Ionicons name={item.icon} size={20} color={Colors.brand.sageDark} />
          <Text style={styles.featureCardTitle}>{item.title}</Text>
          <Text style={styles.featureCardSubtitle}>{item.subtitle}</Text>
        </View>
      ))}
    </View>
  );
}

type DietaryCardProps = {
  dietaryPreferences: string[];
  onToggle: (pref: string) => void;
  onContinue: () => void;
  disabled?: boolean;
};

function DietaryCard({
  dietaryPreferences,
  onToggle,
  onContinue,
  disabled = false,
}: DietaryCardProps) {
  return (
    <View style={styles.inlineCard}>
      <View style={styles.chipsWrap}>
        {DIETARY_OPTIONS.map((option) => {
          const selected = dietaryPreferences.includes(option);
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onToggle(option)}
              disabled={disabled}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.primaryInlineButton, disabled && styles.primaryInlineButtonDisabled]}
        onPress={onContinue}
        disabled={disabled}
      >
        <Text style={styles.primaryInlineButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

type SkillCardProps = {
  selectedSkill: SkillLevel | null;
  onSelect: (level: SkillLevel) => void;
  disabled?: boolean;
};

function SkillCard({ selectedSkill, onSelect, disabled = false }: SkillCardProps) {
  return (
    <View style={styles.inlineCard}>
      <View style={styles.skillCardsWrap}>
        {SKILL_LEVELS.map((level) => {
          const selected = selectedSkill === level.key;
          return (
            <TouchableOpacity
              key={level.key}
              style={[styles.skillCard, selected && styles.skillCardSelected]}
              onPress={() => onSelect(level.key)}
              disabled={disabled}
            >
              <View style={styles.skillCardTextWrap}>
                <Text style={[styles.skillCardTitle, selected && styles.skillCardTitleSelected]}>
                  {level.label}
                </Text>
                <Text style={styles.skillCardDesc}>{level.desc}</Text>
              </View>
              {selected && (
                <Ionicons name="checkmark-circle" size={20} color={Colors.brand.sageDark} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

type StartExploringButtonProps = {
  onPress: () => void;
  saving: boolean;
};

function StartExploringButton({ onPress, saving }: StartExploringButtonProps) {
  return (
    <View style={styles.inlineCard}>
      <TouchableOpacity
        style={[styles.primaryInlineButton, saving && styles.primaryInlineButtonDisabled]}
        onPress={onPress}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={Colors.brand.cream} />
        ) : (
          <Text style={styles.primaryInlineButtonText}>Start Exploring</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function OnboardingChatScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const dietaryPreferences = useOnboardingStore((s) => s.dietaryPreferences);
  const skillLevel = useOnboardingStore((s) => s.skillLevel);
  const setVoiceName = useOnboardingStore((s) => s.setVoiceName);
  const toggleDietaryPreference = useOnboardingStore((s) => s.toggleDietaryPreference);
  const setSkillLevel = useOnboardingStore((s) => s.setSkillLevel);
  const complete = useOnboardingStore((s) => s.complete);

  const firstName = useMemo(
    () => formatFirstName(user?.displayName, user?.email, user?.phoneNumber),
    [user?.displayName, user?.email, user?.phoneNumber],
  );

  const welcomeLine = useMemo(
    () =>
      `Hey ${firstName}, I'm Deborah, your cooking assistant! I'll walk you through recipes step by step, totally hands-free. Let me show you how it works.`,
    [firstName],
  );

  const [phase, setPhase] = useState<OnboardingPhase>('welcome');
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [microphoneDenied, setMicrophoneDenied] = useState(false);
  const [showWakeSkip, setShowWakeSkip] = useState(false);
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const isFocusedRef = useRef(false);
  const shouldListenRef = useRef(false);
  const recognitionActiveRef = useRef(false);
  const voiceStateRef = useRef<VoiceState>('idle');
  const phaseRef = useRef<OnboardingPhase>('welcome');
  const onboardingRunIdRef = useRef(0);
  const wakeHandledRef = useRef(false);
  const micDeniedRef = useRef(false);
  const wakeNudgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeAutoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length, liveTranscript, saving]);

  const clearWakeTimers = useCallback(() => {
    if (wakeNudgeTimeoutRef.current) {
      clearTimeout(wakeNudgeTimeoutRef.current);
      wakeNudgeTimeoutRef.current = null;
    }
    if (wakeAutoAdvanceTimeoutRef.current) {
      clearTimeout(wakeAutoAdvanceTimeoutRef.current);
      wakeAutoAdvanceTimeoutRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    recognitionActiveRef.current = false;
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // no-op
      }
    }
  }, []);

  const startRecognition = useCallback(async () => {
    if (micDeniedRef.current) return;
    if (!isFocusedRef.current) return;
    if (!shouldListenRef.current) return;
    if (recognitionActiveRef.current) return;

    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
        iosVoiceProcessingEnabled: true,
        iosCategory: {
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
          mode: 'voiceChat',
        },
      });
      setVoiceState('listening');
      setError(null);
    } catch (startError: any) {
      setVoiceState('idle');
      setError(startError?.message || 'Could not start voice listening.');
    }
  }, []);

  const requestVoicePermission = useCallback(async () => {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return !!permission.granted;
    } catch {
      return false;
    }
  }, []);

  const appendAssistantMessage = useCallback((content: string, card?: OnboardingCard) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content,
        card,
      },
    ]);
  }, []);

  const appendUserMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        content,
      },
    ]);
  }, []);

  const speakLine = useCallback(async (text: string) => {
    stopRecognition();
    setVoiceState('speaking');
    try {
      await interruptAndSpeak(text);
    } catch {
      // no-op
    }
  }, [stopRecognition]);

  const advanceToPhase = useCallback(async (
    nextPhase: OnboardingPhase,
    options?: { runId?: number },
  ) => {
    const runId = options?.runId ?? onboardingRunIdRef.current;
    const isStale = () => runId !== onboardingRunIdRef.current || !isFocusedRef.current;

    if (isStale()) return;

    phaseRef.current = nextPhase;
    setPhase(nextPhase);

    if (nextPhase !== 'wake-tutorial') {
      shouldListenRef.current = false;
      setShowWakeSkip(false);
      setLiveTranscript('');
      clearWakeTimers();
    }

    if (nextPhase === 'welcome') {
      appendAssistantMessage(welcomeLine);
      await speakLine(welcomeLine);
      if (isStale()) return;

      if (micDeniedRef.current) {
        await advanceToPhase('features', { runId });
      } else {
        await advanceToPhase('wake-tutorial', { runId });
      }
      return;
    }

    if (nextPhase === 'wake-tutorial') {
      wakeHandledRef.current = false;
      const line = 'Whenever you need me, or want to interrupt me, just say hey chef. Go ahead and give it a try!';
      appendAssistantMessage(line);
      await speakLine(line);
      if (isStale()) return;

      shouldListenRef.current = true;
      await startRecognition();

      wakeNudgeTimeoutRef.current = setTimeout(() => {
        if (phaseRef.current !== 'wake-tutorial') return;
        if (runId !== onboardingRunIdRef.current || !isFocusedRef.current) return;

        void (async () => {
          const nudgeLine = 'No worries, just say hey chef whenever you\'re ready.';
          appendAssistantMessage(nudgeLine);
          await speakLine(nudgeLine);
          if (phaseRef.current !== 'wake-tutorial') return;
          if (runId !== onboardingRunIdRef.current || !isFocusedRef.current) return;

          setShowWakeSkip(true);
          shouldListenRef.current = true;
          await startRecognition();

          wakeAutoAdvanceTimeoutRef.current = setTimeout(() => {
            if (phaseRef.current !== 'wake-tutorial') return;
            if (runId !== onboardingRunIdRef.current || !isFocusedRef.current) return;

            void (async () => {
              const encouragingLine = 'All good, we can keep going. You can say hey chef anytime you want to jump in.';
              appendAssistantMessage(encouragingLine);
              await speakLine(encouragingLine);
              if (runId !== onboardingRunIdRef.current || !isFocusedRef.current) return;
              await advanceToPhase('features', { runId });
            })();
          }, WAKE_AUTO_ADVANCE_TIMEOUT_MS);
        })();
      }, WAKE_NUDGE_TIMEOUT_MS);
      return;
    }

    if (nextPhase === 'features') {
      const line = 'Here\'s what else I can do. You can import recipes from any website, save your favorites, and I\'ll build your shopping list automatically.';
      appendAssistantMessage(line, 'features');
      await speakLine(line);
      if (isStale()) return;
      await advanceToPhase('dietary', { runId });
      return;
    }

    if (nextPhase === 'dietary') {
      const line = 'Now let me get to know you a little. Any dietary preferences I should know about?';
      appendAssistantMessage(line, 'dietary');
      await speakLine(line);
      if (isStale()) return;
      setVoiceState('idle');
      return;
    }

    if (nextPhase === 'skill') {
      const line = 'Got it! And how comfortable are you in the kitchen?';
      appendAssistantMessage(line, 'skill');
      await speakLine(line);
      if (isStale()) return;
      setVoiceState('idle');
      return;
    }

    if (nextPhase === 'all-set') {
      const line = 'You\'re all set! Let\'s go find you something delicious to cook.';
      appendAssistantMessage(line, 'start-exploring');
      await speakLine(line);
      if (isStale()) return;
      setVoiceState('idle');
    }
  }, [appendAssistantMessage, clearWakeTimers, speakLine, startRecognition, welcomeLine]);

  const handleWakePhraseDetected = useCallback(async (transcript: string) => {
    if (phaseRef.current !== 'wake-tutorial') return;
    if (wakeHandledRef.current) return;

    wakeHandledRef.current = true;
    clearWakeTimers();
    shouldListenRef.current = false;
    setShowWakeSkip(false);
    setLiveTranscript('');
    stopRecognition();

    const stripped = stripLeadingWakePhrase(transcript);
    appendUserMessage(stripped ? `hey chef ${stripped}` : 'hey chef');

    const successLine = 'Nice, you got it! That\'s all you need to get my attention.';
    appendAssistantMessage(successLine);
    await speakLine(successLine);

    if (!isFocusedRef.current) return;
    await advanceToPhase('features', { runId: onboardingRunIdRef.current });
  }, [advanceToPhase, appendAssistantMessage, appendUserMessage, clearWakeTimers, speakLine, stopRecognition]);

  const handleSkipWakeTutorial = useCallback(() => {
    if (phaseRef.current !== 'wake-tutorial') return;
    clearWakeTimers();
    shouldListenRef.current = false;
    setShowWakeSkip(false);
    setLiveTranscript('');
    stopRecognition();
    appendUserMessage('Skip for now');
    void advanceToPhase('features', { runId: onboardingRunIdRef.current });
  }, [advanceToPhase, appendUserMessage, clearWakeTimers, stopRecognition]);

  const handleDietaryContinue = useCallback(() => {
    if (phaseRef.current !== 'dietary') return;
    void advanceToPhase('skill', { runId: onboardingRunIdRef.current });
  }, [advanceToPhase]);

  const handleSkillSelect = useCallback((level: SkillLevel) => {
    setSkillLevel(level);
    if (phaseRef.current !== 'skill') return;
    void advanceToPhase('all-set', { runId: onboardingRunIdRef.current });
  }, [advanceToPhase, setSkillLevel]);

  const handleStartExploring = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await complete();
      router.replace('/(main)');
    } catch {
      setSaving(false);
      Alert.alert('Could not finish onboarding', 'Please try again.');
    }
  }, [complete, router, saving]);

  const handleVoiceIndicatorPress = useCallback(async () => {
    if (micDeniedRef.current) return;
    if (phaseRef.current !== 'wake-tutorial') return;

    if (shouldListenRef.current) {
      shouldListenRef.current = false;
      setVoiceState('idle');
      setLiveTranscript('');
      stopRecognition();
      return;
    }

    shouldListenRef.current = true;
    setError(null);
    await startRecognition();
  }, [startRecognition, stopRecognition]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      onboardingRunIdRef.current += 1;
      const runId = onboardingRunIdRef.current;

      setVoiceName('Deborah');
      setMessages([]);
      setPhase('welcome');
      phaseRef.current = 'welcome';
      setVoiceState('processing');
      setLiveTranscript('');
      setError(null);
      setShowWakeSkip(false);
      setSaving(false);

      wakeHandledRef.current = false;
      shouldListenRef.current = false;

      void (async () => {
        const granted = await requestVoicePermission();
        if (runId !== onboardingRunIdRef.current || !isFocusedRef.current) return;

        micDeniedRef.current = !granted;
        setMicrophoneDenied(!granted);

        if (!granted) {
          setError('Microphone access is off. You can finish onboarding by tapping the cards below.');
        }

        await advanceToPhase('welcome', { runId });
      })();

      return () => {
        isFocusedRef.current = false;
        onboardingRunIdRef.current += 1;
        clearWakeTimers();
        shouldListenRef.current = false;
        setVoiceState('idle');
        setLiveTranscript('');
        stopRecognition();
        void stopSpeaking(true);
      };
    }, [advanceToPhase, clearWakeTimers, requestVoicePermission, setVoiceName, stopRecognition]),
  );

  useEffect(() => {
    const startSub = ExpoSpeechRecognitionModule.addListener('start', () => {
      recognitionActiveRef.current = true;
      if (shouldListenRef.current && phaseRef.current === 'wake-tutorial') {
        setVoiceState('listening');
      }
    });

    const resultSub = ExpoSpeechRecognitionModule.addListener(
      'result',
      (event: ExpoSpeechRecognitionResultEvent) => {
        if (!isFocusedRef.current) return;
        if (phaseRef.current !== 'wake-tutorial') return;
        if (!shouldListenRef.current) return;
        if (voiceStateRef.current === 'speaking') return;

        const transcript = primaryTranscript(event);
        if (!transcript) return;

        setLiveTranscript(transcript);

        if (hasWakePhrase(transcript)) {
          void handleWakePhraseDetected(transcript);
        }
      },
    );

    const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
      recognitionActiveRef.current = false;
      if (!isFocusedRef.current) return;
      if (!shouldListenRef.current) return;
      if (phaseRef.current !== 'wake-tutorial') return;
      if (voiceStateRef.current === 'speaking') return;

      setTimeout(() => {
        if (!isFocusedRef.current) return;
        if (!shouldListenRef.current) return;
        if (phaseRef.current !== 'wake-tutorial') return;
        if (recognitionActiveRef.current) return;
        if (voiceStateRef.current === 'speaking') return;
        void startRecognition();
      }, 220);
    });

    const errorSub = ExpoSpeechRecognitionModule.addListener(
      'error',
      (event: ExpoSpeechRecognitionErrorEvent) => {
        recognitionActiveRef.current = false;
        if (!isFocusedRef.current) return;
        if (phaseRef.current !== 'wake-tutorial') return;

        setVoiceState('idle');
        setError(`Speech ${event.error}: ${event.message}`);

        if (!shouldListenRef.current) return;
        if (voiceStateRef.current === 'speaking') return;
        setTimeout(() => {
          if (!isFocusedRef.current) return;
          if (!shouldListenRef.current) return;
          if (phaseRef.current !== 'wake-tutorial') return;
          if (recognitionActiveRef.current) return;
          if (voiceStateRef.current === 'speaking') return;
          void startRecognition();
        }, 420);
      },
    );

    return () => {
      clearWakeTimers();
      startSub.remove();
      resultSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, [clearWakeTimers, handleWakePhraseDetected, startRecognition]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meet Deborah</Text>
        <Text style={styles.subtitle}>Let\'s get your kitchen assistant set up.</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <View
              key={message.id}
              style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}
            >
              <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
                {message.content}
              </Text>

              {!isUser && message.card === 'features' && <FeatureCards />}

              {!isUser && message.card === 'dietary' && (
                <DietaryCard
                  dietaryPreferences={dietaryPreferences}
                  onToggle={toggleDietaryPreference}
                  onContinue={handleDietaryContinue}
                  disabled={phase !== 'dietary'}
                />
              )}

              {!isUser && message.card === 'skill' && (
                <SkillCard
                  selectedSkill={skillLevel}
                  onSelect={handleSkillSelect}
                  disabled={phase !== 'skill'}
                />
              )}

              {!isUser && message.card === 'start-exploring' && (
                <StartExploringButton onPress={() => void handleStartExploring()} saving={saving} />
              )}
            </View>
          );
        })}

        {phase === 'wake-tutorial' && !!liveTranscript && (
          <View style={[styles.bubble, styles.bubbleUserDraft]}>
            <Text style={styles.bubbleTextDraft}>{stripLeadingWakePhrase(liveTranscript) || liveTranscript}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.voiceWrap}>
        <VoiceIndicator
          voiceState={voiceState}
          passiveListening={phase !== 'wake-tutorial' || microphoneDenied}
          error={error}
          onPress={() => void handleVoiceIndicatorPress()}
        />

        {phase === 'wake-tutorial' && showWakeSkip && (
          <TouchableOpacity style={styles.skipWakeButton} onPress={handleSkipWakeTutorial}>
            <Text style={styles.skipWakeText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  bubble: {
    maxWidth: '90%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.brand.sage,
  },
  bubbleUserDraft: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.light.border,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
    color: Colors.light.text,
  },
  bubbleTextUser: {
    color: Colors.brand.cream,
  },
  bubbleTextDraft: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  inlineCard: {
    marginTop: 2,
    gap: 10,
  },
  featureCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  featureCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.brand.cream,
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 4,
    alignItems: 'flex-start',
  },
  featureCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
  },
  featureCardSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    color: Colors.light.textSecondary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  chipSelected: {
    backgroundColor: Colors.brand.sage,
    borderColor: Colors.brand.sage,
  },
  chipText: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: Colors.brand.cream,
  },
  primaryInlineButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.brand.sageDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryInlineButtonDisabled: {
    opacity: 0.55,
  },
  primaryInlineButtonText: {
    color: Colors.brand.cream,
    fontSize: 15,
    fontWeight: '700',
  },
  skillCardsWrap: {
    gap: 8,
  },
  skillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.brand.cream,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  skillCardSelected: {
    borderColor: Colors.brand.sage,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  skillCardTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  skillCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
  },
  skillCardTitleSelected: {
    color: Colors.brand.sageDark,
  },
  skillCardDesc: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  voiceWrap: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: Colors.brand.cream,
  },
  skipWakeButton: {
    marginTop: 10,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  skipWakeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
});
