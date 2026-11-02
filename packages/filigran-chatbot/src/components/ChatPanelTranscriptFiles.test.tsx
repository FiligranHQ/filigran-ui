/**
 * Rendering tests of a reply's files and of following the end - `yarn test`:
 * unnamed files behind one collapsed line, the lightbox's download, the
 * reasoning window's host action, the way back to the end, and older
 * messages loaded as the reader nears the top.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';

import { fakeBackend, json, settle, sseStream } from '../../test/dom.ts';
import { agentsRoute, BASE_PROPS, container, finish, mountPanels, restoreRoute, text, type Handle } from '../../test/panel.tsx';

const { render } = mountPanels({ ...BASE_PROPS, onClose: () => undefined, onModeChange: () => undefined });

const button = (label: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label);

const click = (element: Element | undefined) =>
  act(async () => {
    (element as HTMLElement).click();
    await settle();
  });

/** An answer naming `named.csv` and carrying nine more files: eight pictures (one a working file) and a log. */
function answerWithFiles() {
  const pictures = Array.from({ length: 8 }, (_, i) => ({
    file_id: `p${i}`,
    filename: `check-${i}.png`,
    content_type: 'image/png',
    file_tag: i === 0 ? 'download_file' : 'working_file',
  }));
  return {
    id: 'm2',
    role: 'assistant',
    content: 'Here is the export. [[FILE:named]]',
    attachments: [
      { file_id: 'named', filename: 'named.csv', content_type: 'text/csv', file_tag: 'download_file' },
      ...pictures,
      { file_id: 'log', filename: 'run.log', content_type: 'text/plain', file_tag: 'working_file' },
    ],
  };
}

const restoreFiles = () => fakeBackend([agentsRoute, restoreRoute([{ id: 'm1', role: 'user', content: 'export it' }, answerWithFiles()])]);

test('unnamed files are one card each unless the host collapses them', async () => {
  restoreFiles();
  await render({ conversationId: 'c1' });
  assert.equal(button('Working files (9)'), undefined);
  assert.ok(text().includes('run.log'));
  assert.equal(container.querySelectorAll('img').length, 8, 'each picture previewed');
});

test('collapsed, unnamed files are one closed line; opened, each has its card, a picture its thumbnail, and a Show less at the end', async () => {
  restoreFiles();
  await render({ conversationId: 'c1', collapseUnnamedFiles: true });
  const toggle = button('Working files (9)')!;
  assert.ok(toggle, 'one line for the nine files no marker names');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  const list = container.querySelector(`#${CSS.escape(toggle.getAttribute('aria-controls')!)}`) as HTMLElement;
  assert.equal(list.hidden, true);
  const named = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('named.csv'));
  assert.ok(named && !list.contains(named), 'the named file keeps its card in place');
  assert.equal(container.querySelectorAll('img').length, 0, 'no picture is fetched before the list opens');

  await click(toggle);
  assert.equal(list.hidden, false);
  const rows = [...list.querySelectorAll('li')];
  assert.equal(rows.length, 9);
  assert.equal(list.querySelectorAll('img').length, 8, 'a thumbnail for each picture');
  assert.equal(list.querySelector('img')!.getAttribute('src'), '/api/chat/files/p0/download');
  assert.ok(
    rows.every((row) => row.querySelector('button')),
    'and a download card for each file',
  );
  assert.ok(rows[8].textContent!.includes('run.log'));

  await click(button('Show less'));
  assert.equal(list.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
});

test("a host's predicate picks the unnamed files to collapse", async () => {
  restoreFiles();
  await render({ conversationId: 'c1', collapseUnnamedFiles: (att) => att.fileTag === 'working_file' });
  const toggle = button('Working files (8)')!;
  assert.ok(toggle);
  assert.equal(container.querySelectorAll('img').length, 1, 'the picture it leaves out is previewed in the reply');
  await click(toggle);
  assert.equal(button('Show less')?.textContent?.trim(), 'Show less', 'from eight files');
});

test('a thumbnail with no picture to show is the picture icon, in the same box', async () => {
  restoreFiles();
  await render({ conversationId: 'c1', collapseUnnamedFiles: true });
  await click(button('Working files (9)'));
  const thumbnail = container.querySelector('li img')!;
  const box = thumbnail.parentElement!;
  await act(async () => {
    thumbnail.dispatchEvent(new Event('error'));
    await settle();
  });
  assert.equal(box.querySelector('img'), null, 'bytes that do not decode');
  assert.ok(box.querySelector('svg'));
});

