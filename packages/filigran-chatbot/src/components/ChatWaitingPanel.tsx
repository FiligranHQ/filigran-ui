import { useEffect, useMemo, useRef, useState } from 'react';
import type { Translate } from '../types';
import { ExternalLinkIcon, GamepadIcon } from './icons';

/**
 * Playful, rotating "still working on it" messages shown below the status
 * bubble during longer waits. Kept short and upbeat so they fit on one line in
 * the narrow floating panel and read as a sense of progress rather than noise.
 */
const defaultMessages = (t: Translate) => [
  t('Crunching the data'),
  t('Connecting the dots'),
  t('Consulting the sources'),
  t('Thinking it through'),
  t('Reticulating splines'),
  t('Analyzing the details'),
  t('Almost there'),
  t('Putting it together'),
  t('Polishing the answer'),
  t('Wrapping things up'),
];

/** Message rotation cadence. */
const ROTATE_MS = 2600;

/**
 * Where the waiting game is played: XTM One's arcade, which `?arcade=play`
 * opens on any XTM One page, the chat being where it lives. `xtmOneUrl` is
 * host input that ends up in an href, so only an http(s) base is linked.
 */
export function waitingGameUrl(xtmOneUrl: string | undefined): string | null {
  const base = xtmOneUrl?.trim().replace(/\/+$/, '');
  if (!base || !/^https?:\/\//i.test(base)) return null;
  return `${base}/chat?arcade=play`;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mql.matches);
    // Older Safari/WebKit only expose the deprecated addListener/removeListener.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return reduced;
}

/** Px-from-bottom within which the user is considered "still following". */
const FOLLOW_THRESHOLD_PX = 140;

/** Nearest vertically-scrollable ancestor of `el`, or null. */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

interface ChatWaitingPanelProps {
  t: Translate;
  /** Host-level override; when false the panel is hidden entirely. */
  enabled?: boolean;
  /** Opens the arcade in place, for a host that runs it itself. Wins over `playUrl`. */
  onPlay?: () => void;
  /** Where the arcade is played, opened in a new tab. */
  playUrl?: string | null;
}

const PLAY_CLASS =
  'inline-flex items-center gap-1.5 self-start rounded text-xs text-[var(--chat-accent)] opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100';

/**
 * Waiting experience shown below the status bubble during longer waits:
 * rotating messages, and an invitation to play XTM One's Space Invaders arcade
 * while the agent works. The package ships no game of its own; without a way
 * to reach the arcade the messages stand alone.
 */
export const ChatWaitingPanel = ({ t, enabled = true, onPlay, playUrl }: ChatWaitingPanelProps) => {
  const messages = useMemo(() => defaultMessages(t), [t]);
  const reducedMotion = usePrefersReducedMotion();
  const [msgIndex, setMsgIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // The panel mounts below the last message but, unlike streamed reasoning or
  // answer text (which auto-scrolls on length change), nothing else triggers a
  // scroll - so at the bottom it lands under the fold. Reveal it on mount IF
  // the user is still following the bottom; if they scrolled up, leave them.
  useEffect(() => {
    const scroller = findScrollParent(rootRef.current);
    if (!scroller) return;
    const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (distance <= FOLLOW_THRESHOLD_PX) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, []);

  // A disabled host arms no timer; `enabled` is a dep so toggling it cleans up.
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setMsgIndex((i) => (i + 1) % messages.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [enabled, messages.length]);

  if (!enabled) return null;

  const current = messages[msgIndex % messages.length];

  return (
    <div ref={rootRef} className="ml-11 mt-2.5 max-w-[78%]">
      {/* Keep the live region scoped to the announced text only: wrapping the
          play link too would re-announce it alongside each message change. */}
      <span className="sr-only" role="status" aria-live="polite">
        {current}
      </span>
      {/* Every non-essential animation (fade-ins, the blinking caret) stops
          under prefers-reduced-motion; only the dimmed text rotates. */}
      <div
        className="flex flex-col gap-1.5 rounded-md bg-[var(--chat-accent)]/[0.03] px-3 py-2.5"
        style={reducedMotion ? undefined : { animation: 'chat-fade-in 0.5s ease-out' }}
      >
        <span
          key={current}
          aria-hidden
          className="text-xs text-gray-500 dark:text-white/45"
          style={reducedMotion ? undefined : { animation: 'chat-fade-in 0.4s ease-out' }}
        >
          {current}
          <span className={`ml-0.5 inline-block w-1 h-3 align-middle bg-[var(--chat-accent)]/60 ${reducedMotion ? '' : 'animate-pulse'}`} />
        </span>
        {onPlay ? (
          <button type="button" onClick={onPlay} className={PLAY_CLASS}>
            <span aria-hidden className="inline-flex">
              <GamepadIcon size={13} />
            </span>
            {t('Play Space Invaders')}
          </button>
        ) : playUrl ? (
          <a href={playUrl} target="_blank" rel="noopener noreferrer" className={PLAY_CLASS}>
            <span aria-hidden className="inline-flex">
              <GamepadIcon size={13} />
            </span>
            {t('Play Space Invaders in XTM One')}
            <span aria-hidden className="inline-flex">
              <ExternalLinkIcon size={11} />
            </span>
          </a>
        ) : null}
      </div>
    </div>
  );
};
