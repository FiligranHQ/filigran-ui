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
 *
 * The reader's gestures toward the top (a wheel, a swipe, a key, a press on
 * the scrollbar) stop the follow before the scroll they cause, read by the
 * predicates below. A scroll event that moved nothing changes nothing: it is
 * the event of a jump of ours, delivered a frame late, and right after such a
 * gesture it would re-arm the follow the gesture just ended. Each move is read
 * against the last position that moved more than 1 px, so a slow drift of
 * sub-pixel steps adds up to a move instead of reading as none at every step.
 */

/** How near the bottom a reader scrolling down must come for the view to follow again. */
export const FOLLOW_THRESHOLD_PX = 100;

/** How far (px) a finger must travel down the screen before the swipe counts as scrolling up. */
export const TOUCH_SLOP_PX = 4;

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
   * The reader is scrolling toward the top (a wheel, a swipe, a key, the scrollbar). Stops the follow
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
      const movedDown = top > lastTop + 1;
      if (movedUp || movedDown) lastTop = top;
      const distance = box.scrollHeight - top - box.clientHeight;
      if (movedUp) {
        // The reader scrolled up — or the browser moved the view to the new end
        // of a list that got shorter, which leaves it at the bottom.
        following = distance <= 1;
      } else if (movedDown && distance <= FOLLOW_THRESHOLD_PX) {
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

/** A wheel turned toward the top. A pinch (ctrl + wheel) zooms, and a mostly sideways one pans a code block or a table. */
export function wheelScrollsUp(event: { deltaX: number; deltaY: number; ctrlKey: boolean }): boolean {
  return !event.ctrlKey && event.deltaY < 0 && Math.abs(event.deltaY) > Math.abs(event.deltaX);
}

const KEYS_TOWARD_TOP = new Set(['ArrowUp', 'PageUp', 'Home']);

/** A key that scrolls a focused thread toward its top. */
export function keyScrollsUp(event: { key: string; shiftKey: boolean; altKey: boolean }): boolean {
  if (event.altKey) return false;
  return KEYS_TOWARD_TOP.has(event.key) || (event.key === ' ' && event.shiftKey);
}

/**
 * A finger moving DOWN the screen (the content follows it toward the top),
 * measured from the highest point of the touch so far, so a tap's jitter is
 * not a swipe.
 */
export function swipeScrollsUp(anchorY: number, y: number): boolean {
  return y - anchorY > TOUCH_SLOP_PX;
}

/**
 * Where the one finger on the screen is. `null` while two or more are down: a
 * pinch zooms and a first finger can travel down past the slop without the
 * thread scrolling at all.
 */
export function singleTouchY(touches: ArrayLike<{ clientY: number }>): number | null {
  return touches.length === 1 ? touches[0].clientY : null;
}

/** A pointer press on the thread, `x` / `y` measured from its padding box. */
export interface ScrollPress {
  button: number;
  /** The press landed on the container itself, not on its content. */
  onContainer: boolean;
  /** The press landed on a link, a button or a field. */
  onControl: boolean;
  x: number;
  y: number;
  clientWidth: number;
  clientHeight: number;
  scrollTop: number;
  scrollHeight: number;
}

/**
 * A press that hands the view to the reader: the middle button away from a
 * control, which starts the browser's autoscroll on Windows and Linux (on a
 * link it opens a tab), or the thread's own scrollbar (`x` past its content
 * box) on the thumb or above it. The track below the thumb pages DOWN, toward
 * the end the view follows.
 */
export function pressTakesScrollbar(press: ScrollPress): boolean {
  if (press.button === 1) return !press.onControl;
  if (press.button !== 0 || !press.onContainer || press.x < press.clientWidth) return false;
  const thumbBottom = ((press.scrollTop + press.clientHeight) / press.scrollHeight) * press.clientHeight;
  return press.y <= thumbBottom;
}

/** What `innerBoxScrollsUp` reads of an element. */
export interface ScrollNode {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

const SCROLLING_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);

/**
 * Whether a gesture toward the top at `target` scrolls a box INSIDE the thread
 * instead of the thread: the browser moves the innermost box under it that can
 * still go up, and the thread only once that box is at its top. A box that
 * only clips (`overflow: hidden` — the reasoning window, pinned to its own
 * end) is not one: the gesture goes through it.
 */
export function innerBoxScrollsUp<T extends ScrollNode>(
  target: T | null,
  container: T,
  parentOf: (node: T) => T | null,
  overflowY: (node: T) => string,
): boolean {
  for (let node = target; node && node !== container; node = parentOf(node)) {
    if (node.scrollTop > 0 && node.scrollHeight > node.clientHeight && SCROLLING_OVERFLOW.has(overflowY(node))) {
      return true;
    }
  }
  return false;
}
