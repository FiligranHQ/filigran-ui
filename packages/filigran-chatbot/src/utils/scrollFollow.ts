/**
 * How the thread keeps the end of the conversation in view as it grows.
 *
 * The view follows the conversation while the reader is at the bottom, stops
 * once they scroll up to read back, and follows again when they come back down
 * or send a message. While following, each streamed frame jumps to the end at
 * once: a smooth scroll restarted on every frame lags behind the text. A
 * message just sent and a conversation just opened are scrolled to smoothly,
 * and since any other scroll aborts a smooth one, the frames streamed in the
 * meantime wait for it to arrive and the view then catches up with them.
 */

/** How near the bottom a reader scrolling down must come for the view to follow again. */
export const FOLLOW_THRESHOLD_PX = 100;

/**
 * The longest a smooth scroll of ours is waited for. Browsers finish one well
 * within it; past it the view catches up anyway, since a smooth scroll cut
 * short by another one (a prompt scrolling itself into view) never reaches
 * where it was going.
 */
const SMOOTH_SCROLL_TIMEOUT_MS = 1000;

/** The scroll container, as far as following the conversation needs it. */
export interface ScrollBox {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
  scrollTo(options: ScrollToOptions): void;
}

export interface ScrollFollowTimers {
  set: (callback: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

export interface ScrollFollower {
  /** Whether the view follows the conversation as it grows. */
  readonly following: boolean;
  /** Scroll smoothly to the end and follow again: a message just sent, a conversation just opened. */
  reveal: () => void;
  /** The conversation grew: keep its end in view while the view follows. */
  keepUp: () => void;
  /** The container scrolled. */
  onScroll: () => void;
  /**
   * The reader is scrolling toward the top (a wheel, a swipe). Stops the follow
   * at once: the scroll event only comes with the next frame, and a streamed
   * frame committed before it would pull the view back down first.
   */
  leave: () => void;
}

const browserTimers: ScrollFollowTimers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createScrollFollower(getBox: () => ScrollBox | null, timers: ScrollFollowTimers = browserTimers): ScrollFollower {
  let following = true;
  // Where the view was last seen, which tells the reader scrolling up apart
  // from the view being moved down by a scroll of ours.
  let lastTop = 0;
  // A smooth scroll of ours still running: where it lands, and the timer that
  // stops waiting for it.
  let smooth: { target: number; timer: unknown } | null = null;

  // 'instant' rather than 'auto': a `scroll-behavior: smooth` stylesheet would
  // turn 'auto' smooth again.
  const jumpToEnd = (box: ScrollBox) => {
    box.scrollTo({ top: box.scrollHeight, behavior: 'instant' });
    lastTop = box.scrollTop;
  };

  const stopWaiting = () => {
    if (!smooth) return;
    timers.clear(smooth.timer);
    smooth = null;
  };

  // The smooth scroll is over: catch up with what streamed in while it ran.
  const arrived = () => {
    stopWaiting();
    const box = getBox();
    if (box && following) jumpToEnd(box);
  };

  return {
    get following() {
      return following;
    },
    reveal: () => {
      const box = getBox();
      if (!box) return;
      following = true;
      stopWaiting();
      const target = Math.max(0, box.scrollHeight - box.clientHeight);
      box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
      lastTop = box.scrollTop;
      // Already at the end, or moved there at once (smooth scrolling turned off).
      if (lastTop >= target - 1) return;
      smooth = { target, timer: timers.set(arrived, SMOOTH_SCROLL_TIMEOUT_MS) };
    },
    keepUp: () => {
      const box = getBox();
      // A jump now would cut the smooth scroll short: it catches up on arrival.
      if (box && following && !smooth) jumpToEnd(box);
    },
    onScroll: () => {
      const box = getBox();
      if (!box) return;
      const top = box.scrollTop;
      const movedUp = top < lastTop - 1;
      lastTop = top;
      const distance = box.scrollHeight - top - box.clientHeight;
      if (movedUp) {
        // The reader scrolled up — or the browser moved the view to the new end
        // of a list that got shorter, which leaves it at the bottom.
        following = distance <= 1;
      } else if (distance <= FOLLOW_THRESHOLD_PX) {
        following = true;
      }
      // Ours only goes down: it is over once the view reaches where it was sent
      // or the end, and a move up is the reader taking over.
      if (smooth && (movedUp || top >= smooth.target - 1 || distance <= 1)) arrived();
    },
    leave: () => {
      const box = getBox();
      // With nothing above to scroll to (a thread that fits), the reader is
      // still at the end whatever the gesture.
      if (!box || box.scrollTop <= 0) return;
      following = false;
      stopWaiting();
    },
  };
}
