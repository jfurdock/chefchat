import * as functions from 'firebase-functions/v1';
import speech from '@google-cloud/speech';

const speechClient = new speech.SpeechClient();

type TranscribeRequest = {
  audioBase64?: string;
  encoding?:
    | 'LINEAR16'
    | 'FLAC'
    | 'MULAW'
    | 'AMR'
    | 'AMR_WB'
    | 'OGG_OPUS'
    | 'SPEEX_WITH_HEADER_BYTE'
    | 'WEBM_OPUS'
    | 'ENCODING_UNSPECIFIED';
  sampleRateHertz?: number;
  languageCode?: string;
};

function getSpeechErrorMessage(error: any): string {
  if (!error) return 'Unknown Speech API error.';
  if (typeof error.details === 'string' && error.details.trim()) return error.details;
  if (typeof error.message === 'string' && error.message.trim()) return error.message;
  if (Array.isArray(error.errors) && error.errors.length > 0) {
    const first = error.errors[0];
    if (typeof first?.message === 'string' && first.message.trim()) return first.message;
  }
  return String(error);
}

export const transcribeAudio = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
  })
  .https.onCall(async (data: TranscribeRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to use speech transcription.'
      );
    }

    const payload = (data || {}) as TranscribeRequest;
    if (!payload.audioBase64) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required field: audioBase64');
    }

    const languageCode = payload.languageCode || 'en-US';
    const sampleRateHertz = payload.sampleRateHertz || 16000;

    const baseConfig: Record<string, unknown> = {
      languageCode,
      enableAutomaticPunctuation: true,
      model: 'latest_short',
      audioChannelCount: 1,
    };

    const attemptConfigs: Array<Record<string, unknown>> = [
      // Primary path for iOS WAV/PCM chunks recorded by the app.
      { ...baseConfig, encoding: 'LINEAR16', sampleRateHertz: 16000 },
      // Caller-provided fallback (e.g. AMR on Android).
      ...(payload.encoding &&
      payload.encoding !== 'ENCODING_UNSPECIFIED' &&
      payload.encoding !== 'LINEAR16'
        ? [{ ...baseConfig, encoding: payload.encoding, sampleRateHertz }]
        : []),
    ];

    let lastError: any = null;
    let lastEmptyTranscript = false;

    for (const config of attemptConfigs) {
      try {
        const [response] = await speechClient.recognize({
          audio: { content: payload.audioBase64 },
          config,
        });

        const transcript = (response.results || [])
          .map((result) => result.alternatives?.[0]?.transcript || '')
          .join(' ')
          .trim();

        if (transcript) {
          return {
            transcript,
          };
        }

        lastEmptyTranscript = true;
        functions.logger.info('STT recognize attempt produced empty transcript', {
          config,
        });
      } catch (error: any) {
        lastError = error;
        functions.logger.warn('STT recognize attempt failed', {
          config,
          errorMessage: getSpeechErrorMessage(error),
          code: error?.code,
          details: error?.details,
          name: error?.name,
        });
      }
    }

    // If decode succeeded but speech content was empty, do not fail the request.
    // Some fallback configs can throw even after a successful empty decode.
    if (lastEmptyTranscript) {
      return { transcript: '' };
    }

    const sttMessage = getSpeechErrorMessage(lastError);
    const lowered = sttMessage.toLowerCase();

    if (
      lowered.includes('api has not been used') ||
      lowered.includes('is disabled') ||
      lowered.includes('cloud speech-to-text api')
    ) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Cloud Speech-to-Text API is not enabled for this project.',
        { cause: sttMessage }
      );
    }

    if (lowered.includes('billing')) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Google Cloud billing is required for Speech-to-Text.',
        { cause: sttMessage }
      );
    }

    if (lowered.includes('permission denied') || lowered.includes('does not have permission')) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'The function service account does not have permission to call Speech-to-Text.',
        { cause: sttMessage }
      );
    }

    throw new functions.https.HttpsError('internal', 'Speech transcription failed.', {
      cause: sttMessage,
    });
  });
