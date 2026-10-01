/**
 * Unit tests for following the end of the conversation - `yarn test`.
 *
 * The container is a stand-in: an instant scroll lands at once, a smooth one
 * only moves where the test moves it, frame by frame, and the scroll events
 * are delivered by hand.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createScrollFollower,
  FOLLOW_THRESHOLD_PX,
  innerBoxScrollsUp,
  keyScrollsUp,
  pressTakesScrollbar,
  singleTouchY,
  swipeScrollsUp,
  TOUCH_SLOP_PX,
  wheelScrollsUp,
  type ScrollBox,
  type ScrollNode,
  type ScrollPress,
} from './scrollFollow.ts';

interface FakeBox extends ScrollBox {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  scrolls: ScrollToOptions[];
}

/** A 400 px tall container showing the end of `scrollHeight` px of thread. */
function makeBox(scrollHeight: number): FakeBox {
  const clientHeight = 400;
  const box: FakeBox = {
    scrollTop: Math.max(0, scrollHeight - clientHeight),
    scrollHeight,
    clientHeight,
    scrolls: [],
    scrollTo(options) {
      box.scrolls.push(options);
      if (options.behavior !== 'smooth') box.scrollTop = Math.max(0, Math.min(options.top ?? 0, box.scrollHeight - box.clientHeight));
    },
  };
  return box;
}

function makeTimers() {
  const pending = new Map<number, () => void>();
  let next = 0;
  return {
    set: (callback: () => void) => {
      next += 1;
      pending.set(next, callback);
      return next;
    },
    clear: (handle: unknown) => {
      pending.delete(handle as number);
    },
    get pending() {
      return pending.size;
    },
    fire() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
    },
  };
}

/** A follower that has seen the view where the container shows it. */
function followerFor(box: FakeBox, timers = makeTimers()) {
  const follower = createScrollFollower(() => box, timers);
  follower.onScroll();
  return follower;
}

test('while the reader is at the bottom, each streamed frame jumps to the end', () => {
  const box = makeBox(1000);
  const follower = followerFor(box);
  box.scrollHeight = 1100;
  follower.keepUp();
  assert.deepEqual(box.scrolls, [{ top: 1100, behavior: 'instant' }]);
  assert.equal(box.scrollTop, 700);
  // The scroll event of that jump does not read as the reader moving.
  follower.onScroll();
  assert.equal(follower.following, true);
});

test('a reader who scrolls up is left there, and followed again once back near the bottom', () => {
  const box = makeBox(1000);
  const follower = followerFor(box);
  box.scrollTop = 300;
  follower.onScroll();
  assert.equal(follower.following, false);
  box.scrollHeight = 1200;
  follower.keepUp();
  assert.deepEqual(box.scrolls, []);
  box.scrollTop = 1200 - 400 - FOLLOW_THRESHOLD_PX;
  follower.onScroll();
  assert.equal(follower.following, true);
  follower.keepUp();
  assert.equal(box.scrollTop, 800);
});

test('a list that got shorter leaves the view at its new end, still following', () => {
  const box = makeBox(1000);
  const follower = followerFor(box);
  box.scrollHeight = 900;
  box.scrollTop = 500;
  follower.onScroll();
  assert.equal(follower.following, true);
});

test('frames streamed during the smooth scroll to a message just sent wait for it, then the view catches up', () => {
  const box = makeBox(1000);
  const timers = makeTimers();
  const follower = followerFor(box, timers);
  box.scrollHeight = 1300;
  follower.reveal();
  assert.deepEqual(box.scrolls, [{ top: 1300, behavior: 'smooth' }]);

  box.scrollHeight = 1400;
  follower.keepUp();
  box.scrollTop = 750;
  follower.onScroll();
  follower.keepUp();
  assert.equal(box.scrolls.length, 1, 'no instant jump cuts the smooth scroll short');
  assert.equal(follower.following, true);

  // Where it was sent: the end as it was then.
  box.scrollTop = 900;
  follower.onScroll();
  assert.deepEqual(box.scrolls[1], { top: 1400, behavior: 'instant' });
  assert.equal(box.scrollTop, 1000);
  assert.equal(timers.pending, 0);

  box.scrollHeight = 1500;
  follower.keepUp();
  assert.equal(box.scrollTop, 1100);
});

