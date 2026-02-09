import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { createAudioPlayer, setIsAudioActiveAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';

type TtsCallbacks = {
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
};

export type TtsVoiceOption = {
  name: string;
  languageCodes: string[];
  ssmlGender: string;
  naturalSampleRateHertz: number;
};

export type TtsVoiceSettings = {
  voiceName: string;
  languageCode: string;
  speakingRate: number;
  pitch: number;
};

type TtsOptions = TtsCallbacks & Partial<TtsVoiceSettings>;

type SynthesizeSpeechResponse = {
  audioBase64: string;
  mimeType?: string;
};

type ListVoicesResponse = {
  voices?: TtsVoiceOption[];
};

const VOICE_SETTINGS_KEY = 'chefchat_tts_voice_settings';
const PLAYBACK_TIMEOUT_MS = 45000;
const TARGET_SPEAKING_RATE = 1.1;
const MIN_SPEAKING_RATE = 0.85;
const MAX_SPEAKING_RATE = 2.0;

/**
 * Post-playback cooldown period. After TTS stops, the microphone may still
 * pick up residual assistant audio for a short window. During this cooldown
 * window, the voice hook should suppress low-confidence (interim) transcripts
 * that look like echo rather than genuine user speech.
 */
const POST_PLAYBACK_COOLDOWN_MS = 900;

const DEFAULT_SETTINGS: TtsVoiceSettings = {
  voiceName: 'Lily',
  languageCode: 'en-US',
  speakingRate: TARGET_SPEAKING_RATE,
  pitch: 0,
};

export const DEFAULT_TTS_VOICE_OPTIONS: TtsVoiceOption[] = [
  { name: 'Lily', languageCodes: ['en-US'], ssmlGender: 'FEMALE', naturalSampleRateHertz: 24000 },
  { name: 'Dennis', languageCodes: ['en-US'], ssmlGender: 'MALE', naturalSampleRateHertz: 24000 },
];

let queue: string[] = [];
let speaking = false;
let activeCallbacks: TtsCallbacks | null = null;
let activeResolve: (() => void) | null = null;
let activeReject: ((error: Error) => void) | null = null;
let playbackToken = 0;
let currentPlayer: any = null;
const activePlayers = new Set<any>();
let cachedSettings: TtsVoiceSettings | null = null;

/**
 * Timestamp (ms) until which post-playback cooldown is active. Any interim
 * STT transcript arriving before this time is likely residual assistant audio
 * bleeding back through the microphone.
 */
let playbackCooldownUntil = 0;

function splitIntoSentences(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!sentences.length) return [text.trim()].filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length <= 260) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = sentence;
    } else {
      chunks.push(sentence);
      current = '';
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function getCallable(name: string) {
  return httpsCallable(getFunctions(getApp(), 'us-central1'), name);
}

function getFileExtensionFromMime(mimeType?: string): string {
  if (!mimeType) return 'mp3';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  return 'mp3';
}

function toError(error: any, fallback: string): Error {
  return new Error(error?.message || fallback);
}

function clampSpeakingRate(value: unknown, fallback = TARGET_SPEAKING_RATE): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(MIN_SPEAKING_RATE, Math.min(MAX_SPEAKING_RATE, value));
}

export async function getVoiceSettings(): Promise<TtsVoiceSettings> {
  if (cachedSettings) return cachedSettings;

  const raw = await AsyncStorage.getItem(VOICE_SETTINGS_KEY);
  if (!raw) {
    cachedSettings = DEFAULT_SETTINGS;
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw);
    const settings: TtsVoiceSettings = {
      voiceName: typeof parsed?.voiceName === 'string' ? parsed.voiceName : DEFAULT_SETTINGS.voiceName,
      languageCode:
        typeof parsed?.languageCode === 'string' ? parsed.languageCode : DEFAULT_SETTINGS.languageCode,
      speakingRate: clampSpeakingRate(parsed?.speakingRate, DEFAULT_SETTINGS.speakingRate),
      pitch: typeof parsed?.pitch === 'number' ? parsed.pitch : DEFAULT_SETTINGS.pitch,
    };
    cachedSettings = settings;
    return settings;
  } catch {
    cachedSettings = DEFAULT_SETTINGS;
    return DEFAULT_SETTINGS;
  }
}

