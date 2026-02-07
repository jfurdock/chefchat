# ChefChat Functions

This folder contains Firebase Cloud Functions for voice transcription and text-to-speech.

## Setup

1. Install dependencies:
   ```bash
   npm --prefix functions install
   ```
2. Build:
   ```bash
   npm --prefix functions run build
   ```
3. Deploy:
   ```bash
   npm --prefix functions run deploy
   ```
   If you are not logged in yet, run:
   ```bash
   npx firebase-tools login
   ```

## Exported Functions

- `transcribeAudio` (callable): receives base64 audio and returns a transcript.
- `synthesizeSpeech` (callable): receives text + voice settings and returns base64 MP3.
- `listTtsVoices` (callable): returns available Google Cloud TTS voices for a language.
