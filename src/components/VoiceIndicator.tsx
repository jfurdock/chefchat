import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { VoiceState } from '@/src/stores/cookingStore';
import Colors from '@/constants/Colors';

type VoiceIndicatorProps = {
  voiceState: VoiceState;
  passiveListening?: boolean;
  transcriptText?: string;
  assistantText?: string;
  error?: string | null;
  onPress?: () => void;
};

function getStatusLabel(state: VoiceState, passiveListening: boolean) {
  if (state === 'listening' && passiveListening) return 'Listening for your voice';
  if (state === 'listening') return 'Listening...';
  if (state === 'processing') return 'Processing...';
  if (state === 'speaking') return 'Speaking...';
  return 'Microphone ready';
}

export default function VoiceIndicator({
  voiceState,
  passiveListening = false,
  transcriptText,
  assistantText,
  error,
  onPress,
}: VoiceIndicatorProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const bars = useRef([0, 1, 2].map(() => new Animated.Value(0.2))).current;

  useEffect(() => {
    if (voiceState !== 'listening' || passiveListening) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.15,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [passiveListening, pulse, voiceState]);

  useEffect(() => {
    if (voiceState !== 'speaking') {
      bars.forEach((bar) => {
        bar.stopAnimation();
        bar.setValue(0.2);
      });
      return;
    }

    const loops = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(bar, {
            toValue: 1,
            duration: 260,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.3,
            duration: 260,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [bars, voiceState]);

  const circleStyle = useMemo(
    () => [
      styles.circle,
      voiceState === 'listening' && styles.circleListening,
      voiceState === 'listening' && passiveListening && styles.circlePassive,
      voiceState === 'speaking' && styles.circleSpeaking,
      voiceState === 'processing' && styles.circleProcessing,
      { transform: [{ scale: passiveListening ? 1 : pulse }] },
    ],
    [passiveListening, voiceState, pulse]
  );

  const circle = (
    <Animated.View style={circleStyle}>
      <Ionicons
        name={voiceState === 'listening' && !passiveListening ? 'mic' : 'mic-outline'}
        size={30}
        color={
          voiceState === 'idle'
            ? Colors.light.textSecondary
            : passiveListening && voiceState === 'listening'
              ? Colors.brand.sageDark
              : Colors.brand.cream
        }
      />
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
          {circle}
        </TouchableOpacity>
      ) : (
        circle
      )}

      <Text style={styles.status}>{getStatusLabel(voiceState, passiveListening)}</Text>

      {voiceState === 'speaking' && (
        <View style={styles.waveRow}>
          {bars.map((bar, index) => (
            <Animated.View
              key={index}
              style={[
                styles.waveBar,
                {
                  transform: [{ scaleY: bar }],
                },
              ]}
            />
          ))}
        </View>
      )}

      {!!transcriptText && <Text style={styles.transcript}>You: {transcriptText}</Text>}
      {!!assistantText && <Text style={styles.assistant}>ChefChat: {assistantText}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 24,
    gap: 10,
    width: '100%',
  },
  circle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleListening: {
    backgroundColor: Colors.brand.sage,
    borderColor: Colors.brand.sage,
  },
  circlePassive: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderColor: Colors.brand.sage,
  },
  circleProcessing: {
    backgroundColor: Colors.brand.sageDark,
    borderColor: Colors.brand.sageDark,
  },
  circleSpeaking: {
    backgroundColor: Colors.brand.charcoal,
    borderColor: Colors.brand.charcoal,
  },
  status: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 20,
    gap: 5,
  },
  waveBar: {
    width: 5,
    height: 18,
    borderRadius: 4,
    backgroundColor: Colors.brand.sageDark,
  },
  transcript: {
    fontSize: 13,
    color: Colors.light.text,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  assistant: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  error: {
    fontSize: 12,
    color: '#b44545',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
