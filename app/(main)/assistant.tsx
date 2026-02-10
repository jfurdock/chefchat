import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import { useFavorites, useRecipes } from '@/src/hooks/useRecipes';
import {
  getFavorites as getFavoritesFromService,
  getRecipes as getRecipesFromService,
} from '@/src/services/recipeService';
import { useAuthStore } from '@/src/stores/authStore';
import type { Recipe } from '@/src/types/recipe';
import { formatFirstName } from '@/src/utils/formatFirstName';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  suggestedRecipeIds?: string[];
};

type VoiceUiState = 'idle' | 'listening' | 'processing' | 'speaking';

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
const MAX_RECIPE_CATALOG_ITEMS = 100;
const RECIPE_SELECTION_TAG_REGEX = /\[SELECT_RECIPE:([^\]]+)\]/i;
const RECIPE_MATCH_STOPWORDS = new Set([
  'i',
  'me',
  'my',
  'we',
  'our',
  'the',
  'a',
  'an',
  'to',
  'for',
  'of',
  'and',
  'in',
  'on',
  'with',
  'make',
  'cook',
  'recipe',
  'recipes',
  'favorite',
  'favorites',
  'saved',
  'want',
]);

function tokenizeNormalized(value: string): string[] {
  return normalizeForDedup(value)
    .split(' ')
    .map((token) => (token.endsWith('s') && token.length > 3 ? token.slice(0, -1) : token))
    .filter((token) => token.length >= 3 && !RECIPE_MATCH_STOPWORDS.has(token));
}

function parseSelectRecipeTag(text: string): { cleaned: string; recipeId: string | null } {
  const match = text.match(RECIPE_SELECTION_TAG_REGEX);
  const recipeId = match?.[1]?.trim() || null;
  const cleaned = text.replace(RECIPE_SELECTION_TAG_REGEX, '').replace(/\s+/g, ' ').trim();
  return { cleaned, recipeId };
}

function scoreRecipeTitleMatch(queryTokens: string[], recipe: Recipe): number {
  if (!queryTokens.length) return 0;

  const normalizedTitle = normalizeForDedup(recipe.title);
  const normalizedQuery = normalizeForDedup(queryTokens.join(' '));
  if (normalizedQuery && normalizedTitle.includes(normalizedQuery)) {
    return 100 + normalizedQuery.length;
  }

  const titleTokens = tokenizeNormalized(recipe.title);
  if (!titleTokens.length) return 0;

  const titleTokenSet = new Set(titleTokens);
  const overlap = queryTokens.filter((token) => titleTokenSet.has(token)).length;
  if (!overlap) return 0;

  return overlap * 10 - Math.max(0, titleTokens.length - overlap);
}

function wantsRecipeReset(text: string): boolean {
  const normalized = normalizeForDedup(text);
  return (
    normalized.includes('different recipe') ||
    normalized.includes('something else') ||
    normalized.includes('new recipe')
  );
}

function isRecommendationIntent(text: string): boolean {
  const normalized = normalizeForDedup(text);
  return (
    normalized.includes('what should i make') ||
    normalized.includes('what should i cook') ||
    normalized.includes('what dish should i make') ||
    normalized.includes('give me ideas') ||
    normalized.includes('recipe ideas') ||
    normalized.includes('recommend') ||
    normalized.includes('suggest') ||
    normalized.includes('what can i make')
  );
}

function wantsFavoriteRecipes(text: string): boolean {
  const normalized = normalizeForDedup(text);
  return (
    normalized.includes('favorite') ||
    normalized.includes('favorites') ||
    normalized.includes('saved')
  );
}

function isFavoriteListIntent(text: string): boolean {
  const normalized = normalizeForDedup(text);
  return (
    normalized.includes('what are my favorite recipes') ||
    normalized.includes('do you know my favorites') ||
    normalized.includes('show my favorite recipes') ||
    normalized.includes('show my favorites') ||
    normalized.includes('list my favorites') ||
    normalized.includes('my favorites') ||
    normalized.includes('favorite recipes') ||
    normalized.includes('saved recipes') ||
    normalized.includes('my saved recipes')
  );
}

