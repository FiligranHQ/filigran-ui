/**
 * Unit tests for a voice call's loop - `yarn test`: listen, send after a
 * second of silence, wait for the turn that answers, say it, listen again;
 * barge-in, cancel, mute and the idle check.
 *
 * The fake recogniser behaves as the Web Speech API does: `start()` throws
 * while a session runs, and a session ends only when its `end` is dispatched.
 * Timers run by hand.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { SpeechRecognitionEventLike, SpeechRecognitionLike } from './dictationController.ts';
import {
  createVoiceCall,
  VOICE_ANSWER_IDLE_MS,
  VOICE_RETRY_MS,
  VOICE_SILENCE_MS,
  type VoiceCallDeps,
  type VoiceSendOutcome,
} from './voiceCallController.ts';
import type { TurnProbe } from './voiceTurn.ts';

class FakeRecognition implements SpeechRecognitionLike {
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: (() => void) | null = null;
  onend: (() => void) | null = null;
  running = false;
  calls: string[] = [];
  start() {
    if (this.running) throw new Error('InvalidStateError');
    this.running = true;
    this.calls.push('start');
  }
  stop() {
    this.calls.push('stop');
  }
  abort() {
    this.calls.push('abort');
  }
  hear(transcript: string, isFinal = true) {
    this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal, 0: { transcript } } } });
  }
  end() {
    this.running = false;
    this.onend?.();
  }
}

function setup(overrides: Partial<VoiceCallDeps> = {}) {
  const recognition = new FakeRecognition();
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextTimer = 1;
  const sent: string[] = [];
  const spoken: string[] = [];
  const speeches: { signal: AbortSignal; done: () => void }[] = [];
  let hooks!: { onAccepted: () => void; onSteered: (turnId: string | null) => void };
  let settleSend!: (outcome: VoiceSendOutcome) => void;
  let probe: TurnProbe = 'running';
  let stops = 0;
  const call = createVoiceCall({
    recognition,
    lang: 'fr-FR',
    send: (text, h) => {
      sent.push(text);
      hooks = h;
      return new Promise((resolve) => (settleSend = resolve));
    },
    speak: (text, signal) =>
      new Promise<void>((resolve) => {
        spoken.push(text);
        speeches.push({ signal, done: resolve });
        signal.addEventListener('abort', () => resolve());
      }),
    speakable: (text) => text.replace(/\*\*/g, ''),
    present: (text) => text,
    probe: async () => probe,
    stopTurn: () => {
      stops += 1;
    },
    addressedAgentId: () => 'voice-agent',
    onChange: () => undefined,
    setTimer: (fn, ms) => {
      timers.set(nextTimer, { fn, ms });
      return nextTimer++;
    },
    clearTimer: (id) => timers.delete(id as number),
    ...overrides,
  });
  /** Run the timers of *ms*, as if that long had passed. */
  const elapse = (ms: number) => {
    for (const [id, timer] of [...timers]) {
      if (timer.ms !== ms) continue;
      timers.delete(id);
      timer.fn();
    }
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return {
    call,
    recognition,
    sent,
    spoken,
    speeches,
    elapse,
    flush,
    hooks: () => hooks,
    settleSend: (o: VoiceSendOutcome) => settleSend(o),
    setProbe: (p: TurnProbe) => (probe = p),
    stops: () => stops,
  };
}

/** Say *text* and let a second of silence send it, the backend taking it as a new turn. */
function ask(s: ReturnType<typeof setup>, text: string) {
  s.recognition.hear(text);
  s.elapse(VOICE_SILENCE_MS);
  s.hooks().onAccepted();
}

