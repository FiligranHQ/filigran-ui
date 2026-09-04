import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal shape of the Web Speech API surface we use. Typed locally rather
 * than pulled from `lib.dom` — `SpeechRecognition` is still vendor-prefixed and
 * missing from TypeScript's DOM lib, and this package ships no ambient types.
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
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
  toggle: () => void;
  stop: () => void;
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
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Recognition ends on its own after a pause; this distinguishes "the browser
  // stopped listening" from "the user asked to stop", so a natural pause
  // mid-sentence does not silently end the session.
  const shouldRestartRef = useRef(false);
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

    recognition.onresult = (event) => {
      let interimText = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText) {
        onFinalTextRef.current(finalText);
        setInterim('');
      } else {
        setInterim(interimText);
      }
    };

    recognition.onerror = () => {
      // Permission denied, no microphone, network failure — stop cleanly
      // rather than leaving the button stuck in its listening state.
      shouldRestartRef.current = false;
      setListening(false);
      setInterim('');
    };

    recognition.onend = () => {
      if (shouldRestartRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          /* already starting, or the engine refused — fall through and stop */
        }
      }
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    return () => {
      shouldRestartRef.current = false;
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch {
        /* never started */
      }
    };
  }, []);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    setInterim('');
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (shouldRestartRef.current) {
      stop();
      return;
    }
    try {
      shouldRestartRef.current = true;
      recognition.start();
      setListening(true);
    } catch {
      // `start()` throws if it is already running; treat that as "not started"
      // rather than leaving the UI claiming to listen.
      shouldRestartRef.current = false;
      setListening(false);
    }
  }, [stop]);

  return { supported, listening, interim, toggle, stop };
}
