import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { useCookingStore } from '@/src/stores/cookingStore';
import { requestInworldCookingReply } from '@/src/services/chatService';
import { interruptAndSpeak, isSpeaking, stopSpeaking } from '@/src/services/ttsService';
import { Ingredient, Recipe, Step } from '@/src/types/recipe';

const INTERIM_COMMIT_DELAY_MS = 650;
const SHORT_UTTERANCE_COMMIT_DELAY_MS = 320;
const MEDIUM_UTTERANCE_COMMIT_DELAY_MS = 480;
const SPEECH_END_COMMIT_DELAY_MS = 220;
const BARGE_IN_INTERIM_CONFIRM_WINDOW_MS = 1200;

type VoiceReply = {
  text: string;
  stopLoop?: boolean;
};

const NON_FATAL_RECOGNITION_ERRORS = new Set([
  'aborted',
  'no-speech',
  'speech-timeout',
  'interrupted',
  'busy',
]);

const FILLER_WORDS = new Set([
  'the',
  'a',
  'an',
  'again',
  'please',
  'for',
  'to',
  'of',
  'my',
  'me',
  'and',
  'with',
  'in',
  'on',
  'at',
]);

const QUICK_COMMANDS = new Set([
  'next',
  'continue',
  'previous',
  'back',
  'repeat',
  'help',
  'stop',
  'pause',
  'done',
]);

const BARGE_IN_TRIGGER_TOKENS = new Set([
  'chef',
  'next',
  'continue',
  'previous',
  'back',
  'repeat',
  'again',
  'stop',
  'wait',
  'pause',
]);

const IMMEDIATE_BARGE_IN_SINGLE_TOKENS = new Set([
  'chef',
  'stop',
  'wait',
  'pause',
  'next',
  'continue',
  'previous',
  'back',
  'repeat',
]);

const STEP_WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
};

function includesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getCommitDelayMs(transcript: string): number {
  const normalized = normalizeText(transcript);
  if (!normalized) return INTERIM_COMMIT_DELAY_MS;
  const wordCount = normalized.split(' ').filter(Boolean).length;
  if (wordCount <= 3) return SHORT_UTTERANCE_COMMIT_DELAY_MS;
  if (wordCount <= 8) return MEDIUM_UTTERANCE_COMMIT_DELAY_MS;
  return INTERIM_COMMIT_DELAY_MS;
}

function isLikelyAssistantEcho(candidate: string, assistantText: string): boolean {
  const candidateTokens = tokenize(candidate).slice(0, 12);
  const assistantTokens = tokenize(assistantText).slice(0, 40);
  if (!candidateTokens.length || !assistantTokens.length) return false;

  const userIntentTokens = new Set([
    'how',
    'what',
    'why',
    'when',
    'where',
    'again',
    'next',
    'previous',
    'repeat',
    'step',
    'ingredient',
    'amount',
    'substitute',
    'timer',
    'done',
    'stop',
    'wait',
  ]);
  if (candidateTokens.some((token) => userIntentTokens.has(token))) return false;

  const overlap = candidateTokens.filter((token) => assistantTokens.includes(token)).length;
  return candidateTokens.length >= 3 && overlap >= Math.ceil(candidateTokens.length * 0.85);
}

function isLikelyAssistantPlaybackEcho(candidate: string, assistantText: string): boolean {
  const normalizedCandidate = normalizeText(candidate);
  const normalizedAssistant = normalizeText(assistantText);
  if (!normalizedCandidate || !normalizedAssistant) return false;

  // While the assistant is actively speaking, suppress transcript fragments
  // that are likely just the assistant audio bleeding back into STT.
  if (normalizedAssistant.includes(normalizedCandidate)) return true;

  const candidateTokens = tokenize(normalizedCandidate);
  const assistantTokens = tokenize(normalizedAssistant);
  if (!candidateTokens.length || !assistantTokens.length) return false;

  const overlap = candidateTokens.filter((token) => assistantTokens.includes(token)).length;
  return overlap / candidateTokens.length >= 0.6;
}

function hasUserBargeInSignal(
  candidate: string,
  assistantText: string,
  options?: { isFinal?: boolean }
): boolean {
  const candidateTokens = Array.from(new Set(tokenize(candidate)));
  if (!candidateTokens.length) return false;

  const isFinal = !!options?.isFinal;
  const hasTrigger = candidateTokens.some((token) => BARGE_IN_TRIGGER_TOKENS.has(token));
  const isSingleImmediateCommand =
    candidateTokens.length === 1 && IMMEDIATE_BARGE_IN_SINGLE_TOKENS.has(candidateTokens[0]);

  // Wake-word always qualifies as a deliberate user interruption.
  if (candidateTokens.includes('chef')) {
    return true;
  }

  const assistantTokens = new Set(tokenize(assistantText));
  const novelTokens = candidateTokens.filter((token) => !assistantTokens.has(token));
  if (!novelTokens.length) return false;
  const strongNovelTokenCount = novelTokens.filter((token) => token.length >= 3).length;

  // While STT is still interim, only allow explicit command/wake words.
  // This prevents assistant playback fragments from causing false interrupts.
  if (!isFinal) {
    return isSingleImmediateCommand || hasTrigger;
  }

  if (isSingleImmediateCommand || hasTrigger) {
    return true;
  }

  // Final transcript but still a single non-command token: too risky to interrupt.
  if (candidateTokens.length === 1) {
    return false;
  }

  // For general final utterances, require at least 2 novel tokens.
  return novelTokens.length >= 2 && strongNovelTokenCount >= 2;
}