test('without picture previews, a thumbnail is the picture icon and nothing is fetched', async () => {
  restoreFiles();
  await render({ conversationId: 'c1', collapseUnnamedFiles: true, disableImagePreviews: true });
  await click(button('Working files (9)'));
  assert.equal(container.querySelectorAll('img').length, 0);
  assert.equal(container.querySelectorAll('li > span > svg').length, 8);
});

test("a user's uploaded picture is downloaded from its lightbox", async () => {
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute([
      {
        id: 'm1',
        role: 'user',
        content: 'look at this',
        attachments: [{ file_id: 'up1', filename: 'shot.png', content_type: 'image/png' }],
      },
      { id: 'm2', role: 'assistant', content: 'Seen.' },
    ]),
    (req) => (req.url === '/api/chat/files/up1/download' ? new Response('png', { status: 200 }) : undefined),
  ]);
  await render({ conversationId: 'c1' });
  await click(container.querySelector('img[alt="shot.png"]')!);
  assert.ok(container.querySelector('[role="dialog"]'), 'the lightbox is open');
  await click(button('Download'));
  assert.equal(requests.filter((r) => r.url === '/api/chat/files/up1/download').length, 1);
});

test("the reasoning window holds the host's action while it shows, and drops it with the window", async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', renderReasoningAction: () => <button type="button">Play</button> }, ref);
  const send = (frame: Record<string, unknown>) =>
    act(async () => {
      stream.send(frame);
      await settle(10);
    });
  try {
    await act(async () => {
      void ref.current!.send('go');
      await settle();
    });
    assert.equal(button('Play'), undefined, 'no reasoning, no window');
    await send({ type: 'status', status: 'thinking_text', content: 'Weighing the indicators first.' });
    const play = button('Play');
    assert.ok(play?.closest('.filigran-chat-reasoning'), "in the reasoning window's corner");
    await send({ type: 'stream', content: 'The answer.' });
    assert.ok(text().includes('The answer.'));
    assert.equal(button('Play'), undefined, 'gone with the window once the answer streams');
  } finally {
    await finish(stream);
  }
});

/**
 * The transcript laid out 2000 px tall in a 400 px view, which happy-dom does
 * not lay out: an instant scroll lands at once, a smooth one where the test
 * moves it.
 */
function layOutTranscript(t: { after: (fn: () => void) => void }) {
  const proto = HTMLElement.prototype;
  const descriptors = {
    scrollTop: Object.getOwnPropertyDescriptor(proto, 'scrollTop') ?? Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop'),
    scrollHeight: Object.getOwnPropertyDescriptor(proto, 'scrollHeight') ?? Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight'),
    clientHeight: Object.getOwnPropertyDescriptor(proto, 'clientHeight') ?? Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight'),
    scrollTo: Object.getOwnPropertyDescriptor(proto, 'scrollTo') ?? Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTo'),
  };
  const isTranscript = (el: Element) => el.getAttribute('data-testid') === 'filigran-chat-transcript';
  const scrolls: ScrollToOptions[] = [];
  let top = 0;
  const clamp = (value: number) => Math.max(0, Math.min(value, 1600));
  Object.defineProperties(proto, {
    scrollTop: {
      configurable: true,
      get() {
        return isTranscript(this) ? top : descriptors.scrollTop?.get?.call(this);
      },
      set(value: number) {
        if (isTranscript(this)) top = clamp(value);
        else descriptors.scrollTop?.set?.call(this, value);
      },
    },
    scrollHeight: {
      configurable: true,
      get() {
        return isTranscript(this) ? 2000 : descriptors.scrollHeight?.get?.call(this);
      },
    },
    clientHeight: {
      configurable: true,
      get() {
        return isTranscript(this) ? 400 : descriptors.clientHeight?.get?.call(this);
      },
    },
    scrollTo: {
      configurable: true,
      writable: true,
      value(this: HTMLElement, options: ScrollToOptions) {
        if (!isTranscript(this)) return descriptors.scrollTo?.value?.call(this, options);
        scrolls.push(options);
        if (options.behavior !== 'smooth') top = clamp(options.top ?? 0);
      },
    },
  });
  t.after(() => {
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(proto, name, descriptor);
      else delete (proto as unknown as Record<string, unknown>)[name];
    }
  });
  const transcript = () => container.querySelector('[data-testid="filigran-chat-transcript"]') as HTMLElement;
  return {
    scrolls,
    /** The view moves to *to*, and the transcript hears of it. */
    scrollTo: (to: number) =>
      act(async () => {
        top = clamp(to);
        transcript().dispatchEvent(new Event('scroll'));
        await settle();
      }),
  };
}

