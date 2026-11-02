/**
 * Rendering tests of what the status line names and how a stored reply reads -
 * `yarn test`: setup steps, compaction, saving, the analysis step, transfers,
 * mentioned agents answering (and the sends held meanwhile), the host's tool
 * names, a reply interrupted by a server restart and an empty reply.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';

import { fakeBackend, json, settle, sseStream } from '../../test/dom.ts';
import { agentsRoute, container, finish, mountPanels, restoreRoute, text, type Handle, type Props } from '../../test/panel.tsx';

const { render } = mountPanels();

/** A turn running in `c1`; *send* streams frames into it. */
async function running(props: Partial<Props> = {}) {
  const stream = sseStream();
  const requests = fakeBackend([
    agentsRoute,
    restoreRoute(),
    (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined),
    (req) => (req.url === '/api/chat/messages/steer' ? json({ status: 'steered' }) : undefined),
  ]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1', ...props }, ref);
  await act(async () => {
    void ref.current!.send('go');
    await settle();
  });
  const send = (...frames: Record<string, unknown>[]) =>
    act(async () => {
      for (const frame of frames) stream.send(frame);
      await settle(10);
    });
  return { stream, send, ref, requests };
}

const status = (name: string, fields: Record<string, unknown> = {}) => ({ type: 'status', status: name, ...fields });

test('the status line names the setup step, the compaction, the save and the analysis step', async () => {
  const { stream, send } = await running();
  const phases: [string | undefined, string][] = [
    ['history', 'Loading conversation history…'],
    ['compaction', 'Summarizing earlier conversation…'],
    ['memory', 'Recalling memory…'],
    ['integrations', 'Connecting integrations…'],
    ['tools', 'Preparing tools…'],
    ['skills', 'Preparing…'],
    [undefined, 'Preparing…'],
  ];
  for (const [phase, label] of phases) {
    await send(status('preparing', phase ? { phase } : {}));
    assert.ok(text().includes(label), `${phase}: ${text()}`);
  }
  await send(status('context_compaction', { phase: 'summarizing' }));
  assert.ok(text().includes('Compacting conversation context…'), text());

  await send(status('tool_start', { tools: ['search_iocs'] }), status('thinking', { iteration: 3 }));
  assert.ok(text().includes('Analyzing results (step 3)…'), text());
  await send(status('thinking'));
  assert.ok(text().includes('Analyzing results…') && !text().includes('(step'), text());

  await send(status('persisting'));
  assert.ok(text().includes('Saving response…'), text());
  await finish(stream);
});

test('a transfer names the agent the conversation goes to', async () => {
  const { stream, send } = await running();
  await send(status('transfer_start', { agent_id: 'a2', agent_name: 'Analyst' }));
  assert.ok(text().includes('Transferring to Analyst…'), text());
  await finish(stream);
});

test('each mentioned agent answering is named, and its name stays before the statuses of its run', async () => {
  const { stream, send } = await running();
  const answering = (name: string, position: number) => status('mention_answering', { agent_id: name, agent_name: name, position, total: 2 });
  const line = () => container.querySelector('.filigran-chat-active-border')?.textContent ?? '';

  await send(answering('Analyst', 1));
  assert.equal(line(), 'Analyst is answering…');
  await send(status('tool_start', { tools: ['search_iocs'] }));
  assert.equal(line(), 'AnalystSearch Iocs…');

  // Its answer closes; the next mentioned agent answers in a bubble of its own.
  await send({ type: 'done', content: 'APT28.', intermediate: true, answered_by: { agent_name: 'Analyst' } }, answering('Hunter', 2));
  assert.equal(line(), 'Hunter is answering…');
  await send(status('composing'));
  assert.equal(line(), 'HunterComposing answer…');
  await finish(stream);
});

test('while mentioned agents answer, a send is held for the next turn, not steered; before, it steers', async () => {
  const { stream, send, ref, requests } = await running({ holdSendsDuringTurn: true });
  const steers = () => requests.filter((r) => r.url === '/api/chat/messages/steer');

  await act(async () => {
    void ref.current!.send('also check 2024');
    await settle();
  });
  assert.equal(steers().length, 1);

  await send(status('mention_answering', { agent_id: 'a2', agent_name: 'Analyst', position: 1, total: 2 }));
  await act(async () => {
    void ref.current!.send('and the infrastructure');
    await settle();
  });
  assert.equal(steers().length, 1, 'not steered');
  assert.ok(text().includes('Sends when the answer ends:'), text());
  await finish(stream);
});

test("the host's tool names replace the raw ones in the status line", async () => {
  const { stream, send } = await running({ toolLabels: { search_iocs: 'Searching indicators' } });
  await send(status('tool_start', { tools: ['search_iocs', 'read_report'] }));
  assert.ok(text().includes('Searching indicators (+1 more)…'), text());
  await send(status('tool_start', { tools: ['consult_agent'] }));
  await send(status('consult_progress', { agent_id: 'a2', agent_name: 'Analyst', inner: status('tool_start', { tools: ['search_iocs'] }) }));
  assert.ok(text().includes('Consulting Analyst: Searching indicators…'), text());
  await finish(stream);
});

test("the host's tool names can come from a function, and a name it does not give stays title-cased", async () => {
  const { stream, send } = await running({ toolLabels: (name) => (name === 'read_report' ? 'Reading the report' : undefined) });
  await send(status('tool_start', { tools: ['read_report'] }));
  assert.ok(text().includes('Reading the report…'), text());
  await send(status('tool_start', { tools: ['search_iocs'] }));
  assert.ok(text().includes('Search Iocs…'), text());
  await finish(stream);
});

/** Open the reasoning details of the only answer; its button's label. */
async function openReasoning(): Promise<string> {
  const button = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
  await act(async () => {
    button.click();
    await settle();
  });
  return button.getAttribute('aria-label') ?? '';
}

test('the reasoning details name the tools as the host does', async () => {
  fakeBackend([
    agentsRoute,
    restoreRoute([
      {
        id: 'm1',
        role: 'assistant',
        content: 'Found it.',
        tool_call_trace: [
          { name: 'search_iocs', success: true },
          { name: 'read_report', success: true },
        ],
      },
    ]),
  ]);
  await render({ conversationId: 'c1', toolLabels: { search_iocs: 'Searching indicators' } });
  await openReasoning();
  const dialog = document.querySelector('[role="dialog"]')?.textContent ?? '';
  assert.ok(dialog.includes('Searching indicators') && dialog.includes('read report'), dialog);
});

test('a stored reply interrupted by a server restart is marked, and its details say why', async () => {
  fakeBackend([agentsRoute, restoreRoute([{ id: 'm1', role: 'assistant', content: 'I was checking', interrupted: true }])]);
  await render({ conversationId: 'c1' });
  const label = await openReasoning();
  assert.equal(label, 'Reasoning details — interrupted by a server restart');
  const dialog = document.querySelector('[role="dialog"]')?.textContent ?? '';
  assert.ok(dialog.includes('Interrupted by a server restart.'), dialog);
});

test('an empty finished reply says nothing was generated; one of markers that draw nothing keeps the ellipsis', async () => {
  fakeBackend([
    agentsRoute,
    restoreRoute([
      { id: 'm1', role: 'assistant', content: '' },
      { id: 'm2', role: 'assistant', content: '[[FILE:f9]]' },
    ]),
  ]);
  await render({ conversationId: 'c1' });
  const answers = [...container.querySelectorAll('[data-testid="filigran-chat-assistant-message"]')].map((e) => e.textContent);
  assert.deepEqual(answers, ['No response was generated. Please try again.', '...']);
});
