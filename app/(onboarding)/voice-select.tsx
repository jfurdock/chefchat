import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OnboardingScreen from '@/src/components/onboarding/OnboardingScreen';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { DEFAULT_TTS_VOICE_OPTIONS, stopSpeaking, speakQueued } from '@/src/services/ttsService';
import Colors from '@/constants/Colors';

export default function VoiceSelectScreen() {
  const router = useRouter();
  const { voiceName, setVoiceName } = useOnboardingStore();
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  async function handlePreview(name: string) {
    if (playingVoice) {
      await stopSpeaking();
      if (playingVoice === name) {
        setPlayingVoice(null);
        return;
      }
    }
    setPlayingVoice(name);
    setVoiceName(name);
    try {
      await speakQueued(
        `Hi, I'm ${name}! I'll walk you through every recipe, step by step.`,
        { voiceName: name, languageCode: 'en-US', onDone: () => setPlayingVoice(null) }
      );
    } catch {
      // Ignore preview errors
    }
    setPlayingVoice(null);
  }

  return (
    <OnboardingScreen
      onNext={() => {
        void stopSpeaking();
        router.push('/(onboarding)/import-feature');
      }}
      nextDisabled={!voiceName}
      showSkip={false}
      currentStep={1}
    >
      <View>
        <Text style={styles.headline}>Choose your chef</Text>
        <Text style={styles.subtitle}>Pick the voice that'll guide you in the kitchen.</Text>

        <View style={styles.cards}>
          {DEFAULT_TTS_VOICE_OPTIONS.map((voice) => {
            const selected = voiceName === voice.name;
            const playing = playingVoice === voice.name;
            return (
              <TouchableOpacity
                key={voice.name}
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => void handlePreview(voice.name)}
                activeOpacity={0.7}
              >
                <View style={styles.cardLeft}>
                  <View style={styles.cardIcon}>
                    {playing ? (
                      <ActivityIndicator size="small" color={Colors.brand.sage} />
                    ) : (
                      <Ionicons
                        name="play-circle-outline"
                        size={28}
                        color={selected ? Colors.brand.sageDark : Colors.light.textSecondary}
                      />
                    )}
                  </View>
                  <View>
                    <Text style={[styles.cardName, selected && styles.cardNameSelected]}>
                      {voice.name}
                    </Text>
                    <Text style={styles.cardGender}>
                      {voice.ssmlGender === 'MALE' ? 'Male' : 'Female'}
                    </Text>
                  </View>
                </View>
                {selected && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.brand.sageDark} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.hint}>Tap a voice to hear a preview</Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  cards: {
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 16,
    backgroundColor: Colors.light.card,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  cardSelected: {
    borderColor: Colors.brand.sage,
    backgroundColor: Colors.brand.cream,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  cardNameSelected: {
    color: Colors.brand.sageDark,
  },
  cardGender: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  hint: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
});
