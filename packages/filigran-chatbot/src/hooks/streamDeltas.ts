/**
 * Streamed answer text and reasoning, applied to React state at most once per
 * animation frame.
 *
 * A backend can emit one event per model delta, dozens a second: applied one by
 * one, each re-renders the panel and re-parses the live answer, far more often
 * than the screen can show. The deltas are gathered here and applied together
 * on the next frame. Every other event is handled after a `flush()`, so state
 * still changes in the order the events arrived.
 *
 * A hidden tab runs no frames, and needs none: what waits is the text itself,
 * not a queue of events, and the first frame once the tab is visible applies
 * it - or, before that, the next event of another kind or the end of the
 * stream.
 */
export interface StreamDeltas {
  /** The answer text grew; the applier reads the text itself. */
  text: () => void;
  /** A chunk of reasoning prose arrived. */
  thinking: (chunk: string) => void;
  /** Apply what is pending now. */
  flush: () => void;
  /** Drop what is pending and ignore any later delta: the stream is over or abandoned. */
  close: () => void;
}

export function createStreamDeltas(apply: (textChanged: boolean, thinking: string) => void): StreamDeltas {
  let textChanged = false;
  let thinking = '';
  let frame: number | null = null;
  let closed = false;

  const cancelFrame = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  const flush = () => {
    cancelFrame();
    if (!textChanged && !thinking) return;
    const changed = textChanged;
    const chunk = thinking;
    textChanged = false;
    thinking = '';
    apply(changed, chunk);
  };
  const schedule = () => {
    if (frame !== null) return;
    if (typeof requestAnimationFrame !== 'function') {
      flush();
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = null;
      flush();
    });
  };

  return {
    text: () => {
      if (closed) return;
      textChanged = true;
      schedule();
    },
    thinking: (chunk) => {
      if (closed) return;
      thinking += chunk;
      schedule();
    },
    flush,
    close: () => {
      closed = true;
      cancelFrame();
      textChanged = false;
      thinking = '';
    },
  };
}
