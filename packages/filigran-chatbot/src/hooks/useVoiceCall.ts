import { useCallback, useEffect, useInsertionEffect, useRef, useState } from 'react';
import { chunkSpeech } from '../utils/speech';
import { getSpeechRecognition } from './useDictation';
import type { TtsRoute } from './useSpeechReader';
import { createVoiceCall, type VoiceCallController, type VoiceCallDeps, type VoiceCallSnapshot } from './voiceCallController';
import { probeTurn } from './voiceTurn';
import { usePanelFetch } from './usePanelRequests';

/** Longest piece of an answer spoken at once: the first one plays while the next are made. */
export const VOICE_CHUNK_LENGTH = 200;

/** Whether this browser can hold a voice call: it needs speech recognition. */
export const voiceCallSupported = (): boolean => getSpeechRecognition() !== null;

interface UseVoiceCallOptions {
  /** Sends a question through the panel, as the user. */
  send: VoiceCallDeps['send'];
  /** Stops the turn running (the Stop button's). */
  stopTurn: () => void;
  /** Whether the conversation's turn still runs, for the idle check; `null` when it could not be read. */
  readTurnState?: () => Promise<{ running: boolean } | null>;
  addressedAgentId: () => string | null;
  speakable: (text: string) => string;
  present: (text: string) => string;
  /** The host's speech route; the browser's voice speaks without it, or when it fails. */
  tts?: TtsRoute;
  /** Language listened for and spoken in; the browser's own when unset. */
  locale?: string;
}

/** Fetch the backend's audio for *text*; `null` when the route fails. */
async function fetchSpeech(fetchImpl: typeof fetch, route: TtsRoute, text: string, signal: AbortSignal): Promise<Blob | null> {
  try {
    const res = await fetchImpl(route.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(route.requestHeaders ?? {}) },
      body: JSON.stringify({ text, format: 'mp3' }),
      signal,
    });
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

/** Play *blob*; resolves once it ended, failed, or *signal* aborted it. */
function playAudio(blob: Blob, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const done = () => {
      audio.pause();
      URL.revokeObjectURL(url);
      signal.removeEventListener('abort', done);
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
    signal.addEventListener('abort', done);
    audio.play().catch(done);
  });
}

/** Say *text* in the browser's voice; resolves at once without one. */
function speakInBrowser(text: string, lang: string | undefined, signal: AbortSignal): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang;
    const done = () => {
      signal.removeEventListener('abort', stop);
      resolve();
    };
    const stop = () => {
      window.speechSynthesis.cancel();
      done();
    };
    utterance.onend = done;
    utterance.onerror = done;
    signal.addEventListener('abort', stop);
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * A voice call over the panel: the browser listens, the panel sends, the
 * answer is spoken through the host's speech route in sentence-sized pieces
 * (all requested at once, played in order), each piece the route fails in the
 * browser's voice. `onFrame` must see every frame of both streams.
 */
export function useVoiceCall(options: UseVoiceCallOptions) {
  const panelFetch = usePanelFetch();
  const optionsRef = useRef(options);
  useInsertionEffect(() => {
    optionsRef.current = options;
  });
  const [snapshot, setSnapshot] = useState<VoiceCallSnapshot | null>(null);
  const callRef = useRef<VoiceCallController | null>(null);

  const speak = useCallback(async (text: string, signal: AbortSignal) => {
    const { tts, locale } = optionsRef.current;
    const lang = locale || (typeof navigator !== 'undefined' ? navigator.language : undefined);
    const chunks = chunkSpeech(text, VOICE_CHUNK_LENGTH);
    const audio = chunks.map((chunk) => (tts ? fetchSpeech(panelFetch, tts, chunk, signal) : Promise.resolve(null)));
    for (let i = 0; i < chunks.length; i += 1) {
      if (signal.aborted) return;
      const blob = await audio[i];
      if (signal.aborted) return;
      if (blob) await playAudio(blob, signal);
      else await speakInBrowser(chunks[i], lang, signal);
    }
  }, []);

  const start = useCallback((): boolean => {
    if (callRef.current) return true;
    const Recognition = getSpeechRecognition();
    if (!Recognition) return false;
    const call = createVoiceCall({
      recognition: new Recognition(),
      lang: optionsRef.current.locale || (typeof navigator !== 'undefined' ? navigator.language : undefined),
      send: (text, hooks) => optionsRef.current.send(text, hooks),
      speak,
      speakable: (text) => optionsRef.current.speakable(text),
      present: (text) => optionsRef.current.present(text),
      // Without a way to read the turn, a turn silent for two minutes is taken as over.
      probe: () => {
        const read = optionsRef.current.readTurnState;
        return read ? probeTurn(read) : Promise.resolve('over');
      },
      stopTurn: () => optionsRef.current.stopTurn(),
      addressedAgentId: () => optionsRef.current.addressedAgentId(),
      // An ended call says nothing more.
      onChange: (next) => {
        if (callRef.current === call) setSnapshot(next);
      },
    });
    callRef.current = call;
    call.start();
    return true;
  }, [speak]);

  const end = useCallback(() => {
    const call = callRef.current;
    callRef.current = null;
    call?.end();
    setSnapshot(null);
  }, []);

  useEffect(() => () => callRef.current?.end(), []);

  return {
    /** The call on screen, or `null`. */
    snapshot,
    start,
    end,
    onFrame: useCallback((frame: Record<string, unknown>, relayed: boolean) => callRef.current?.frame(frame, relayed), []),
    interrupt: useCallback(() => callRef.current?.interrupt(), []),
    cancel: useCallback(() => callRef.current?.cancel(), []),
    toggleMute: useCallback(() => callRef.current?.toggleMute(), []),
  };
}