function isConsistentInterimCandidate(previous: string, next: string): boolean {
  const prevNorm = normalizeText(previous);
  const nextNorm = normalizeText(next);
  if (!prevNorm || !nextNorm) return false;
  if (prevNorm === nextNorm) return true;
  if (prevNorm.startsWith(nextNorm) || nextNorm.startsWith(prevNorm)) return true;

  const prevTokens = tokenize(prevNorm);
  const nextTokens = tokenize(nextNorm);
  if (!prevTokens.length || !nextTokens.length) return false;

  const overlap = nextTokens.filter((token) => prevTokens.includes(token)).length;
  const minLen = Math.min(prevTokens.length, nextTokens.length);
  return overlap >= Math.max(1, minLen - 1);
}

function extractBargeInKeyword(transcript: string): string {
  const tokens = tokenize(transcript);
  for (const token of tokens) {
    if (IMMEDIATE_BARGE_IN_SINGLE_TOKENS.has(token)) {
      return token;
    }
  }
  return '';
}

function mergeBargeInKeyword(transcript: string, keyword: string): string {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return transcript.trim();

  const normalizedTranscript = normalizeText(transcript);
  if (!normalizedTranscript) return normalizedKeyword;
  if (normalizedTranscript.includes(normalizedKeyword)) return transcript.trim();
  return `${normalizedKeyword} ${transcript.trim()}`.trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token && !FILLER_WORDS.has(token));
}

function isLikelyNoiseUtterance(raw: string): boolean {
  const normalized = normalizeText(raw);
  if (!normalized) return true;
  if (QUICK_COMMANDS.has(normalized)) return false;

  const tokens = tokenize(normalized);
  if (!tokens.length) return true;
  if (tokens.length === 1 && tokens[0].length <= 2) return true;
  if (normalized.length < 4) return true;

  return false;
}

function parseSpokenStepNumber(raw: string): number | null {
  const normalized = normalizeText(raw);
  if (!normalized) return null;

  // Try "step X" pattern first
  const stepMatch = normalized.match(/\bstep\s+([a-z0-9]+)\b/);
  if (stepMatch?.[1]) {
    const token = stepMatch[1];
    const asNumber = Number(token);
    if (Number.isInteger(asNumber) && asNumber > 0) return asNumber;
    const mapped = STEP_WORD_TO_NUMBER[token];
    if (typeof mapped === 'number') return mapped;
  }

  // Try bare number or word-number anywhere in the text
  // e.g. "go to 3", "jump to two", or just "3"
  const tokens = normalized.split(/\s+/);
  for (const token of tokens) {
    const asNumber = Number(token);
    if (Number.isInteger(asNumber) && asNumber > 0) return asNumber;
    const mapped = STEP_WORD_TO_NUMBER[token];
    if (typeof mapped === 'number') return mapped;
  }

  return null;
}

function hasCookingQuestionIntent(text: string): boolean {
  // If the utterance is clearly about ingredients, substitutions, or cooking
  // questions, it should NOT be treated as a step jump — even if it contains
  // a number word like "two eggs" or "three cloves".
  return /\b(substitute|substitution|swap|replace|replacement|instead|without)\b/.test(text) ||
    /\b(don t have|dont have|do not have|ran out|out of|no more|missing)\b/.test(text) ||
    /\b(how much|how many|amount|quantity|ingredient|teaspoon|tablespoon|cup|ounce|gram)\b/.test(text) ||
    /\b(what can i use|what do i use|what should i use|what else can i|is there an alternative)\b/.test(text) ||
    /\b(can i use|could i use|will .+ work|okay to use)\b/.test(text);
}

function isStepJumpCommand(raw: string): boolean {
  const normalized = normalizeText(raw);
  if (!normalized) return false;

  // If this sounds like a cooking/ingredient question, bail out immediately.
  // "What can I use instead of two eggs" contains "two" but is NOT a step jump.
  if (hasCookingQuestionIntent(normalized)) return false;

  // "step X" with or without a jump cue
  const hasStepReference = /\bstep\s+[a-z0-9]+\b/.test(normalized);
  const hasJumpCue = /\b(go to|goto|back to|jump to|move to|take me to|start at|switch to)\b/.test(
    normalized
  );

  if (hasStepReference && hasJumpCue) return true;
  if (/^step\s+[a-z0-9]+(\s+please)?$/.test(normalized)) return true;

  // Bare number with a jump cue: "go to 3", "jump to two"
  // Only match short utterances — long sentences with a jump cue are likely
  // conversational ("I want to go to the store and get some butter").
  if (hasJumpCue && normalized.split(/\s+/).length <= 6 && parseSpokenStepNumber(normalized) !== null) return true;

  // Bare number or word-number alone: "3", "three"
  const tokens = normalized.replace(/\s*please\s*/g, '').split(/\s+/);
  if (tokens.length === 1) {
    const n = Number(tokens[0]);
    if (Number.isInteger(n) && n > 0) return true;
    if (STEP_WORD_TO_NUMBER[tokens[0]] !== undefined) return true;
  }

  return false;
}

