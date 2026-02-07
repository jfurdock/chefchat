# ChefChat — Hands-Free Cooking Assistant

## Implementation Plan

---

## 1. Overview

ChefChat is a React Native (Expo) + Firebase app that lets users cook entirely hands-free. Users select a recipe, set the phone down, and interact with an AI cooking assistant through natural voice conversation. The AI walks them through each step, answers questions, and suggests ingredient substitutions — all without touching the screen.

### Tech Stack Summary

| Layer | Technology |
|---|---|
| **Framework** | React Native via Expo SDK 54 |
| **Navigation** | Expo Router v5 (file-based routing) |
| **Backend** | Firebase (Firestore, Auth, Cloud Functions) |
| **AI** | Google Gemini (via Firebase AI Logic / `@react-native-firebase/ai`) |
| **Speech-to-Text** | Google Cloud Speech-to-Text API (via Cloud Function proxy) |
| **Text-to-Speech** | `expo-speech` (on-device) or Google Cloud TTS (higher quality) |
| **Audio Capture** | `expo-audio` with config plugin for mic permissions |
| **State Management** | Zustand (lightweight, minimal boilerplate) |
| **Auth** | Firebase Auth with `@react-native-async-storage/async-storage` for persistence |

---

## 2. Architecture

### High-Level Flow

```
┌─────────────┐     voice      ┌──────────────────┐
│  User speaks │ ──────────────▶│  expo-audio       │
│  (hands-free)│                │  (mic capture)    │
└─────────────┘                └────────┬─────────┘
                                        │ audio chunks
                                        ▼
                               ┌──────────────────┐
                               │  Cloud Function   │
                               │  (STT proxy)      │
                               │  Google Speech API │
                               └────────┬─────────┘
                                        │ transcript text
                                        ▼
                               ┌──────────────────┐
                               │  Cloud Function   │
                               │  (Gemini AI)      │
                               │  + function calling│
                               └──┬────────────┬──┘
                                  │            │
                          Firestore│            │ response text
                          lookups  │            ▼
                               ┌───┴──┐  ┌──────────────┐
                               │Recipe│  │  expo-speech  │
                               │  DB  │  │  (TTS output) │
                               └──────┘  └──────┬───────┘
                                                │ audio
                                                ▼
                                        ┌─────────────┐
                                        │  User hears  │
                                        │  response    │
                                        └─────────────┘
```

### Why Cloud Functions as a proxy?

Routing STT and Gemini calls through Cloud Functions (rather than calling directly from the client) gives you:

- **Security**: API keys and service account credentials stay server-side.
- **Flexibility**: You can pre-process transcripts, inject system prompts, and manage conversation history server-side.
- **Cost control**: Rate limiting and usage tracking happen in one place.
- **Gemini function calling**: The Cloud Function can execute Firestore lookups when Gemini calls a tool (e.g., "look up the recipe for chicken parmesan").

---

## 3. Project Structure

