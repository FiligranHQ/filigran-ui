/**
 * Rendering tests of the voice call - `yarn test`: started from the handle,
 * it sends what was said through the panel, speaks the addressed agent's
 * answer through the host's speech route in short pieces, shows the other
 * agents' replies by name, and is cancelled by the handle's `stop()`.
 */
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { fakeBackend, installDom, json, settle, sseStream, type RecordedRequest } from '../../test/dom.ts';
import type { SpeechRecognitionEventLike } from '../hooks/dictationController.ts';

installDom();
const { ChatPanel } = await import('./ChatPanel.tsx');
type Props = import('../types.ts').ChatPanelProps;
type Handle = import('../types.ts').ChatPanelHandle;

const AGENTS = [{ id: 'a1', name: 'Hunter', slug: 'hunter', icon: null, description: null }];

/** The browser's recogniser, driven by the test. */
class FakeRecognition {
  static last: FakeRecognition | null = null;
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: (() => void) | null = null;
  onend: (() => void) | null = null;
  running = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.running = true;
  }
  stop() {
    this.running = false;
  }
  abort() {
    this.running = false;
  }
  hear(transcript: string) {
    this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, 0: { transcript } } } });
  }
}

let container: HTMLElement;
let root: Root;
const realSetTimeout = window.setTimeout;
// The second of silence that sends a phrase runs by hand.
let silenceTimers: (() => void)[] = [];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
  silenceTimers = [];
  window.setTimeout = ((fn: () => void, ms?: number, ...args: unknown[]) => {
    if (ms === 1000) {
      silenceTimers.push(fn);
      return 0;
    }
    return realSetTimeout(fn, ms, ...args);
  }) as typeof window.setTimeout;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  window.setTimeout = realSetTimeout;
});

const baseProps: Props = { mode: 'inline', apiBaseUrl: '/api', user: { firstName: 'Ada' } };

async function render(props: Partial<Props>, ref?: React.Ref<Handle>) {
  await act(async () => {
    root.render(<ChatPanel {...baseProps} {...props} ref={ref} />);
  });
  await act(async () => settle());
}

const agentsRoute = (req: RecordedRequest) => (req.url === '/api/chat/agents' ? json(AGENTS) : undefined);
const overlay = () => container.querySelector('[data-testid="filigran-chat-voice-call"]');
const text = () => container.textContent ?? '';

/** Say *text*, then let the second of silence send it. */
const say = (text: string) =>
  act(async () => {
    FakeRecognition.last!.hear(text);
    for (const fn of silenceTimers.splice(0)) fn();
    await settle(10);
  });

test('a voice call sends what was said and speaks only the addressed agent’s answer, in short pieces', async () => {
  const stream = sseStream();
  const seen: string[] = [];
  const requests = fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/tts' ? new Response(new Blob(['mp3']), { status: 200 }) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render(
    {
      apiEndpoints: { tts: '/chat/tts' },
      onBeforeSend: ({ source }) => {
        seen.push(source);
      },
    },
    ref,
  );
  let started = false;
  await act(async () => {
    started = ref.current!.startVoiceCall();
    await settle();
  });
  assert.equal(started, true);
  assert.ok(overlay(), 'the call shows over the panel');
  assert.ok(overlay()!.textContent?.includes('Listening...'));

  await say('What is APT28');
  const body = requests.find((r) => r.url === '/api/chat/messages')!.body as Record<string, unknown>;
  assert.equal(body.content, 'What is APT28');
  assert.deepEqual(seen, ['voice']);

  const sentence = 'APT28 is a threat group attributed to Russian military intelligence. ';
  const answer = sentence.repeat(4).trim();
  await act(async () => {
    stream.send({ type: 'thinking', turn_id: 't1' });
    stream.send({ type: 'done', content: answer, intermediate: true, answered_by: { agent_id: 'a1', agent_name: 'Hunter' }, turn_id: 't1' });
    stream.send({
      type: 'done',
      content: 'Writer could not answer: timeout',
      answered_by: { agent_id: 'w1', agent_name: 'Writer' },
      mention_failed: true,
      turn_id: 't1',
      conversation_id: 'c1',
    });
    await settle(10);
  });
  const tts = requests.filter((r) => r.url === '/api/chat/tts').map((r) => (r.body as { text: string }).text);
  assert.ok(tts.length >= 2, 'a long answer goes as several pieces');
  assert.ok(
    tts.every((piece) => piece.length <= 200),
    'each piece a sentence or so',
  );
  assert.equal(tts.join(' '), answer, 'the addressed agent’s answer, and only it');
  assert.ok(overlay()!.textContent?.includes('Speaking…'));
  assert.ok(overlay()!.textContent?.includes('Writer · Did not answer'), 'the other agent shown by name');

  await act(async () => {
    (overlay()!.querySelector('button[aria-label="End voice call"]') as HTMLButtonElement).click();
    await settle();
  });
  assert.equal(overlay(), null);
  await act(async () => {
    stream.close();
    await settle();
  });
});

test('the handle’s stop cancels the question a call awaits, and a read-only panel starts no call', async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({}, ref);
  await act(async () => {
    ref.current!.startVoiceCall();
    await settle();
  });
  await say('Long question');
  assert.ok(overlay()!.textContent?.includes('Tap to cancel'));
  await act(async () => {
    ref.current!.stop();
    await settle(10);
  });
  assert.ok(overlay()!.textContent?.includes('Listening...'), 'back to listening');
  assert.ok(text().includes('Stopped'), 'and the turn stopped');

  await act(async () => root.unmount());
  root = createRoot(container);
  await render({ readOnly: true }, ref);
  let started = true;
  await act(async () => {
    started = ref.current!.startVoiceCall();
  });
  assert.equal(started, false);
  assert.equal(overlay(), null);
});

test('without speech recognition no call starts', async () => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  fakeBackend([agentsRoute]);
  const ref = createRef<Handle>();
  await render({}, ref);
  let started = true;
  await act(async () => {
    started = ref.current!.startVoiceCall();
  });
  assert.equal(started, false);
  assert.equal(overlay(), null);
});
