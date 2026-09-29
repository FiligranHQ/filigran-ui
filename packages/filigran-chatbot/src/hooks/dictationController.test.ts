/**
 * Unit tests for the dictation sessions of one recogniser - `yarn test`.
 *
 * The fake recogniser behaves as the Web Speech API specifies: `start()`
 * throws while a session runs, and a session only ends when its `end` event
 * is dispatched, which the tests do by hand.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDictationController, type SpeechRecognitionEventLike, type SpeechRecognitionLike } from './dictationController.ts';

class FakeRecognition implements SpeechRecognitionLike {
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: (() => void) | null = null;
  onend: (() => void) | null = null;
  running = false;
  refuseStart = false;
  calls: string[] = [];

  start() {
    if (this.running || this.refuseStart) throw new Error('InvalidStateError');
    this.running = true;
    this.calls.push('start');
  }
  stop() {
    this.calls.push('stop');
  }
  abort() {
    this.calls.push('abort');
  }

  hear(transcript: string, isFinal: boolean) {
    this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal, 0: { transcript } } } });
  }
  end() {
    this.running = false;
    this.onend?.();
  }
  fail() {
    this.onerror?.();
  }
}

function setup() {
  const recognition = new FakeRecognition();
  const finals: string[] = [];
  const interims: string[] = [];
  const listening: boolean[] = [];
  const controller = createDictationController(recognition, {
    onFinal: (text) => finals.push(text),
    onInterim: (text) => interims.push(text),
    onListeningChange: (on) => listening.push(on),
  });
  return { recognition, controller, finals, interims, listening };
}

test('a phrase still on its way when the draft is sent is dropped', () => {
  const { recognition, controller, finals, listening } = setup();
  controller.toggle();
  recognition.hear('hello', true);
  controller.cancel();
  assert.deepEqual(recognition.calls, ['start', 'abort']);
  recognition.hear('late words', true);
  recognition.end();
  assert.deepEqual(finals, ['hello']);
  assert.deepEqual(listening, [true, false]);
});

test('the next session is heard again once the cancelled one has ended', () => {
  const { recognition, controller, finals } = setup();
  controller.toggle();
  controller.cancel();
  recognition.end();
  controller.toggle();
  recognition.hear('again', true);
  assert.deepEqual(finals, ['again']);
});

test('stopping by hand still commits the phrase already heard, without a preview', () => {
  const { recognition, controller, finals, interims, listening } = setup();
  controller.toggle();
  recognition.hear('hel', false);
  controller.toggle();
  assert.deepEqual(recognition.calls, ['start', 'stop']);
  recognition.hear('more', false);
  recognition.hear('hello', true);
  recognition.end();
  assert.deepEqual(finals, ['hello']);
  assert.deepEqual(interims, ['hel', '', '']);
  assert.deepEqual(listening, [true, false]);
});

test('sending after a stop drops the phrase the stop was still waiting for', () => {
  const { recognition, controller, finals } = setup();
  controller.toggle();
  controller.toggle();
  controller.cancel();
  assert.deepEqual(recognition.calls, ['start', 'stop', 'abort']);
  recognition.hear('late words', true);
  recognition.end();
  assert.deepEqual(finals, []);
});

test('a pause ending the session restarts it without the mic ever looking off', () => {
  const { recognition, controller, finals, listening } = setup();
  controller.toggle();
  recognition.end();
  assert.deepEqual(recognition.calls, ['start', 'start']);
  recognition.hear('after the pause', true);
  assert.deepEqual(finals, ['after the pause']);
  assert.deepEqual(listening, [true]);
});

test('the end of a stopped or cancelled session never restarts it', () => {
  for (const end of ['stop', 'cancel'] as const) {
    const { recognition, controller, listening } = setup();
    controller.toggle();
    if (end === 'stop') controller.toggle();
    else controller.cancel();
    recognition.end();
    assert.equal(recognition.calls.filter((call) => call === 'start').length, 1, end);
    assert.deepEqual(listening, [true, false], end);
  }
});

test('a start while the cancelled session is ending waits for its end and keeps dropping its results', () => {
  const { recognition, controller, finals, listening } = setup();
  controller.toggle();
  controller.cancel();
  controller.toggle();
  assert.deepEqual(recognition.calls, ['start', 'abort']);
  assert.deepEqual(listening, [true, false, true]);
  recognition.hear('late words', true);
  recognition.end();
  assert.deepEqual(recognition.calls, ['start', 'abort', 'start']);
  recognition.hear('new session', true);
  assert.deepEqual(finals, ['new session']);
  assert.deepEqual(listening, [true, false, true]);
});

test('a start while a stopped session is ending still commits its last phrase', () => {
  const { recognition, controller, finals } = setup();
  controller.toggle();
  controller.toggle();
  controller.toggle();
  recognition.hear('last phrase', true);
  recognition.end();
  recognition.hear('next phrase', true);
  assert.deepEqual(finals, ['last phrase', 'next phrase']);
});

test('a start withdrawn before the previous session ended never happens', () => {
  const { recognition, controller, listening } = setup();
  controller.toggle();
  controller.cancel();
  controller.toggle();
  controller.cancel();
  recognition.end();
  assert.deepEqual(recognition.calls, ['start', 'abort']);
  assert.deepEqual(listening, [true, false, true, false]);
});

test('an error ends the session instead of restarting it', () => {
  const { recognition, controller, listening } = setup();
  controller.toggle();
  recognition.fail();
  recognition.end();
  assert.deepEqual(recognition.calls, ['start']);
  assert.deepEqual(listening, [true, false]);
});

test('a start the engine refuses leaves the mic off', () => {
  const { recognition, controller, listening } = setup();
  recognition.refuseStart = true;
  controller.toggle();
  assert.deepEqual(recognition.calls, []);
  assert.deepEqual(listening, []);
});

test('phrases are trimmed, and a blank one is not appended', () => {
  const { recognition, controller, finals } = setup();
  controller.toggle();
  recognition.hear(' second phrase ', true);
  recognition.hear('  ', true);
  assert.deepEqual(finals, ['second phrase']);
});

test('dispose releases the recogniser and reports nothing more', () => {
  const { recognition, controller, finals, listening } = setup();
  controller.toggle();
  controller.dispose();
  assert.deepEqual(recognition.calls, ['start', 'abort']);
  assert.equal(recognition.onresult, null);
  assert.equal(recognition.onend, null);
  controller.toggle();
  controller.cancel();
  assert.deepEqual(recognition.calls, ['start', 'abort']);
  assert.deepEqual(finals, []);
  assert.deepEqual(listening, [true]);
});
