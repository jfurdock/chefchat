import * as functions from 'firebase-functions/v1';
import { inworldRequest, readInworldConfig } from './inworldClient';
import { consumeVoiceCredits, estimateTtsCredits } from './voiceQuota';

type SynthesizeSpeechRequest = {
  text?: string;
  languageCode?: string;
  voiceName?: string;
  speakingRate?: number;
  pitch?: number;
};

type ListVoicesRequest = {
  languageCode?: string;
};

type InworldSynthesizeResponse = {
  audioContent?: string;
  result?: {
    audioContent?: string;
  };
  error?: {
    message?: string;
  };
};

type InworldVoice = {
  voiceId?: string;
  name?: string;
  displayName?: string;
  languages?: string[];
  languageCodes?: string[];
  locales?: string[];
  language?: string;
  langCode?: string;
  gender?: string;
  naturalSampleRateHertz?: number;
  sampleRateHertz?: number;
};

type InworldListVoicesResponse = {
  voices?: InworldVoice[];
};

function asBoundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeLanguageFilter(languageCode: string): string {
  const trimmed = languageCode.trim();
  if (!trimmed) return 'en';
  return trimmed.split('-')[0].toLowerCase();
}

function resolveVoiceId(inputVoice?: string): string {
  const defaultVoice = readInworldConfig('tts_voice_id', 'Lily');
  if (!inputVoice) return defaultVoice;

  // Old Google voice names may still be persisted on clients.
  if (inputVoice.includes('Neural2') || inputVoice.includes('Wavenet')) return defaultVoice;
  return inputVoice;
}

function inferGender(voice: InworldVoice): string {
  const source = `${voice.gender || ''} ${voice.name || ''} ${voice.voiceId || ''}`.toLowerCase();
  if (source.includes('female')) return 'FEMALE';
  if (source.includes('male')) return 'MALE';
  return 'SSML_VOICE_GENDER_UNSPECIFIED';
}

export const synthesizeSpeech = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
  })
  .https.onCall(async (data: SynthesizeSpeechRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to use text-to-speech.'
      );
    }

    const payload = (data || {}) as SynthesizeSpeechRequest;
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';

    if (!text) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required field: text');
    }

    const languageCode = payload.languageCode || 'en-US';
    const voiceName = resolveVoiceId(payload.voiceName);
    const speakingRate = asBoundedNumber(payload.speakingRate, 1.1, 0.25, 2.0);
    const pitch = asBoundedNumber(payload.pitch, 0, -20, 20);

    const modelId = readInworldConfig('tts_model', 'inworld-tts-1.5-max');

    let response: InworldSynthesizeResponse;

    try {
      response = await inworldRequest<InworldSynthesizeResponse>({
        method: 'POST',
        path: '/tts/v1/voice',
        body: {
          text,
          voiceId: voiceName,
          modelId,
        },
      });
    } catch (error: any) {
      throw new functions.https.HttpsError(
        'internal',
        error?.message || 'Inworld TTS synthesis failed.'
      );
    }

    const audioContent = response?.audioContent || response?.result?.audioContent;
    if (!audioContent) {
      throw new functions.https.HttpsError('internal', 'Inworld TTS returned empty audio.');
    }

    const usage = await consumeVoiceCredits({
      uid: context.auth.uid,
      feature: 'tts',
      amount: estimateTtsCredits(text),
    });

    return {
      audioBase64: audioContent,
      mimeType: 'audio/mpeg',
      languageCode,
      voiceName,
      speakingRate,
      pitch,
      provider: 'inworld',
      usage,
    };
  });

export const listTtsVoices = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .https.onCall(async (data: ListVoicesRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to list available voices.'
      );
    }

    const payload = (data || {}) as ListVoicesRequest;
    const languageCode = payload.languageCode || 'en-US';
    const languageFilter = normalizeLanguageFilter(languageCode);

    let response: InworldListVoicesResponse;

    try {
      response = await inworldRequest<InworldListVoicesResponse>({
        method: 'GET',
        path: '/tts/v1/voices',
        query: {
          filter: `language=${languageFilter}`,
        },
      });
    } catch (error: any) {
      throw new functions.https.HttpsError('internal', error?.message || 'Failed to list Inworld voices.');
    }

    const voices = (response?.voices || []).map((voice) => {
      const languageCodes =
        voice.languages ||
        voice.languageCodes ||
        voice.locales ||
        (voice.language ? [voice.language] : voice.langCode ? [voice.langCode] : [languageCode]);

      return {
        name: voice.voiceId || voice.name || voice.displayName || 'UnknownVoice',
        languageCodes,
        ssmlGender: inferGender(voice),
        naturalSampleRateHertz: voice.naturalSampleRateHertz || voice.sampleRateHertz || 24000,
      };
    });

    return {
      voices,
      languageCode,
      provider: 'inworld',
    };
  });
