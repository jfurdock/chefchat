import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { Recipe } from '@/src/types/recipe';

type ConversationHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

type InworldChatRequest = {
  userMessage: string;
  currentStep: number;
  recipe: Recipe | null;
  conversationHistory: ConversationHistoryItem[];
};

type InworldChatResponse = {
  response?: string;
};

export async function requestInworldCookingReply(
  payload: InworldChatRequest
): Promise<string> {
  const callable = httpsCallable(getFunctions(getApp(), 'us-central1'), 'inworldChat');

  try {
    const response = (await callable(payload)) as { data: InworldChatResponse };
    return response?.data?.response?.trim() || '';
  } catch (error: any) {
    const code = error?.code || 'unknown';
    const details =
      typeof error?.details === 'string'
        ? error.details
        : error?.details?.message || error?.message || 'Cooking chat failed';

    throw new Error(`Inworld chat ${code}: ${details}`);
  }
}
