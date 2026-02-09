import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { doc, getDoc, getFirestore, updateDoc } from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import Colors from '@/constants/Colors';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Keto', 'None'];

export default function DietaryPreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => !loading && !saving && !!user?.uid, [loading, saving, user?.uid]);

  const loadPreferences = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const snap = await getDoc(doc(getFirestore(), 'users', user.uid));
      const raw = snap.data()?.dietaryPreferences;
      const prefs = Array.isArray(raw) ? raw.filter((item) => typeof item === 'string') : [];
      setSelected(prefs.length ? prefs : ['None']);
    } catch {
      setSelected(['None']);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  function togglePreference(pref: string) {
    setSelected((current) => {
      if (pref === 'None') return ['None'];

      const withoutNone = current.filter((item) => item !== 'None');
      return withoutNone.includes(pref)
        ? withoutNone.filter((item) => item !== pref)
        : [...withoutNone, pref];
    });
  }

  async function handleSave() {
    if (!user?.uid || saving) return;

    setSaving(true);
    try {
      const prefs = selected.filter((item) => item !== 'None');
      await updateDoc(doc(getFirestore(), 'users', user.uid), {
        dietaryPreferences: prefs,
      });
      setSaving(false);
      router.replace('/(main)/profile');
      return;
    } catch {
      Alert.alert('Save failed', 'Could not update dietary preferences right now.');
    }
    setSaving(false);
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.brand.sageDark} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Dietary Preferences</Text>
            <Text style={styles.subtitle}>Choose any restrictions you want ChefChat to consider.</Text>

            <View style={styles.chips}>
              {DIETARY_OPTIONS.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => togglePreference(option)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              onPress={() => void handleSave()}
              disabled={!canSave}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={Colors.brand.cream} />
              ) : (
                <Text style={styles.saveButtonText}>Save Preferences</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.textSecondary,
    marginBottom: 24,
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
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.brand.cream,
  },
  saveButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.brand.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: Colors.brand.cream,
    fontSize: 16,
    fontWeight: '700',
  },
});