test('a phrase is sent after a second of silence, and the final answer of its own turn is said', async () => {
  const s = setup();
  s.call.start();
  assert.equal(s.call.snapshot.phase, 'listening');
  assert.equal(s.recognition.lang, 'fr-FR');
  assert.equal(s.recognition.running, true);
  s.recognition.hear('What is', false);
  assert.equal(s.call.snapshot.heard, 'What is');
  s.elapse(VOICE_SILENCE_MS);
  assert.deepEqual(s.sent, [], 'words not final yet are not sent');
  s.recognition.hear('What is APT28');
  s.elapse(VOICE_SILENCE_MS);
  assert.deepEqual(s.sent, ['What is APT28']);
  assert.equal(s.call.snapshot.phase, 'processing');
  assert.ok(s.recognition.calls.includes('stop'), 'the microphone closes while the answer is awaited');
  s.call.frame({ type: 'done', content: 'Before the question', turn_id: 'old' }, false);
  assert.equal(s.call.snapshot.phase, 'processing', 'nothing counts before the backend took the question');
  s.hooks().onAccepted();
  s.call.frame({ type: 'thinking', turn_id: 'own' }, false);
  s.call.frame({ type: 'done', content: 'First part.', intermediate: true, turn_id: 'own' }, false);
  s.call.frame({ type: 'done', content: 'A **Russian** group.', turn_id: 'other' }, true);
  s.call.frame({ type: 'done', content: 'A **Russian** group.', turn_id: 'own' }, false);
  assert.equal(s.call.snapshot.phase, 'speaking');
  assert.deepEqual(s.spoken, ['First part.\n\nA Russian group.']);
  assert.deepEqual(
    s.call.snapshot.lines.map((l) => [l.role, l.content]),
    [
      ['user', 'What is APT28'],
      ['assistant', 'First part.\n\nA **Russian** group.'],
    ],
  );
  s.recognition.end();
  s.speeches[0].done();
  await s.flush();
  assert.equal(s.call.snapshot.phase, 'listening', 'listening again once said');
});

test('a question steered into a running turn is answered by that turn', () => {
  const s = setup();
  s.call.start();
  s.recognition.hear('And the other one?');
  s.elapse(VOICE_SILENCE_MS);
  s.hooks().onSteered('running');
  s.call.frame({ type: 'done', content: 'Answer to what it was doing.', intermediate: true, turn_id: 'running' }, true);
  s.call.frame({ type: 'done', content: 'Answer to the spoken one.', turn_id: 'running' }, true);
  assert.deepEqual(s.spoken, ['Answer to the spoken one.']);
});

test('a steer the backend only stored, for want of a running turn, ends the wait and listens again', () => {
  const s = setup();
  s.call.start();
  s.recognition.hear('Hello there');
  s.elapse(VOICE_SILENCE_MS);
  s.hooks().onSteered(null);
  assert.equal(s.call.snapshot.phase, 'error');
  s.elapse(VOICE_RETRY_MS);
  assert.equal(s.call.snapshot.phase, 'listening');
});

test('other agents of the turn are shown with their name, never said', () => {
  const s = setup();
  s.call.start();
  ask(s, 'Ask them both');
  s.call.frame(
    { type: 'done', content: 'Mine.', intermediate: true, answered_by: { agent_id: 'voice-agent', agent_name: 'Desk' }, turn_id: 'own' },
    false,
  );
  s.call.frame(
    {
      type: 'done',
      content: 'Writer could not answer',
      answered_by: { agent_id: 'writer', agent_name: 'Writer' },
      mention_failed: true,
      turn_id: 'own',
    },
    false,
  );
  assert.deepEqual(s.spoken, ['Mine.']);
  assert.deepEqual(s.call.snapshot.lines.slice(1), [
    { role: 'assistant', content: 'Mine.' },
    { role: 'assistant', content: 'Writer could not answer', agent: { name: 'Writer', failed: true } },
  ]);
});

test('an answer with nothing to say listens again at once', () => {
  const s = setup();
  s.call.start();
  ask(s, 'Draw it');
  s.call.frame({ type: 'done', content: '', turn_id: 'own' }, false);
  assert.equal(s.call.snapshot.phase, 'listening');
  assert.deepEqual(s.spoken, []);
});

test('speech over the answer takes the turn back; its own echo does not', () => {
  const s = setup();
  s.call.start();
  ask(s, 'Tell me everything');
  s.call.frame({ type: 'done', content: 'Three campaigns were seen this quarter.', turn_id: 'own' }, false);
  assert.equal(s.call.snapshot.phase, 'speaking');
  assert.equal(s.recognition.running, true, 'the microphone stays open for a barge-in');
  s.recognition.hear('three campaigns were seen');
  assert.equal(s.call.snapshot.phase, 'speaking', 'its own voice heard back');
  s.recognition.hear('wait, only the last one');
  assert.equal(s.call.snapshot.phase, 'listening');
  assert.equal(s.speeches[0].signal.aborted, true, 'the answer stops');
  s.elapse(VOICE_SILENCE_MS);
  assert.deepEqual(s.sent, ['Tell me everything', 'wait, only the last one']);
});

