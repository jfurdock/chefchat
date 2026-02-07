import * as functions from 'firebase-functions/v1';
import { inworldRequest, readInworldConfig } from './inworldClient';

type HistoryMessage = {
  role?: 'user' | 'assistant';
  content?: string;
};

type ChatRequest = {
  userMessage?: string;
  currentStep?: number;
  recipe?: {
    id?: string;
    title?: string;
    ingredients?: Array<{ name?: string; quantity?: number | string; unit?: string; preparation?: string }>;
    steps?: Array<{ number?: number; instruction?: string; duration?: number; tips?: string }>;
  } | null;
  conversationHistory?: HistoryMessage[];
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
      const role = message.role === 'assistant' ? 'ChefChat' : 'User';
      const content = typeof message.content === 'string' ? message.content.trim() : '';
      return content ? `${role}: ${content}` : null;
    })
    .filter(Boolean)
    .join('\n');
}

function buildPrompt({ userMessage, recipe, currentStep, conversationHistory }: {
  userMessage: string;
  recipe: ChatRequest['recipe'];
  currentStep: number;
  conversationHistory?: HistoryMessage[];
}): string {
  return [
    'You are ChefChat, a friendly and concise voice cooking assistant.',
    'The user is cooking hands-free and needs short spoken responses.',
    '',
    'Rules:',
    '- Keep responses to 1-3 sentences.',
    '- Be clear and encouraging, not verbose.',
    '- If asked for ingredient amount, provide the exact amount from the recipe context.',
    '- If asked about substituting an ingredient, suggest a practical alternative with a brief reason. Use common cooking knowledge.',
    '- Answer cooking questions conversationally. The user may ask about techniques, timing, or why a step matters.',
    '- Never ask the user for a step number.',
    '- If unsure, ask one short clarifying question.',
    '',
    'Step navigation:',
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

    return {
      response: content,
      provider: 'inworld',
      model,
    };
  });