function hasPreviousIntent(text: string): boolean {
  // Short utterance (roughly a command length) with a clear backward keyword
  if (text.split(/\s+/).length > 8) return false;
  return /\b(previous step|go back|go to (the )?previous|back a step|last step)\b/.test(text) ||
    /^(previous|back)(\s+please)?$/.test(text);
}

function hasNextIntent(text: string): boolean {
  // Short utterance with a clear forward keyword
  if (text.split(/\s+/).length > 8) return false;
  return /\b(next step|next one|go ahead|move on|keep going)\b/.test(text) ||
    /^(next|continue)(\s+please)?$/.test(text);
}

function formatQuantity(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}

function formatStep(stepNumber: number, step?: Step): string {
  if (!step) {
    return `Step ${stepNumber}. I cannot find the instruction yet.`;
  }
  const durationText =
    typeof step.duration === 'number' && step.duration > 0
      ? step.duration >= 60
        ? ` This step should take about ${Math.ceil(step.duration / 60)} minutes.`
        : ` This step should take about ${step.duration} seconds.`
      : '';
  const tipText = step.tips ? ` Tip: ${step.tips}` : '';
  return `Step ${stepNumber}. ${step.instruction}${durationText}${tipText}`;
}

function formatIngredientAmount(ingredient: Ingredient): string {
  const quantity = formatQuantity((ingredient as any).quantity);
  const unit = typeof ingredient.unit === 'string' ? ingredient.unit.trim() : '';
  const prep =
    typeof ingredient.preparation === 'string' && ingredient.preparation.trim()
      ? `, ${ingredient.preparation.trim()}`
      : '';

  if (quantity && unit) return `${quantity} ${unit} ${ingredient.name}${prep}`.trim();
  if (quantity) return `${quantity} ${ingredient.name}${prep}`.trim();
  return `${ingredient.name}${prep}`.trim();
}

function findIngredientInQuestion(recipe: Recipe, transcript: string): Ingredient | null {
  const query = normalizeText(transcript);
  const queryTokens = tokenize(transcript);
  if (!queryTokens.length) return null;

  let best: { ingredient: Ingredient; score: number } | null = null;

  for (const ingredient of recipe.ingredients || []) {
    const ingredientName = normalizeText(ingredient.name || '');
    if (!ingredientName) continue;

    let score = 0;
    if (query.includes(ingredientName)) {
      score += 5;
    }

    const ingredientTokens = tokenize(ingredientName);
    const overlap = ingredientTokens.filter((token) => queryTokens.includes(token)).length;
    score += overlap;

    if (!best || score > best.score) {
      best = { ingredient, score };
    }
  }

  return best && best.score >= 2 ? best.ingredient : null;
}

function findSubstitutionsForIngredient(recipe: Recipe, ingredientName: string) {
  const substitutions = recipe.substitutions || {};
  const target = normalizeText(ingredientName);

  for (const [key, options] of Object.entries(substitutions)) {
    const normalizedKey = normalizeText(key);
    if (target === normalizedKey || target.includes(normalizedKey) || normalizedKey.includes(target)) {
      return options;
    }
  }

  return null;
}

function buildSessionIntro(recipe: Recipe, stepNumber: number, step?: Step): string {
  const guidance =
    'Ask things like "how much onion again", "repeat that step", or "what should I do next".';
  return `Ready when you are. We are making ${recipe.title}. ${formatStep(stepNumber, step)} ${guidance}`;
}

function hasSubstitutionIntent(text: string): boolean {
  // Broad detection for substitution-related questions.
  // Catches natural phrasings people actually use while cooking:
  //   "I don't have baking soda"
  //   "what can I use instead of butter"
  //   "I'm out of eggs, what do I do"
  //   "can I substitute almond milk"
  //   "will olive oil work instead"
  return /\b(substitute|substitution|swap|replace|replacement|instead of|in place of)\b/.test(text) ||
    /\b(don t have|dont have|do not have|ran out of|out of|no more|i m missing|i am missing)\b/.test(text) ||
    /\b(what can i use|what do i use|what should i use|what else can i use|is there an alternative)\b/.test(text) ||
    /\b(can i use .+ instead|could i use .+ instead|will .+ work instead|okay to use .+ instead)\b/.test(text) ||
    /\b(can i use|could i use|will .+ work)\b/.test(text) && /\b(instead|replace|swap)\b/.test(text) ||
    /\b(any alternative|another option|something else)\b/.test(text);
}