function isCatalogListIntent(text: string): boolean {
  const normalized = normalizeForDedup(text);
  return (
    normalized.includes('recipes in the app') ||
    normalized.includes('recipes in app') ||
    normalized.includes('what recipes do you have') ||
    normalized.includes('show me recipes in the app') ||
    normalized.includes('show app recipes') ||
    normalized.includes('list app recipes')
  );
}

function scoreRecommendation(
  recipe: Recipe,
  queryTokens: string[],
  favoriteIds: Set<string>,
  prioritizeFavorites: boolean,
): number {
  let score = 0;
  if (favoriteIds.has(recipe.id)) score += 40;
  if (prioritizeFavorites && !favoriteIds.has(recipe.id)) score -= 40;

  const totalTime = Math.max(0, recipe.prepTimeMinutes + recipe.cookTimeMinutes);
  score += Math.max(0, 30 - Math.floor(totalTime / 4));

  if (recipe.difficulty === 'easy') score += 12;
  else if (recipe.difficulty === 'medium') score += 6;

  const recipeSearchTokens = tokenizeNormalized(
    `${recipe.title} ${recipe.cuisine} ${recipe.tags.join(' ')} ${recipe.description}`,
  );
  const recipeTokenSet = new Set(recipeSearchTokens);
  const overlap = queryTokens.filter((token) => recipeTokenSet.has(token)).length;
  score += overlap * 14;

  return score;
}

function formatRecipeMeta(recipe: Recipe): string {
  const totalMinutes = Math.max(0, recipe.prepTimeMinutes + recipe.cookTimeMinutes);
  const difficulty = recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1);
  return `${recipe.cuisine} • ${difficulty} • ${totalMinutes} min`;
}

function formatIngredientLine(item: Recipe['ingredients'][number]): string {
  const quantity = Number.isFinite(item.quantity) ? `${item.quantity}` : '';
  const unit = (item.unit || '').trim();
  const prep = item.preparation?.trim() ? ` (${item.preparation.trim()})` : '';
  const parts = [quantity, unit, item.name?.trim() || 'ingredient'].filter(Boolean);
  return `${parts.join(' ')}${prep}`.trim();
}

function buildIngredientChecklistReply(recipe: Recipe): string {
  const ingredients = recipe.ingredients.slice(0, 12).map(formatIngredientLine).filter(Boolean);
  const ingredientText = ingredients.length
    ? ingredients.join('; ')
    : 'your listed ingredients';
  const moreCount = Math.max(0, recipe.ingredients.length - ingredients.length);
  const moreSuffix = moreCount > 0 ? ` plus ${moreCount} more` : '';

  return `Great choice. For ${recipe.title}, gather ${ingredientText}${moreSuffix}. If you are missing anything, tell me and I can suggest a substitute. If you have everything, say "ready to start" and I will begin with the instructions.`;
}

function isReadyToStartIntent(text: string): boolean {
  const normalized = normalizeForDedup(text);
  return (
    normalized.includes('ready to start') ||
    normalized.includes('lets start') ||
    normalized.includes('let s start') ||
    normalized.includes('start now') ||
    normalized.includes('i have everything') ||
    normalized.includes('got everything') ||
    normalized.includes('ready')
  );
}

function isContinueIntent(text: string): boolean {
  const normalized = normalizeForDedup(text);
  return (
    normalized.includes('next') ||
    normalized.includes('continue') ||
    normalized.includes('move on') ||
    normalized.includes('go ahead') ||
    normalized.includes('ready')
  );
}

function withInstructionPrompt(text: string, isFirst: boolean): string {
  const trimmed = text.trim().replace(/^\d+[\).\s-]*/, '');
  if (!trimmed) {
    return isFirst
      ? "Let's start with the first instruction. Let me know when you're ready to continue."
      : "Next, let's continue. Let me know when you're ready to continue.";
  }
  const base = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  const prefix = isFirst ? "Let's start with" : "Next, let's";
  return `${prefix} ${base} Let me know when you're ready to continue.`;
}

function formatInstructionPreviewLine(text: string, isFirst: boolean): string {
  const trimmed = text.trim().replace(/^\d+[\).\s-]*/, '');
  if (!trimmed) return isFirst ? "Let's start with the first instruction." : "Next, let's continue.";
  const base = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  const prefix = isFirst ? "Let's start with" : "Next, let's";
  return `${prefix} ${base}`;
}

