import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/hooks/useAuth';
import { signOut } from '@/src/services/authService';
import {
  DEFAULT_TTS_VOICE_OPTIONS,
  getVoiceSettings,
  interruptAndSpeak,
  listTtsVoices,
  setVoiceSettings,
  TtsVoiceOption,
  TtsVoiceSettings,
} from '@/src/services/ttsService';
import Colors from '@/constants/Colors';

function formatVoiceName(raw: string): string {
  return raw.replace(/^en-US-/, '').replace(/-/g, ' ');
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const [voiceSettings, setLocalVoiceSettings] = useState<TtsVoiceSettings | null>(null);
  const [voices, setVoices] = useState<TtsVoiceOption[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [savingVoiceName, setSavingVoiceName] = useState<string | null>(null);

  const visibleVoices = useMemo(() => {
    if (!voices.length) return DEFAULT_TTS_VOICE_OPTIONS;

    const preferred = voices.filter(
      (voice) =>
        voice.name.includes('Neural2') || voice.name.includes('Wavenet') || voice.name.includes('Studio')
    );

    return (preferred.length ? preferred : voices).slice(0, 8);
  }, [voices]);

  useEffect(() => {
    let mounted = true;

    const loadVoiceData = async () => {
      try {
        const [settings, voiceOptions] = await Promise.all([getVoiceSettings(), listTtsVoices('en-US')]);
        if (!mounted) return;
        setLocalVoiceSettings(settings);
        setVoices(voiceOptions);
      } finally {
        if (mounted) setLoadingVoices(false);
      }
    };

    void loadVoiceData();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  }

  async function handleSelectVoice(voice: TtsVoiceOption) {
    if (!voiceSettings || savingVoiceName) return;

    setSavingVoiceName(voice.name);
    try {
      const updated = await setVoiceSettings({
        voiceName: voice.name,
        languageCode: voice.languageCodes?.[0] || 'en-US',
      });
      setLocalVoiceSettings(updated);
      await interruptAndSpeak('Voice updated. I will guide you with this voice while you cook.');
    } catch {
      Alert.alert('Voice Update Failed', 'Could not change voice right now. Please try again.');
    } finally {
      setSavingVoiceName(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.displayName?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.name}>{user?.displayName || 'Chef'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Menu items */}
      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="nutrition-outline" size={22} color={Colors.light.text} />
          <Text style={styles.menuText}>Dietary Preferences</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="timer-outline" size={22} color={Colors.light.text} />
          <Text style={styles.menuText}>Cooking History</Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="mic-outline" size={22} color={Colors.light.text} />
          <Text style={styles.menuText}>Voice Settings (Inworld TTS)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.voiceSection}>
        <Text style={styles.voiceTitle}>Assistant Voice</Text>
        <Text style={styles.voiceSubtitle}>Pick the voice ChefChat uses during cooking mode.</Text>

        {loadingVoices ? (
          <Text style={styles.voiceLoading}>Loading voices...</Text>
        ) : (
          visibleVoices.map((voice) => {
            const selected = voiceSettings?.voiceName === voice.name;
            const saving = savingVoiceName === voice.name;
            return (
              <TouchableOpacity
                key={voice.name}
                style={[styles.voiceOption, selected && styles.voiceOptionSelected]}
                onPress={() => void handleSelectVoice(voice)}
                disabled={!!savingVoiceName}
              >
                <View style={styles.voiceOptionTextWrap}>
                  <Text style={[styles.voiceOptionTitle, selected && styles.voiceOptionTitleSelected]}>
                    {formatVoiceName(voice.name)}
                  </Text>
                  <Text style={styles.voiceOptionMeta}>
                    {voice.ssmlGender} • {voice.languageCodes?.[0] || 'en-US'}
                  </Text>
                </View>
                {saving ? (
                  <Text style={styles.voiceSaving}>Saving...</Text>
                ) : selected ? (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.brand.sageDark} />
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={22} color={Colors.light.text} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  content: {
    paddingBottom: 36,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brand.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.brand.cream,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 12,
  },
  email: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  menu: {
    backgroundColor: Colors.light.card,
    marginTop: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    color: Colors.light.text,
    flex: 1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    paddingVertical: 16,
    backgroundColor: Colors.light.card,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '600',
  },
  voiceSection: {
    marginTop: 20,
    backgroundColor: Colors.light.card,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 8,
  },
  voiceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  voiceSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  voiceLoading: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  voiceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  voiceOptionSelected: {
    backgroundColor: Colors.brand.cream,
  },
  voiceOptionTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  voiceOptionTitle: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '600',
  },
  voiceOptionTitleSelected: {
    color: Colors.brand.sageDark,
  },
  voiceOptionMeta: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  voiceSaving: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
});
