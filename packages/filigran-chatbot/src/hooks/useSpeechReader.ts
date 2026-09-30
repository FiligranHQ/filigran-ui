import { useCallback, useEffect, useInsertionEffect, useRef, useState } from 'react';
import { chunkSpeech, createSpeechController, speakableText, type SpeechController } from '../utils/speech';

const speechSupported = (): boolean =>
  typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';

/**
 * Reads answers aloud through the browser's speech synthesis, one at a time,
 * in `locale` (the browser's voice when unset). `supported` is false where the
 * browser has no synthesiser: the panel then offers no button at all.
 *
 * Whatever is being read stops when the transcript unmounts.
 */
export function useSpeechReader(locale?: string) {
  const [supported] = useState(speechSupported);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const controllerRef = useRef<SpeechController | null>(null);
  const localeRef = useRef(locale);
  useInsertionEffect(() => {
    localeRef.current = locale;
  });

  const controller = useCallback((): SpeechController | null => {
    if (!supported) return null;
    controllerRef.current ??= createSpeechController<SpeechSynthesisUtterance>(
      window.speechSynthesis,
      (text, { lang, onEnd, onError }) => {
        const utterance = new SpeechSynthesisUtterance(text);
        if (lang) utterance.lang = lang;
        utterance.onend = onEnd;
        utterance.onerror = onError;
        return utterance;
      },
      setSpeakingId,
    );
    return controllerRef.current;
  }, [supported]);

  /**
   * Reads the message `id` from the markdown documents the transcript renders it
   * from (`answerMarkdownSources`), or stops it when it is the one being read.
   */
  const toggle = useCallback(
    (id: string, documents: readonly string[]) => {
      const reader = controller();
      if (!reader) return;
      if (reader.speakingId === id) reader.stop();
      else reader.speak(id, chunkSpeech(speakableText(documents)), localeRef.current);
    },
    [controller],
  );

  const stop = useCallback(() => controllerRef.current?.stop(), []);

  useEffect(() => () => controllerRef.current?.stop(), []);

  return { supported, speakingId, toggle, stop };
}