function buildVoiceReply(transcript: string): VoiceReply {
  const store = useCookingStore.getState();
  const lower = normalizeText(transcript);
  const recipe = store.recipe;
  if (!recipe) {
    return { text: 'I am missing the recipe context right now. Please try again in a moment.' };
  }

  const currentStepNumber = store.currentStep;
  const currentStepData = recipe.steps.find((step) => step.number === currentStepNumber);
  const ingredientMatch = findIngredientInQuestion(recipe, transcript);
  const asksAmount = includesAny(lower, ['how much', 'how many', 'amount', 'quantity']);
  const asksTiming = includesAny(lower, ['how long', 'time', 'timer', 'minutes', 'seconds']);
  const asksCurrentStep = includesAny(lower, [
    'what step',
    'which step',
    'where are we',
    'what do i do',
    'what should i do',
    'what now',
  ]);
  const asksRepeat = includesAny(lower, ['repeat', 'again', 'say that again', 'one more time']);
  const asksSubstitution = hasSubstitutionIntent(lower);

  // ── Priority 1: Session control (stop/quit) ────────────────────────────
  if (includesAny(lower, ['stop listening', 'stop voice', 'quit voice', 'end voice'])) {
    return {
      text: 'Stopping voice mode. You can tap the microphone to start again.',
      stopLoop: true,
    };
  }

  // ── Priority 2: Substitution questions ─────────────────────────────────
  // Check BEFORE step navigation so "I don't have two eggs" doesn't get
  // mistaken for "go to step two".
  if (asksSubstitution && ingredientMatch) {
    const substitutions = findSubstitutionsForIngredient(recipe, ingredientMatch.name);
    if (substitutions?.length) {
      const options = substitutions.slice(0, 2).map((sub) =>
        `${sub.name} (${sub.ratio}${sub.notes ? ` — ${sub.notes}` : ''})`
      );
      return {
        text: `Instead of ${ingredientMatch.name}, you can try: ${options.join('. Or ')}.`,
      };
    }
    // No pre-defined substitution — let the AI handle it via the fallback.
    // Return a placeholder that processUtterance will replace with the AI response.
    return {
      text: `Let me think about a substitute for ${ingredientMatch.name}...`,
    };
  }

  // Substitution intent but no ingredient match — forward to AI
  if (asksSubstitution) {
    return {
      text: `I can help with substitutions. Let me think about that...`,
    };
  }

  // ── Priority 3: Ingredient amount questions ────────────────────────────
  if ((asksAmount || asksRepeat) && ingredientMatch) {
    return {
      text: `You need ${formatIngredientAmount(ingredientMatch)}.`,
    };
  }

  if (ingredientMatch && !asksSubstitution) {
    return {
      text: `For ${ingredientMatch.name}, use ${formatIngredientAmount(ingredientMatch)}.`,
    };
  }

  if (includesAny(lower, ['ingredient list', 'all ingredients', 'ingredients'])) {
    const preview = recipe.ingredients
      .slice(0, 8)
      .map((item) => formatIngredientAmount(item))
      .join(', ');
    return {
      text: preview
        ? `Here are the main ingredients: ${preview}. Ask about any ingredient and I can repeat the exact amount.`
        : 'I do not have ingredients for this recipe yet.',
    };
  }

  // ── Priority 4: Step navigation ────────────────────────────────────────
  if (isStepJumpCommand(transcript)) {
    const targetStep = parseSpokenStepNumber(transcript);
    if (!targetStep) {
      return { text: `Tell me a step number, for example: "step 2".` };
    }

    if (targetStep < 1 || targetStep > recipe.steps.length) {
      return { text: `This recipe has steps 1 through ${recipe.steps.length}.` };
    }

    if (targetStep === currentStepNumber) {
      return { text: `You are already on step ${targetStep}.` };
    }

    store.setCurrentStep(targetStep);
    const step = recipe.steps.find((item) => item.number === targetStep);
    return { text: `Going to step ${targetStep}. ${formatStep(targetStep, step)}` };
  }

  if (hasPreviousIntent(lower)) {
    if (currentStepNumber <= 1) {
      return { text: 'We are already at step 1.' };
    }
    store.previousStep();
    const prevStepNumber = useCookingStore.getState().currentStep;
    const prevStep = recipe.steps.find((step) => step.number === prevStepNumber);
    return {
      text: `Going back. ${formatStep(prevStepNumber, prevStep)}`,
    };
  }

  if (hasNextIntent(lower)) {
    if (currentStepNumber >= recipe.steps.length) {
      return {
        text: 'You are already on the final step. Say "done" when you finish and I can wrap up.',
      };
    }
    store.nextStep();
    const nextStepNumber = useCookingStore.getState().currentStep;
    const nextStep = recipe.steps.find((step) => step.number === nextStepNumber);
    return {
      text: formatStep(nextStepNumber, nextStep),
    };
  }

  if (includesAny(lower, ['done with this step', 'step done', 'finished this step'])) {
    if (currentStepNumber >= recipe.steps.length) {
      return {
        text: 'Nice work. That was the final step. Say "end session" when you are ready to stop.',
      };
    }
    store.nextStep();
    const nextStepNumber = useCookingStore.getState().currentStep;
    const nextStep = recipe.steps.find((step) => step.number === nextStepNumber);
    return {
      text: `Great. ${formatStep(nextStepNumber, nextStep)}`,
    };
  }

  // ── Priority 5: Informational queries ──────────────────────────────────
  if (asksTiming) {
    const totalMinutes = (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);
    if (currentStepData?.duration) {
      const stepTime =
        currentStepData.duration >= 60
          ? `${Math.ceil(currentStepData.duration / 60)} minutes`
          : `${currentStepData.duration} seconds`;
      return {
        text: `Step ${currentStepNumber} should take about ${stepTime}. Total recipe time is around ${totalMinutes} minutes.`,
      };
    }
    return {
      text: `Total recipe time is around ${totalMinutes} minutes. I can also repeat the current step if you want.`,
    };
  }

  if (asksCurrentStep || asksRepeat) {
    return {
      text: formatStep(currentStepNumber, currentStepData),
    };
  }

  if (includesAny(lower, ['start over', 'first step'])) {
    store.setCurrentStep(1);
    const firstStep = recipe.steps.find((step) => step.number === 1);
    return {
      text: `Starting over. ${formatStep(1, firstStep)}`,
    };
  }

  if (includesAny(lower, ['help', 'what can i ask'])) {
    return {
      text:
        'You can say things like: next step, previous, repeat that, how much garlic, ' +
        'I don\'t have butter, how long does this take, or ask me any cooking question.',
    };
  }

  // ── Fallback: generic context reply (will be replaced by AI if available)
  return {
    text:
      `I am with you on step ${currentStepNumber}. ${currentStepData?.instruction || ''} ` +
      'If you need an amount, ask like "how much onion again?"',
  };
}