function buildGuidedInstructionReply(recipe: Recipe, index: number): string {
  const step = recipe.steps[index];
  if (!step?.instruction) {
    return 'I could not find that instruction right now. Tell me when you are ready and I will continue.';
  }
  return withInstructionPrompt(step.instruction, index === 0);
}

function sanitizeInstructionLanguage(text: string): string {
  let seen = 0;
  let output = text.replace(/\b[Ss]tep\s*\d+\s*[:\-]?\s*/g, () => {
    const replacement = seen === 0 ? "Let's start with " : "Next, let's ";
    seen += 1;
    return replacement;
  });

  output = output
    .replace(/\bgo to step\s*\d+\b/gi, 'continue')
    .replace(/\bstep\s*\d+\b/gi, 'that part')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return output;
}

export default function AssistantScreen() {
  const user = useAuthStore((s) => s.user);
  const { recipes } = useRecipes();
  const { favorites } = useFavorites();
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
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [previewRecipeId, setPreviewRecipeId] = useState<string | null>(null);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [awaitingGuidedStart, setAwaitingGuidedStart] = useState(false);
  const [guidedInstructionIndex, setGuidedInstructionIndex] = useState(-1);
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

  const recipesById = useMemo(() => {
    return new Map(recipes.map((recipe) => [recipe.id, recipe]));
  }, [recipes]);

  const favoritesById = useMemo(() => {
    return new Map(favorites.map((recipe) => [recipe.id, recipe]));
  }, [favorites]);

  const favoriteRecipeIds = useMemo(() => {
    return new Set(favorites.map((recipe) => recipe.id));
  }, [favorites]);

  const activeRecipe = useMemo(() => {
    if (!activeRecipeId) return null;
    return recipesById.get(activeRecipeId) || favoritesById.get(activeRecipeId) || null;
  }, [activeRecipeId, recipesById, favoritesById]);

  const previewRecipe = useMemo(() => {
    if (!previewRecipeId) return null;
    return recipesById.get(previewRecipeId) || favoritesById.get(previewRecipeId) || null;
  }, [favoritesById, previewRecipeId, recipesById]);

  const recipeCatalog = useMemo(() => {
    const favoriteFirst = [...recipes].sort((a, b) => {
      const aFav = favoriteRecipeIds.has(a.id) ? 1 : 0;
      const bFav = favoriteRecipeIds.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return a.title.localeCompare(b.title);
    });

    return favoriteFirst.slice(0, MAX_RECIPE_CATALOG_ITEMS).map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      cuisine: recipe.cuisine,
      difficulty: recipe.difficulty,
      servings: recipe.servings,
      totalTimeMinutes: recipe.prepTimeMinutes + recipe.cookTimeMinutes,
      tags: recipe.tags,
    }));
  }, [favoriteRecipeIds, recipes]);

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

  const findBestRecipeMatch = useCallback((text: string, pool: Recipe[]): Recipe | null => {
    const queryTokens = tokenizeNormalized(text);
    if (!queryTokens.length) return null;

    let best: { recipe: Recipe; score: number } | null = null;
    for (const recipe of pool) {
      const score = scoreRecipeTitleMatch(queryTokens, recipe);
      if (!score) continue;
      if (!best || score > best.score) {
        best = { recipe, score };
      }
    }

    if (!best) return null;

    const mentionsFavorites =
      normalizeForDedup(text).includes('favorite') ||
      normalizeForDedup(text).includes('saved');
    const minimumScore = mentionsFavorites ? 8 : 18;
    return best.score >= minimumScore ? best.recipe : null;
  }, []);

  const resolveRecipeFromPools = useCallback((
    text: string,
    recipePool: Recipe[],
    favoritePool: Recipe[],
  ): Recipe | null => {
    const normalized = normalizeForDedup(text);
    if (!normalized) return null;

    const mentionsFavorites =
      normalized.includes('favorite') ||
      normalized.includes('favorites') ||
      normalized.includes('saved');

    if (mentionsFavorites) {
      const favoriteMatch = findBestRecipeMatch(text, favoritePool);
      if (favoriteMatch) return favoriteMatch;
    }

    return findBestRecipeMatch(text, recipePool);
  }, [findBestRecipeMatch]);

  const recommendRecipesFromApp = useCallback((
    text: string,
    limit = 3,
    options?: {
      recipePool?: Recipe[];
      favoritePool?: Recipe[];
      favoriteIdSet?: Set<string>;
    },
  ): Recipe[] => {
    const recipesPool = options?.recipePool || recipes;
    const favoritesPool = options?.favoritePool || favorites;
    const favoriteSet = options?.favoriteIdSet || favoriteRecipeIds;
    const prioritizeFavorites = wantsFavoriteRecipes(text);
    const queryTokens = tokenizeNormalized(text);
    const sourceRecipes = prioritizeFavorites && favoritesPool.length > 0
      ? favoritesPool
      : recipesPool;
    if (!sourceRecipes.length) return [];

    const scored = sourceRecipes
      .map((recipe) => ({
        recipe,
        score: scoreRecommendation(recipe, queryTokens, favoriteSet, prioritizeFavorites),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.recipe.title.localeCompare(b.recipe.title);
      });

    const recommendations = scored
      .filter((item) => item.score > -5)
      .slice(0, limit)
      .map((item) => item.recipe);

    if (recommendations.length > 0) return recommendations;

    return sourceRecipes
      .slice()
      .sort((a, b) => {
        const aFav = favoriteSet.has(a.id) ? 1 : 0;
        const bFav = favoriteSet.has(b.id) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        const aTime = a.prepTimeMinutes + a.cookTimeMinutes;
        const bTime = b.prepTimeMinutes + b.cookTimeMinutes;
        if (aTime !== bTime) return aTime - bTime;
        return a.title.localeCompare(b.title);
      })
      .slice(0, limit);
  }, [favoriteRecipeIds, favorites, recipes]);

  const buildRecommendationReply = useCallback((recommended: Recipe[], text: string): string => {
    if (!recommended.length) {
      return 'I could not find good matches in your current recipe library yet. Try asking for a cuisine or ingredient.';
    }

    const favoriteOnly = wantsFavoriteRecipes(text);
    const intro = favoriteOnly
      ? 'Great picks from your saved favorites:'
      : 'Here are some dishes from your app I recommend:';
    const list = recommended.map((recipe) => recipe.title).join(', ');
    return `${intro} ${list}. Tap Preview on any option and tell me which one you want to cook.`;
  }, []);

  const buildFavoriteListReply = useCallback((favoritePool: Recipe[]): string => {
    if (!favoritePool.length) {
      return 'You do not have any saved favorites yet. Tap the heart icon on a recipe to save it, then ask me again.';
    }

    const top = favoritePool.slice(0, 5).map((recipe) => recipe.title).join(', ');
    return `Your saved favorites are: ${top}. Tap Preview on any option and I can help you cook it.`;
  }, []);

  const buildCatalogListReply = useCallback((recipePool: Recipe[], favoriteIdSet: Set<string>): string => {
    if (!recipePool.length) {
      return 'I cannot see any recipes loaded in the app right now. Pull to refresh Recipes, then ask me again.';
    }

    const sorted = recipePool
      .slice()
      .sort((a, b) => {
        const aFav = favoriteIdSet.has(a.id) ? 1 : 0;
        const bFav = favoriteIdSet.has(b.id) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 5);

    const top = sorted.map((recipe) => recipe.title).join(', ');
    return `Recipes currently in your app include: ${top}. Tell me which one you want and I’ll use the exact recipe details.`;
  }, []);

  const loadAssistantRecipeContext = useCallback(async (
    options?: { requireFavorites?: boolean },
  ): Promise<{ recipesSnapshot: Recipe[]; favoritesSnapshot: Recipe[] }> => {
    let recipesSnapshot = recipes;
    let favoritesSnapshot = favorites;

    const shouldFetchRecipes = recipesSnapshot.length === 0;
    const shouldFetchFavorites = !!user?.uid && !!options?.requireFavorites && favoritesSnapshot.length === 0;

    if (!shouldFetchRecipes && !shouldFetchFavorites) {
      return { recipesSnapshot, favoritesSnapshot };
    }

    try {
      const [fetchedRecipes, fetchedFavorites] = await Promise.all([
        shouldFetchRecipes ? getRecipesFromService() : Promise.resolve(recipesSnapshot),
        shouldFetchFavorites && user?.uid
          ? getFavoritesFromService(user.uid)
          : Promise.resolve(favoritesSnapshot),
      ]);

      recipesSnapshot = fetchedRecipes || [];
      favoritesSnapshot = fetchedFavorites || [];
      return { recipesSnapshot, favoritesSnapshot };
    } catch {
      return { recipesSnapshot, favoritesSnapshot };
    }
  }, [favorites, recipes, user?.uid]);

  const handlePreviewRecipe = useCallback((recipe: Recipe) => {
    setActiveRecipeId(recipe.id);
    setPreviewRecipeId(recipe.id);
    setIsPreviewCollapsed(false);
  }, []);

  const handleUseRecipe = useCallback((recipe: Recipe) => {
    setActiveRecipeId(recipe.id);
    setPreviewRecipeId(null);
    setAwaitingGuidedStart(true);
    setGuidedInstructionIndex(-1);

    const ingredientReply = buildIngredientChecklistReply(recipe);
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-recipe-selected-${Date.now()}`,
        role: 'assistant',
        content: ingredientReply,
      },
    ]);
    void (async () => {
      clearInactivityCommitTimer();
      stopRecognition();
      setVoiceState('speaking');
      try {
        await interruptAndSpeak(ingredientReply);
      } catch {
        // no-op
      } finally {
        if (isFocusedRef.current && shouldListenRef.current && !isSendingRef.current) {
          await startRecognition();
        } else {
          setVoiceState('idle');
        }
      }
    })();
  }, [clearInactivityCommitTimer, startRecognition, stopRecognition]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? draft).trim();
    if (!text || isSendingRef.current) return;

    clearInactivityCommitTimer();
    setLiveTranscript('');
    stopRecognition();
    setError(null);

    const recommendationIntent = isRecommendationIntent(text);
    const favoriteListIntent = isFavoriteListIntent(text);
    const catalogListIntent = isCatalogListIntent(text);
    const requireFavorites = wantsFavoriteRecipes(text) || favoriteListIntent;
    const needsRecipeContext =
      recommendationIntent ||
      favoriteListIntent ||
      catalogListIntent ||
      requireFavorites ||
      recipeCatalog.length === 0;

    const { recipesSnapshot, favoritesSnapshot } = needsRecipeContext
      ? await loadAssistantRecipeContext({ requireFavorites })
      : { recipesSnapshot: recipes, favoritesSnapshot: favorites };

    const favoriteIdSnapshot = new Set(favoritesSnapshot.map((recipe) => recipe.id));
    const recipesByIdSnapshot = new Map<string, Recipe>();
    for (const recipe of recipesSnapshot) {
      recipesByIdSnapshot.set(recipe.id, recipe);
    }
    for (const recipe of favoritesSnapshot) {
      if (!recipesByIdSnapshot.has(recipe.id)) {
        recipesByIdSnapshot.set(recipe.id, recipe);
      }
    }

    const recipeCatalogForRequest = recipesSnapshot
      .slice()
      .sort((a, b) => {
        const aFav = favoriteIdSnapshot.has(a.id) ? 1 : 0;
        const bFav = favoriteIdSnapshot.has(b.id) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        return a.title.localeCompare(b.title);
      })
      .slice(0, MAX_RECIPE_CATALOG_ITEMS)
      .map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        cuisine: recipe.cuisine,
        difficulty: recipe.difficulty,
        servings: recipe.servings,
        totalTimeMinutes: recipe.prepTimeMinutes + recipe.cookTimeMinutes,
        tags: recipe.tags,
      }));

    const shouldResetRecipe = wantsRecipeReset(text);
    if (shouldResetRecipe) {
      setActiveRecipeId(null);
      setAwaitingGuidedStart(false);
      setGuidedInstructionIndex(-1);
    }

    const recipeFromUtterance = shouldResetRecipe
      ? null
      : resolveRecipeFromPools(text, recipesSnapshot, favoritesSnapshot);
    const selectedRecipeForRequest = shouldResetRecipe ? null : recipeFromUtterance || activeRecipe;
    if (recipeFromUtterance) {
      setActiveRecipeId(recipeFromUtterance.id);
    }
    const readyToStartIntent = isReadyToStartIntent(text);
    const continueIntent = isContinueIntent(text);

    const directRecommendations = recommendationIntent
      ? recommendRecipesFromApp(text, 4, {
          recipePool: recipesSnapshot,
          favoritePool: favoritesSnapshot,
          favoriteIdSet: favoriteIdSnapshot,
        })
      : [];
    const catalogRecommendations = catalogListIntent
      ? recommendRecipesFromApp(text, 5, {
          recipePool: recipesSnapshot,
          favoritePool: favoritesSnapshot,
          favoriteIdSet: favoriteIdSnapshot,
        })
      : [];

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

    try {
      if (
        selectedRecipeForRequest &&
        selectedRecipeForRequest.steps.length > 0 &&
        awaitingGuidedStart &&
        readyToStartIntent
      ) {
        const firstInstruction = sanitizeInstructionLanguage(
          buildGuidedInstructionReply(selectedRecipeForRequest, 0),
        );
        const assistantMsg: ChatMessage = {
          id: `assistant-start-instructions-${Date.now()}`,
          role: 'assistant',
          content: firstInstruction,
        };
        setAwaitingGuidedStart(false);
        setGuidedInstructionIndex(0);
        setMessages((prev) => [...prev, assistantMsg]);
        setVoiceState('speaking');
        await interruptAndSpeak(firstInstruction);
        return;
      }

      if (
        selectedRecipeForRequest &&
        selectedRecipeForRequest.steps.length > 0 &&
        !awaitingGuidedStart &&
        guidedInstructionIndex >= 0 &&
        continueIntent
      ) {
        const nextIndex = guidedInstructionIndex + 1;
        const hasMoreSteps = nextIndex < selectedRecipeForRequest.steps.length;
        const assistantReply = hasMoreSteps
          ? sanitizeInstructionLanguage(buildGuidedInstructionReply(selectedRecipeForRequest, nextIndex))
          : 'Great job, you are through the core instructions. If you want, I can suggest plating, serving, or storage tips.';
        const assistantMsg: ChatMessage = {
          id: `assistant-next-instruction-${Date.now()}`,
          role: 'assistant',
          content: assistantReply,
        };
        if (hasMoreSteps) {
          setGuidedInstructionIndex(nextIndex);
        }
        setMessages((prev) => [...prev, assistantMsg]);
        setVoiceState('speaking');
        await interruptAndSpeak(assistantReply);
        return;
      }

      if (favoriteListIntent) {
        const suggestions = favoritesSnapshot.slice(0, 5);
        const assistantReply = sanitizeInstructionLanguage(
          buildFavoriteListReply(favoritesSnapshot),
        );
        const assistantMsg: ChatMessage = {
          id: `assistant-favorites-${Date.now()}`,
          role: 'assistant',
          content: assistantReply,
          suggestedRecipeIds: suggestions.map((recipe) => recipe.id),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setVoiceState('speaking');
        await interruptAndSpeak(assistantReply);
        return;
      }

      if (catalogListIntent) {
        const assistantReply = sanitizeInstructionLanguage(
          buildCatalogListReply(recipesSnapshot, favoriteIdSnapshot),
        );
        const assistantMsg: ChatMessage = {
          id: `assistant-catalog-${Date.now()}`,
          role: 'assistant',
          content: assistantReply,
          suggestedRecipeIds: catalogRecommendations.map((recipe) => recipe.id),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setVoiceState('speaking');
        await interruptAndSpeak(assistantReply);
        return;
      }

      if (recommendationIntent && directRecommendations.length > 0) {
        const assistantReply = sanitizeInstructionLanguage(
          buildRecommendationReply(directRecommendations, text),
        );
        const assistantMsg: ChatMessage = {
          id: `assistant-recommend-${Date.now()}`,
          role: 'assistant',
          content: assistantReply,
          suggestedRecipeIds: directRecommendations.map((recipe) => recipe.id),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setVoiceState('speaking');
        await interruptAndSpeak(assistantReply);
        return;
      }

      const responseTextRaw = await requestInworldCookingReply({
        userMessage: text,
        currentStep: 1,
        recipe: selectedRecipeForRequest,
        assistantMode: 'general',
        activeRecipeId: selectedRecipeForRequest?.id ?? null,
        recipeCatalog: recipeCatalogForRequest,
        favoriteRecipeIds: Array.from(favoriteIdSnapshot),
        favoriteRecipeTitles: favoritesSnapshot.map((recipe) => recipe.title),
        conversationHistory: nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const { cleaned, recipeId } = parseSelectRecipeTag(responseTextRaw || '');
      let suggestedRecipeIds: string[] | undefined;
      if (recipeId) {
        const matchedRecipe = recipesByIdSnapshot.get(recipeId);
        if (matchedRecipe) {
          setActiveRecipeId(matchedRecipe.id);
          setAwaitingGuidedStart(false);
          setGuidedInstructionIndex(-1);
          suggestedRecipeIds = [matchedRecipe.id];
        }
      }

      const assistantReply = sanitizeInstructionLanguage(
        cleaned ||
          "I couldn't pull that in right now. Ask again and I'll help with your cooking question.",
      );

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantReply,
        suggestedRecipeIds,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setVoiceState('speaking');
      await interruptAndSpeak(assistantReply);
    } catch (error: any) {
      const assistantReply = sanitizeInstructionLanguage(
        error?.message || 'I hit a network issue. Ask again and I will keep helping.',
      );
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
  }, [
    activeRecipe,
    awaitingGuidedStart,
    buildCatalogListReply,
    buildFavoriteListReply,
    buildRecommendationReply,
    clearInactivityCommitTimer,
    draft,
    favorites,
    guidedInstructionIndex,
    loadAssistantRecipeContext,
    messages,
    recommendRecipesFromApp,
    recipeCatalog,
    recipes,
    resolveRecipeFromPools,
    startRecognition,
    stopRecognition,
  ]);

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

  const closePreviewDrawer = () => {
    setPreviewRecipeId(null);
    setIsPreviewCollapsed(false);
  };

  const handleClearActiveRecipe = useCallback(() => {
    setActiveRecipeId(null);
    setAwaitingGuidedStart(false);
    setGuidedInstructionIndex(-1);
    setPreviewRecipeId(null);
    setIsPreviewCollapsed(false);
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-clear-recipe-${Date.now()}`,
        role: 'assistant',
        content: "Sounds good, whenever you want to cook, I'll be here.",
      },
    ]);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 84, android: 0 })}
    >
      <View style={styles.header}>
        <Text style={styles.title}>ChefChat Assistant</Text>
        <Text style={styles.subtitle}>Ask any cooking question while you cook.</Text>
        {activeRecipe && (
          <View style={styles.activeRecipeRow}>
            <Ionicons name="book-outline" size={15} color={Colors.brand.sageDark} />
            <Text style={styles.activeRecipeText}>
              Using: {activeRecipe.title}
              {favoriteRecipeIds.has(activeRecipe.id) ? ' • Favorite' : ''}
            </Text>
            <TouchableOpacity
              style={styles.clearRecipeButton}
              onPress={handleClearActiveRecipe}
            >
              <Ionicons name="close" size={14} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
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
          const suggestedRecipes = (message.suggestedRecipeIds || [])
            .map((recipeId) => recipesById.get(recipeId) || favoritesById.get(recipeId))
            .filter((recipe): recipe is Recipe => !!recipe);
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
              {!isUser && suggestedRecipes.length > 0 && (
                <View style={styles.suggestionList}>
                  {suggestedRecipes.map((recipe) => {
                    const isFavorite = favoriteRecipeIds.has(recipe.id);
                    return (
                      <View key={`${message.id}-${recipe.id}`} style={styles.suggestionCard}>
                        <View style={styles.suggestionHeader}>
                          <Text style={styles.suggestionTitle}>{recipe.title}</Text>
                          {isFavorite && (
                            <View style={styles.favoritePill}>
                              <Ionicons name="heart" size={11} color={Colors.brand.cream} />
                              <Text style={styles.favoritePillText}>Favorite</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.suggestionMeta}>{formatRecipeMeta(recipe)}</Text>
                        <View style={styles.suggestionActions}>
                          <TouchableOpacity
                            style={[styles.suggestionButton, styles.previewButton]}
                            onPress={() => handlePreviewRecipe(recipe)}
                          >
                            <Ionicons
                              name="eye-outline"
                              size={14}
                              color={Colors.brand.sageDark}
                            />
                            <Text style={styles.previewButtonText}>Preview</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.suggestionButton, styles.useButton]}
                            onPress={() => handleUseRecipe(recipe)}
                          >
                            <Ionicons name="sparkles-outline" size={14} color={Colors.brand.cream} />
                            <Text style={styles.useButtonText}>Use</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
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

      <Modal
        visible={!!previewRecipe}
        transparent
        animationType="fade"
        onRequestClose={closePreviewDrawer}
      >
        <View style={styles.previewModalRoot}>
          <TouchableOpacity
            style={styles.previewBackdrop}
            activeOpacity={1}
            onPress={closePreviewDrawer}
          />
          {previewRecipe && (
            <View style={styles.previewDrawer}>
              <View style={styles.previewHandle} />
              <View style={styles.previewHeaderRow}>
                <View style={styles.previewHeaderTextWrap}>
                  <Text style={styles.previewTitle}>{previewRecipe.title}</Text>
                  <Text style={styles.previewMeta}>{formatRecipeMeta(previewRecipe)}</Text>
                </View>
                <View style={styles.previewHeaderActions}>
                  <TouchableOpacity
                    style={styles.previewIconButton}
                    onPress={() => setIsPreviewCollapsed((prev) => !prev)}
                  >
                    <Ionicons
                      name={isPreviewCollapsed ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={Colors.light.textSecondary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.previewIconButton} onPress={closePreviewDrawer}>
                    <Ionicons name="close" size={18} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {!isPreviewCollapsed && (
                <ScrollView
                  style={styles.previewScroll}
                  contentContainerStyle={styles.previewScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {!!previewRecipe.description && (
                    <Text style={styles.previewDescription}>{previewRecipe.description}</Text>
                  )}

                  <Text style={styles.previewSectionTitle}>Ingredients</Text>
                  {previewRecipe.ingredients.length > 0 ? (
                    previewRecipe.ingredients.map((ingredient, index) => (
                      <Text
                        key={`${previewRecipe.id}-ingredient-${index}`}
                        style={styles.previewListItem}
                      >
                        - {formatIngredientLine(ingredient)}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.previewEmptyText}>No ingredient list available yet.</Text>
                  )}

                  <Text style={styles.previewSectionTitle}>Instruction Preview</Text>
                  {previewRecipe.steps.length > 0 ? (
                    previewRecipe.steps.slice(0, 3).map((step, index) => (
                      <Text key={`${previewRecipe.id}-instruction-${index}`} style={styles.previewListItem}>
                        {formatInstructionPreviewLine(step.instruction || '', index === 0)}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.previewEmptyText}>No instructions available yet.</Text>
                  )}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </Modal>
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
  activeRecipeRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  activeRecipeText: {
    flex: 1,
    color: Colors.light.text,
    fontSize: 12,
    fontWeight: '600',
  },
  clearRecipeButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
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
  suggestionList: {
    marginTop: 10,
    gap: 8,
  },
  suggestionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.brand.cream,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  suggestionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
  },
  suggestionMeta: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  favoritePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: Colors.brand.sage,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  favoritePillText: {
    fontSize: 11,
    color: Colors.brand.cream,
    fontWeight: '700',
  },
  suggestionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  suggestionButton: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  previewButton: {
    borderWidth: 1,
    borderColor: Colors.brand.sageDark,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  previewButtonText: {
    fontSize: 12,
    color: Colors.brand.sageDark,
    fontWeight: '700',
  },
  useButton: {
    backgroundColor: Colors.brand.sageDark,
  },
  useButtonText: {
    fontSize: 12,
    color: Colors.brand.cream,
    fontWeight: '700',
  },
  previewModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.26)',
  },
  previewDrawer: {
    maxHeight: '78%',
    backgroundColor: Colors.brand.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.light.border,
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: Platform.select({ ios: 28, android: 14 }),
  },
  previewHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.light.border,
    marginBottom: 10,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewHeaderTextWrap: {
    flex: 1,
  },
  previewHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  previewMeta: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  previewScroll: {
    marginTop: 12,
  },
  previewScrollContent: {
    paddingBottom: 12,
  },
  previewDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.text,
    marginBottom: 10,
  },
  previewSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 10,
    marginBottom: 6,
  },
  previewListItem: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.text,
    marginBottom: 4,
  },
  previewEmptyText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
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
