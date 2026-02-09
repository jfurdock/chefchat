# Onboarding Flow Design

## Overview

An 8-screen onboarding flow that runs immediately after signup, before the user ever sees the main app. Combines feature discovery with personalization (voice selection, dietary preferences, skill level).

## Trigger

The AuthGate in `app/_layout.tsx` checks `onboardingCompleted` on the user's Firestore profile. If `false`, routes to `/(onboarding)/welcome`. If `true`, routes to `/(main)`.

## Flow

### Screen 1: Welcome

- Layout: Centered content, no navigation chrome
- ChefChat logo/icon at top
- Headline: "Welcome, {firstName}!"
- Subtitle: "Your personal cooking assistant — let's get you set up."
- Single "Get Started" button
- No skip, no back

### Screen 2: Voice-Guided Cooking (Feature)

- Top: Illustration/icon (waveform or mic with chef hat)
- Headline: "Cook hands-free"
- Body: "ChefChat guides you through every step with voice. Just say 'next' to move forward, or ask questions while you cook."
- Progress dots, "Next" button + "Skip" link, back arrow

### Screen 3: Pick Your Voice

- Headline: "Choose your chef"
- Subtitle: "Pick the voice that'll guide you in the kitchen."
- Two voice cards, vertically stacked:
  - **Dennis** — Male, tap to hear preview
  - **Deborah** — Female, tap to hear preview
- Tapping a card plays a sample: e.g., "Hi, I'm Dennis! I'll walk you through every recipe, step by step."
- Selected card: sage green border + checkmark
- No default pre-selected — user must pick one
- "Next" button disabled until a voice is selected
- Back arrow, no skip

### Screen 4: Recipe Import (Feature)

- Headline: "Bring your recipes"
- Body: "Import recipes from anywhere — snap a photo of a cookbook, paste a URL, or type one in yourself."
- Three icon+label groups:
  - Camera icon — "Photo"
  - Link icon — "URL"
  - Pencil icon — "Manual"
- Progress dots, "Next" button + "Skip" link, back arrow

### Screen 5: Browsing & Favorites (Feature)

- Headline: "Find what you're craving"
- Body: "Browse recipes by protein, search by name, and save your favorites for quick access."
- Illustration: stylized recipe card with heart icon
- Progress dots, "Next" button + "Skip" link, back arrow

### Screen 6: Shopping Lists & Menu Planning (Feature)

- Headline: "Plan your week"
- Body: "Add recipes to your menu and ChefChat builds your shopping list automatically — grouped by category."
- Illustration: stylized checklist or cart icon
- Progress dots, "Next" button + "Skip" link, back arrow

### Screen 7: Personalization

- **Section 1 — Dietary Preferences**
  - Headline: "Any dietary needs?"
  - Multi-select chips: Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut-Free, Keto, None
  - Selecting "None" deselects others and vice versa
- **Section 2 — Skill Level**
  - Headline: "How comfortable are you in the kitchen?"
  - Three single-select cards:
    - Beginner — "I follow recipes closely"
    - Intermediate — "I'm comfortable improvising"
    - Advanced — "I cook by instinct"
- "Next" button disabled until skill level is selected (dietary can be empty if "None")
- Back arrow, no skip

### Screen 8: All Set

- Centered, celebratory layout
- Chef hat icon or small animation
- Headline: "You're ready to cook!"
- Subtitle: "Your kitchen assistant is set up and waiting."
- Single "Let's Cook!" button
- Saves all onboarding data and navigates to main app
- No back, no skip

## Technical Implementation

### Data Model Changes (`src/types/recipe.ts`)

Add to `UserProfile`:

```typescript
onboardingCompleted: boolean;
skillLevel: 'beginner' | 'intermediate' | 'advanced' | null;
```

`dietaryPreferences: string[]` already exists.

### Routing (`app/(onboarding)/`)

New route group with its own `_layout.tsx` (stack navigator, no headers):

- `welcome.tsx`
- `voice-feature.tsx`
- `voice-select.tsx`
- `import-feature.tsx`
- `favorites-feature.tsx`
- `shopping-feature.tsx`
- `personalization.tsx`
- `all-set.tsx`

### AuthGate Update (`app/_layout.tsx`)

After auth check, fetch user profile from Firestore:

- If `onboardingCompleted === false` or missing → route to `/(onboarding)/welcome`
- If `onboardingCompleted === true` → route to `/(main)`

### Onboarding Store (`src/stores/onboardingStore.ts`)

Zustand store (ephemeral, no persistence):

```typescript
interface OnboardingState {
  voiceName: string | null;
  dietaryPreferences: string[];
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | null;

  setVoiceName: (name: string) => void;
  toggleDietaryPreference: (pref: string) => void;
  setSkillLevel: (level: 'beginner' | 'intermediate' | 'advanced') => void;
  complete: () => Promise<void>; // writes to Firestore + AsyncStorage
}
```

`complete()` action:

1. Writes `dietaryPreferences`, `skillLevel`, `onboardingCompleted: true` to Firestore user profile
2. Saves voice selection to AsyncStorage via `ttsService.setVoiceSettings()`
3. Navigates to `/(main)`

### Voice Preview

- Reuse `ttsService.speakQueued()` with short sample text per voice
- Pass selected voice name as override in options
- Sample text: "Hi, I'm {name}! I'll walk you through every recipe, step by step."

### Signup Update (`src/services/authService.ts`)

When creating user profile in Firestore, set:

```typescript
onboardingCompleted: false,
skillLevel: null,
```

## Progress Indicator

Dot-based progress indicator across screens 2-7 (6 dots). Welcome (screen 1) and All Set (screen 8) have no progress indicator.

## Skip Behavior

- Feature screens (2, 4, 5, 6): "Skip" link advances to next screen
- Voice select (3) and Personalization (7): No skip — required
- Welcome (1) and All Set (8): No skip (single CTA only)
