/**
 * Rendering tests of the voice call - `yarn test`: started from the handle,
 * it sends what was said through the panel, speaks the addressed agent's
 * answer through the host's speech route in short pieces, shows the other
 * agents' replies by name, and is cancelled by the handle's `stop()`.
 */
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, Activity, createRef } from 'react';
import { createRoot } from 'react-dom/client';

import { fakeBackend, json, settle, sseStream } from '../../test/dom.ts';
import { agentsRoute, BASE_PROPS, container, mountPanels, text, type Handle } from '../../test/panel.tsx';
import type { SpeechRecognitionEventLike } from '../hooks/dictationController.ts';

const { render, unmount } = mountPanels();

/** The browser's recogniser, driven by the test. */
class FakeRecognition {
  static last: FakeRecognition | null = null;
  static created = 0;
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  running = false;
  constructor() {
    FakeRecognition.created += 1;
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

const realSetTimeout = window.setTimeout;
// The second of silence that sends a phrase runs by hand.
let silenceTimers: (() => void)[] = [];

beforeEach(() => {
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

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  window.setTimeout = realSetTimeout;
});

const overlay = () => container.querySelector('[data-testid="filigran-chat-voice-call"]');

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

  await unmount();
  await render({ readOnly: true }, ref);
  let started = true;
  await act(async () => {
    started = ref.current!.startVoiceCall();
  });
  assert.equal(started, false);
  assert.equal(overlay(), null);
});