function shouldHandleUtteranceLocally(transcript: string): boolean {
  const lower = normalizeText(transcript);

  // Substitution questions should ALWAYS go to the AI if there's no local
  // answer, so we never mark them as "local only".
  if (hasSubstitutionIntent(lower)) return false;

  // Anything that looks like a general cooking question → let the AI handle it
  if (hasCookingQuestionIntent(lower) && !isStepJumpCommand(transcript)) return false;

  // Navigation and session commands are safe to handle locally
  if (isStepJumpCommand(transcript)) return true;
  if (hasPreviousIntent(lower)) return true;
  if (hasNextIntent(lower)) return true;

  // Other short navigation / session commands
  if (includesAny(lower, ['done with this step', 'step done', 'finished this step'])) return true;
  if (includesAny(lower, ['start over', 'first step'])) return true;
  if (includesAny(lower, ['stop listening', 'stop voice', 'quit voice', 'end voice'])) return true;

  return false;
}

function primaryTranscript(event: ExpoSpeechRecognitionResultEvent): string {
  // In continuous mode, results accumulate in the array. We always want the
  // LATEST result — not results[0] which is the first thing the user said.
  const results = event.results;
  if (!results || !results.length) return '';
  const latest = results[results.length - 1];
  return (latest?.transcript || '').trim();
}