```
chefchat/
├── app/                              # Expo Router screens
│   ├── _layout.tsx                   # Root layout (auth gate)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (main)/
│   │   ├── _layout.tsx               # Tab navigator
│   │   ├── index.tsx                 # Home / recipe browser
│   │   ├── recipe/
│   │   │   ├── [id].tsx              # Recipe detail screen
│   │   │   └── cook/
│   │   │       └── [id].tsx          # Cooking session screen (voice UI)
│   │   ├── favorites.tsx
│   │   └── profile.tsx
├── src/
│   ├── config/
│   │   └── firebase.ts              # Firebase init
│   ├── services/
│   │   ├── authService.ts           # Sign in / sign up / sign out
│   │   ├── recipeService.ts         # Firestore recipe CRUD
│   │   ├── voiceService.ts          # Audio recording + STT integration
│   │   ├── aiService.ts             # Cloud Function calls for Gemini
│   │   └── ttsService.ts            # Text-to-speech wrapper
│   ├── hooks/
│   │   ├── useAuth.ts               # Auth state hook
│   │   ├── useCookingSession.ts     # Manages voice loop + AI conversation
│   │   ├── useRecipes.ts            # Recipe fetching + search
│   │   └── useVoice.ts              # Mic recording + transcript
│   ├── stores/
│   │   ├── authStore.ts             # Zustand auth store
│   │   └── cookingStore.ts          # Zustand cooking session state
│   ├── context/
│   │   └── AuthContext.tsx           # Auth provider wrapping the app
│   ├── components/
│   │   ├── RecipeCard.tsx
│   │   ├── CookingUI.tsx            # Minimal visual UI for cooking mode
│   │   ├── VoiceIndicator.tsx       # Pulsing mic / listening animation
│   │   ├── StepProgress.tsx         # Visual step tracker
│   │   └── SubstitutionCard.tsx
│   ├── types/
│   │   ├── recipe.ts
│   │   ├── conversation.ts
│   │   └── navigation.ts
│   └── utils/
│       ├── audioHelpers.ts          # Audio format conversion
│       └── recipeParser.ts          # Normalize recipe data for AI context
├── functions/                        # Firebase Cloud Functions (Node.js)
│   ├── src/
│   │   ├── index.ts                 # Function exports
│   │   ├── stt.ts                   # Speech-to-text endpoint
│   │   ├── chat.ts                  # Gemini conversation endpoint
│   │   └── tools/
│   │       ├── recipeTools.ts       # Gemini function calling tools
│   │       └── substitutionTools.ts # Ingredient substitution logic
│   ├── package.json
│   └── tsconfig.json
├── app.json                          # Expo config + plugins
├── eas.json                          # EAS Build config
├── firestore.rules                   # Security rules
├── firestore.indexes.json
├── firebase.json                     # Firebase project config
└── package.json
```

---

## 4. Data Models

### 4.1 Firestore Schema

#### `recipes` collection

```typescript
interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  cuisine: string;
  tags: string[];                        // e.g., ['vegetarian', 'quick', 'italian']
  ingredients: Ingredient[];
  steps: Step[];
  substitutions: SubstitutionMap;        // Pre-defined substitutions
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Ingredient {
  name: string;                          // e.g., "garlic"
  quantity: number;                      // e.g., 3
  unit: string;                          // e.g., "cloves"
  preparation?: string;                  // e.g., "minced"
  isOptional: boolean;
  category: 'produce' | 'protein' | 'dairy' | 'pantry' | 'spice' | 'other';
}

interface Step {
  number: number;                        // 1-indexed
  instruction: string;                   // Full instruction text
  duration?: number;                     // Estimated seconds
  timerRequired: boolean;                // Should the app offer a timer?
  tips?: string;                         // Optional cooking tip
}

// Maps ingredient name → array of possible substitutions
interface SubstitutionMap {
  [ingredientName: string]: Substitution[];
}

interface Substitution {
  name: string;                          // e.g., "shallots"
  ratio: string;                         // e.g., "1 shallot per 3 cloves garlic"
  notes: string;                         // e.g., "milder flavor, works well in sauces"
}
```

#### `users` collection

```typescript
interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  favorites: string[];                   // Recipe IDs
  dietaryPreferences: string[];          // e.g., ['gluten-free', 'nut-free']
  cookingHistory: CookingRecord[];
  createdAt: Timestamp;
}

interface CookingRecord {
  recipeId: string;
  completedAt: Timestamp;
  rating?: number;                       // 1-5
  notes?: string;
}
```

#### `conversations` collection (for session persistence)

```typescript
interface ConversationSession {
  id: string;
  userId: string;
  recipeId: string;
  currentStep: number;
  messages: ConversationMessage[];
  substitutionsMade: { original: string; replacement: string }[];
  startedAt: Timestamp;
  endedAt?: Timestamp;
  status: 'active' | 'completed' | 'abandoned';
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Timestamp;
}
```

---

## 5. Implementation Phases

### Phase 1 — Foundation (Week 1-2)

**Goal**: Scaffold the app, set up Firebase, build recipe browsing.

#### Tasks

1. **Initialize the Expo project**
   ```bash
   npx create-expo-app chefchat --template tabs
   cd chefchat
   npx expo install expo-dev-client
   ```