test('a tap stops the answer being said, or cancels the question and stops its turn', () => {
  const s = setup();
  s.call.start();
  ask(s, 'Long one');
  s.call.interrupt();
  assert.equal(s.stops(), 1);
  assert.equal(s.call.snapshot.phase, 'listening');
  s.call.frame({ type: 'done', content: 'Too late', turn_id: 'own' }, false);
  assert.deepEqual(s.spoken, [], 'the cancelled question’s answer is not said');
  ask(s, 'Short one');
  s.call.frame({ type: 'done', content: 'Short answer', turn_id: 'own2' }, false);
  s.call.interrupt();
  assert.equal(s.speeches[0].signal.aborted, true);
  assert.equal(s.call.snapshot.phase, 'listening');
  assert.equal(s.stops(), 1, 'no turn to stop while speaking');
});

test("the panel's stop cancels the question without stopping a turn again", () => {
  const s = setup();
  s.call.start();
  ask(s, 'Go');
  s.call.cancel();
  assert.equal(s.call.snapshot.phase, 'listening');
  assert.equal(s.stops(), 0);
  s.call.frame({ type: 'done', content: 'Late', turn_id: 'own' }, false);
  assert.deepEqual(s.spoken, []);
});

test('a refused or dropped send, a cancelled turn and an error each end the wait', async () => {
  for (const end of ['failed', 'cancelled', 'error'] as const) {
    const s = setup();
    s.call.start();
    ask(s, 'Question');
    if (end === 'failed') {
      s.settleSend('failed');
      await s.flush();
    } else {
      s.call.frame({ type: end, content: 'boom', turn_id: 'own' }, false);
    }
    assert.equal(s.call.snapshot.phase, 'error', end);
    s.elapse(VOICE_RETRY_MS);
    assert.equal(s.call.snapshot.phase, 'listening', end);
  }
});

test('a silent turn is asked after 120 s: still running keeps the wait, over ends it', async () => {
  const s = setup();
  s.call.start();
  ask(s, 'Slow tool');
  s.elapse(VOICE_ANSWER_IDLE_MS);
  await s.flush();
  assert.equal(s.call.snapshot.phase, 'processing');
  s.setProbe('unknown');
  s.elapse(VOICE_ANSWER_IDLE_MS);
  await s.flush();
  assert.equal(s.call.snapshot.phase, 'processing', 'a read that failed says nothing');
  s.setProbe('over');
  s.elapse(VOICE_ANSWER_IDLE_MS);
  await s.flush();
  assert.equal(s.call.snapshot.phase, 'error');
});

test('muted, nothing heard is sent; unmuted while speaking takes the turn back', () => {
  const s = setup();
  s.call.start();
  s.call.toggleMute();
  assert.equal(s.call.snapshot.muted, true);
  s.recognition.hear('not for the call');
  s.elapse(VOICE_SILENCE_MS);
  assert.deepEqual(s.sent, []);
  s.call.toggleMute();
  s.recognition.end();
  ask(s, 'Now');
  s.call.frame({ type: 'done', content: 'Answer said aloud', turn_id: 'own' }, false);
  s.call.toggleMute();
  s.call.toggleMute();
  assert.equal(s.speeches[0].signal.aborted, true);
  assert.equal(s.call.snapshot.phase, 'listening');
});

test('a recogniser that keeps failing is muted rather than restarted in a loop', () => {
  const s = setup();
  s.call.start();
  for (let i = 0; i < 5; i++) {
    s.recognition.onerror?.();
    s.recognition.end();
    s.elapse(300);
  }
  assert.equal(s.call.snapshot.muted, true);
});

test('without speech recognition the call says so; ending it releases the recogniser', () => {
  const unsupported = setup({ recognition: null });
  unsupported.call.start();
  assert.equal(unsupported.call.snapshot.phase, 'unsupported');
  const s = setup();
  s.call.start();
  ask(s, 'Bye');
  s.call.end();
  assert.equal(s.call.snapshot.phase, 'ended');
  assert.ok(s.recognition.calls.includes('abort'));
  s.call.frame({ type: 'done', content: 'Late', turn_id: 'own' }, false);
  assert.deepEqual(s.spoken, []);
});
