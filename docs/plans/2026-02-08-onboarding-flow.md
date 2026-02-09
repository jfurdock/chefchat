# Onboarding Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an 8-screen onboarding flow (feature discovery + personalization) that runs after signup before the main app.

**Architecture:** New `/(onboarding)` route group with a Stack navigator. An onboarding Zustand store collects selections across screens and writes them to Firestore + AsyncStorage on completion. The AuthGate checks a Firestore `onboardingCompleted` flag to route users.

**Tech Stack:** Expo Router, React Native, Zustand, Firebase Firestore, AsyncStorage, Ionicons, existing `ttsService`

---

### Task 1: Update Data Model

**Files:**
- Modify: `src/types/recipe.ts:55-63` (UserProfile interface)

**Step 1: Add new fields to UserProfile**

In `src/types/recipe.ts`, add two fields to the `UserProfile` interface:

```typescript
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  favorites: string[];
  dietaryPreferences: string[];
  cookingHistory: CookingRecord[];
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | null;
  onboardingCompleted: boolean;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}
```

**Step 2: Commit**

```bash
git add src/types/recipe.ts
git commit -m "feat(onboarding): add skillLevel and onboardingCompleted to UserProfile"
```

---

### Task 2: Update Signup to Initialize New Fields

**Files:**
- Modify: `src/services/authService.ts:35-43` (userProfile object in signUp)

**Step 1: Add new fields to the Firestore profile created on signup**

In `src/services/authService.ts`, update the `userProfile` object inside `signUp()`:

```typescript
const userProfile: Omit<UserProfile, 'createdAt'> & { createdAt: FirebaseFirestoreTypes.FieldValue } = {
  uid: credential.user.uid,
  displayName,
  email,
  favorites: [],
  dietaryPreferences: [],
  cookingHistory: [],
  skillLevel: null,
  onboardingCompleted: false,
  createdAt: serverTimestamp(),
};
```

**Step 2: Commit**

```bash
git add src/services/authService.ts
git commit -m "feat(onboarding): initialize onboardingCompleted=false on signup"
```

---

### Task 3: Update Default TTS Voice Options

**Files:**
- Modify: `src/services/ttsService.ts:60-63` (DEFAULT_TTS_VOICE_OPTIONS)

**Step 1: Replace Lily with Deborah in the defaults**

In `src/services/ttsService.ts`, update `DEFAULT_TTS_VOICE_OPTIONS`:

```typescript
export const DEFAULT_TTS_VOICE_OPTIONS: TtsVoiceOption[] = [
  { name: 'Dennis', languageCodes: ['en-US'], ssmlGender: 'MALE', naturalSampleRateHertz: 24000 },
  { name: 'Deborah', languageCodes: ['en-US'], ssmlGender: 'FEMALE', naturalSampleRateHertz: 24000 },
];
```

Also update `DEFAULT_SETTINGS` at line 53-58 to default to Dennis:

```typescript
const DEFAULT_SETTINGS: TtsVoiceSettings = {
  voiceName: 'Dennis',
  languageCode: 'en-US',
  speakingRate: TARGET_SPEAKING_RATE,
  pitch: 0,
};
```

**Step 2: Commit**

```bash
git add src/services/ttsService.ts
git commit -m "feat(onboarding): default voices to Dennis and Deborah"
```

---

### Task 4: Create Onboarding Store

**Files:**
- Create: `src/stores/onboardingStore.ts`

**Step 1: Create the Zustand store**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/stores/onboardingStore.ts
git commit -m "feat(onboarding): add onboarding Zustand store"
```

---

### Task 5: Create Onboarding Layout

**Files:**
- Create: `app/(onboarding)/_layout.tsx`

**Step 1: Create the Stack layout**

```typescript
import { Stack } from 'expo-router';
import Colors from '@/constants/Colors';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.brand.cream },
        animation: 'slide_from_right',
      }}
    />
  );
}
```

**Step 2: Commit**

```bash
git add app/\(onboarding\)/_layout.tsx
git commit -m "feat(onboarding): add onboarding route group layout"
```

---

### Task 6: Create Shared Onboarding Components

**Files:**
- Create: `src/components/onboarding/OnboardingScreen.tsx`

**Step 1: Create the shared wrapper component**

This component provides the common layout for all onboarding screens: progress dots, back arrow, next button, and optional skip link.

```typescript
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
```

**Step 2: Commit**

```bash
git add src/components/onboarding/OnboardingScreen.tsx
git commit -m "feat(onboarding): add shared OnboardingScreen wrapper component"
```

---

### Task 7: Create Screen 1 — Welcome

**Files:**
- Create: `app/(onboarding)/welcome.tsx`

**Step 1: Create the welcome screen**

```typescript
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/hooks/useAuth';
import BrandLockup from '@/src/components/BrandLockup';
import Colors from '@/constants/Colors';

