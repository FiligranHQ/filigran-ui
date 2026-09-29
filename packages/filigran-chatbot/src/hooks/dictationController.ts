/**
 * Minimal shape of the Web Speech API surface we use. Typed locally rather
 * than pulled from `lib.dom` - `SpeechRecognition` is still vendor-prefixed and
 * missing from TypeScript's DOM lib, and this package ships no ambient types.
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export interface DictationEvents {
  /** A finalised phrase, trimmed, to append to the draft. */
  onFinal: (text: string) => void;
  /** Words heard but not final yet; an empty string clears the preview. */
  onInterim: (text: string) => void;
  onListeningChange: (listening: boolean) => void;
}

export interface DictationController {
  /** Start listening, or stop and commit the phrase already heard. */
  toggle: () => void;
  /** Stop listening and drop whatever the session still delivers. */
  cancel: () => void;
  /** Release the recogniser; no event is reported afterwards. */
  dispose: () => void;
}

/**
 * - `listening`: a session the user wants; the engine ending it after a pause
 *   starts it again.
 * - `stopping`: the user stopped it; the phrase in flight is still committed.
 * - `discarding`: cancelled; everything it delivers until its `end` is dropped.
 */
type Phase = 'idle' | 'listening' | 'stopping' | 'discarding';

/**
 * Drives one recogniser through successive dictation sessions.
 *
 * A session keeps emitting after `stop()` / `abort()` until its `end` event,
 * and no event says which session it belongs to. The recogniser also refuses
 * `start()` until that `end`, so every event is read against the phase of the
 * one session it can belong to, and a start asked for while the previous
 * session is still ending waits for that `end` instead of failing.
 */
export function createDictationController(recognition: SpeechRecognitionLike, events: DictationEvents): DictationController {
  let phase: Phase = 'idle';
  let startQueued = false;
  let disposed = false;
  let reported = false;

  const isOn = () => phase === 'listening' || startQueued;

  const report = () => {
    if (disposed || isOn() === reported) return;
    reported = isOn();
    events.onListeningChange(reported);
  };

  const tryStart = () => {
    try {
      recognition.start();
      return true;
    } catch {
      return false;
    }
  };

  const start = () => {
    if (tryStart()) phase = 'listening';
    else if (phase !== 'idle') startQueued = true;
    report();
  };

  const stop = () => {
    startQueued = false;
    if (phase === 'listening') {
      phase = 'stopping';
      events.onInterim('');
      try {
        recognition.stop();
      } catch {
        phase = 'idle';
      }
    }
    report();
  };

  const cancel = () => {
    if (disposed) return;
    startQueued = false;
    if (phase === 'listening' || phase === 'stopping') {
      phase = 'discarding';
      events.onInterim('');
      try {
        recognition.abort();
      } catch {
        phase = 'idle';
      }
    }
    report();
  };

  recognition.onresult = (event) => {
    if (phase !== 'listening' && phase !== 'stopping') return;
    let finalText = '';
    let interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) finalText += result[0].transcript;
      else interimText += result[0].transcript;
    }
    const phrase = finalText.trim();
    if (phrase) events.onFinal(phrase);
    if (phase === 'listening') events.onInterim(interimText.trim());
  };

  recognition.onerror = () => {
    // Permission denied, no microphone, network failure: let the session end
    // rather than restart it into the same failure.
    if (phase === 'listening') {
      phase = 'stopping';
      events.onInterim('');
    }
    report();
  };

  recognition.onend = () => {
    events.onInterim('');
    if (phase === 'listening') {
      if (tryStart()) return;
      phase = 'idle';
    } else if (startQueued) {
      startQueued = false;
      phase = tryStart() ? 'listening' : 'idle';
    } else {
      phase = 'idle';
    }
    report();
  };

  return {
    toggle: () => {
      if (disposed) return;
      if (isOn()) stop();
      else start();
    },
    cancel,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      if (phase !== 'idle') {
        try {
          recognition.abort();
        } catch {
          /* already ended */
        }
      }
      phase = 'idle';
      startQueued = false;
    },
  };
}