export function useVoice() {
  const { voiceState, setVoiceState, addMessage } = useCookingStore();

  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceLoopActive, setIsVoiceLoopActive] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loopActiveRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const shouldRestartRecognitionRef = useRef(false);
  const recognitionActiveRef = useRef(false);
  const isRespondingRef = useRef(false);
  const pendingUtteranceRef = useRef<string | null>(null);
  const bargeInKeywordRef = useRef('');
  const interimBargeCandidateRef = useRef<{ normalized: string; count: number; at: number } | null>(null);
  const lastProcessedUtteranceRef = useRef<{ normalized: string; at: number } | null>(null);
  const assistantSpeakingRef = useRef(false);
  const currentAssistantReplyRef = useRef('');
  const latestTranscriptRef = useRef('');
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCommitTimer = useCallback(() => {
    if (!commitTimerRef.current) return;
    clearTimeout(commitTimerRef.current);
    commitTimerRef.current = null;
  }, []);

  const processUtterance = useCallback(
    async (utterance: string) => {
      const text = utterance.trim();
      if (!text) return;
      if (isLikelyNoiseUtterance(text)) return;

      const normalizedText = normalizeText(text);
      const now = Date.now();
      const lastProcessed = lastProcessedUtteranceRef.current;
      if (
        normalizedText &&
        lastProcessed &&
        lastProcessed.normalized === normalizedText &&
        now - lastProcessed.at < 2200
      ) {
        return;
      }
      lastProcessedUtteranceRef.current = {
        normalized: normalizedText,
        at: now,
      };

      if (isRespondingRef.current) {
        pendingUtteranceRef.current = text;
        return;
      }

      isRespondingRef.current = true;
      setTranscriptText(text);
      addMessage('user', text);
      setVoiceState('processing');

      let shouldStopLoop = false;

      try {
        let reply = buildVoiceReply(text);
        if (!shouldHandleUtteranceLocally(text)) {
          try {
            const snapshot = useCookingStore.getState();
            const inworldResponse = await requestInworldCookingReply({
              userMessage: text,
              currentStep: snapshot.currentStep,
              recipe: snapshot.recipe,
              conversationHistory: snapshot.conversationHistory.slice(-10),
            });

            if (inworldResponse) {
              // Parse [GOTO:N] navigation tag from LLM response
              const gotoMatch = inworldResponse.match(/\[GOTO:(\d+)\]\s*$/);
              if (gotoMatch) {
                const targetStep = parseInt(gotoMatch[1], 10);
                const currentSnapshot = useCookingStore.getState();
                const maxSteps = currentSnapshot.recipe?.steps?.length ?? 0;
                if (targetStep >= 1 && targetStep <= maxSteps && targetStep !== currentSnapshot.currentStep) {
                  useCookingStore.getState().setCurrentStep(targetStep);
                }
              }
              // Strip the tag so it is not spoken aloud
              const cleanResponse = inworldResponse.replace(/\s*\[GOTO:\d+\]\s*$/, '').trim();
              reply = { text: cleanResponse || inworldResponse };
            }
          } catch (chatError: any) {
            setError(chatError?.message || 'Inworld chat failed');
          }
        }

        setAssistantText(reply.text);
        addMessage('assistant', reply.text);
        currentAssistantReplyRef.current = reply.text;
        shouldStopLoop = !!reply.stopLoop;

        assistantSpeakingRef.current = true;
        setVoiceState('speaking');
        await interruptAndSpeak(reply.text);
      } catch (speakError: any) {
        setError(speakError?.message || 'TTS playback failed');
      } finally {
        assistantSpeakingRef.current = false;
        isRespondingRef.current = false;

        // ── Clear stale transcript state so old speech doesn't bleed ──
        latestTranscriptRef.current = '';
        clearCommitTimer();

        // ── Restart recognition to get a fresh session ──
        // Without this, continuous mode accumulates all previous results
        // and the next `result` event includes everything said so far.
        if (loopActiveRef.current) {
          recognitionActiveRef.current = false;
          try {
            ExpoSpeechRecognitionModule.abort();
          } catch {
            // no-op
          }
          // The `end` listener will auto-restart recognition via startRecognition()
          setVoiceState('listening');
        }
      }

      if (shouldStopLoop) {
        loopActiveRef.current = false;
        setIsVoiceLoopActive(false);
        shouldRestartRecognitionRef.current = false;
        stopRequestedRef.current = true;
        clearCommitTimer();
        latestTranscriptRef.current = '';
        lastProcessedUtteranceRef.current = null;
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          try {
            ExpoSpeechRecognitionModule.stop();
          } catch {
            // no-op
          }
        }
        await stopSpeaking(true);
        setVoiceState('idle');
        return;
      }

      const pending = pendingUtteranceRef.current;
      pendingUtteranceRef.current = null;
      if (pending && loopActiveRef.current) {
        void processUtterance(pending);
      }
    },
    [addMessage, clearCommitTimer, setVoiceState]
  );

  const commitBufferedTranscript = useCallback(async () => {
    clearCommitTimer();
    const text = latestTranscriptRef.current.trim();
    if (!text) return;
    latestTranscriptRef.current = '';
    bargeInKeywordRef.current = '';
    await processUtterance(text);
  }, [clearCommitTimer, processUtterance]);

  const startRecognition = useCallback(async () => {
    if (!loopActiveRef.current || recognitionActiveRef.current) return;

    stopRequestedRef.current = false;
    shouldRestartRecognitionRef.current = true;

    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
        // Enable iOS voice processing to reduce assistant self-capture.
        iosVoiceProcessingEnabled: true,
        iosCategory: {
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
          mode: 'voiceChat',
        },
      });
      recognitionActiveRef.current = true;
      setIsListening(true);
      if (!isRespondingRef.current && !assistantSpeakingRef.current) {
        setVoiceState('listening');
      }
    } catch (startError: any) {
      setError(startError?.message || 'Failed to start speech recognition');
      recognitionActiveRef.current = false;
      setIsListening(false);
    }
  }, [setVoiceState]);

  const stopRecognition = useCallback(() => {
    shouldRestartRecognitionRef.current = false;
    stopRequestedRef.current = true;
    recognitionActiveRef.current = false;
    latestTranscriptRef.current = '';
    clearCommitTimer();
    setIsListening(false);

    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // no-op
      }
    }
  }, [clearCommitTimer]);

  const stopVoiceLoop = useCallback(async () => {
    loopActiveRef.current = false;
    setIsVoiceLoopActive(false);
    pendingUtteranceRef.current = null;
    bargeInKeywordRef.current = '';
    interimBargeCandidateRef.current = null;
    lastProcessedUtteranceRef.current = null;
    latestTranscriptRef.current = '';
    clearCommitTimer();
    stopRecognition();
    assistantSpeakingRef.current = false;
    await stopSpeaking(true);
    setVoiceState('idle');
  }, [clearCommitTimer, setVoiceState, stopRecognition]);

  const announceCurrentStep = useCallback(async () => {
    if (!loopActiveRef.current) return;
    if (isRespondingRef.current || assistantSpeakingRef.current) return;

    const store = useCookingStore.getState();
    const recipe = store.recipe;
    if (!recipe) return;

    const step = recipe.steps.find((item) => item.number === store.currentStep);
    const message = `${formatStep(store.currentStep, step)} Say next step when you are ready.`;

    if (currentAssistantReplyRef.current.includes(`Step ${store.currentStep}.`)) {
      return;
    }

    try {
      setAssistantText(message);
      addMessage('assistant', message);
      assistantSpeakingRef.current = true;
      setVoiceState('speaking');
      await interruptAndSpeak(message);
    } catch (speakError: any) {
      setError(speakError?.message || 'TTS playback failed');
    } finally {
      assistantSpeakingRef.current = false;
      if (loopActiveRef.current && !isRespondingRef.current) {
        setVoiceState('listening');
      }
    }
  }, [addMessage, setVoiceState]);

  const requestPermission = useCallback(async () => {
    const response = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    setPermissionGranted(!!response.granted);
    return response;
  }, []);

  const startVoiceLoop = useCallback(async () => {
    if (loopActiveRef.current) return;

    setError(null);
    const permission = await requestPermission();
    if (!permission.granted) {
      setError('Microphone and speech recognition permissions are required.');
      return;
    }

    loopActiveRef.current = true;
    setIsVoiceLoopActive(true);
    latestTranscriptRef.current = '';
    bargeInKeywordRef.current = '';
    interimBargeCandidateRef.current = null;
    pendingUtteranceRef.current = null;
    lastProcessedUtteranceRef.current = null;
    setVoiceState('listening');

    await startRecognition();

    const store = useCookingStore.getState();
    const recipe = store.recipe;
    const currentStepData = recipe?.steps.find((step) => step.number === store.currentStep);

    if (recipe) {
      const intro = buildSessionIntro(recipe, store.currentStep, currentStepData);
      setAssistantText(intro);
      addMessage('assistant', intro);

      try {
        assistantSpeakingRef.current = true;
        setVoiceState('speaking');
        await interruptAndSpeak(intro);
      } catch (speakError: any) {
        setError(speakError?.message || 'TTS playback failed');
      } finally {
        assistantSpeakingRef.current = false;
      }
    }

    if (loopActiveRef.current && !isRespondingRef.current) {
      setVoiceState('listening');
      if (!recognitionActiveRef.current) {
        await startRecognition();
      }
    }
  }, [addMessage, requestPermission, setVoiceState, startRecognition]);

  const interruptAndListen = useCallback(async () => {
    if (!loopActiveRef.current) return;
    await interruptAndSpeak('');
    assistantSpeakingRef.current = false;
    setVoiceState('listening');
  }, [setVoiceState]);

  const toggleVoiceLoop = useCallback(async () => {
    if (loopActiveRef.current) {
      await stopVoiceLoop();
      return;
    }

    await startVoiceLoop();
  }, [startVoiceLoop, stopVoiceLoop]);

  useEffect(() => {
    let mounted = true;

    const syncPermission = async () => {
      try {
        const response = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        if (mounted) {
          setPermissionGranted(!!response.granted);
        }
      } catch {
        if (mounted) {
          setPermissionGranted(false);
        }
      }
    };

    void syncPermission();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const startSub = ExpoSpeechRecognitionModule.addListener('start', () => {
      recognitionActiveRef.current = true;
      setIsListening(true);
      if (loopActiveRef.current && !assistantSpeakingRef.current && !isRespondingRef.current) {
        setVoiceState('listening');
      }
    });

    const speechStartSub = ExpoSpeechRecognitionModule.addListener('speechstart', () => {
      if (!loopActiveRef.current) return;
      if (!assistantSpeakingRef.current && !isRespondingRef.current) {
        setVoiceState('listening');
      }
    });

    const speechEndSub = ExpoSpeechRecognitionModule.addListener('speechend', () => {
      if (!loopActiveRef.current) return;
      if (assistantSpeakingRef.current) return;
      if (isRespondingRef.current) return;
      if (!latestTranscriptRef.current.trim()) return;

      clearCommitTimer();
      commitTimerRef.current = setTimeout(() => {
        void commitBufferedTranscript();
      }, SPEECH_END_COMMIT_DELAY_MS);
    });

    const resultSub = ExpoSpeechRecognitionModule.addListener(
      'result',
      (event: ExpoSpeechRecognitionResultEvent) => {
        if (!loopActiveRef.current) return;

        const transcript = primaryTranscript(event);
        if (!transcript) return;

        if (assistantSpeakingRef.current) {
          const isPlaybackEcho = isLikelyAssistantPlaybackEcho(transcript, currentAssistantReplyRef.current);
          if (isPlaybackEcho) {
            interimBargeCandidateRef.current = null;
            return;
          }

          const isAssistantEcho = isLikelyAssistantEcho(transcript, currentAssistantReplyRef.current);
          if (isAssistantEcho) {
            interimBargeCandidateRef.current = null;
            return;
          }

          // Mission-critical guard: only interrupt if transcript contains
          // at least one meaningful token that was NOT just spoken by assistant.
          if (
            !hasUserBargeInSignal(transcript, currentAssistantReplyRef.current, {
              isFinal: !!event.isFinal,
            })
          ) {
            interimBargeCandidateRef.current = null;
            return;
          }

          // Guard against noisy interim hallucinations by requiring a stable
          // interim candidate twice before interrupting assistant playback.
          if (!event.isFinal) {
            const normalizedCandidate = normalizeText(transcript);
            const now = Date.now();
            const previous = interimBargeCandidateRef.current;
            const hasImmediateCommand = tokenize(transcript).some((token) =>
              IMMEDIATE_BARGE_IN_SINGLE_TOKENS.has(token)
            );

            // Explicit command/wake words should interrupt quickly.
            if (hasImmediateCommand) {
              interimBargeCandidateRef.current = null;
            } else if (
              previous &&
              isConsistentInterimCandidate(previous.normalized, normalizedCandidate) &&
              now - previous.at <= BARGE_IN_INTERIM_CONFIRM_WINDOW_MS
            ) {
              interimBargeCandidateRef.current = {
                normalized: normalizedCandidate,
                count: previous.count + 1,
                at: now,
              };
            } else {
              interimBargeCandidateRef.current = {
                normalized: normalizedCandidate,
                count: 1,
                at: now,
              };
              return;
            }

            if (!hasImmediateCommand && (interimBargeCandidateRef.current?.count ?? 0) < 2) {
              return;
            }
          } else {
            interimBargeCandidateRef.current = null;
          }

          const keyword = extractBargeInKeyword(transcript);
          if (keyword) {
            bargeInKeywordRef.current = keyword;
          }

          setVoiceState('listening');
        } else if (isLikelyAssistantEcho(transcript, currentAssistantReplyRef.current)) {
          return;
        }

        void (async () => {
          const playing = assistantSpeakingRef.current || (await isSpeaking());
          if (playing) {
            await stopSpeaking(true);
            assistantSpeakingRef.current = false;
            if (loopActiveRef.current && !isRespondingRef.current) {
              setVoiceState('listening');
            }
          }

          const mergedTranscript = mergeBargeInKeyword(transcript, bargeInKeywordRef.current);
          latestTranscriptRef.current = mergedTranscript;
          setTranscriptText(mergedTranscript);

          if (event.isFinal) {
            await commitBufferedTranscript();
            return;
          }

          clearCommitTimer();
          commitTimerRef.current = setTimeout(() => {
            void commitBufferedTranscript();
          }, getCommitDelayMs(mergedTranscript));
        })();
      }
    );

    const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
      recognitionActiveRef.current = false;
      setIsListening(false);
      clearCommitTimer();

      if (!loopActiveRef.current) return;
      if (stopRequestedRef.current || !shouldRestartRecognitionRef.current) return;

      setTimeout(() => {
        if (!loopActiveRef.current) return;
        if (recognitionActiveRef.current) return;
        void startRecognition();
      }, 180);
    });

    const errorSub = ExpoSpeechRecognitionModule.addListener(
      'error',
      (event: ExpoSpeechRecognitionErrorEvent) => {
        if (!loopActiveRef.current) return;

        const isNonFatal = NON_FATAL_RECOGNITION_ERRORS.has(event.error);
        if (!isNonFatal) {
          setError(`Speech ${event.error}: ${event.message}`);
        }

        recognitionActiveRef.current = false;
        setIsListening(false);

        if (!stopRequestedRef.current && shouldRestartRecognitionRef.current) {
          setTimeout(() => {
            if (!loopActiveRef.current || recognitionActiveRef.current) return;
            void startRecognition();
          }, 220);
        }
      }
    );

    return () => {
      startSub.remove();
      speechStartSub.remove();
      speechEndSub.remove();
      resultSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, [clearCommitTimer, commitBufferedTranscript, setVoiceState, startRecognition]);

  useEffect(() => {
    return () => {
      void stopVoiceLoop();
    };
  }, [stopVoiceLoop]);

  return {
    voiceState,
    isListening,
    isVoiceLoopActive,
    permissionGranted,
    transcriptText,
    assistantText,
    error,
    startVoiceLoop,
    stopVoiceLoop,
    toggleVoiceLoop,
    interruptAndListen,
    announceCurrentStep,
  };
}
