/**
 * Unit tests for following the end of the conversation - `yarn test`.
 *
 * The container is a stand-in: an instant scroll lands at once, a smooth one
 * only moves where the test moves it, frame by frame, and the scroll events
 * are delivered by hand.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createScrollFollower, FOLLOW_THRESHOLD_PX, type ScrollBox } from './scrollFollow.ts';

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