export async function setVoiceSettings(settings: Partial<TtsVoiceSettings>): Promise<TtsVoiceSettings> {
  const current = await getVoiceSettings();
  const next: TtsVoiceSettings = {
    ...current,
    ...settings,
    speakingRate: clampSpeakingRate(settings.speakingRate ?? current.speakingRate, TARGET_SPEAKING_RATE),
  };
  cachedSettings = next;
  await AsyncStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export async function listTtsVoices(languageCode = 'en-US'): Promise<TtsVoiceOption[]> {
  try {
    const callable = getCallable('listTtsVoices');
    const response = (await callable({ languageCode })) as { data: ListVoicesResponse };
    const voices = response?.data?.voices || [];
    const languagePrefix = languageCode.split('-')[0].toLowerCase();
    return voices.filter((voice) => {
      const codes = voice?.languageCodes || [];
      if (!codes.length) return true;
      return codes.some((code) => code.toLowerCase().startsWith(languagePrefix));
    });
  } catch {
    return DEFAULT_TTS_VOICE_OPTIONS;
  }
}

async function synthesizeSpeechCloud(
  text: string,
  settings: TtsVoiceSettings
): Promise<SynthesizeSpeechResponse> {
  const callable = getCallable('synthesizeSpeech');
  const response = (await callable({
    text,
    languageCode: settings.languageCode,
    voiceName: settings.voiceName,
    speakingRate: settings.speakingRate,
    pitch: settings.pitch,
  })) as { data: SynthesizeSpeechResponse };

  if (!response?.data?.audioBase64) {
    throw new Error('TTS service returned empty audio.');
  }

  return response.data;
}

async function playAudioBase64(
  audioBase64: string,
  mimeType: string | undefined,
  token: number
): Promise<void> {
  if (token !== playbackToken) return;

  if (!FileSystem.cacheDirectory) {
    throw new Error('File cache directory is unavailable.');
  }

  // Do not override the iOS audio category here. Speech recognition config
  // already sets playAndRecord + defaultToSpeaker, and overriding from TTS
  // can route output to a quieter path.
  await setIsAudioActiveAsync(true);

  const extension = getFileExtensionFromMime(mimeType);
  const fileUri = `${FileSystem.cacheDirectory}chefchat-tts-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${extension}`;

  await FileSystem.writeAsStringAsync(fileUri, audioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const player = createAudioPlayer(fileUri, {
    updateInterval: 100,
    keepAudioSessionActive: true,
  });
  player.muted = false;
  player.volume = 1;
  currentPlayer = player;
  activePlayers.add(player);

  return new Promise<void>((resolve, reject) => {
    let finished = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let subscription: any = null;

    const finish = async (isError: boolean, error?: Error) => {
      if (finished) return;
      finished = true;

      if (poll) clearInterval(poll);
      if (timeout) clearTimeout(timeout);
      if (subscription?.remove) subscription.remove();

      try {
        player.remove();
      } catch {}
      activePlayers.delete(player);

      if (currentPlayer === player) {
        currentPlayer = null;
      }

      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch {}

      if (isError && error) {
        reject(error);
      } else {
        resolve();
      }
    };

    try {
      subscription = player.addListener?.('playbackStatusUpdate', (status: any) => {
        if (token !== playbackToken) {
          void finish(false);
          return;
        }
        if (status?.didJustFinish) {
          void finish(false);
        }
      });

      poll = setInterval(() => {
        if (token !== playbackToken) {
          void finish(false);
          return;
        }
        const status = player.currentStatus;
        if (status?.didJustFinish) {
          void finish(false);
        }
      }, 50);

      timeout = setTimeout(() => {
        void finish(true, new Error('Audio playback timed out.'));
      }, PLAYBACK_TIMEOUT_MS);

      player.play();
    } catch (error: any) {
      void finish(true, toError(error, 'Audio playback failed.'));
    }
  });
}

async function speakOnDevice(text: string, settings: TtsVoiceSettings): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    Speech.speak(text, {
      language: settings.languageCode,
      rate: clampSpeakingRate(settings.speakingRate, TARGET_SPEAKING_RATE),
      pitch: Math.max(0.5, Math.min(2.0, 1 + settings.pitch / 20)),
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: (error) => reject(new Error(error?.message || 'Device speech failed.')),
    });
  });
}