export default function WelcomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] || 'Chef';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <BrandLockup size="lg" />
        <Text style={styles.headline}>Welcome, {firstName}!</Text>
        <Text style={styles.subtitle}>
          Your personal cooking assistant {'\u2014'} let's get you set up.
        </Text>
      </View>
      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/(onboarding)/voice-feature')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Get Started</Text>
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
    lineHeight: 22,
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
  buttonText: {
    color: Colors.brand.cream,
    fontSize: 17,
    fontWeight: '600',
  },
});
```

**Step 2: Commit**

```bash
git add app/\(onboarding\)/welcome.tsx
git commit -m "feat(onboarding): add welcome screen"
```

---

### Task 8: Create Screen 2 — Voice Feature

**Files:**
- Create: `app/(onboarding)/voice-feature.tsx`

**Step 1: Create the voice feature highlight screen**

```typescript
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OnboardingScreen from '@/src/components/onboarding/OnboardingScreen';
import Colors from '@/constants/Colors';

export default function VoiceFeatureScreen() {
  const router = useRouter();

  return (
    <OnboardingScreen
      onNext={() => router.push('/(onboarding)/voice-select')}
      showSkip
      currentStep={0}
    >
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="mic-outline" size={64} color={Colors.brand.sage} />
        </View>
        <Text style={styles.headline}>Cook hands-free</Text>
        <Text style={styles.body}>
          ChefChat guides you through every step with voice. Just say "next" to move forward, or ask questions while you cook.
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
```

**Step 2: Commit**

```bash
git add app/\(onboarding\)/voice-feature.tsx
git commit -m "feat(onboarding): add voice feature highlight screen"
```

---

### Task 9: Create Screen 3 — Voice Select

**Files:**
- Create: `app/(onboarding)/voice-select.tsx`

**Step 1: Create the voice selection screen**

Uses `ttsService.speakQueued()` with voice name override to play previews. Only shows Dennis and Deborah (from `DEFAULT_TTS_VOICE_OPTIONS`).

```typescript
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
                        name={playing ? 'volume-high' : 'play-circle-outline'}
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
```

**Step 2: Commit**

```bash
git add app/\(onboarding\)/voice-select.tsx
git commit -m "feat(onboarding): add voice selection screen with preview"
```

---

### Task 10: Create Screen 4 — Import Feature

**Files:**
- Create: `app/(onboarding)/import-feature.tsx`

**Step 1: Create the import feature highlight screen**

```typescript
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OnboardingScreen from '@/src/components/onboarding/OnboardingScreen';
import Colors from '@/constants/Colors';

const METHODS = [
  { icon: 'camera-outline' as const, label: 'Photo' },
  { icon: 'link-outline' as const, label: 'URL' },
  { icon: 'pencil-outline' as const, label: 'Manual' },
];

export default function ImportFeatureScreen() {
  const router = useRouter();

  return (
    <OnboardingScreen
      onNext={() => router.push('/(onboarding)/favorites-feature')}
      showSkip
      currentStep={2}
    >
      <View style={styles.center}>
        <Text style={styles.headline}>Bring your recipes</Text>
        <Text style={styles.body}>
          Import recipes from anywhere {'\u2014'} snap a photo of a cookbook, paste a URL, or type one in yourself.
        </Text>
        <View style={styles.methods}>
          {METHODS.map((m) => (
            <View key={m.label} style={styles.method}>
              <View style={styles.methodIcon}>
                <Ionicons name={m.icon} size={28} color={Colors.brand.sage} />
              </View>
              <Text style={styles.methodLabel}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  methods: {
    flexDirection: 'row',
    gap: 24,
  },
  method: {
    alignItems: 'center',
    gap: 8,
  },
  methodIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
});
```

**Step 2: Commit**

```bash
git add app/\(onboarding\)/import-feature.tsx
git commit -m "feat(onboarding): add recipe import feature screen"
```

---

### Task 11: Create Screen 5 — Favorites Feature

**Files:**
- Create: `app/(onboarding)/favorites-feature.tsx`

**Step 1: Create the browsing & favorites feature screen**

```typescript
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OnboardingScreen from '@/src/components/onboarding/OnboardingScreen';
import Colors from '@/constants/Colors';

export default function FavoritesFeatureScreen() {
  const router = useRouter();

  return (
    <OnboardingScreen
      onNext={() => router.push('/(onboarding)/shopping-feature')}
      showSkip
      currentStep={3}
    >
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="heart-outline" size={48} color={Colors.brand.sage} />
          <View style={styles.cardOverlay}>
            <Ionicons name="search-outline" size={20} color={Colors.light.textSecondary} />
          </View>
        </View>
        <Text style={styles.headline}>Find what you're craving</Text>
        <Text style={styles.body}>
          Browse recipes by protein, search by name, and save your favorites for quick access.
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brand.cream,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
```

**Step 2: Commit**

```bash
git add app/\(onboarding\)/favorites-feature.tsx
git commit -m "feat(onboarding): add browsing & favorites feature screen"
```

---

### Task 12: Create Screen 6 — Shopping Feature

**Files:**
- Create: `app/(onboarding)/shopping-feature.tsx`

**Step 1: Create the shopping & menu feature screen**

```typescript
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OnboardingScreen from '@/src/components/onboarding/OnboardingScreen';
import Colors from '@/constants/Colors';

export default function ShoppingFeatureScreen() {
  const router = useRouter();

  return (
    <OnboardingScreen
      onNext={() => router.push('/(onboarding)/personalization')}
      showSkip
      currentStep={4}
    >
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="cart-outline" size={56} color={Colors.brand.sage} />
        </View>
        <Text style={styles.headline}>Plan your week</Text>
        <Text style={styles.body}>
          Add recipes to your menu and ChefChat builds your shopping list automatically {'\u2014'} grouped by category.
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
```

**Step 2: Commit**

```bash
git add app/\(onboarding\)/shopping-feature.tsx
git commit -m "feat(onboarding): add shopping & menu feature screen"
```

---

### Task 13: Create Screen 7 — Personalization

**Files:**
- Create: `app/(onboarding)/personalization.tsx`

**Step 1: Create the personalization screen**

```typescript
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OnboardingScreen from '@/src/components/onboarding/OnboardingScreen';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import Colors from '@/constants/Colors';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Keto', 'None'];

const SKILL_LEVELS = [
  { key: 'beginner' as const, label: 'Beginner', desc: 'I follow recipes closely' },
  { key: 'intermediate' as const, label: 'Intermediate', desc: "I'm comfortable improvising" },
  { key: 'advanced' as const, label: 'Advanced', desc: 'I cook by instinct' },
];

export default function PersonalizationScreen() {
  const router = useRouter();
  const { dietaryPreferences, skillLevel, toggleDietaryPreference, setSkillLevel } =
    useOnboardingStore();

  return (
    <OnboardingScreen
      onNext={() => router.push('/(onboarding)/all-set')}
      nextDisabled={!skillLevel}
      showSkip={false}
      currentStep={5}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Dietary preferences */}
        <Text style={styles.sectionTitle}>Any dietary needs?</Text>
        <View style={styles.chips}>
          {DIETARY_OPTIONS.map((opt) => {
            const selected = dietaryPreferences.includes(opt);
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleDietaryPreference(opt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Skill level */}
        <Text style={[styles.sectionTitle, { marginTop: 36 }]}>
          How comfortable are you in the kitchen?
        </Text>
        <View style={styles.skillCards}>
          {SKILL_LEVELS.map((level) => {
            const selected = skillLevel === level.key;
            return (
              <TouchableOpacity
                key={level.key}
                style={[styles.skillCard, selected && styles.skillCardSelected]}
                onPress={() => setSkillLevel(level.key)}
                activeOpacity={0.7}
              >
                <View style={styles.skillCardText}>
                  <Text style={[styles.skillLabel, selected && styles.skillLabelSelected]}>
                    {level.label}
                  </Text>
                  <Text style={styles.skillDesc}>{level.desc}</Text>
                </View>
                {selected && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.brand.sageDark} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
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
  skillCards: {
    gap: 12,
  },
  skillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.light.card,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  skillCardSelected: {
    borderColor: Colors.brand.sage,
    backgroundColor: Colors.brand.cream,
  },
  skillCardText: {
    flex: 1,
    paddingRight: 12,
  },
  skillLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  skillLabelSelected: {
    color: Colors.brand.sageDark,
  },
  skillDesc: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
});
```

**Step 2: Commit**

```bash
git add app/\(onboarding\)/personalization.tsx
git commit -m "feat(onboarding): add personalization screen (dietary + skill level)"
```

---

### Task 14: Create Screen 8 — All Set

**Files:**
- Create: `app/(onboarding)/all-set.tsx`

**Step 1: Create the completion screen**

```typescript
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
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
```

**Step 2: Commit**

```bash
git add app/\(onboarding\)/all-set.tsx
git commit -m "feat(onboarding): add all-set completion screen"
```

---

### Task 15: Update AuthGate to Route Through Onboarding

**Files:**
- Modify: `app/_layout.tsx:1-69`
- Modify: `src/stores/authStore.ts:1-23`

**Step 1: Add onboarding state to auth store**

In `src/stores/authStore.ts`, add `onboardingCompleted` and a `setOnboardingCompleted` action:

```typescript
import { create } from 'zustand';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface AuthState {
  user: FirebaseAuthTypes.User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  onboardingCompleted: boolean | null; // null = not yet loaded
  setUser: (user: FirebaseAuthTypes.User | null) => void;
  setLoading: (loading: boolean) => void;
  setOnboardingCompleted: (completed: boolean | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  onboardingCompleted: null,
  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
}));
```

**Step 2: Update AuthGate in `app/_layout.tsx`**

The AuthGate must fetch the user's Firestore profile to check `onboardingCompleted`. Update the entire file:

```typescript
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { doc, getDoc, getFirestore } from '@react-native-firebase/firestore';
import { useAuthListener, useAuth } from '@/src/hooks/useAuth';
import { useAuthStore } from '@/src/stores/authStore';
import Colors from '@/constants/Colors';
import 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);
  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);
  const segments = useSegments();
  const router = useRouter();

  // Fetch onboarding status when user changes
  useEffect(() => {
    if (!user) {
      setOnboardingCompleted(null);
      return;
    }

    let mounted = true;
    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(getFirestore(), 'users', user.uid));
        if (!mounted) return;
        const data = snap.data();
        setOnboardingCompleted(data?.onboardingCompleted === true);
      } catch {
        if (mounted) setOnboardingCompleted(false);
      }
    };

    void fetchProfile();
    return () => { mounted = false; };
  }, [user?.uid]);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && onboardingCompleted === null) return; // still loading profile

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      if (onboardingCompleted === false) {
        router.replace('/(onboarding)/welcome');
      } else {
        router.replace('/(main)');
      }
    } else if (isAuthenticated && !inOnboardingGroup && onboardingCompleted === false) {
      router.replace('/(onboarding)/welcome');
    } else if (isAuthenticated && inOnboardingGroup && onboardingCompleted === true) {
      router.replace('/(main)');
    }
  }, [isAuthenticated, isLoading, onboardingCompleted, segments]);

  useEffect(() => {
    if (!isLoading && (onboardingCompleted !== null || !isAuthenticated)) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, onboardingCompleted, isAuthenticated]);

  if (isLoading || (isAuthenticated && onboardingCompleted === null)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.brand.sageDark} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  useAuthListener();

  return (
    <>
      <StatusBar style="auto" />
      <AuthGate />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.brand.cream,
  },
});
```

**Step 3: Commit**

```bash
git add src/stores/authStore.ts app/_layout.tsx
git commit -m "feat(onboarding): update AuthGate to route through onboarding flow"
```

---

### Task 16: Manual Smoke Test

**No files changed — verification only.**

**Step 1: Start the dev server**

Run: `npx expo start`

**Step 2: Test the full flow**

1. Create a new account via signup
2. Verify you land on the Welcome screen (not Recipes tab)
3. Tap "Get Started" → Voice Feature screen
4. Tap "Next" or "Skip" → Voice Select screen
5. Tap Dennis or Deborah, hear the preview, see the selection highlight
6. Tap "Next" → Import Feature screen
7. Navigate through Favorites → Shopping → Personalization
8. Select a skill level, pick some dietary preferences
9. Tap "Next" → All Set screen
10. Tap "Let's Cook!" → Main app (Recipes tab)
11. Kill and reopen the app → should go directly to main app (not onboarding)
12. Verify voice selection persisted by checking Profile → Voice Settings

**Step 3: Test existing user path**

1. Sign out and sign back in with an existing account
2. If `onboardingCompleted` is missing from their Firestore doc, they should see onboarding
3. After completing onboarding, they should never see it again
