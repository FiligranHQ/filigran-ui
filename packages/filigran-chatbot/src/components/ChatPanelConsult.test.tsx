/**
 * Rendering tests of the status line while the agent consults another -
 * `yarn test`: what the consulted agent does, read through every consult
 * level, how many consults run, and its elapsed time.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createRef } from 'react';

import { fakeBackend, settle, sseStream } from '../../test/dom.ts';
import { agentsRoute, finish, mountPanels, restoreRoute, text, type Handle } from '../../test/panel.tsx';

const { render } = mountPanels();

/** A frame of the consulted agent *agent*, wrapped once more for each peer of *peers* it consulted in turn. */
function consultFrame(agent: string, inner: Record<string, unknown>, peers: string[] = []): Record<string, unknown> {
  const deepest = peers.reduceRight<Record<string, unknown>>(
    (frame, peer) => ({ status: 'consult_progress', agent_id: peer, agent_name: peer, inner: frame }),
    inner,
  );
  return { type: 'status', status: 'consult_progress', agent_id: agent, agent_name: agent, inner: deepest };
}

async function consulting() {
  const stream = sseStream();
  fakeBackend([agentsRoute, restoreRoute(), (req) => (req.url === '/api/chat/messages' ? stream.response() : undefined)]);
  const ref = createRef<Handle>();
  await render({ conversationId: 'c1' }, ref);
  await act(async () => {
    void ref.current!.send('go');
    await settle();
    stream.send({ type: 'status', status: 'tool_start', tools: ['consult_agent'] });
    await settle(10);
  });
  const send = (...frames: Record<string, unknown>[]) =>
    act(async () => {
      for (const frame of frames) stream.send(frame);
      await settle(10);
    });
  return { stream, send };
}

test('the status line names the agent consulted and what it does', async () => {
  const { stream, send } = await consulting();
  await send(consultFrame('Analyst', { status: 'thinking' }));
  assert.ok(text().includes('Consulting Analyst…'), text());

  await send(consultFrame('Analyst', { status: 'tool_start', tools: ['search_iocs', 'search_iocs', 'read_report'] }));
  assert.ok(text().includes('Consulting Analyst: Search Iocs, Read Report…'), text());

  // A running tool's report and the consulted agent's reasoning leave the line as it is.
  await send(
    consultFrame('Analyst', { status: 'tool_progress', event: 'output' }),
    consultFrame('Analyst', { status: 'thinking_text', content: 'hmm' }),
  );
  assert.ok(text().includes('Consulting Analyst: Search Iocs, Read Report…'), text());

  await send(consultFrame('Analyst', { status: 'streaming' }));
  assert.ok(text().includes('Consulting Analyst: writing the answer…'), text());
  await finish(stream);
});

test('a peer the consulted agent consults in turn shows under the agent consulted, and its answer ends no consult', async () => {
  const { stream, send } = await consulting();
  await send(consultFrame('Analyst', { status: 'tool_start', tools: ['lookup_actor'] }, ['Researcher']));
  assert.ok(text().includes('Consulting Analyst: Lookup Actor…'), text());

  // The peer answers the agent consulted, while a second consult runs.
  await send(consultFrame('Writer', { status: 'thinking' }), consultFrame('Analyst', { status: 'streaming' }, ['Researcher']));
  assert.ok(text().includes('Consulting 2 agents…'), text());

  // The agent consulted answers: its consult ends, the other one shows, as it last was.
  await send(consultFrame('Writer', { status: 'tool_start', tools: ['draft_report'] }), consultFrame('Analyst', { status: 'streaming' }));
  assert.ok(text().includes('Consulting Writer: Draft Report…'), text());

  // The last one answers: it shows writing its answer.
  await send(consultFrame('Writer', { status: 'streaming' }));
  assert.ok(text().includes('Consulting Writer: writing the answer…'), text());
  await finish(stream);
});

test('a consult that has only reported a tool’s progress or its reasoning is counted', async () => {
  const { stream, send } = await consulting();
  await send(consultFrame('Analyst', { status: 'tool_start', tools: ['search_iocs'] }));
  await send(consultFrame('Writer', { status: 'tool_progress', event: 'output' }));
  assert.ok(text().includes('Consulting 2 agents…'), text());

  // Its report keeps what the other shows once it is the only one left.
  await send(consultFrame('Researcher', { status: 'thinking_text', content: 'hmm' }), consultFrame('Writer', { status: 'streaming' }));
  await send(consultFrame('Researcher', { status: 'streaming' }));
  assert.ok(text().includes('Consulting Analyst: Search Iocs…'), text());
  await finish(stream);
});

test('a consult keeps the elapsed time its heartbeats report', async () => {
  const { stream, send } = await consulting();
  await send({ type: 'status', status: 'tool_heartbeat', tools: ['consult_agent'], elapsed_s: 40 });
  assert.ok(text().includes('40s'), text());
  await send(consultFrame('Analyst', { status: 'tool_start', tools: ['search_iocs'] }, ['Researcher']));
  assert.ok(text().includes('Consulting Analyst: Search Iocs…'), text());
  assert.match(text(), /4\ds/, 'the elapsed time runs on');
  await finish(stream);
});
