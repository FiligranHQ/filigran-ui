/**
 * Rendering tests of the composer's files, placeholder and focus - `yarn
 * test`: limits that say which file they refused and why, a failed upload
 * that says why and holds the message back, the picker's types, the
 * placeholder, the files `onBeforeSend` is told of, and where the focus goes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';

import { fakeBackend, json, settle, sseStream, type RecordedRequest } from '../../test/dom.ts';
import { agentsRoute, container, finish, mountPanels, restoreRoute, text, type Handle } from '../../test/panel.tsx';
import type { ChatFileRefusal, ChatSendDraft } from '../types.ts';

const { render } = mountPanels();

let uploads = 0;
const uploadRoute = (req: RecordedRequest) => (req.url === '/api/chat/upload' ? json({ file_ids: [`f${++uploads}`] }) : undefined);
const messages = (requests: RecordedRequest[]) => requests.filter((r) => r.url === '/api/chat/messages');

const attach = (...files: File[]) =>
  act(async () => {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(10);
  });
const sized = (name: string, size: number, type = 'application/pdf') => new File([new Uint8Array(size)], name, { type });
const notice = () => container.querySelector('[data-testid="filigran-chat-file-notice"]')?.textContent ?? null;
const steerNotice = () => container.querySelector('[data-testid="filigran-chat-composer-notice"]')?.textContent ?? null;
const chips = () => [...container.querySelectorAll('[data-testid="filigran-chat-composer"] .rounded-full')].map((e) => e.textContent ?? '');
const textarea = () => container.querySelector<HTMLTextAreaElement>('textarea')!;
const sendButton = () => container.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!;

test('a file over maxFileSize is refused, named, and told to the host; a smaller one attaches past that size in total', async () => {
  fakeBackend([agentsRoute, restoreRoute(), uploadRoute]);
  const refused: [string, ChatFileRefusal][] = [];
  await render({ conversationId: 'c1', maxFileSize: 1024, onFileRefused: (file, reason) => refused.push([file.name, reason]) });
  await attach(sized('a.pdf', 800), sized('huge.iso', 2048), sized('b.pdf', 800));
  assert.equal(notice(), 'huge.iso was not attached: a file may be at most 1 KB.');
  assert.deepEqual(refused, [['huge.iso', 'file-size']]);
  assert.equal(chips().length, 2, 'the two under the limit, 1.6 KB together');
  // The next attach that refuses nothing takes the notice away.
  await attach(sized('c.pdf', 10));
  assert.equal(notice(), null);
});

test('a file past maxFileCount or maxTotalSize is refused with why, never dropped without a word', async () => {
  fakeBackend([agentsRoute, restoreRoute(), uploadRoute]);
  const refused: [string, ChatFileRefusal][] = [];
  await render({ conversationId: 'c1', maxFileCount: 2, maxTotalSize: 1000, onFileRefused: (file, reason) => refused.push([file.name, reason]) });
  await attach(sized('a.pdf', 600), sized('b.pdf', 600), sized('c.pdf', 100), sized('d.pdf', 100));
  assert.deepEqual(refused, [
    ['b.pdf', 'total-size'],
    ['d.pdf', 'file-count'],
  ]);
  assert.ok(notice()!.includes('b.pdf was not attached: the files of a message may add up to at most 1000 B.'));
  assert.ok(notice()!.includes('d.pdf was not attached: a message holds at most 2 files.'));
  assert.equal(chips().length, 2);
});

test('maxTotalSize: Infinity puts no cap on the total, only maxFileSize on each file', async () => {
  fakeBackend([agentsRoute, restoreRoute(), uploadRoute]);
  const refused: [string, ChatFileRefusal][] = [];
  const mb = 1024 * 1024;
  await render({
    conversationId: 'c1',
    maxFileSize: 40 * mb,
    maxTotalSize: Number.POSITIVE_INFINITY,
    onFileRefused: (file, reason) => refused.push([file.name, reason]),
  });
  // Sizes stated, not allocated: 90 MB together, past the 50 MB default total.
  const claimed = (name: string, size: number) => Object.defineProperty(sized(name, 1), 'size', { value: size });
  await attach(claimed('a.pdf', 30 * mb), claimed('b.pdf', 30 * mb), claimed('c.pdf', 30 * mb), claimed('d.pdf', 41 * mb));
  assert.deepEqual(refused, [['d.pdf', 'file-size']]);
  assert.equal(chips().length, 3);
});

test('a maxTotalSize that is not a positive number keeps the 50 MB default', async () => {
  fakeBackend([agentsRoute, restoreRoute(), uploadRoute]);
  const refused: [string, ChatFileRefusal][] = [];
  await render({ conversationId: 'c1', maxTotalSize: Number.NaN, onFileRefused: (file, reason) => refused.push([file.name, reason]) });
  const claimed = (name: string, size: number) => Object.defineProperty(sized(name, 1), 'size', { value: size });
  await attach(claimed('a.pdf', 30 * 1024 * 1024), claimed('b.pdf', 30 * 1024 * 1024));
  assert.deepEqual(refused, [['b.pdf', 'total-size']]);
});

test("a new chat's draft is gone once it is sent, not left as the next new chat's", async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({}, ref);
  await act(async () => ref.current!.setDraft('the question'));
  await act(async () => {
    window.dispatchEvent(new window.Event('pagehide'));
  });
  assert.equal(sessionStorage.getItem('filigranChatDraft:new'), 'the question', 'the draft as the page left it');
  await act(async () => {
    sendButton().click();
    await settle();
  });
  assert.equal(sessionStorage.getItem('filigranChatDraft:new'), null);
  await finish(stream);
});

test('acceptFileTypes filters the picker and refuses a file of another type', async () => {
  const requests = fakeBackend([agentsRoute, restoreRoute(), uploadRoute]);
  const refused: [string, ChatFileRefusal][] = [];
  await render({ conversationId: 'c1', acceptFileTypes: '.pdf,image/*', onFileRefused: (file, reason) => refused.push([file.name, reason]) });
  assert.equal(container.querySelector('input[type="file"]')!.getAttribute('accept'), '.pdf,image/*');
  await attach(sized('run.exe', 10, 'application/x-msdownload'), sized('shot.png', 10, 'image/png'));
  assert.deepEqual(refused, [['run.exe', 'file-type']]);
  assert.equal(notice(), 'run.exe was not attached: this type of file is not accepted.');
  assert.equal(requests.filter((r) => r.url === '/api/chat/upload').length, 1);
});

test('with no limits of its own, the picker takes any type and any file under the total', async () => {
  fakeBackend([agentsRoute, restoreRoute(), uploadRoute]);
  await render({ conversationId: 'c1' });
  assert.equal(container.querySelector('input[type="file"]')!.hasAttribute('accept'), false);
  await attach(sized('run.exe', 4096, 'application/x-msdownload'));
  assert.equal(notice(), null);
  assert.equal(chips().length, 1);
});

test("a failed upload's chip says why, and the message is not sent until the file is removed", async () => {
  const stream = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/upload' ? json({ detail: 'The file is over the 5 MB limit.' }, 413) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  await attach(sized('report.pdf', 10));
  assert.equal(container.querySelector('[data-testid="filigran-chat-upload-error"]')?.textContent, '✕The file is over the 5 MB limit.');
  await act(async () => {
    ref.current!.setDraft('read this');
    await settle();
  });
  assert.equal(sendButton().disabled, true, 'no turn runs, and Send is off');
  assert.ok(text().includes('A file failed to upload: remove it to send the message'));
  await act(async () => {
    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle(10);
  });
  assert.equal(messages(requests).length, 0, 'Enter sends nothing either');
  await act(async () => {
    container.querySelector('[data-testid="filigran-chat-upload-error"]')!.parentElement!.querySelector('button')!.click();
    await settle();
  });
  await act(async () => {
    sendButton().click();
    await settle(10);
  });
  assert.equal(messages(requests).length, 1, 'sent once the file is removed');
  await finish(stream);
});

test('a file attached before the host turns attaching off stays shown and removable', async () => {
  const stream = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/upload' ? json({ detail: 'The file is over the 5 MB limit.' }, 413) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  await attach(sized('report.pdf', 10));
  await render({ conversationId: 'c1', disableFileManagement: true }, ref);
  assert.equal(container.querySelector('input[type="file"]'), null, 'nothing more can be attached');
  const failed = container.querySelector('[data-testid="filigran-chat-upload-error"]');
  assert.ok(failed, 'the failed file is still shown, with why');
  await act(async () => {
    ref.current!.setDraft('read this');
    await settle();
  });
  assert.equal(sendButton().disabled, true, 'the failed file still holds the message, visibly');
  await act(async () => {
    failed.parentElement!.querySelector('button')!.click();
    await settle();
  });
  await act(async () => {
    sendButton().click();
    await settle(10);
  });
  assert.equal(messages(requests).length, 1, 'sent once the file is removed');
  await finish(stream);
});

test('a failed upload whose backend gave no reason says it failed', async () => {
  fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/upload' ? new Response('Bad gateway', { status: 502 }) : undefined)]);
  await render({ conversationId: 'c1' });
  await attach(sized('report.pdf', 10));
  assert.equal(container.querySelector('[data-testid="filigran-chat-upload-error"]')?.textContent, '✕Upload failed');
});

test('onBeforeSend is told how many files the message carries', async () => {
  const streams = [sseStream(), sseStream()];
  let turns = 0;
  fakeBackend([agentsRoute, restoreRoute(), uploadRoute, (req) => (req.url === '/api/chat/messages' ? streams[turns++].response() : undefined)]);
  const drafts: ChatSendDraft[] = [];
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', onBeforeSend: (draft) => void drafts.push(draft) }, ref);
  await attach(sized('a.pdf', 10), sized('b.pdf', 10));
  await act(async () => {
    ref.current!.setDraft('two files');
    await settle();
  });
  await act(async () => {
    sendButton().click();
    await settle(10);
  });
  await act(async () => {
    streams[0].send({ type: 'done', content: 'Read', conversation_id: 'c1' });
    streams[0].close();
    await settle(10);
  });
  await act(async () => {
    void ref.current!.send('none');
    await settle(10);
  });
  assert.deepEqual(
    drafts.map((d) => [d.text, d.source, d.fileCount]),
    [
      ['two files', 'composer', 2],
      ['none', 'host', 0],
    ],
  );
  await finish(...streams);
});

test('the placeholder is the host’s text, or the one it gives for the agent selected', async () => {
  fakeBackend([agentsRoute, restoreRoute()]);
  await render({ conversationId: 'c1' });
  assert.equal(textarea().placeholder, 'Ask a question...');
  await render({ conversationId: 'c1', placeholder: 'Ask anything, @ to mention' });
  assert.equal(textarea().placeholder, 'Ask anything, @ to mention');
  await render({ conversationId: 'c1', placeholder: (agent) => `Ask ${agent?.name ?? 'the assistant'}` });
  assert.equal(textarea().placeholder, 'Ask Hunter');
});

test('a send from the composer, and a conversation switched to, focus the field; focus elsewhere in the page stays', async () => {
  const streams = [sseStream()];
  fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? streams[0].response() : undefined)]);
  const ref = createRef<Handle>();
  await render({}, ref);
  try {
    assert.ok(document.activeElement !== textarea(), 'opening the panel takes no focus');
    await act(async () => {
      ref.current!.setDraft('hello');
      await settle();
    });
    await act(async () => {
      sendButton().click();
      await settle(10);
    });
    assert.ok(document.activeElement === textarea(), 'after a send');
  } finally {
    await finish(...streams);
  }
  textarea().blur();
  await act(async () => {
    ref.current!.selectConversation('c1');
    await settle(10);
  });
  assert.ok(document.activeElement === textarea(), 'after a switch');
  // The host's own field keeps the focus through a switch.
  const hostField = document.createElement('input');
  document.body.appendChild(hostField);
  try {
    hostField.focus();
    await act(async () => {
      ref.current!.newConversation();
      await settle(10);
    });
    assert.ok(document.activeElement === hostField);
  } finally {
    hostField.remove();
  }
});

test('a refusal has its own notice: it leaves the unanswered-steer one alone, and outlives the turn it was shown in', async () => {
  const streams = [sseStream(), sseStream()];
  let next = 0;
  fakeBackend([
    agentsRoute,
    restoreRoute(),
    uploadRoute,
    (req) => (req.url === '/api/chat/messages' ? streams[next++].response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ status: 'stored', turn_id: null, answered: false }) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', maxFileSize: 100 }, ref);
  try {
    await act(async () => {
      void ref.current!.send('first');
      await settle();
      streams[0].send({ type: 'stream', content: 'Working' });
      await settle(10);
    });
    await act(async () => {
      void ref.current!.send('one more thing');
      await settle(10);
    });
    const unanswered = 'This message will be read with your next one.';
    assert.equal(steerNotice(), unanswered);
    await attach(sized('huge.iso', 200));
    assert.equal(notice(), 'huge.iso was not attached: a file may be at most 100 B.');
    assert.equal(steerNotice(), unanswered, 'the refusal does not overwrite it');
    await act(async () => {
      streams[0].send({ type: 'done', content: 'Working, done' });
      streams[0].close();
      await settle(10);
    });
    assert.equal(notice(), 'huge.iso was not attached: a file may be at most 100 B.', 'past the turn’s end');
    await attach(sized('ok.pdf', 10));
    assert.equal(notice(), null, 'the next attach that refuses nothing clears it');
    assert.equal(steerNotice(), unanswered, 'and leaves the steer notice');
    await act(async () => {
      void ref.current!.send('next');
      await settle(10);
    });
    assert.equal(steerNotice(), null, 'until the next send');
  } finally {
    await finish(...streams);
  }
});

test("the handle's send leaves the refusal shown; a send from the composer clears it", async () => {
  const streams = [sseStream(), sseStream()];
  let next = 0;
  fakeBackend([agentsRoute, restoreRoute(), uploadRoute, (req) => (req.url === '/api/chat/messages' ? streams[next++].response() : undefined)]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', maxFileSize: 100 }, ref);
  try {
    await attach(sized('huge.iso', 200));
    const refusal = 'huge.iso was not attached: a file may be at most 100 B.';
    assert.equal(notice(), refusal);
    await act(async () => {
      void ref.current!.send('from the host');
      await settle();
      streams[0].send({ type: 'done', content: 'Done', conversation_id: 'c1' });
      streams[0].close();
      await settle(10);
    });
    assert.equal(notice(), refusal);
    await act(async () => {
      ref.current!.setDraft('from the composer');
      await settle();
    });
    await act(async () => {
      sendButton().click();
      await settle(10);
    });
    assert.equal(notice(), null);
  } finally {
    await finish(...streams);
  }
});

test('focus in a field, a dialog or an editable element of the panel stays through a conversation switch', async () => {
  fakeBackend([agentsRoute, restoreRoute()]);
  const ref = createRef<Handle>();
  await render({}, ref);
  const panel = container.querySelector<HTMLElement>('.filigran-chatbot')!;
  const field = document.createElement('input');
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  const dialogButton = document.createElement('button');
  dialog.appendChild(dialogButton);
  const editable = document.createElement('div');
  editable.contentEditable = 'true';
  editable.tabIndex = 0;
  for (const [held, label] of [
    [field, 'a field'],
    [dialogButton, 'a dialog'],
    [editable, 'an editable element'],
  ] as const) {
    const host = held === dialogButton ? dialog : held;
    panel.appendChild(host);
    try {
      held.focus();
      assert.ok(document.activeElement === held, label);
      await act(async () => {
        ref.current!.newConversation();
        await settle(10);
      });
      assert.ok(document.activeElement === held, `${label} keeps the focus`);
    } finally {
      host.remove();
    }
  }
});

test('a placeholder function runs once per agent, not on each streamed delta', async () => {
  const stream = sseStream();
  fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  let calls = 0;
  const placeholder = (agent: { name: string } | null) => {
    calls += 1;
    return `Ask ${agent?.name ?? 'the assistant'}`;
  };
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', placeholder }, ref);
  try {
    const before = calls;
    await act(async () => {
      void ref.current!.send('hello');
      await settle();
      for (let i = 0; i < 5; i += 1) {
        stream.send({ type: 'stream', content: `part ${i} ` });
        await settle(2);
      }
    });
    assert.equal(textarea().placeholder, 'Ask Hunter');
    assert.equal(calls, before);
  } finally {
    await finish(stream);
  }
});
