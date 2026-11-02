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
const notice = () => container.querySelector('[data-testid="filigran-chat-composer-notice"]')?.textContent ?? null;
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
    assert.notEqual(document.activeElement, textarea(), 'opening the panel takes no focus');
    await act(async () => {
      ref.current!.setDraft('hello');
      await settle();
    });
    await act(async () => {
      sendButton().click();
      await settle(10);
    });
    assert.equal(document.activeElement, textarea(), 'after a send');
  } finally {
    await finish(...streams);
  }
  textarea().blur();
  await act(async () => {
    ref.current!.selectConversation('c1');
    await settle(10);
  });
  assert.equal(document.activeElement, textarea(), 'after a switch');
  // The host's own field keeps the focus through a switch.
  const hostField = document.createElement('input');
  document.body.appendChild(hostField);
  try {
    hostField.focus();
    await act(async () => {
      ref.current!.newConversation();
      await settle(10);
    });
    assert.equal(document.activeElement, hostField);
  } finally {
    hostField.remove();
  }
});
