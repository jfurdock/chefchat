import { createAudioPlayer, setIsAudioActiveAsync } from 'expo-audio';

const LISTENING_PING = require('../../assets/sounds/listening-ping.wav');
const LISTENING_PING_DURATION_MS = 360;
const PING_RETRIGGER_WINDOW_MS = 120;
let activePlayer: any | null = null;
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
let lastPingAt = 0;

function cleanupActivePlayer() {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
  try {
    activePlayer?.pause?.();
  } catch {}
  try {
    activePlayer?.stop?.();
  } catch {}
  try {
    activePlayer?.remove?.();
  } catch {}
  activePlayer = null;
}

export async function playListeningPing(options?: { force?: boolean }): Promise<void> {
  const now = Date.now();
  if (!options?.force && now - lastPingAt < PING_RETRIGGER_WINDOW_MS) {
    return;
  }
  lastPingAt = now;

  // Best effort; do not block ping playback if this call is slow.
  void setIsAudioActiveAsync(true).catch(() => {});

  try {
    cleanupActivePlayer();
    activePlayer = createAudioPlayer(LISTENING_PING, {
      updateInterval: 100,
      keepAudioSessionActive: true,
    });
    activePlayer.volume = 1;
    activePlayer.play();

    cleanupTimer = setTimeout(() => {
      cleanupActivePlayer();
    }, LISTENING_PING_DURATION_MS + 80);
  } catch {
    // Non-fatal UI sound.
    cleanupActivePlayer();
  }
}
