/**
 * Unit tests for reading an answer aloud - `yarn test`.
 *
 * The fake synthesiser behaves as the Web Speech API specifies: utterances
 * queue, `end` fires when one finishes (dispatched by hand here), and
 * `cancel()` empties the queue, failing every utterance still in it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stripFileMarkers } from './index.ts';
import { chunkSpeech, createSpeechController, hasSpeakableWords, speakableText } from './speech.ts';

test('the markdown is read as the words a reader sees', () => {
  const text = speakableText(
    [
      '## Summary',
      '',
      'The **report** links _three_ actors to `APT29`.',
      '',
      '- first finding',
      '- second finding!',
      '',
      '```python',
      'print("never read")',
      '```',
      '',
      '| Name | Status |',
      '| --- | --- |',
      '| Alpha | done |',
      '',
      '![a chart](https://example.com/chart.png)',
      '',
      'See [the dashboard](https://example.com/d) or https://example.com/raw',
      '',
      '---',
    ].join('\n'),
  );
  assert.equal(
    text,
    [
      'Summary.',
      'The report links three actors to APT29.',
      'first finding.',
      'second finding!',
      'Name, Status.',
      'Alpha, done.',
      'See the dashboard or.',
    ].join('\n'),
  );
});

test('file markers are stripped before the text is read', () => {
  assert.equal(speakableText(stripFileMarkers('Here is the export [[FILE:3f2a]].')), 'Here is the export.');
  assert.equal(speakableText(stripFileMarkers('[[FILE:3f2a]]')), '');
});

test('an answer with nothing to say reads as nothing', () => {
  assert.equal(speakableText(''), '');
  assert.equal(speakableText('```\ncode only\n```'), '');
  assert.equal(speakableText('![img](x.png)\n\n---'), '');
});

test('long text is cut between sentences, then between words, never past the limit', () => {
  assert.deepEqual(chunkSpeech('One. Two! Three?', 10), ['One. Two!', 'Three?']);
  assert.deepEqual(chunkSpeech('First line\nSecond line', 100), ['First line Second line']);
  const long = 'word '.repeat(30).trim();
  const chunks = chunkSpeech(long, 24);
  assert.ok(chunks.every((c) => c.length <= 24));
  assert.equal(chunks.join(' '), long);
  assert.deepEqual(chunkSpeech('x'.repeat(25), 10), ['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)]);
  assert.deepEqual(chunkSpeech(''), []);
});

type FakeUtterance = { text: string; lang?: string; onEnd: () => void; onError: () => void };

class FakeSynth {
  queue: FakeUtterance[] = [];
  spoken: string[] = [];
  cancels = 0;
  speak(u: FakeUtterance) {
    this.queue.push(u);
    this.spoken.push(u.text);
  }
  cancel() {
    this.cancels += 1;
    const dropped = this.queue;
    this.queue = [];
    for (const u of dropped) u.onError();
  }
  finishNext() {
    this.queue.shift()?.onEnd();
  }
}

function setup() {
  const synth = new FakeSynth();
  const changes: (string | null)[] = [];
  const controller = createSpeechController<FakeUtterance>(
    synth,
    (text, options) => ({ text, ...options }),
    (id) => changes.push(id),
  );
  return { synth, changes, controller };
}

test('a reading ends after its last utterance', () => {
  const { synth, changes, controller } = setup();
  assert.equal(controller.speak('m1', ['One.', 'Two.'], 'fr'), true);
  assert.equal(controller.speakingId, 'm1');
  assert.deepEqual(
    synth.queue.map((u) => u.lang),
    ['fr', 'fr'],
  );
  synth.finishNext();
  assert.equal(controller.speakingId, 'm1');
  synth.finishNext();
  assert.equal(controller.speakingId, null);
  assert.deepEqual(changes, ['m1', null]);
});

test('reading another message stops the first, whose cancelled queue changes nothing', () => {
  const { synth, changes, controller } = setup();
  controller.speak('m1', ['One.', 'Two.']);
  controller.speak('m2', ['Three.']);
  assert.equal(controller.speakingId, 'm2');
  assert.deepEqual(changes, ['m1', null, 'm2']);
  assert.deepEqual(synth.spoken, ['One.', 'Two.', 'Three.']);
  synth.finishNext();
  assert.equal(controller.speakingId, null);
});

test('an answer made only of code has no words to read', () => {
  assert.equal(hasSpeakableWords('Here is the query.\n\n```sql\nSELECT 1\n```'), true);
  assert.equal(hasSpeakableWords('```sql\nSELECT 1;\n```'), false);
  assert.equal(hasSpeakableWords('  ~~~\nls -la\n  ~~~\n'), false);
  // A fence still open (a cut answer) runs to the end.
  assert.equal(hasSpeakableWords('```\nrm -rf build'), false);
  assert.equal(hasSpeakableWords('```\na\n```\nThen run it.'), true);
  assert.equal(hasSpeakableWords('---'), false);
  assert.equal(hasSpeakableWords('Réponse : 42'), true);
});

test('stop ends the reading once, and is a no-op when nothing is read', () => {
  const { synth, changes, controller } = setup();
  controller.stop();
  assert.deepEqual(changes, []);
  // The synthesiser is the page's: stopping nothing never cancels the host's speech.
  assert.equal(synth.cancels, 0);
  controller.speak('m1', ['One.']);
  controller.stop();
  controller.stop();
  assert.deepEqual(changes, ['m1', null]);
  assert.equal(synth.queue.length, 0);
  assert.equal(synth.cancels, 1);
});

test('a failed utterance ends the reading and drops the rest of it', () => {
  const { synth, changes, controller } = setup();
  controller.speak('m1', ['One.', 'Two.', 'Three.']);
  synth.queue.shift()?.onError();
  assert.equal(controller.speakingId, null);
  assert.deepEqual(changes, ['m1', null]);
  assert.equal(synth.queue.length, 0);
});

test('nothing to read reads nothing', () => {
  const { synth, changes, controller } = setup();
  assert.equal(controller.speak('m1', ['  ']), false);
  assert.equal(controller.speakingId, null);
  assert.deepEqual(changes, []);
  assert.deepEqual(synth.spoken, []);
});
