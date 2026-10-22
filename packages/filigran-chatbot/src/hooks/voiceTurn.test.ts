/**
 * Unit tests for a voice call's answer matching - `yarn test`, ported from the
 * XTM One voice overlay's.
 *
 * The panel also reads the turns it did not start (relayed by the event
 * stream): only the turn that answers the spoken question may resolve it, and
 * only with its final answer - spoken for the addressed agent alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  answerTranscriptLines,
  classifyVoiceFrame,
  newPendingAnswer,
  isBargeIn,
  probeTurn,
  type VoiceAgentReply,
  type VoiceFrame,
} from './voiceTurn.ts';

const last = <T>(items: T[]): T => items[items.length - 1];

const run = (frames: VoiceFrame[], agentId: string | null = null) => {
  const pending = newPendingAnswer(agentId);
  return { pending, verdicts: frames.map((frame) => classifyVoiceFrame(pending, frame)) };
};

const answer = (text: string, others: VoiceAgentReply[] = []) => ({ kind: 'answer', text, others });

test("the panel's own turn answers the question with its final done", () => {
  const { verdicts } = run([
    { type: 'thinking' },
    { type: 'status', turn_id: 'own' },
    { type: 'stream', content: 'Hel', turn_id: 'own' },
    { type: 'done', content: 'Hello', turn_id: 'own' },
  ]);
  assert.deepEqual(
    verdicts.map((v) => v.kind),
    ['progress', 'progress', 'progress', 'answer'],
  );
  assert.deepEqual(verdicts[3], answer('Hello'));
});

test('a turn the panel did not start never answers it, whatever it sends', () => {
  const { verdicts } = run([
    { type: 'thinking' },
    { type: 'thinking', relayed: true, turn_id: 'main-chat' },
    { type: 'status', relayed: true, turn_id: 'main-chat' },
    { type: 'done', content: "the main chat's answer", relayed: true, turn_id: 'main-chat' },
    { type: 'error', content: 'boom', relayed: true, turn_id: 'main-chat' },
    { type: 'user_message', relayed: true },
    { type: 'done', content: 'mine', turn_id: 'own' },
  ]);
  assert.deepEqual(
    verdicts.map((v) => v.kind),
    ['progress', 'ignore', 'ignore', 'ignore', 'ignore', 'ignore', 'answer'],
  );
  assert.deepEqual(last(verdicts), answer('mine'));
});

test('a relayed frame from a server that predates turn ids is ignored too', () => {
  const { verdicts } = run([{ type: 'done', content: 'theirs', relayed: true }]);
  assert.deepEqual(verdicts, [{ kind: 'ignore' }]);
});

test("a question folded into a running turn is answered by that turn's final done", () => {
  const { pending, verdicts } = run([
    { type: 'thinking' },
    { type: 'folded_into_active_turn', folded: true, turn_id: 'running' },
    { type: 'status', relayed: true, turn_id: 'running' },
    { type: 'done', content: 'other', relayed: true, turn_id: 'another' },
    { type: 'done', content: 'answer', relayed: true, turn_id: 'running' },
  ]);
  assert.equal(pending.turnId, 'running');
  assert.deepEqual(
    verdicts.map((v) => v.kind),
    ['progress', 'progress', 'progress', 'ignore', 'answer'],
  );
  assert.deepEqual(last(verdicts), answer('answer'));
});

test("a folded turn's earlier segments answer what it was already doing, not the question", () => {
  const { verdicts } = run([
    { type: 'folded_into_active_turn', folded: true, turn_id: 'running' },
    { type: 'done', content: 'Answer to the typed question.', intermediate: true, relayed: true, turn_id: 'running' },
    { type: 'thinking', intermediate: true, relayed: true, turn_id: 'running' },
    { type: 'done', content: 'Answer to the spoken one.', relayed: true, turn_id: 'running' },
  ]);
  assert.deepEqual(last(verdicts), answer('Answer to the spoken one.'));
});

test('a question queued for the next turn with no turn running ends the wait', () => {
  assert.deepEqual(run([{ type: 'thinking' }, { type: 'folded_into_active_turn', folded: false }]).verdicts, [
    { kind: 'progress' },
    { kind: 'failed', message: 'The message was queued for the next response.' },
  ]);
  // Queued while a turn runs: that turn consumes it live, so it answers it.
  const queued = run([
    { type: 'folded_into_active_turn', folded: false, turn_id: 'running' },
    { type: 'done', content: 'answer', relayed: true, turn_id: 'running' },
  ]);
  assert.deepEqual(last(queued.verdicts), answer('answer'));
});

test('a committed mid-turn segment does not cut the answer short', () => {
  const { verdicts } = run([
    { type: 'done', content: 'First part.', intermediate: true, turn_id: 'own' },
    { type: 'thinking', intermediate: true, turn_id: 'own' },
    { type: 'done', content: 'Second part.', turn_id: 'own' },
  ]);
  assert.deepEqual(
    verdicts.map((v) => v.kind),
    ['progress', 'progress', 'answer'],
  );
  assert.deepEqual(last(verdicts), answer('First part.\n\nSecond part.'));
});

// A turn several @mentioned agents answer reaches voice mode through a
// message another client folded in: only the addressed agent speaks.
const VOICE_AGENT = { agent_id: 'voice-agent', agent_name: 'Mail Desk' };
const ANALYST = { agent_id: 'analyst', agent_name: 'Analyst' };
const WRITER = { agent_id: 'writer', agent_name: 'Writer' };

test('the other agents a folded message mentions are handed over as text, never spoken', () => {
  const { verdicts } = run(
    [
      { type: 'thinking' },
      { type: 'done', content: 'Looking it up.', intermediate: true, turn_id: 'own' },
      // The conversation agent's reply is attributed to it on such a turn.
      { type: 'done', content: 'Here is your answer.', intermediate: true, answered_by: VOICE_AGENT, turn_id: 'own' },
      { type: 'thinking', intermediate: true, turn_id: 'own' },
      { type: 'status', status: 'mention_answering', agent_id: 'analyst', agent_name: 'Analyst', turn_id: 'own' },
      { type: 'done', content: "Analyst's take.", intermediate: true, answered_by: ANALYST, turn_id: 'own' },
      { type: 'status', status: 'mention_answering', agent_id: 'writer', agent_name: 'Writer', turn_id: 'own' },
      { type: 'done', content: 'Writer could not answer: timeout', answered_by: WRITER, mention_failed: true, turn_id: 'own' },
    ],
    'voice-agent',
  );
  assert.deepEqual(
    verdicts.map((v) => v.kind),
    ['progress', 'progress', 'progress', 'progress', 'progress', 'progress', 'progress', 'answer'],
  );
  assert.deepEqual(
    last(verdicts),
    answer('Looking it up.\n\nHere is your answer.', [
      { agentId: 'analyst', agentName: 'Analyst', failed: false, text: "Analyst's take." },
      { agentId: 'writer', agentName: 'Writer', failed: true, text: 'Writer could not answer: timeout' },
    ]),
  );
});

test("on a General Assistant conversation every attributed reply is another agent's", () => {
  // The General Assistant's own reply is never attributed.
  const { verdicts } = run([
    { type: 'done', content: "The assistant's answer.", intermediate: true, turn_id: 'own' },
    { type: 'done', content: "Analyst's take.", answered_by: ANALYST, turn_id: 'own' },
  ]);
  assert.deepEqual(
    last(verdicts),
    answer("The assistant's answer.", [{ agentId: 'analyst', agentName: 'Analyst', failed: false, text: "Analyst's take." }]),
  );
});

test('a question folded into a turn several agents answer is answered by the addressed agent', () => {
  // A REST turn's viewers get every reply together, at the end.
  const { verdicts } = run(
    [
      { type: 'folded_into_active_turn', folded: true, turn_id: 'running' },
      { type: 'status', status: 'mention_answering', agent_id: 'analyst', relayed: true, turn_id: 'running' },
      { type: 'done', content: 'Answer to both.', intermediate: true, answered_by: VOICE_AGENT, relayed: true, turn_id: 'running' },
      { type: 'done', content: "Analyst's take.", intermediate: true, answered_by: ANALYST, relayed: true, turn_id: 'running' },
      { type: 'done', content: "Writer's take.", answered_by: WRITER, relayed: true, turn_id: 'running' },
    ],
    'voice-agent',
  );
  assert.deepEqual(
    last(verdicts),
    answer('Answer to both.', [
      { agentId: 'analyst', agentName: 'Analyst', failed: false, text: "Analyst's take." },
      { agentId: 'writer', agentName: 'Writer', failed: false, text: "Writer's take." },
    ]),
  );
});

test('a folded question the addressed agent said nothing after speaks nothing and shows the rest', () => {
  const { verdicts } = run(
    [
      { type: 'folded_into_active_turn', folded: true, turn_id: 'running' },
      { type: 'done', content: "Writer's take.", answered_by: WRITER, relayed: true, turn_id: 'running' },
    ],
    'voice-agent',
  );
  assert.deepEqual(last(verdicts), answer('', [{ agentId: 'writer', agentName: 'Writer', failed: false, text: "Writer's take." }]));
});

test('the addressed agent follows a transfer, and its own note is its answer', () => {
  const { pending, verdicts } = run(
    [
      { type: 'status', status: 'transfer_start', agent_id: 'billing', agent_name: 'Billing', turn_id: 'own' },
      {
        type: 'done',
        content: 'I encountered an issue while processing your request.',
        intermediate: true,
        answered_by: { agent_id: 'billing', agent_name: 'Billing' },
        mention_failed: true,
        turn_id: 'own',
      },
      { type: 'done', content: "Analyst's take.", answered_by: ANALYST, turn_id: 'own' },
    ],
    'voice-agent',
  );
  assert.equal(pending.agentId, 'billing');
  assert.equal(last(verdicts).kind, 'answer');
  assert.equal((last(verdicts) as { text: string }).text, 'I encountered an issue while processing your request.');
});

test('only a transfer in the answering turn moves the addressed agent', () => {
  const { pending } = run(
    [
      { type: 'folded_into_active_turn', folded: true, turn_id: 'running' },
      // A frame of a turn other than the one the question joined.
      { type: 'status', status: 'transfer_start', agent_id: 'billing', turn_id: 'another' },
    ],
    'voice-agent',
  );
  assert.equal(pending.agentId, 'voice-agent');
  const answering = run(
    [
      { type: 'folded_into_active_turn', folded: true, turn_id: 'running' },
      { type: 'status', status: 'transfer_start', agent_id: 'billing', relayed: true, turn_id: 'running' },
    ],
    'voice-agent',
  );
  assert.equal(answering.pending.agentId, 'billing');
  // A server that names no turn: its transfer is the turn's.
  assert.equal(run([{ type: 'status', status: 'transfer_start', agent_id: 'billing' }], 'voice-agent').pending.agentId, 'billing');
});

test('an answer adds its lines to the voice transcript, never an empty one', () => {
  const analyst = { agentId: 'analyst', agentName: 'Analyst', failed: false, text: "Analyst's take." };
  assert.deepEqual(answerTranscriptLines({ text: 'Mine.', others: [analyst] }), [
    { content: 'Mine.' },
    { content: "Analyst's take.", agent: { name: 'Analyst', failed: false } },
  ]);
  const blank = { agentId: 'writer', agentName: 'Writer', failed: true, text: '  ' };
  assert.deepEqual(answerTranscriptLines({ text: ' ', others: [blank] }), []);
  assert.deepEqual(answerTranscriptLines({ text: '', others: [] }), []);
});

test("an attribution without a name, or the addressed agent's own, is spoken as before", () => {
  const { verdicts } = run(
    [
      { type: 'done', content: 'One.', intermediate: true, answered_by: { agent_id: 'x' }, turn_id: 'own' },
      { type: 'done', content: 'Two.', answered_by: VOICE_AGENT, turn_id: 'own' },
    ],
    'voice-agent',
  );
  assert.deepEqual(last(verdicts), answer('One.\n\nTwo.'));
});

test("the panel's own turn ending without an answer fails the wait instead of hanging it", () => {
  assert.deepEqual(run([{ type: 'cancelled', turn_id: 'own' }]).verdicts, [{ kind: 'failed', message: 'The response was stopped.' }]);
  assert.deepEqual(run([{ type: 'error', content: 'Too many messages' }]).verdicts, [{ kind: 'failed', message: 'Too many messages' }]);
  // The turn it was folded into, closed by the relay because its end was lost.
  const folded = run([
    { type: 'folded_into_active_turn', turn_id: 'running' },
    { type: 'error', content: 'lost', reason: 'lost', relayed: true, turn_id: 'running' },
  ]);
  assert.deepEqual(last(folded.verdicts), { kind: 'failed', message: 'lost' });
});

test('the idle check tells a turn that is over from a read that failed', async () => {
  assert.equal(await probeTurn(async () => ({ running: true })), 'running');
  assert.equal(await probeTurn(async () => ({ running: false })), 'over');
  // A failed read says nothing about the turn: the wait goes on and the check
  // is asked again, rather than failing a long tool call's answer.
  assert.equal(await probeTurn(async () => null), 'unknown');
  assert.equal(
    await probeTurn(async () => {
      throw new Error('503');
    }),
    'unknown',
  );
});

test("speech over the call's own voice is a barge-in, its echo is not", () => {
  const speaking = 'The report lists three campaigns attributed to APT28 this quarter.';
  assert.equal(isBargeIn('three campaigns attributed', speaking), false, 'its own words, heard back');
  assert.equal(isBargeIn('wait stop', speaking), true);
  assert.equal(isBargeIn('no, tell me about APT29 instead', speaking), true);
  assert.equal(isBargeIn('stop', speaking), false, 'one word is too little to tell');
});

test('keep-alives and panel-local frames are not about the answer', () => {
  const { verdicts } = run([{ type: 'pong' }, { type: 'steered' }, {}]);
  assert.deepEqual(
    verdicts.map((v) => v.kind),
    ['ignore', 'ignore', 'ignore'],
  );
});
