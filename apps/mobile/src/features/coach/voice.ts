import { speakableText } from '@fitmate/coach';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useState } from 'react';

export type VoiceLang = 'en' | 'te';
const LOCALE: Record<VoiceLang, string> = { en: 'en-IN', te: 'te-IN' };

export type VoiceError = 'unavailable' | 'permission' | 'language' | 'no-speech' | 'network' | 'other';

function mapError(code: string): VoiceError | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
      return 'permission';
    case 'service-not-allowed':
      return 'unavailable';
    case 'language-not-supported':
      return 'language';
    case 'no-speech':
    case 'speech-timeout':
      return 'no-speech';
    case 'network':
      return 'network';
    default:
      return 'other';
  }
}

/**
 * Speech-to-text with Android's own speech recogniser (Google app), in Indian
 * English or Telugu. The transcript is put in the message box, never sent
 * automatically, so the user can check it first.
 */
export function useVoiceInput(lang: VoiceLang, onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<VoiceError | null>(null);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    setPartial('');
  });
  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      setPartial('');
      if (text.trim()) onText(text.trim());
    } else {
      setPartial(text);
    }
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    setError(mapError(e.error));
  });

  const start = async () => {
    setError(null);
    Speech.stop();
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setError('unavailable');
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError('permission');
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: LOCALE[lang], interimResults: true, continuous: false });
  };

  const stop = () => ExpoSpeechRecognitionModule.stop();

  return { listening, partial, error, start, stop };
}

/** Reads a coach reply aloud with the phone's text-to-speech. */
export function speakReply(text: string, lang: VoiceLang) {
  Speech.stop();
  Speech.speak(speakableText(text), { language: LOCALE[lang] });
}

export const stopSpeaking = () => void Speech.stop();
