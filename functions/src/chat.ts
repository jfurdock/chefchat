import * as functions from 'firebase-functions/v1';
import { inworldRequest, readInworldConfig } from './inworldClient';
import { consumeVoiceCredits, estimateChatCredits } from './voiceQuota';

const DEBORAH_PERSONALITY = [
  'You are Deborah, the ChefChat cooking assistant.',
  'Think of yourself as a fun, relaxed cooking instructor leading a cooking class.',
  'You are casual, conversational, and warm, like a friend who happens to be a great cook.',
  'Keep your responses short and natural, never verbose or robotic.',
].join(' ');

const FORMATTING_RULES = [
  'Never use symbols in your responses. No asterisks, colons, semicolons, dashes, bullet points, numbered lists, or markdown formatting.',
  'Write everything as plain conversational English sentences.',
  'Do not introduce yourself by name unless the user explicitly asks who you are.',
  'Tags like [SELECT_RECIPE:id] and [GOTO:N] are internal app signals only. Never mention them conversationally or read them aloud.',
].join(' ');

type HistoryMessage = {
  role?: 'user' | 'assistant';
  content?: string;
};

type ChatRequest = {
  userMessage?: string;
  currentStep?: number;
  assistantMode?: 'general' | 'guided' | 'onboarding';
  activeRecipeId?: string | null;
  recipe?: {
    id?: string;
    title?: string;
    ingredients?: Array<{ name?: string; quantity?: number | string; unit?: string; preparation?: string }>;
    steps?: Array<{ number?: number; instruction?: string; duration?: number; tips?: string }>;
  } | null;
  conversationHistory?: HistoryMessage[];
  recipeCatalog?: Array<{
    id?: string;
    title?: string;
    cuisine?: string;
    difficulty?: 'easy' | 'medium' | 'hard' | string;
    servings?: number;
    totalTimeMinutes?: number;
    tags?: string[];
  }>;
  favoriteRecipeIds?: string[];
  favoriteRecipeTitles?: string[];
};