test('a question asked after cancelling the last one goes out once the stopped turn winds down', async () => {
  const streams = [sseStream(), sseStream()];
  let next = 0;
  const requests = fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', messages: [] }) : undefined),
    (req) => (req.url === '/api/chat/messages' ? streams[next++].response() : undefined),
    (req) => (req.url === '/api/chat/messages/cancel' ? json({ status: 'cancelled', turn: 'local' }, 202) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', apiEndpoints: { cancel: '/chat/messages/cancel' } }, ref);
  const questions = () => requests.filter((r) => r.url === '/api/chat/messages').map((r) => (r.body as { content: string }).content);
  await act(async () => {
    ref.current!.startVoiceCall();
    await settle();
  });
  await say('First question');
  await act(async () => {
    streams[0].send({ type: 'turn_started', turn_id: 't1' });
    streams[0].send({ type: 'stream', turn_id: 't1', content: 'Partial' });
    await settle(10);
  });
  await act(async () => {
    (overlay()!.querySelector('button[aria-label="Cancel question"]') as HTMLButtonElement).click();
    await settle(10);
  });
  await act(async () => {
    streams[0].send({ type: 'cancelled', turn_id: 't1', provisional: true });
    await settle(10);
  });
  await say('Second question');
  assert.deepEqual(questions(), ['First question'], 'held while the stopped turn winds down');
  await act(async () => {
    streams[0].send({ type: 'cancelled', turn_id: 't1', message_id: 'm1' });
    await settle(20);
  });
  assert.deepEqual(questions(), ['First question', 'Second question']);
  await act(async () => {
    for (const stream of streams) stream.close();
    await settle();
  });
});

test('a held voice question the send hook takes over as it leaves ends its wait, and the answer to the rest is not said', async () => {
  const streams = [sseStream(), sseStream()];
  let next = 0;
  const requests = fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', messages: [] }) : undefined),
    (req) => (req.url === '/api/chat/messages' ? streams[next++].response() : undefined),
    (req) => (req.url === '/api/chat/tts' ? new Response(new Blob(['mp3']), { status: 200 }) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render(
    {
      conversationId: 'c1',
      holdSendsDuringTurn: true,
      apiEndpoints: { tts: '/chat/tts', steer: null },
      // The voice question is the host's to handle once the turn is over.
      onBeforeSend: ({ source, held }) => (source === 'voice' && held ? false : undefined),
    },
    ref,
  );
  const questions = () => requests.filter((r) => r.url === '/api/chat/messages').map((r) => (r.body as { content: string }).content);
  await act(async () => {
    void ref.current!.send('First');
    await settle(10);
    streams[0].send({ type: 'turn_started', turn_id: 't1' });
    await settle(10);
  });
  await act(async () => {
    ref.current!.setDraft('Typed question');
    await settle();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Send when the answer ends"]')!.click();
    await settle(10);
  });
  await act(async () => {
    ref.current!.startVoiceCall();
    await settle();
  });
  await say('Voice question');
  assert.deepEqual(questions(), ['First'], 'both held');
  await act(async () => {
    streams[0].send({ type: 'done', turn_id: 't1', content: 'First answer' });
    streams[0].close();
    await settle(20);
  });
  assert.deepEqual(questions(), ['First', 'Typed question'], 'only what the hook kept goes');
  assert.ok(overlay()!.textContent?.includes('Failed to get a response. Resuming…'), 'the voice question’s wait is over');
  await act(async () => {
    streams[1].send({ type: 'turn_started', turn_id: 't2' });
    streams[1].send({ type: 'done', turn_id: 't2', content: 'Typed answer' });
    streams[1].close();
    await settle(20);
  });
  assert.equal(requests.filter((r) => r.url === '/api/chat/tts').length, 0, 'nothing said');
  assert.ok(!overlay()!.textContent?.includes('Speaking…'));
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

test('a piece of the answer the browser cannot play is said in the browser’s voice', async () => {
  const stream = sseStream();
  fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/tts' ? new Response(new Blob(['mp3']), { status: 200 }) : undefined),
  ]);
  const page = window as unknown as Record<string, unknown>;
  const global = globalThis as unknown as Record<string, unknown>;
  const saved = { Audio: global.Audio, speechSynthesis: page.speechSynthesis, SpeechSynthesisUtterance: page.SpeechSynthesisUtterance };
  // Playback the browser refuses (an autoplay policy, a format it cannot decode).
  class RefusedAudio {
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    play() {
      return Promise.reject(new DOMException('play() failed', 'NotAllowedError'));
    }
    pause() {}
  }
  const said: string[] = [];
  class Utterance {
    lang = '';
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }
  const synthesis = {
    speak: (utterance: Utterance) => {
      said.push(utterance.text);
      setTimeout(() => utterance.onend?.(), 0);
    },
    cancel: () => undefined,
  };
  for (const target of [page, global]) {
    target.Audio = RefusedAudio;
    target.speechSynthesis = synthesis;
    target.SpeechSynthesisUtterance = Utterance;
  }
  try {
    const ref = createRef<Handle>();
    await render({ apiEndpoints: { tts: '/chat/tts' } }, ref);
    await act(async () => {
      ref.current!.startVoiceCall();
      await settle();
    });
    await say('Who is APT28?');
    await act(async () => {
      stream.send({ type: 'thinking', turn_id: 't1' });
      stream.send({ type: 'done', content: 'A threat group.', turn_id: 't1', conversation_id: 'c1' });
      await settle(20);
    });
    assert.deepEqual(said, ['A threat group.']);
    await act(async () => {
      stream.close();
      await settle();
    });
  } finally {
    for (const target of [page, global]) Object.assign(target, saved);
  }
});

test('a call ended by its panel being hidden starts anew once the panel shows again', async () => {
  fakeBackend([agentsRoute]);
  const { ChatPanel } = await import('./ChatPanel.tsx');
  const ref = createRef<Handle>();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const show = (mode: 'visible' | 'hidden') =>
    act(async () => {
      root.render(
        <Activity mode={mode}>
          <ChatPanel {...BASE_PROPS} ref={ref} />
        </Activity>,
      );
      await settle(10);
    });
  try {
    await show('visible');
    await act(async () => {
      ref.current!.startVoiceCall();
      await settle();
    });
    await show('hidden');
    await show('visible');
    assert.ok(!host.querySelector('[data-testid="filigran-chat-voice-call"]'), 'the call ended with it');
    const created = FakeRecognition.created;
    let started = false;
    await act(async () => {
      started = ref.current!.startVoiceCall();
      await settle();
    });
    assert.equal(started, true);
    assert.equal(FakeRecognition.created, created + 1, 'a new call listens');
    assert.ok(host.querySelector('[data-testid="filigran-chat-voice-call"]'));
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

test('a long spoken answer asks the speech route one piece ahead, never all at once', async () => {
  const stream = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    // The route answers nothing yet: what was asked meanwhile is what is in flight.
    (req) => (req.url === '/api/chat/tts' ? new Promise<Response>(() => undefined) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ apiEndpoints: { tts: '/chat/tts' } }, ref);
  await act(async () => {
    ref.current!.startVoiceCall();
    await settle();
  });
  await say('What is APT28');
  const answer = 'APT28 is a threat group attributed to Russian military intelligence. '.repeat(6).trim();
  await act(async () => {
    stream.send({ type: 'done', content: answer, conversation_id: 'c1' });
    stream.close();
    await settle(10);
  });
  assert.equal(requests.filter((r) => r.url === '/api/chat/tts').length, 1);
  await act(async () => {
    (overlay()!.querySelector('button[aria-label="End voice call"]') as HTMLButtonElement).click();
    await settle();
  });
});

test('a host transform that throws on the answer neither hides its frame from the host nor stalls the call', async () => {
  const stream = sseStream();
  fakeBackend([
    agentsRoute,
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/tts' ? new Response(new Blob(['mp3']), { status: 200 }) : undefined),
  ]);
  const ref = createRef<Handle>();
  const frames: string[] = [];
  const original = console.error;
  console.error = () => undefined;
  try {
    await render(
      {
        apiEndpoints: { tts: '/chat/tts' },
        transformMessageText: () => {
          throw new Error('host bug');
        },
        onStreamEvent: (frame) => {
          frames.push(String(frame.type));
        },
      },
      ref,
    );
    await act(async () => {
      ref.current!.startVoiceCall();
      await settle();
    });
    await say('What is APT28');
    await act(async () => {
      stream.send({ type: 'done', content: 'A threat group.', conversation_id: 'c1' });
      stream.close();
      await settle(10);
    });
  } finally {
    console.error = original;
  }
  assert.ok(frames.includes('done'), 'the host still sees the answer');
  assert.ok(!overlay()!.textContent?.includes('Thinking'), 'the call moved on from the question');
  await act(async () => {
    (overlay()!.querySelector('button[aria-label="End voice call"]') as HTMLButtonElement).click();
    await settle();
  });
});