test('scrolling up during that smooth scroll leaves the reader where they went', () => {
  const box = makeBox(1000);
  const timers = makeTimers();
  const follower = followerFor(box, timers);
  box.scrollHeight = 1300;
  follower.reveal();
  box.scrollTop = 750;
  follower.onScroll();
  box.scrollTop = 700;
  follower.onScroll();
  assert.equal(follower.following, false);
  assert.equal(timers.pending, 0);
  box.scrollHeight = 1400;
  follower.keepUp();
  assert.equal(box.scrolls.length, 1);
  assert.equal(box.scrollTop, 700);
});

test('a wheel toward the top stops the follow at once, a smooth scroll of ours included', () => {
  const box = makeBox(1000);
  const timers = makeTimers();
  const follower = followerFor(box, timers);
  box.scrollHeight = 1300;
  follower.reveal();
  follower.leave();
  assert.equal(follower.following, false);
  assert.equal(timers.pending, 0);
  box.scrollHeight = 1400;
  follower.keepUp();
  assert.equal(box.scrolls.length, 1);
});

test('the late scroll event of a jump does not re-arm the follow a gesture toward the top just ended', () => {
  const box = makeBox(1000);
  const follower = followerFor(box);
  // A reasoning chunk: the view jumps to the end.
  box.scrollHeight = 1050;
  follower.keepUp();
  // The reader turns the wheel up before that jump's scroll event arrives.
  follower.leave();
  follower.onScroll();
  assert.equal(follower.following, false);
  box.scrollHeight = 1100;
  follower.keepUp();
  assert.equal(box.scrolls.length, 1, 'no jump pulls the reader back down');
  assert.equal(box.scrollTop, 650);
});

test('a reader who scrolled up a few pixels is left there, however near the end', () => {
  const box = makeBox(1000);
  const follower = followerFor(box);
  box.scrollTop = 560;
  follower.onScroll();
  assert.equal(follower.following, false);
  box.scrollHeight = 1050;
  follower.keepUp();
  // A scroll event that moved nothing changes nothing.
  follower.onScroll();
  assert.equal(follower.following, false);
  assert.deepEqual(box.scrolls, []);
  assert.equal(box.scrollTop, 560);
});

test('a wheel toward the top of a thread that fits the panel keeps following', () => {
  const box = makeBox(300);
  const follower = followerFor(box);
  follower.leave();
  assert.equal(follower.following, true);
  // The answer outgrows the panel: its end stays in view.
  box.scrollHeight = 700;
  follower.keepUp();
  assert.equal(box.scrollTop, 300);
});

test('a smooth scroll that never arrives is waited for only so long', () => {
  const box = makeBox(1000);
  const timers = makeTimers();
  const follower = followerFor(box, timers);
  box.scrollHeight = 1300;
  follower.reveal();
  box.scrollHeight = 1400;
  follower.keepUp();
  assert.equal(box.scrolls.length, 1);
  // Cut short by another scroll: no scroll event reaches where it was sent.
  timers.fire();
  assert.deepEqual(box.scrolls[1], { top: 1400, behavior: 'instant' });
  assert.equal(box.scrollTop, 1000);
});

test('with the end already in view, a message sent starts no smooth scroll to wait for', () => {
  const box = makeBox(300);
  const timers = makeTimers();
  const follower = followerFor(box, timers);
  follower.reveal();
  assert.equal(timers.pending, 0);
  box.scrollHeight = 700;
  follower.keepUp();
  assert.equal(box.scrollTop, 300);
});

test('a message sent after scrolling up brings the view back and follows again', () => {
  const box = makeBox(1000);
  const follower = followerFor(box);
  box.scrollTop = 200;
  follower.onScroll();
  assert.equal(follower.following, false);
  box.scrollHeight = 1100;
  follower.reveal();
  assert.equal(follower.following, true);
  assert.deepEqual(box.scrolls, [{ top: 1100, behavior: 'smooth' }]);
});

test('a wheel turned toward the top, not a pinch nor a sideways pan, leaves the bottom', () => {
  assert.equal(wheelScrollsUp({ deltaX: 0, deltaY: -40, ctrlKey: false }), true);
  assert.equal(wheelScrollsUp({ deltaX: 0, deltaY: 40, ctrlKey: false }), false);
  assert.equal(wheelScrollsUp({ deltaX: 0, deltaY: -40, ctrlKey: true }), false, 'a trackpad pinch zooms');
  assert.equal(wheelScrollsUp({ deltaX: -60, deltaY: -20, ctrlKey: false }), false, 'a code block panned sideways');
});

