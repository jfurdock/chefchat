import { create } from 'zustand';
import { getAuth } from '@react-native-firebase/auth';
import { doc, getFirestore, updateDoc } from '@react-native-firebase/firestore';
import { setVoiceSettings } from '../services/ttsService';

type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

interface OnboardingState {
  voiceName: string | null;
  dietaryPreferences: string[];
  skillLevel: SkillLevel | null;

  setVoiceName: (name: string) => void;
  toggleDietaryPreference: (pref: string) => void;
  setSkillLevel: (level: SkillLevel) => void;
  complete: () => Promise<void>;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  voiceName: null,
  dietaryPreferences: [],
  skillLevel: null,

  setVoiceName: (voiceName) => set({ voiceName }),

  toggleDietaryPreference: (pref) =>
    set((state) => {
      if (pref === 'None') {
        return { dietaryPreferences: ['None'] };
      }
      const without = state.dietaryPreferences.filter((p) => p !== 'None');
      const exists = without.includes(pref);
      return {
        dietaryPreferences: exists ? without.filter((p) => p !== pref) : [...without, pref],
      };
    }),

  setSkillLevel: (skillLevel) => set({ skillLevel }),

  complete: async () => {
    const { voiceName, dietaryPreferences, skillLevel } = get();
    const user = getAuth().currentUser;
    if (!user) throw new Error('Not authenticated');

    // Save voice to AsyncStorage
    if (voiceName) {
      await setVoiceSettings({ voiceName, languageCode: 'en-US' });
    }

    // Save profile data to Firestore
    const prefs = dietaryPreferences.filter((p) => p !== 'None');
    const db = getFirestore();
    await updateDoc(doc(db, 'users', user.uid), {
      dietaryPreferences: prefs,
      skillLevel,
      onboardingCompleted: true,
    });
  },

  reset: () => set({ voiceName: null, dietaryPreferences: [], skillLevel: null }),
}));
