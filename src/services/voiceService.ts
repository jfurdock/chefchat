import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  type RecordingOptions,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import type { SttEncoding } from './sttService';

const DEFAULT_CHUNK_MS = 3500;
const DEFAULT_SILENCE_THRESHOLD_DB = -45;
const DEFAULT_SPEECH_DETECTION_THRESHOLD_DB = -38;

const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  isMeteringEnabled: true,
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    extension: '.wav',
    sampleRate: 16000,
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    extension: '.amr',
    sampleRate: 8000,
    outputFormat: 'amrnb',
    audioEncoder: 'amr_nb',
  },
};

type StartListeningParams = {
  chunkDurationMs?: number;
  silenceThresholdDb?: number;
  speechDetectionThresholdDb?: number;
  onSpeechDetected?: () => Promise<void> | void;
  onChunk: (chunk: RecordedChunk) => Promise<void> | void;
  onError?: (error: Error) => void;
};

export type RecordedChunk = {
  uri: string;
  durationMs: number;
  isSilent: boolean;
  encoding: SttEncoding;
  sampleRateHertz: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inferEncodingFromUri(uri: string): SttEncoding {
  const lowered = uri.toLowerCase();
  if (lowered.endsWith('.wav') || lowered.endsWith('.wave')) return 'LINEAR16';
  if (lowered.endsWith('.ogg') || lowered.endsWith('.opus')) return 'OGG_OPUS';
  if (lowered.endsWith('.webm')) return 'WEBM_OPUS';
  if (lowered.endsWith('.amr')) return 'AMR';
  if (lowered.endsWith('.awb')) return 'AMR_WB';
  return 'ENCODING_UNSPECIFIED';
}

function inferSampleRateFromEncoding(encoding: SttEncoding): number {
  if (encoding === 'AMR') return 8000;
  if (encoding === 'AMR_WB') return 16000;
  if (encoding === 'LINEAR16') return 16000;
  if (encoding === 'ENCODING_UNSPECIFIED') return 16000;
  return 16000;
}

function isRecordingDisabledError(error: any): boolean {
  const message = `${error?.message || ''}`.toLowerCase();
  return (
    message.includes('recording not allowed') ||
    message.includes('recordingdisabledexception') ||
    message.includes("calling the 'record' function has failed")
  );
}

export function useVoiceRecorderService() {
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const listeningRef = useRef(false);
  const chunkPeakDbRef = useRef(-160);
  const chunkStartMsRef = useRef(0);
  const sawMeteringThisChunkRef = useRef(false);
  const speechDetectedThisChunkRef = useRef(false);
  const speechDetectionThresholdDbRef = useRef(DEFAULT_SPEECH_DETECTION_THRESHOLD_DB);
  const onSpeechDetectedRef = useRef<(() => Promise<void> | void) | undefined>(undefined);
  const speechDetectionCooldownUntilRef = useRef(0);

  useEffect(() => {
    if (!isListening) return;
    const metering = recorderState.metering;
    if (typeof metering === 'number') {
      sawMeteringThisChunkRef.current = true;
      chunkPeakDbRef.current = Math.max(chunkPeakDbRef.current, metering);
      const now = Date.now();
      if (
        !speechDetectedThisChunkRef.current &&
        now >= speechDetectionCooldownUntilRef.current &&
        metering >= speechDetectionThresholdDbRef.current
      ) {
        speechDetectedThisChunkRef.current = true;
        speechDetectionCooldownUntilRef.current = now + 350;
        const onSpeechDetected = onSpeechDetectedRef.current;
        if (onSpeechDetected) {
          void Promise.resolve(onSpeechDetected()).catch(() => {
            // Ignore barge-in callback errors to keep recorder loop running.
          });
        }
      }
    }
  }, [isListening, recorderState.metering]);

  const requestPermission = useCallback(async () => {
    const response = await requestRecordingPermissionsAsync();
    setPermissionGranted(response.granted);
    return response;
  }, []);

  const enableRecordingMode = useCallback(async () => {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
  }, []);

  const disableRecordingMode = useCallback(async () => {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const syncPermission = async () => {
      try {
        const response = await getRecordingPermissionsAsync();
        if (mounted) {
          setPermissionGranted(response.granted);
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

  const stopListening = useCallback(async () => {
    listeningRef.current = false;
    setIsListening(false);
    onSpeechDetectedRef.current = undefined;
    try {
      await recorder.stop();
    } catch {
      // It is normal to hit this when stop is called while recorder isn't active.
    }
    try {
      await disableRecordingMode();
    } catch {
      // Ignore audio mode cleanup failures.
    }
  }, [disableRecordingMode, recorder]);

  const startListening = useCallback(
    async ({
      chunkDurationMs = DEFAULT_CHUNK_MS,
      silenceThresholdDb = DEFAULT_SILENCE_THRESHOLD_DB,
      speechDetectionThresholdDb = DEFAULT_SPEECH_DETECTION_THRESHOLD_DB,
      onSpeechDetected,
      onChunk,
      onError,
    }: StartListeningParams) => {
      try {
        setLastError(null);
        speechDetectionThresholdDbRef.current = speechDetectionThresholdDb;
        onSpeechDetectedRef.current = onSpeechDetected;

        if (!permissionGranted) {
          const result = await requestPermission();
          if (!result.granted) {
            throw new Error('Microphone permission is required for voice mode.');
          }
        }

        await enableRecordingMode();

        listeningRef.current = true;
        setIsListening(true);

        while (listeningRef.current) {
          chunkPeakDbRef.current = -160;
          chunkStartMsRef.current = Date.now();
          sawMeteringThisChunkRef.current = false;
          speechDetectedThisChunkRef.current = false;

          await recorder.prepareToRecordAsync();
          try {
            recorder.record();
          } catch (recordError: any) {
            if (!isRecordingDisabledError(recordError)) throw recordError;
            // Recover from transient iOS audio session changes by re-enabling record mode.
            await enableRecordingMode();
            await sleep(80);
            recorder.record();
          }
          await sleep(chunkDurationMs);

          if (!listeningRef.current) break;

          await recorder.stop();
          const uri = recorder.uri;
          if (!uri) continue;

          const durationMs = Date.now() - chunkStartMsRef.current;
          // If metering isn't available on this device/runtime, keep transcribing
          // instead of treating every chunk as silence.
          const isSilent = sawMeteringThisChunkRef.current
            ? chunkPeakDbRef.current <= silenceThresholdDb
            : false;
          const encoding = inferEncodingFromUri(uri);

          await onChunk({
            uri,
            durationMs,
            isSilent,
            encoding,
            sampleRateHertz: inferSampleRateFromEncoding(encoding),
          });
        }
      } catch (error: any) {
        const err = new Error(error?.message || 'Voice recorder failed.');
        setLastError(err.message);
        setIsListening(false);
        listeningRef.current = false;
        onSpeechDetectedRef.current = undefined;
        try {
          await disableRecordingMode();
        } catch {
          // Ignore audio mode cleanup failures.
        }
        onError?.(err);
      }
    },
    [disableRecordingMode, enableRecordingMode, permissionGranted, recorder, requestPermission]
  );

  useEffect(() => {
    return () => {
      void stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    lastError,
    permissionGranted,
    requestPermission,
    startListening,
    stopListening,
  };
}