test('the keys that scroll a focused thread toward its top', () => {
  const key = (k: string, mods: { shiftKey?: boolean; altKey?: boolean } = {}) =>
    keyScrollsUp({ key: k, shiftKey: !!mods.shiftKey, altKey: !!mods.altKey });
  assert.equal(key('ArrowUp'), true);
  assert.equal(key('PageUp'), true);
  assert.equal(key('Home'), true);
  assert.equal(key(' ', { shiftKey: true }), true);
  assert.equal(key(' '), false, 'Space scrolls down');
  assert.equal(key('ArrowDown'), false);
  assert.equal(key('End'), false);
  assert.equal(key('ArrowUp', { altKey: true }), false);
});

test("a tap's jitter is not a swipe; a finger travelling down past the slop is", () => {
  assert.equal(swipeScrollsUp(300, 300 + TOUCH_SLOP_PX), false);
  assert.equal(swipeScrollsUp(300, 301 + TOUCH_SLOP_PX), true);
  assert.equal(swipeScrollsUp(300, 250), false, 'a finger moving up scrolls down');
});

test('one finger is a swipe; two are a pinch, which scrolls nothing', () => {
  assert.equal(singleTouchY([{ clientY: 120 }]), 120);
  assert.equal(singleTouchY([{ clientY: 120 }, { clientY: 300 }]), null);
  assert.equal(singleTouchY([]), null);
});

test('a press on the thumb of the thread, above it, or the middle button off a control hands the view to the reader', () => {
  // 2000 px of thread scrolled to 800: the thumb runs from 160 to 240 px.
  const press: ScrollPress = {
    button: 0,
    onContainer: true,
    onControl: false,
    x: 384,
    y: 200,
    clientWidth: 380,
    clientHeight: 400,
    scrollTop: 800,
    scrollHeight: 2000,
  };
  assert.equal(pressTakesScrollbar(press), true, 'the thumb');
  assert.equal(pressTakesScrollbar({ ...press, y: 40 }), true, 'the track above the thumb');
  assert.equal(pressTakesScrollbar({ ...press, y: 300 }), false, 'the track below the thumb pages toward the end');
  assert.equal(pressTakesScrollbar({ ...press, x: 200 }), false, 'a press on the content');
  assert.equal(pressTakesScrollbar({ ...press, onContainer: false }), false);
  assert.equal(pressTakesScrollbar({ ...press, button: 2 }), false);
  const middle = { ...press, button: 1, onContainer: false, x: 10 };
  assert.equal(pressTakesScrollbar(middle), true, 'autoscroll');
  assert.equal(pressTakesScrollbar({ ...middle, onControl: true }), false, 'a middle click on a link opens a tab');
});

test('a slow drift toward the top adds up to a move, a step of 1 px at a time', () => {
  const box = makeBox(1000);
  const follower = followerFor(box);
  box.scrollTop = 599;
  follower.onScroll();
  assert.equal(follower.following, true, 'one pixel is not a move');
  box.scrollTop = 598;
  follower.onScroll();
  assert.equal(follower.following, false);
  box.scrollHeight = 1050;
  follower.keepUp();
  assert.deepEqual(box.scrolls, []);
});

interface FakeNode extends ScrollNode {
  parent: FakeNode | null;
  overflowY: string;
}

function makeNode(parent: FakeNode | null, overflowY = 'visible', scroll = { scrollTop: 0, scrollHeight: 100, clientHeight: 100 }): FakeNode {
  return { parent, overflowY, ...scroll };
}

const scrollsInside = (target: FakeNode, container: FakeNode) =>
  innerBoxScrollsUp(
    target,
    container,
    (n) => n.parent,
    (n) => n.overflowY,
  );

test('a box inside the thread that can still go up takes the gesture first', () => {
  const thread = makeNode(null, 'auto', { scrollTop: 500, scrollHeight: 1000, clientHeight: 400 });
  const codeBlock = makeNode(thread, 'auto', { scrollTop: 40, scrollHeight: 600, clientHeight: 200 });
  assert.equal(scrollsInside(makeNode(codeBlock), thread), true);
  const atItsTop = makeNode(thread, 'auto', { scrollTop: 0, scrollHeight: 600, clientHeight: 200 });
  assert.equal(scrollsInside(makeNode(atItsTop), thread), false, 'at its top, the gesture moves the thread');
  // The reasoning window clips its prose and pins it to its own end: the gesture goes through it.
  const reasoning = makeNode(thread, 'hidden', { scrollTop: 120, scrollHeight: 280, clientHeight: 160 });
  assert.equal(scrollsInside(makeNode(reasoning), thread), false);
  assert.equal(scrollsInside(thread, thread), false);
});