2. **Install core dependencies**
   ```bash
   # Firebase
   npx expo install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-native-firebase/functions

   # Navigation (already included with Expo Router)
   npx expo install expo-router expo-linking expo-constants

   # State management
   npm install zustand

   # Async storage for auth persistence
   npx expo install @react-native-async-storage/async-storage

   # Build properties (needed for Firebase iOS)
   npx expo install expo-build-properties
   ```

3. **Configure `app.json`**
   ```json
   {
     "expo": {
       "plugins": [
         "@react-native-firebase/app",
         "@react-native-firebase/auth",
         "@react-native-firebase/firestore",
         [
           "expo-build-properties",
           {
             "ios": {
               "useFrameworks": "static"
             }
           }
         ]
       ]
     }
   }
   ```

4. **Set up Firebase project**
   - Create project in Firebase Console
   - Enable Authentication (Email/Password + Google Sign-In)
   - Create Firestore database
   - Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
   - Place in project root

5. **Implement auth flow**
   - `AuthContext.tsx` wrapping the app with `onAuthStateChanged` listener
   - Login / Signup screens using Firebase Auth
   - Protected route layout in `app/(main)/_layout.tsx`

6. **Build recipe browsing UI**
   - Home screen with recipe cards (grid or list)
   - Recipe detail screen with ingredients, steps, and "Start Cooking" button
   - Favorites functionality (Firestore write to user profile)
   - Basic search/filter by cuisine, tags, difficulty

7. **Seed the recipe database**
   - Write a Firebase seed script (`scripts/seedRecipes.ts`) to populate Firestore with 10-20 starter recipes
   - Include well-structured ingredients, steps, and substitution maps

#### Deliverables
- Working app with auth, recipe browsing, and Firestore integration
- Development builds for iOS and Android via EAS

---

### Phase 2 — Voice Pipeline (Week 3-4)

**Goal**: Get microphone capture, speech-to-text, and text-to-speech working end-to-end.

#### Tasks

1. **Install audio dependencies**
   ```bash
   npx expo install expo-audio expo-speech
   ```

2. **Configure mic permissions in `app.json`**
   ```json
   {
     "expo": {
       "plugins": [
         [
           "expo-audio",
           {
             "microphonePermission": "ChefChat needs microphone access so you can cook hands-free."
           }
         ]
       ]
     }
   }
   ```

3. **Build `voiceService.ts`**
   - Use `expo-audio`'s `useAudioRecorder` hook to capture audio
   - Record in short segments (e.g., 3-5 second chunks) for near-real-time transcription
   - Implement voice activity detection (VAD): detect silence to know when the user has finished speaking
   - Convert audio to a format Google Cloud STT accepts (LINEAR16 / WAV)

4. **Build the STT Cloud Function (`functions/src/stt.ts`)**
   ```typescript
   import { onCall } from 'firebase-functions/v2/https';
   import speech from '@google-cloud/speech';

   const client = new speech.SpeechClient();

   export const transcribeAudio = onCall(async (request) => {
     const { audioBase64, encoding, sampleRateHertz } = request.data;

     const [response] = await client.recognize({
       audio: { content: audioBase64 },
       config: {
         encoding: encoding || 'LINEAR16',
         sampleRateHertz: sampleRateHertz || 16000,
         languageCode: 'en-US',
         model: 'latest_long',
         enableAutomaticPunctuation: true,
       },
     });

     const transcript = response.results
       ?.map(r => r.alternatives?.[0]?.transcript)
       .join(' ');

     return { transcript };
   });
   ```

5. **Build `ttsService.ts`**
   - Wrap `expo-speech` for on-device TTS
   - Configure voice, rate, and pitch for a clear, warm cooking-assistant tone
   - Implement queue management: if the AI responds with a long message, break it into sentences and speak them sequentially
   - Handle interruption: if the user starts speaking, stop TTS playback

6. **Build the voice loop (`useVoice.ts` hook)**
   - State machine: `idle` → `listening` → `processing` → `speaking` → `listening`
   - When TTS finishes, automatically return to `listening` state
   - Handle errors gracefully (retry STT on failure, fall back to on-screen text)

