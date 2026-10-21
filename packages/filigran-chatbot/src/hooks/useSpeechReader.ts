import { useCallback, useEffect, useInsertionEffect, useRef, useState } from 'react';
import { chunkSpeech, createSpeechController, speakableText, type SpeechController } from '../utils/speech';

const speechSupported = (): boolean =>
  typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';

/** The most text one request to the host's speech route carries; a longer answer takes several. */
export const TTS_MAX_LENGTH = 4096;

/** The host's speech route (`apiEndpoints.tts`), and the headers it is called with. */
export interface TtsRoute {
  url: string;
  requestHeaders?: Record<string, string>;
}

/**
 * Reads answers aloud, one at a time: through the host's speech route when it
 * names one, falling back to the browser's speech synthesis, in `locale` (the
 * browser's voice when unset). `supported` is false with neither: the panel
 * then offers no button at all.
 *
 * Whatever is being read stops when the transcript unmounts.
 */
export function useSpeechReader(locale?: string, tts?: TtsRoute) {
  const [browserSupported] = useState(speechSupported);
  const supported = browserSupported || !!tts;
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const controllerRef = useRef<SpeechController | null>(null);
  const localeRef = useRef(locale);
  const ttsRef = useRef(tts);
  useInsertionEffect(() => {
    localeRef.current = locale;
    ttsRef.current = tts;
  });
  // What the host's route is playing, or fetching.
  const playbackRef = useRef<{ id: string; audio?: HTMLAudioElement; url?: string; abort: AbortController } | null>(null);

  const stopPlayback = useCallback(() => {
    const playback = playbackRef.current;
    if (!playback) return;
    playbackRef.current = null;
    playback.abort.abort();
    playback.audio?.pause();
    if (playback.url) URL.revokeObjectURL(playback.url);
    setSpeakingId((current) => (current === playback.id ? null : current));
  }, []);

  const controller = useCallback((): SpeechController | null => {
    if (!browserSupported) return null;
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
  }, [browserSupported]);

  /**
   * Reads the message `id` from the markdown documents the transcript renders it
   * from (`answerMarkdownSources`), or stops it when it is the one being read.
   */
  const speakInBrowser = useCallback((id: string, text: string) => controller()?.speak(id, chunkSpeech(text), localeRef.current), [controller]);

  const speakThroughRoute = useCallback(
    async (route: TtsRoute, id: string, text: string) => {
      const abort = new AbortController();
      const playback: { id: string; audio?: HTMLAudioElement; url?: string; abort: AbortController } = { id, abort };
      playbackRef.current = playback;
      setSpeakingId(id);
      // A long answer goes as several requests, read one after the other on one
      // audio element (made while the click is still being handled, which some
      // browsers ask of playback), the next one fetched while this one plays.
      const chunks = chunkSpeech(text, TTS_MAX_LENGTH);
      const audio = new Audio();
      playback.audio = audio;
      const fetchChunk = async (chunk: string): Promise<Blob> => {
        const res = await fetch(route.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(route.requestHeaders ?? {}) },
          body: JSON.stringify({ text: chunk, format: 'mp3' }),
          signal: abort.signal,
        });
        if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
        return res.blob();
      };
      let index = 0;
      let next: Promise<Blob> | null = chunks.length > 0 ? fetchChunk(chunks[0]) : null;
      try {
        for (; next; index += 1) {
          const blob = await next;
          if (playbackRef.current !== playback) return;
          next = index + 1 < chunks.length ? fetchChunk(chunks[index + 1]) : null;
          // Its failure is met when its turn comes.
          next?.catch(() => undefined);
          if (playback.url) URL.revokeObjectURL(playback.url);
          playback.url = URL.createObjectURL(blob);
          const ended = new Promise<boolean>((resolve) => {
            audio.onended = () => resolve(true);
            audio.onerror = () => resolve(false);
          });
          audio.src = playback.url;
          await audio.play();
          if (!(await ended)) throw new Error('TTS playback failed');
          if (playbackRef.current !== playback) return;
        }
        stopPlayback();
      } catch (err) {
        if (playbackRef.current !== playback || (err instanceof DOMException && err.name === 'AbortError')) return;
        // The route failed: the browser's voice reads what is left, when there is one.
        stopPlayback();
        speakInBrowser(id, chunks.slice(index).join(' '));
      }
    },
    [speakInBrowser, stopPlayback],
  );

  const toggle = useCallback(
    (id: string, documents: readonly string[]) => {
      const reading = playbackRef.current?.id ?? controllerRef.current?.speakingId ?? null;
      stopPlayback();
      controllerRef.current?.stop();
      if (reading === id) return;
      const text = speakableText(documents);
      const route = ttsRef.current;
      if (route) void speakThroughRoute(route, id, text);
      else speakInBrowser(id, text);
    },
    [speakInBrowser, speakThroughRoute, stopPlayback],
  );

  const stop = useCallback(() => {
    stopPlayback();
    controllerRef.current?.stop();
  }, [stopPlayback]);

  useEffect(() => () => stop(), [stop]);

  return { supported, speakingId, toggle, stop };
}