async function continueQueue(options: TtsOptions, token: number) {
  if (token !== playbackToken) return;

  if (queue.length === 0) {
    speaking = false;
    const callbacks = activeCallbacks;
    activeCallbacks = null;
    callbacks?.onDone?.();
    activeResolve?.();
    activeResolve = null;
    activeReject = null;
    return;
  }

  const nextSentence = queue.shift();
  if (!nextSentence) {
    await continueQueue(options, token);
    return;
  }

  try {
    options.onStart?.();
    const stored = await getVoiceSettings();
    const settings: TtsVoiceSettings = {
      ...stored,
      ...options,
      voiceName: options.voiceName ?? stored.voiceName,
      languageCode: options.languageCode ?? stored.languageCode,
      speakingRate: clampSpeakingRate(options.speakingRate ?? stored.speakingRate, TARGET_SPEAKING_RATE),
      pitch: options.pitch ?? stored.pitch,
    };
    const synthesized = await synthesizeSpeechCloud(nextSentence, settings);
    if (token !== playbackToken) return;
    await playAudioBase64(synthesized.audioBase64, synthesized.mimeType, token);
    if (token !== playbackToken) return;
    await continueQueue(options, token);
  } catch (error: any) {
    try {
      const stored = await getVoiceSettings();
      const settings: TtsVoiceSettings = {
        ...stored,
        ...options,
        voiceName: options.voiceName ?? stored.voiceName,
        languageCode: options.languageCode ?? stored.languageCode,
        speakingRate: clampSpeakingRate(options.speakingRate ?? stored.speakingRate, TARGET_SPEAKING_RATE),
        pitch: options.pitch ?? stored.pitch,
      };
      if (token !== playbackToken) return;
      await speakOnDevice(nextSentence, settings);
      if (token !== playbackToken) return;
      await continueQueue(options, token);
    } catch {
      speaking = false;
      const err = toError(error, 'Text-to-speech failed');
      activeCallbacks?.onError?.(err);
      activeReject?.(err);
      activeCallbacks = null;
      activeResolve = null;
      activeReject = null;
      queue = [];
    }
  }
}

export async function speakQueued(text: string, options: TtsOptions = {}): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  return new Promise<void>((resolve, reject) => {
    playbackToken += 1;
    const token = playbackToken;
    queue = splitIntoSentences(trimmed);
    activeResolve = resolve;
    activeReject = reject;
    activeCallbacks = {
      onStart: options.onStart,
      onDone: options.onDone,
      onError: options.onError,
    };
    speaking = true;
    void continueQueue(options, token);
  });
}

export async function stopSpeaking(clearQueue = true): Promise<void> {
  // Increment token FIRST — this immediately invalidates any in-flight
  // playback promises and queue continuations so they resolve/bail out.
  playbackToken += 1;
  speaking = false;
  if (clearQueue) queue = [];
  try {
    Speech.stop();
  } catch {}

  for (const player of activePlayers) {
    try {
      player.pause?.();
    } catch {}
    try {
      player.stop?.();
    } catch {}
    try {
      player.seekTo?.(0);
    } catch {}
    try {
      player.remove?.();
    } catch {}
  }
  activePlayers.clear();
  currentPlayer = null;
  // Keep session active; frequent deactivate/reactivate cycles can cause
  // inconsistent output routing/levels on iOS.

  // Set post-playback cooldown so the voice hook can suppress residual echo.
  playbackCooldownUntil = Date.now() + POST_PLAYBACK_COOLDOWN_MS;

  activeResolve?.();
  activeResolve = null;
  activeReject = null;
  activeCallbacks = null;
}

export async function interruptAndSpeak(text: string, options: TtsOptions = {}): Promise<void> {
  await stopSpeaking(true);
  await speakQueued(text, options);
}

export async function isSpeaking(): Promise<boolean> {
  return speaking;
}

/**
 * Returns true if we are still within the post-playback cooldown window.
 * During this period, interim STT transcripts that look like echo should
 * be suppressed by the voice hook.
 */
export function isInPlaybackCooldown(): boolean {
  return Date.now() < playbackCooldownUntil;
}

/**
 * Returns the timestamp (ms) when playback last stopped. Useful for the
 * voice hook to calculate how recently TTS was active.
 */
export function getPlaybackCooldownUntil(): number {
  return playbackCooldownUntil;
}