7. **Build the listening UI (`VoiceIndicator.tsx`)**
   - Animated pulsing circle when listening
   - "Processing..." state indicator
   - Speaking waveform animation
   - Minimal — this screen is meant to be glanced at, not interacted with

#### Deliverables
- Working voice loop: speak → transcribe → display → speak back
- Cloud Function deployed for STT

---

### Phase 3 — AI Cooking Assistant (Week 5-6)

**Goal**: Integrate Gemini as the conversational brain that understands cooking context and walks users through recipes.

#### Tasks

1. **Enable Gemini in Firebase**
   - Go to Firebase Console → AI Logic → Enable
   - Select Gemini model (recommended: `gemini-2.0-flash` for low latency)

2. **Build the chat Cloud Function (`functions/src/chat.ts`)**

   This is the core of the app. The function:
   - Receives the user's transcript + conversation history
   - Sends it to Gemini with a cooking-assistant system prompt
   - Declares tools (function calling) so Gemini can look up recipe data
   - Returns the AI's response text

   ```typescript
   import { onCall } from 'firebase-functions/v2/https';
   import { GoogleGenerativeAI, FunctionDeclarationSchemaType } from '@google/generative-ai';
   import { getFirestore } from 'firebase-admin/firestore';

   const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
   const db = getFirestore();

   // Define tools Gemini can call
   const tools = [{
     functionDeclarations: [{
       name: 'getRecipeStep',
       description: 'Get a specific step from the current recipe',
       parameters: {
         type: FunctionDeclarationSchemaType.OBJECT,
         properties: {
           recipeId: { type: FunctionDeclarationSchemaType.STRING },
           stepNumber: { type: FunctionDeclarationSchemaType.NUMBER },
         },
         required: ['recipeId', 'stepNumber'],
       },
     }, {
       name: 'getIngredientInfo',
       description: 'Get details about an ingredient including quantity and substitutions',
       parameters: {
         type: FunctionDeclarationSchemaType.OBJECT,
         properties: {
           recipeId: { type: FunctionDeclarationSchemaType.STRING },
           ingredientName: { type: FunctionDeclarationSchemaType.STRING },
         },
         required: ['recipeId', 'ingredientName'],
       },
     }, {
       name: 'getSubstitution',
       description: 'Find substitutes for an ingredient the user does not have',
       parameters: {
         type: FunctionDeclarationSchemaType.OBJECT,
         properties: {
           recipeId: { type: FunctionDeclarationSchemaType.STRING },
           ingredientName: { type: FunctionDeclarationSchemaType.STRING },
         },
         required: ['recipeId', 'ingredientName'],
       },
     }],
   }];

   export const chat = onCall(async (request) => {
     const { recipeId, userMessage, conversationHistory } = request.data;

     // Fetch recipe context
     const recipeDoc = await db.collection('recipes').doc(recipeId).get();
     const recipe = recipeDoc.data();

     const model = genAI.getGenerativeModel({
       model: 'gemini-2.0-flash',
       tools,
       systemInstruction: `
         You are a friendly, concise cooking assistant helping someone cook
         "${recipe.title}" hands-free. They cannot touch their phone.

         Rules:
         - Keep responses SHORT (1-3 sentences). They're spoken aloud.
         - Be warm and encouraging but not chatty.
         - Always reference step numbers so they can track progress.
         - When they ask "what step am I on?", check conversation history.
         - When they ask about an ingredient, give the exact quantity.
         - When they need a substitution, check the recipe's substitution map first,
           then suggest common alternatives if none are pre-defined.
         - Proactively mention timers when a step has a duration.
         - If they seem confused, offer to repeat the current step.

         Current recipe has ${recipe.steps.length} steps.
       `,
     });

     const chatSession = model.startChat({ history: conversationHistory });
     const result = await chatSession.sendMessage(userMessage);

     // Handle function calls if Gemini wants to look up data
     // (implement tool execution loop here)

     return {
       response: result.response.text(),
       updatedHistory: [...conversationHistory, /* new messages */],
     };
   });
   ```

