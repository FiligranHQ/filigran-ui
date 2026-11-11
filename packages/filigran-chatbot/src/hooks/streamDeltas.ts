/**
 * Streamed answer text and reasoning, applied to React state at most once per
 * animation frame, the answer text revealed at a steady pace.
 *
 * A backend can emit one event per model delta, dozens a second, and a
 * provider often sends them in clumps: applied as they come, each clump lands
 * as a block of text at once ("frozen, then a burst"). The text is held here
 * and revealed frame by frame instead, a step sized to the backlog so any
 * backlog drains within about {@link STREAM_CATCH_UP_MS}: a steady flow that
 * never falls more than that behind the stream. This is the reveal the chat
 * page had before it moved to this panel.
 *
 * Reasoning prose is applied whole on the next frame. Every other event is
 * handled after a `flush()`, which shows all the text that arrived, so state
 * still changes in the order the events arrived.
 *
 * A hidden tab runs no frames, and needs none: what waits is the text itself,
 * not a queue of events, and the first frame once the tab is visible goes on
 * revealing it - or, before that, the next event of another kind or the end of
 * the stream shows it all.
 */
export interface StreamDeltas {
  /** The answer text is now `full` (what came so far, whole). */
  text: (full: string) => void;
  /** A chunk of reasoning prose arrived. */
  thinking: (chunk: string) => void;
  /** Apply what is pending now: all the text that arrived, and the reasoning. */
  flush: () => void;
  /** The answer text starts over (a new segment, a replay, a retracted answer): nothing of it is shown yet. */
  reset: () => void;
  /** Drop what is pending and ignore any later delta: the stream is over or abandoned. */
  close: () => void;
}

/** The window (ms) within which any backlog of text is revealed. */
export const STREAM_CATCH_UP_MS = 350;
/** The fewest characters a frame reveals while text is pending. */
export const STREAM_MIN_CHARS_PER_FRAME = 4;
/** The frame duration the reveal step is sized on (ms). */
const STREAM_FRAME_MS = 1000 / 60;
const CATCH_UP_FRAMES = Math.max(1, STREAM_CATCH_UP_MS / STREAM_FRAME_MS);

/** How far the reveal moves on one frame: proportional to the backlog, never below the minimum, never past the text. */
export function nextRevealLength(shown: number, total: number): number {
  if (shown >= total) return total;
  const step = Math.max(STREAM_MIN_CHARS_PER_FRAME, Math.ceil((total - shown) / CATCH_UP_FRAMES));
  return Math.min(total, shown + step);
}

/**
 * `apply(text, thinking)`: `text` is the answer text to show now, or null when
 * it did not move; `thinking` the reasoning that arrived since the last call.
 */
export function createStreamDeltas(apply: (text: string | null, thinking: string) => void): StreamDeltas {
  let target = '';
  let shown = 0;
  let thinking = '';
  let frame: number | null = null;
  let closed = false;

  const cancelFrame = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  const emit = (length: number) => {
    const moved = length !== shown;
    shown = length;
    const chunk = thinking;
    thinking = '';
    if (!moved && !chunk) return;
    apply(moved ? target.slice(0, length) : null, chunk);
  };
  const flush = () => {
    cancelFrame();
    emit(target.length);
  };
  const schedule = () => {
    if (frame !== null) return;
    if (typeof requestAnimationFrame !== 'function') {
      flush();
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = null;
      emit(nextRevealLength(shown, target.length));
      if (shown < target.length) schedule();
    });
  };

  return {
    text: (full) => {
      if (closed) return;
      target = full;
      if (shown > full.length) shown = 0;
      schedule();
    },
    thinking: (chunk) => {
      if (closed) return;
      thinking += chunk;
      schedule();
    },
    flush,
    reset: () => {
      target = '';
      shown = 0;
    },
    close: () => {
      closed = true;
      cancelFrame();
      target = '';
      shown = 0;
      thinking = '';
    },
  };
}
