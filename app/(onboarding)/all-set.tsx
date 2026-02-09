import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import BrandLockup from '@/src/components/BrandLockup';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import Colors from '@/constants/Colors';

export default function AllSetScreen() {
  const router = useRouter();
  const complete = useOnboardingStore((s) => s.complete);
  const [saving, setSaving] = useState(false);

  async function handleFinish() {
    setSaving(true);
    try {
      await complete();
      router.replace('/(main)');
    } catch {
      Alert.alert('Could not finish onboarding', 'Please try again.');
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <BrandLockup size="md" showWordmark={false} />
        <Text style={styles.headline}>You're ready to cook!</Text>
        <Text style={styles.subtitle}>Your kitchen assistant is set up and waiting.</Text>
      </View>
      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={() => void handleFinish()}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={Colors.brand.cream} />
          ) : (
            <Text style={styles.buttonText}>Let's Cook!</Text>
          )}
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  bottom: {
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  button: {
    height: 52,
    backgroundColor: Colors.brand.sage,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.brand.cream,
    fontSize: 17,
    fontWeight: '600',
  },
});