3. **Implement Gemini function calling execution loop**
   - When Gemini returns a function call instead of text, execute it against Firestore
   - `getRecipeStep`: fetch the step from the recipe document
   - `getIngredientInfo`: find the ingredient and return quantity/unit/preparation
   - `getSubstitution`: look up the substitution map, return options
   - Send the function result back to Gemini so it can formulate a natural response

4. **Build `useCookingSession.ts` hook**
   - Manages the full cooking session lifecycle
   - Tracks `currentStep`, `conversationHistory`, `substitutionsMade`
   - Orchestrates: voice capture → STT → Gemini chat → TTS
   - Persists session to Firestore so users can resume if the app closes
   - Handles edge cases: "I'm done", "skip this step", "start over"

5. **Build the Cooking Session screen (`app/(main)/recipe/cook/[id].tsx`)**
   - Large "Start Cooking" button to begin the session
   - Minimal UI once started: current step number, voice state indicator
   - Keep screen awake (`expo-keep-awake`)
   - Optional: show a small text view of the current step for visual reference
   - "End Session" button (accessible but not prominent)

6. **Design the system prompt carefully**
   - The system prompt is the personality of your app — iterate on it
   - Test with edge cases: "What was step 2 again?", "I don't have butter", "How long should I bake this?"
   - Make sure the AI doesn't volunteer information unless asked (avoid interrupting cooking)

#### Deliverables
- Full voice-to-AI-to-voice cooking loop
- Gemini with function calling looking up recipe data from Firestore
- Persistent cooking sessions

---

### Phase 4 — Polish and UX (Week 7-8)

**Goal**: Refine the experience for actual cooking scenarios.

#### Tasks

1. **Improve voice activity detection**
   - Tune silence threshold: too sensitive = cuts off the user mid-sentence, too lenient = long pauses before response
   - Consider ambient noise: kitchens are noisy (fan, sizzling, water). Test with background noise.
   - Add a configurable sensitivity setting

2. **Add a "Hey Chef" wake word (optional but recommended)**
   - Install `@picovoice/porcupine-react-native` for on-device wake word detection
   - Create a custom wake word via Picovoice Console
   - Flow: app passively listens for wake word → activates STT → processes query → returns to passive listening
   - This prevents the app from constantly streaming audio to the cloud

3. **Implement timers**
   - When a step has a `duration`, offer to set a timer
   - Use local notifications (`expo-notifications`) so the timer works even if the app is backgrounded
   - Voice integration: "Your timer for 12 minutes is done. Ready for the next step?"

4. **Add cooking session resume**
   - If the app crashes or closes, persist session state to Firestore
   - On re-open, detect active session and offer to resume
   - "Welcome back! You were on step 4 of chicken parmesan. Want to pick up where you left off?"

5. **Implement keep-awake mode**
   ```bash
   npx expo install expo-keep-awake
   ```
   - Keep the screen on during cooking sessions (users need to glance at it)
   - Dim the screen but don't lock

6. **Add accessibility features**
   - Large, high-contrast text for at-a-glance reading
   - Haptic feedback for state changes (started listening, AI responding)
   - Support for adjustable speech rate

7. **Offline fallback**
   - Cache the current recipe locally when a cooking session starts
   - If connectivity drops, continue reading steps from the cached recipe (without AI conversation)
   - Queue voice queries and process them when connectivity returns

8. **Error handling polish**
   - STT failures: "Sorry, I didn't catch that. Could you say it again?"
   - Network issues: "I'm having trouble connecting. Let me read you step 4 from the recipe."
   - Gemini overloaded: Retry with exponential backoff, fall back to simple step reading

---

### Phase 5 — Testing, Content, and Launch Prep (Week 9-10)

#### Tasks

1. **Populate the recipe database**
   - Create 50+ well-structured recipes across cuisines
   - Each recipe needs: clear step-by-step instructions, precise ingredient quantities, pre-defined substitutions for common dietary restrictions
   - Write an admin script or simple web panel for adding/editing recipes

