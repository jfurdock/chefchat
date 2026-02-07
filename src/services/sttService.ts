import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

export type SttEncoding =
  | 'LINEAR16'
  | 'FLAC'
  | 'MULAW'
  | 'AMR'
  | 'AMR_WB'
  | 'OGG_OPUS'
  | 'SPEEX_WITH_HEADER_BYTE'
  | 'WEBM_OPUS'
  | 'ENCODING_UNSPECIFIED';

type SttResponse = {
  transcript?: string;
};

type TranscribeInput = {
  fileUri: string;
  encoding?: SttEncoding;
  sampleRateHertz?: number;
};

async function fileUriToBase64(fileUri: string): Promise<string> {
  const response = await fetch(fileUri);
  const blob = await response.blob();

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read audio file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to convert audio to base64'));
    reader.readAsDataURL(blob);
  });

  const [, base64] = dataUrl.split(',');
  if (!base64) throw new Error('Invalid base64 audio payload');
  return base64;
}

export async function transcribeAudioChunk({
  fileUri,
  encoding = 'ENCODING_UNSPECIFIED',
  sampleRateHertz,
}: TranscribeInput): Promise<string> {
  const audioBase64 = await fileUriToBase64(fileUri);
  const callable = httpsCallable(getFunctions(getApp(), 'us-central1'), 'transcribeAudio');
  try {
    const request: Record<string, unknown> = {
      audioBase64,
      encoding,
    };
    if (typeof sampleRateHertz === 'number' && sampleRateHertz > 0) {
      request.sampleRateHertz = sampleRateHertz;
    }

    const response = (await callable(request)) as { data: SttResponse };
    return response?.data?.transcript?.trim() || '';
  } catch (error: any) {
    const code = error?.code || 'unknown';
    const details =
      typeof error?.details === 'string'
        ? error.details
        : typeof error?.details?.cause === 'string'
          ? error.details.cause
        : error?.details?.message || error?.message || 'Speech-to-text failed';
    throw new Error(`STT ${code}: ${details}`);
  }
}