type InworldChatResponse = {
  result?: {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
};

function formatQuantity(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}

function summarizeRecipe(recipe: ChatRequest['recipe'], currentStep: number): string {
  if (!recipe) return 'No recipe context available.';

  const title = recipe.title || 'Unknown recipe';
  const ingredients = (recipe.ingredients || [])
    .slice(0, 25)
    .map((item) => {
      const quantity = formatQuantity(item.quantity);
      const unit = item.unit?.trim() || '';
      const prep = item.preparation?.trim() ? ` (${item.preparation.trim()})` : '';
      return `${quantity ? `${quantity} ` : ''}${unit ? `${unit} ` : ''}${item.name || 'ingredient'}${prep}`.trim();
    })
    .join('; ');

  const steps = (recipe.steps || [])
    .slice(0, 20)
    .map((step, index) => {
      const number = step.number || index + 1;
      const instruction = step.instruction || 'No instruction';
      const duration = typeof step.duration === 'number' && step.duration > 0 ? ` [${step.duration}s]` : '';
      return `${number}. ${instruction}${duration}`;
    })
    .join('\n');

  return [
    `Recipe: ${title}`,
    `Current step: ${currentStep}`,
    ingredients ? `Ingredients: ${ingredients}` : 'Ingredients: unavailable',
    steps ? `Steps:\n${steps}` : 'Steps: unavailable',
  ].join('\n\n');
}

function summarizeHistory(history: HistoryMessage[] | undefined): string {
  if (!history?.length) return 'No prior conversation.';

  return history
    .slice(-10)
    .map((message) => {
      const role = message.role === 'assistant' ? 'Deborah' : 'User';
      const content = typeof message.content === 'string' ? message.content.trim() : '';
      return content ? `${role}: ${content}` : null;
    })
    .filter(Boolean)
    .join('\n');
}

function summarizeRecipeCatalog(
  recipeCatalog: ChatRequest['recipeCatalog'],
  favoriteRecipeIds: string[] | undefined,
  favoriteRecipeTitles: string[] | undefined,
): string {
  if (!recipeCatalog?.length) return 'No app recipe catalog was provided.';

  const favoriteIds = new Set((favoriteRecipeIds || []).filter(Boolean));
  const favoriteTitles = new Set(
    (favoriteRecipeTitles || []).map((title) => String(title || '').trim().toLowerCase()).filter(Boolean),
  );

  const entries = recipeCatalog.slice(0, 100).map((recipe) => {
    const id = recipe.id || 'unknown-id';
    const title = recipe.title || 'Untitled recipe';
    const cuisine = recipe.cuisine || 'General';
    const difficulty = recipe.difficulty || 'unknown';
    const totalTime =
      typeof recipe.totalTimeMinutes === 'number' && Number.isFinite(recipe.totalTimeMinutes)
        ? `${Math.max(0, Math.round(recipe.totalTimeMinutes))} min`
        : '? min';
    const favoriteMark =
      favoriteIds.has(id) || favoriteTitles.has(title.trim().toLowerCase()) ? '[FAVORITE]' : '';
    return `${id} :: ${title} :: ${cuisine} :: ${difficulty} :: ${totalTime} ${favoriteMark}`.trim();
  });

  return [
    `Available app recipes (${entries.length} shown):`,
    ...entries,
  ].join('\n');
}

function buildPrompt({
  userMessage,
  recipe,
  currentStep,
  conversationHistory,
  assistantMode,
  activeRecipeId,
  recipeCatalog,
  favoriteRecipeIds,
  favoriteRecipeTitles,
}: {
  userMessage: string;
  recipe: ChatRequest['recipe'];
  currentStep: number;
  assistantMode?: 'general' | 'guided' | 'onboarding';
  activeRecipeId?: string | null;
  recipeCatalog?: ChatRequest['recipeCatalog'];
  favoriteRecipeIds?: string[];
  favoriteRecipeTitles?: string[];
  conversationHistory?: HistoryMessage[];
}): string {
  const catalogSummary = summarizeRecipeCatalog(
    recipeCatalog,
    favoriteRecipeIds,
    favoriteRecipeTitles,
  );
  const preferredRecipeLine = activeRecipeId
    ? `Current selected app recipe id: ${activeRecipeId}`
    : 'Current selected app recipe id: none';
  const hasRecipeContext =
    !!recipe &&
    (!!recipe.title ||
      (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) ||
      (Array.isArray(recipe.steps) && recipe.steps.length > 0));
  const isGeneralAssistant = assistantMode === 'general';
  const isOnboardingAssistant = assistantMode === 'onboarding';

  if (isOnboardingAssistant) {
    return [
      DEBORAH_PERSONALITY,
      'You are guiding a first-time user through onboarding.',
      'Keep responses warm, casual, and short so they sound natural in voice.',
      'Mention the wake phrase hey chef naturally when relevant.',
      '',
      'Rules:',
      FORMATTING_RULES,
      'Keep replies to one or two short sentences unless the user asks for more.',
      'Stay encouraging and practical.',
      '',
      preferredRecipeLine,
      '',
      catalogSummary,
      '',
      `Conversation so far:\n${summarizeHistory(conversationHistory)}`,
      '',
      `Latest user request: ${userMessage}`,
    ].join('\n');
  }

  if (!hasRecipeContext) {
    return [
      DEBORAH_PERSONALITY,
      'The user can ask any standalone cooking question (timing, temperatures, substitutions, techniques, food safety).',
      'When recommending dishes, only recommend recipes that are listed in AVAILABLE APP RECIPES.',
      'If the user asks for favorites or saved recipes, prioritize recipes marked [FAVORITE].',
      'If user asks to cook/select a specific app recipe, append [SELECT_RECIPE:<recipe_id>] at the end of your response.',
      'Only use recipe ids that exist in AVAILABLE APP RECIPES.',
      '',
      'Rules:',
      FORMATTING_RULES,
      '- Keep responses to 1-3 sentences unless the user asks for a detailed breakdown.',
      '- Give practical cooking advice with specific temperatures/times when relevant.',
      '- If there are multiple good options, give the best default first.',
      '- If critical context is missing, ask one short clarifying question.',
      '- If user asks "what should I make?", suggest 2-4 app recipes with short reasons.',
      '- Never say "Step 1", "Step 2", or similar numbered step phrasing.',
      '- For instructions, prefer natural transitions like "Let\'s start with...", then "Next, let\'s...".',
      '',
      'No active recipe context is currently available.',
      preferredRecipeLine,
      '',
      catalogSummary,
      '',
      `Conversation so far:\n${summarizeHistory(conversationHistory)}`,
      '',
      `Latest user request: ${userMessage}`,
    ].join('\n');
  }

  if (isGeneralAssistant) {
    return [
      DEBORAH_PERSONALITY,
      'The user is chatting about a selected recipe from the app.',
      'Use exact ingredient amounts and steps from the provided recipe context.',
      'If user asks to switch recipes, recommend from AVAILABLE APP RECIPES and append [SELECT_RECIPE:<recipe_id>].',
      '',
      'Rules:',
      FORMATTING_RULES,
      '- Keep responses to 1-3 sentences unless the user asks for more detail.',
      '- Give practical timing/temperature guidance tied to the selected recipe.',
      '- If user asks for substitutions, keep suggestions realistic for this recipe.',
      '- If critical context is missing, ask one short clarifying question.',
      '- Never say "Step 1", "Step 2", or similar numbered step phrasing.',
      '- For instructions, prefer natural transitions like "Let\'s start with...", then "Next, let\'s...".',
      '- End instruction-style replies with "Let me know when you\'re ready to continue."',
      '',
      preferredRecipeLine,
      '',
      summarizeRecipe(recipe, currentStep),
      '',
      catalogSummary,
      '',
      `Conversation so far:\n${summarizeHistory(conversationHistory)}`,
      '',
      `Latest user request: ${userMessage}`,
    ].join('\n');
  }

  return [
    DEBORAH_PERSONALITY,
    'The user is cooking hands-free and needs short spoken responses.',
    '',
    'Rules:',
    FORMATTING_RULES,
    '- Keep responses to 1-3 sentences.',
    '- Be clear and encouraging, not verbose.',
    '- If asked for ingredient amount, provide the exact amount from the recipe context.',
    '- If asked about substituting an ingredient, suggest a practical alternative with a brief reason. Use common cooking knowledge.',
    '- Answer cooking questions conversationally. The user may ask about techniques, timing, or why a step matters.',
    '- Never ask the user for a step number.',
    '- Never say "Step 1", "Step 2", or similar numbered step phrasing.',
    '- For instructions, prefer natural transitions like "Let\'s start with...", then "Next, let\'s...".',
    '- End instruction-style replies with "Let me know when you\'re ready to continue."',
    '- If unsure, ask one short clarifying question.',
    '',
    'Step navigation:',
    '[GOTO:N] is a silent internal app tag, never spoken aloud.',
    'When the user wants to move to a different step (e.g. "what\'s next", "let\'s move on", "okay next", "go back one"), include the tag [GOTO:N] at the very end of your response where N is the step number to navigate to. Read the step instruction in your response.',
    `For example if the user is on step 2 and says "what's next", respond with the step 3 instruction and end with [GOTO:3].`,
    'If the user asks "go back" or similar, respond with the previous step instruction and end with the appropriate [GOTO:N].',
    'Only include [GOTO:N] when the user actually wants to change steps, not when they are just asking a question about a step.',
    '',
    summarizeRecipe(recipe, currentStep),
    '',
    `Conversation so far:\n${summarizeHistory(conversationHistory)}`,
    '',
    `Latest user request: ${userMessage}`,
  ].join('\n');
}

export const inworldChat = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
  })
  .https.onCall(async (data: ChatRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to use cooking chat.');
    }

    const payload = (data || {}) as ChatRequest;
    const userMessage = typeof payload.userMessage === 'string' ? payload.userMessage.trim() : '';

    if (!userMessage) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required field: userMessage');
    }

    const currentStep =
      typeof payload.currentStep === 'number' && Number.isFinite(payload.currentStep)
        ? payload.currentStep
        : 1;

    const prompt = buildPrompt({
      userMessage,
      recipe: payload.recipe || null,
      currentStep,
      assistantMode: payload.assistantMode,
      activeRecipeId: payload.activeRecipeId,
      recipeCatalog: payload.recipeCatalog,
      favoriteRecipeIds: payload.favoriteRecipeIds,
      favoriteRecipeTitles: payload.favoriteRecipeTitles,
      conversationHistory: payload.conversationHistory,
    });

    const model = readInworldConfig('llm_model', 'gpt-4o-mini');
    const provider = readInworldConfig('llm_provider', 'SERVICE_PROVIDER_OPENAI');

    let response: InworldChatResponse;

    try {
      response = await inworldRequest<InworldChatResponse>({
        method: 'POST',
        path: '/llm/v1alpha/completions:completeChat',
        body: {
          servingId: {
            modelId: {
              model,
              serviceProvider: provider,
            },
            userId: context.auth.uid,
          },
          messages: [
            {
              role: 'MESSAGE_ROLE_USER',
              content: prompt,
            },
          ],
          textGenerationConfig: {
            maxTokens: 220,
            temperature: 0.4,
            stream: false,
          },
        },
      });
    } catch (error: any) {
      throw new functions.https.HttpsError('internal', error?.message || 'Inworld chat request failed.');
    }

    const content = response?.result?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new functions.https.HttpsError('internal', 'Inworld chat returned empty response.');
    }

    const usage = await consumeVoiceCredits({
      uid: context.auth.uid,
      feature: 'chat',
      amount: estimateChatCredits(userMessage),
    });

    return {
      response: content,
      provider: 'inworld',
      model,
      usage,
    };
  });