2. **Real-world testing**
   - Cook with the app yourself. This is the most important test.
   - Test in a real kitchen with real background noise
   - Test long recipes (20+ steps) for conversation context limits
   - Test substitution requests for ingredients not in the pre-defined map

3. **Performance optimization**
   - Measure end-to-end latency: user finishes speaking → AI starts speaking
   - Target: under 2 seconds (ideally under 1.5s)
   - Optimize: batch STT, stream Gemini response, start TTS before full response arrives
   - Profile Firestore reads — consider caching the full recipe in the Cloud Function memory

4. **Set up EAS Build and Submit**
   ```bash
   eas build --platform all
   eas submit --platform all
   ```
   - Configure `eas.json` with development, preview, and production profiles
   - Set up OTA updates with `expo-updates`

5. **App Store preparation**
   - App description emphasizing "hands-free" and "voice-controlled"
   - Screenshots of the cooking UI, recipe browser, and voice interaction
   - Privacy policy covering microphone usage and data handling
   - Microphone permission justification for App Store review

---

## 6. Key Packages Summary

| Package | Purpose |
|---|---|
| `expo` (SDK 54) | App framework |
| `expo-router` | File-based navigation |
| `expo-audio` | Microphone recording |
| `expo-speech` | On-device text-to-speech |
| `expo-keep-awake` | Prevent screen sleep during cooking |
| `expo-notifications` | Cooking timers |
| `@react-native-firebase/app` | Firebase core |
| `@react-native-firebase/auth` | Authentication |
| `@react-native-firebase/firestore` | Recipe database + session persistence |
| `@react-native-firebase/functions` | Call Cloud Functions |
| `@react-native-async-storage/async-storage` | Auth persistence |
| `zustand` | Client state management |
| `expo-build-properties` | iOS Firebase config |
| `@google-cloud/speech` (Cloud Functions) | Server-side STT |
| `@google/generative-ai` (Cloud Functions) | Gemini API |
| `@picovoice/porcupine-react-native` (optional) | Wake word detection |

---

## 7. Firebase Security Rules (Starter)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Recipes: anyone authenticated can read, only admin can write
    match /recipes/{recipeId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.admin == true;
    }

    // User profiles: users can only read/write their own
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Conversation sessions: users can only access their own
    match /conversations/{sessionId} {
      allow read, write: if request.auth != null
        && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
    }
  }
}
```

---

## 8. Environment Variables

```bash
# .env (client - prefixed for Expo)
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...

# functions/.env (server-side)
GEMINI_API_KEY=...
GOOGLE_CLOUD_PROJECT=...
```

---

## 9. Risk Areas and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Latency in voice loop** | Users waiting 3+ seconds feels broken | Stream Gemini response; start TTS on first sentence; optimize STT with shorter audio chunks |
| **Kitchen background noise** | Poor STT accuracy | Test extensively in real kitchens; tune VAD sensitivity; consider directional mic guidance for users |
| **Gemini hallucinating recipe info** | Dangerous (wrong temps, allergens) | Always ground Gemini with function calling to real recipe data; never let it improvise cooking instructions |
| **Conversation context growing too large** | Slower responses, hitting token limits | Summarize older conversation turns; keep a sliding window of recent messages |
| **App backgrounding during cooking** | Voice loop stops | Use foreground service on Android; audio session on iOS; test thoroughly |
| **Cost of STT + Gemini per session** | Expensive at scale | Monitor usage; consider caching common queries; use `gemini-2.0-flash` (cheapest); set per-user rate limits |

---

## 10. Future Enhancements (Post-Launch)

- **User-submitted recipes**: Let users add their own recipes with voice or text input
- **Meal planning**: Suggest weekly meal plans and generate shopping lists
- **Smart kitchen integration**: Connect to smart timers, ovens (via Home APIs)
- **Multi-language support**: Internationalize recipes and voice interaction
- **Dietary profiles**: Automatically flag allergens and suggest substitutions based on user preferences
- **Cooking skill progression**: Track what users have cooked and suggest increasingly complex recipes
- **Social features**: Share cooked meals, rate recipes, follow other cooks
