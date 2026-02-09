import { createAudioPlayer, setIsAudioActiveAsync } from 'expo-audio';

const LISTENING_PING = require('../../assets/sounds/listening-ping.wav');
const LISTENING_PING_DURATION_MS = 360;
let inFlightPing: Promise<void> | null = null;

export async function playListeningPing(): Promise<void> {
  if (inFlightPing) {
    await inFlightPing;
    return;
  }

  inFlightPing = (async () => {
    let player: any | null = null;
    try {
      await setIsAudioActiveAsync(true);
      player = createAudioPlayer(LISTENING_PING, {
        updateInterval: 100,
        keepAudioSessionActive: true,
      });
      player.volume = 1;
      player.play();

      await new Promise((resolve) => setTimeout(resolve, LISTENING_PING_DURATION_MS));
    } catch {
      // Non-fatal UI sound.
    } finally {
      try {
        player?.remove?.();
      } catch {
        // no-op
      }
      inFlightPing = null;
    }
  })();

  await inFlightPing;
}
