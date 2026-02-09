import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import Colors from '@/constants/Colors';
import { requestInworldCookingReply } from '@/src/services/chatService';
import { interruptAndSpeak, stopSpeaking } from '@/src/services/ttsService';
import { useAuthStore } from '@/src/stores/authStore';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
};

type VoiceUiState = 'idle' | 'listening' | 'processing' | 'speaking';

function formatFirstName(
  displayName?: string | null,
  email?: string | null,
  phone?: string | null,
): string {
  const fromDisplay = (displayName || '').trim().split(/\s+/)[0];
  if (fromDisplay) return fromDisplay;

  const fromEmail = (email || '').split('@')[0]?.trim();
  if (fromEmail) return fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1);

  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length >= 4) return `Chef ${digits.slice(-4)}`;
  return 'Chef';
}

function dayPeriod(date: Date): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function normalizeForDedup(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function primaryTranscript(event: ExpoSpeechRecognitionResultEvent): string {
  const results = event.results;
  if (!results?.length) return '';
  const latest = results[results.length - 1];
  return (latest?.transcript || '').trim();
}

const QUICK_PROMPTS = [
  'How long and what temperature should I roast carrots?',
  'What is a substitute for heavy cream?',
  'How do I know when chicken is fully cooked?',
  'How can I fix a sauce that is too salty?',
];
const VOICE_INACTIVITY_COMMIT_MS = 2600;

export default function AssistantScreen() {
  const user = useAuthStore((s) => s.user);
  const firstName = useMemo(
    () => formatFirstName(user?.displayName, user?.email, user?.phoneNumber),
    [user?.displayName, user?.email, user?.phoneNumber],
  );
  const greeting = useMemo(
    () => `Hi ${firstName}. What are we cooking this ${dayPeriod(new Date())}?`,
    [firstName],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'assistant-greeting', role: 'assistant', content: greeting },
  ]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceUiState>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const shouldListenRef = useRef(false);
  const isFocusedRef = useRef(false);
  const recognitionActiveRef = useRef(false);
  const isSendingRef = useRef(false);
  const voiceStateRef = useRef<VoiceUiState>('idle');
  const lastProcessedUtteranceRef = useRef<{
    normalized: string;
    at: number;
  } | null>(null);
  const inactivityCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    isSendingRef.current = isSending;
  }, [isSending]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length, liveTranscript, isSending]);

  const clearInactivityCommitTimer = useCallback(() => {
    if (!inactivityCommitTimerRef.current) return;
    clearTimeout(inactivityCommitTimerRef.current);
    inactivityCommitTimerRef.current = null;
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
    if (!shouldListenRef.current) return;
    if (!isFocusedRef.current) return;
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

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? draft).trim();
    if (!text || isSendingRef.current) return;

    clearInactivityCommitTimer();
    setLiveTranscript('');
    stopRecognition();

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setDraft('');
    setIsSending(true);
    setVoiceState('processing');
    setError(null);

    try {
      const responseText = await requestInworldCookingReply({
        userMessage: text,
        currentStep: 1,
        recipe: null,
        conversationHistory: nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantReply =
        responseText ||
        "I couldn't pull that in right now. Ask again and I'll help with your cooking question.";

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantReply,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setVoiceState('speaking');
      await interruptAndSpeak(assistantReply);
    } catch (error: any) {
      const assistantReply =
        error?.message || 'I hit a network issue. Ask again and I will keep helping.';
      const assistantMsg: ChatMessage = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: assistantReply,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setVoiceState('speaking');
      try {
        await interruptAndSpeak(assistantReply);
      } catch {
        // no-op
      }
    } finally {
      setIsSending(false);
      if (isFocusedRef.current && shouldListenRef.current) {
        await startRecognition();
      } else {
        setVoiceState('idle');
      }
    }
  }, [clearInactivityCommitTimer, draft, messages, startRecognition, stopRecognition]);

  const commitVoiceTranscript = useCallback((transcript: string) => {
    const normalized = normalizeForDedup(transcript);
    if (!normalized) return;

    const lastProcessed = lastProcessedUtteranceRef.current;
    if (
      lastProcessed &&
      lastProcessed.normalized === normalized &&
      Date.now() - lastProcessed.at < 2500
    ) {
      return;
    }

    lastProcessedUtteranceRef.current = {
      normalized,
      at: Date.now(),
    };

    void sendMessage(transcript);
  }, [sendMessage]);

  const scheduleVoiceInactivityCommit = useCallback((transcript: string) => {
    clearInactivityCommitTimer();
    inactivityCommitTimerRef.current = setTimeout(() => {
      if (!shouldListenRef.current || !isFocusedRef.current) return;
      if (isSendingRef.current || voiceStateRef.current === 'speaking') return;
      if (!recognitionActiveRef.current) return;
      commitVoiceTranscript(transcript);
    }, VOICE_INACTIVITY_COMMIT_MS);
  }, [clearInactivityCommitTimer, commitVoiceTranscript]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      shouldListenRef.current = true;
      setError(null);
      setLiveTranscript('');

      const greetingMessage: ChatMessage = {
        id: `assistant-greeting-${Date.now()}`,
        role: 'assistant',
        content: greeting,
      };
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.content === greeting) return prev;
        return [...prev, greetingMessage];
      });

      void (async () => {
        const granted = await requestVoicePermission();
        if (!granted) {
          setVoiceState('idle');
          setError('Microphone and speech recognition permissions are required.');
          return;
        }

        try {
          setVoiceState('speaking');
          await interruptAndSpeak(greeting);
        } catch {
          // no-op
        }

        if (isFocusedRef.current && shouldListenRef.current && !isSendingRef.current) {
          await startRecognition();
        }
      })();

      return () => {
        isFocusedRef.current = false;
        shouldListenRef.current = false;
        setVoiceState('idle');
        setLiveTranscript('');
        clearInactivityCommitTimer();
        stopRecognition();
        void stopSpeaking(true);
      };
    }, [clearInactivityCommitTimer, greeting, requestVoicePermission, startRecognition, stopRecognition]),
  );

  useEffect(() => {
    const startSub = ExpoSpeechRecognitionModule.addListener('start', () => {
      recognitionActiveRef.current = true;
      if (shouldListenRef.current && !isSendingRef.current) {
        setVoiceState('listening');
      }
    });

    const resultSub = ExpoSpeechRecognitionModule.addListener(
      'result',
      (event: ExpoSpeechRecognitionResultEvent) => {
        if (!shouldListenRef.current || !isFocusedRef.current) return;
        if (isSendingRef.current) return;
        if (voiceStateRef.current === 'speaking') return;

        const transcript = primaryTranscript(event);
        if (!transcript) return;

        setLiveTranscript(transcript);

        if (!event.isFinal) {
          scheduleVoiceInactivityCommit(transcript);
          return;
        }

        clearInactivityCommitTimer();
        commitVoiceTranscript(transcript);
      },
    );

    const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
      recognitionActiveRef.current = false;
      if (!shouldListenRef.current || !isFocusedRef.current) return;
      if (isSendingRef.current || voiceStateRef.current === 'speaking') return;

      setTimeout(() => {
        if (!shouldListenRef.current || !isFocusedRef.current) return;
        if (recognitionActiveRef.current) return;
        if (isSendingRef.current || voiceStateRef.current === 'speaking') return;
        void startRecognition();
      }, 220);
    });

    const errorSub = ExpoSpeechRecognitionModule.addListener(
      'error',
      (event: ExpoSpeechRecognitionErrorEvent) => {
        recognitionActiveRef.current = false;
        if (!shouldListenRef.current || !isFocusedRef.current) return;

        setVoiceState('idle');
        setError(`Speech ${event.error}: ${event.message}`);

        if (isSendingRef.current || voiceStateRef.current === 'speaking') return;
        setTimeout(() => {
          if (!shouldListenRef.current || !isFocusedRef.current) return;
          if (recognitionActiveRef.current) return;
          if (isSendingRef.current || voiceStateRef.current === 'speaking') return;
          void startRecognition();
        }, 420);
      },
    );

    return () => {
      clearInactivityCommitTimer();
      startSub.remove();
      resultSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, [clearInactivityCommitTimer, commitVoiceTranscript, scheduleVoiceInactivityCommit, startRecognition]);

  const voiceStatusLabel =
    voiceState === 'listening'
      ? 'Listening by default. Ask your cooking question.'
      : voiceState === 'processing'
        ? 'Thinking...'
        : voiceState === 'speaking'
          ? 'Speaking...'
          : 'Voice paused';

  const toggleListening = async () => {
    if (shouldListenRef.current) {
      shouldListenRef.current = false;
      setVoiceState('idle');
      setLiveTranscript('');
      clearInactivityCommitTimer();
      stopRecognition();
      return;
    }

    shouldListenRef.current = true;
    setError(null);
    await startRecognition();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 84, android: 0 })}
    >
      <View style={styles.header}>
        <Text style={styles.title}>ChefChat Assistant</Text>
        <Text style={styles.subtitle}>Ask any cooking question while you cook.</Text>
        <View style={styles.voiceStatusRow}>
          <Ionicons
            name={voiceState === 'listening' ? 'mic' : 'mic-off'}
            size={16}
            color={voiceState === 'listening' ? Colors.brand.sageDark : Colors.light.textSecondary}
          />
          <Text style={styles.voiceStatusText}>{voiceStatusLabel}</Text>
          <TouchableOpacity style={styles.voiceToggle} onPress={() => void toggleListening()}>
            <Text style={styles.voiceToggleText}>
              {voiceState === 'listening' ? 'Pause' : 'Resume'}
            </Text>
          </TouchableOpacity>
        </View>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
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
              style={[
                styles.bubble,
                isUser ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
            >
              <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
                {message.content}
              </Text>
            </View>
          );
        })}

        {isSending && (
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <ActivityIndicator size="small" color={Colors.brand.sageDark} />
          </View>
        )}

        {!!liveTranscript && !isSending && (
          <View style={[styles.bubble, styles.bubbleUserDraft]}>
            <Text style={styles.bubbleTextDraft}>{liveTranscript}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.quickPromptWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {QUICK_PROMPTS.map((prompt) => (
            <TouchableOpacity
              key={prompt}
              style={styles.quickPrompt}
              onPress={() => void sendMessage(prompt)}
            >
              <Text style={styles.quickPromptText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask anything about cooking..."
          placeholderTextColor={Colors.light.textSecondary}
          multiline
          maxLength={600}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={() => void sendMessage()}
          disabled={!draft.trim() || isSending}
        >
          <Ionicons name="arrow-up" size={18} color={Colors.brand.cream} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingBottom: 10,
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
  voiceStatusRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceStatusText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  voiceToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  voiceToggleText: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#B45145',
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
    maxWidth: '86%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  quickPromptWrap: {
    paddingBottom: 6,
  },
  quickPrompt: {
    marginLeft: 12,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  quickPromptText: {
    color: Colors.light.textSecondary,
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.select({ ios: 28, android: 12 }),
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.brand.cream,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 14,
    backgroundColor: Colors.light.backgroundSecondary,
    color: Colors.light.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.brand.sageDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
