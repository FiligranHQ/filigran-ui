import { useCallback, useEffect, useRef, useState } from 'react';
import { createDictationController, type DictationController, type SpeechRecognitionLike } from './dictationController';

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface UseDictationReturn {
  /** False on browsers without the API — the host should render no button. */
  supported: boolean;
  listening: boolean;
  /** Words heard but not yet finalised, for a live preview. */
  interim: string;
  /** Start listening, or stop and still commit the phrase already heard. */
  toggle: () => void;
  /** Stop listening and drop anything still on its way, e.g. once the draft is sent. */
  cancel: () => void;
}

/**
 * Speech-to-text for the composer, using the browser's own Web Speech API.
 *
 * Entirely client-side: no endpoint, no key, nothing for a host to deploy —
 * which is why it ships regardless of how the backend is configured, unlike the
 * prompt library and quota indicator.
 *
 * Final phrases are appended through `onFinalText`; interim words are returned
 * separately so the composer can preview them without committing.
 */
export function useDictation(onFinalText: (text: string) => void): UseDictationReturn {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const controllerRef = useRef<DictationController | null>(null);
  // Read through a ref so re-creating the callback each render does not tear
  // down and rebuild the recogniser mid-dictation.
  const onFinalTextRef = useRef(onFinalText);
  onFinalTextRef.current = onFinalText;

  const supported = getSpeechRecognition() !== null;

  useEffect(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';

    const controller = createDictationController(recognition, {
      onFinal: (text) => onFinalTextRef.current(text),
      onInterim: setInterim,
      onListeningChange: setListening,
    });
    controllerRef.current = controller;
    return () => {
      controllerRef.current = null;
      controller.dispose();
      setListening(false);
      setInterim('');
    };
  }, []);

  const toggle = useCallback(() => controllerRef.current?.toggle(), []);
  const cancel = useCallback(() => controllerRef.current?.cancel(), []);

  return { supported, listening, interim, toggle, cancel };
}