function olderHistoryBackend() {
  return fakeBackend([
    agentsRoute,
    restoreRoute(
      [
        { id: 'm2', role: 'user', content: 'the question' },
        { id: 'm3', role: 'assistant', content: 'newest answer' },
      ],
      { has_more: true },
    ),
    (req) =>
      req.url.startsWith('/api/chat/sessions/c1/messages?')
        ? json({ messages: [{ id: 'm1', role: 'user', content: 'the first question' }], has_more: false })
        : undefined,
  ]);
}
const olderPages = (requests: { url: string }[]) => requests.filter((r) => r.url.startsWith('/api/chat/sessions/c1/messages?')).length;

test('a reader who scrolled up gets a way back to the end, which follows again', async (t) => {
  const view = layOutTranscript(t);
  olderHistoryBackend();
  await render({ conversationId: 'c1', apiEndpoints: { messagesPage: '/chat/sessions' } });
  await view.scrollTo(1600);
  assert.equal(button('Scroll to bottom'), undefined, 'at the end, following');
  await view.scrollTo(900);
  const back = button('Scroll to bottom');
  assert.ok(back);
  view.scrolls.length = 0;
  await click(back);
  assert.deepEqual(view.scrolls, [{ top: 2000, behavior: 'smooth' }]);
  assert.equal(button('Scroll to bottom'), undefined, 'following again');
});

test('older messages load as the reader nears the top, never while the view follows the end, and the button says so meanwhile', async (t) => {
  const view = layOutTranscript(t);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(
      [
        { id: 'm2', role: 'user', content: 'the question' },
        { id: 'm3', role: 'assistant', content: 'newest answer' },
      ],
      { has_more: true },
    ),
    async (req) => {
      if (!req.url.startsWith('/api/chat/sessions/c1/messages?')) return undefined;
      await held;
      return json({ messages: [{ id: 'm1', role: 'user', content: 'the first question' }], has_more: false });
    },
  ]);
  await render({ conversationId: 'c1', apiEndpoints: { messagesPage: '/chat/sessions' } });
  // The conversation just opened scrolls down from its top.
  await view.scrollTo(50);
  assert.equal(olderPages(requests), 0, 'the view follows the end');
  await view.scrollTo(1600);
  await view.scrollTo(100);
  assert.equal(olderPages(requests), 1);
  const loading = button('Loading earlier messages…') as HTMLButtonElement;
  assert.ok(loading?.disabled, 'labelled and disabled while it loads');
  await act(async () => {
    release();
    await settle();
  });
  assert.ok(text().includes('the first question'));
});

test('older messages are asked for at most once a cooldown', async (t) => {
  const view = layOutTranscript(t);
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute([{ id: 'm3', role: 'assistant', content: 'newest answer' }], { has_more: true }),
    (req) => {
      if (!req.url.startsWith('/api/chat/sessions/c1/messages?')) return undefined;
      const page = olderPages(requests);
      return json({ messages: [{ id: `old${page}`, role: 'user', content: `older ${page}` }], has_more: true });
    },
  ]);
  await render({ conversationId: 'c1', apiEndpoints: { messagesPage: '/chat/sessions' } });
  await view.scrollTo(1600);
  await view.scrollTo(100);
  await view.scrollTo(1600);
  await view.scrollTo(100);
  assert.equal(olderPages(requests), 1);
});

test('nearing the top asks nothing of a host that offers no older messages', async (t) => {
  const view = layOutTranscript(t);
  const requests = olderHistoryBackend();
  await render({ conversationId: 'c1' });
  await view.scrollTo(1600);
  await view.scrollTo(100);
  assert.equal(olderPages(requests), 0);
  assert.equal(button('Load earlier messages'), undefined);
});
