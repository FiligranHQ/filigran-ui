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

/**
 * A frame of the consulted agent *agent*, wrapped once more for each peer of
 * *peers* it consulted in turn; *consultId* names the consult (none: a backend
 * that sends no id).
 */
function consultFrame(agent: string, inner: Record<string, unknown>, peers: string[] = [], consultId?: string): Record<string, unknown> {
  const deepest = peers.reduceRight<Record<string, unknown>>(
    (frame, peer) => ({ status: 'consult_progress', agent_id: peer, agent_name: peer, inner: frame }),
    inner,
  );
  return {
    type: 'status',
    status: 'consult_progress',
    agent_id: agent,
    agent_name: agent,
    ...(consultId ? { consult_id: consultId } : {}),
    inner: deepest,
  };
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
  assert.ok(text().includes('Consulting Analyst: Search Iocs (+1 more)…'), text());

  // A running tool's report and the consulted agent's reasoning leave the line as it is.
  await send(
    consultFrame('Analyst', { status: 'tool_progress', event: 'output' }),
    consultFrame('Analyst', { status: 'thinking_text', content: 'hmm' }),
  );
  assert.ok(text().includes('Consulting Analyst: Search Iocs (+1 more)…'), text());

  await send(consultFrame('Analyst', { status: 'streaming' }));
  assert.ok(text().includes('Consulting Analyst: writing the answer…'), text());

  // A late report or reasoning of the consult that answered does not bring it back.
  await send(
    consultFrame('Analyst', { status: 'thinking_text', content: 'done' }),
    consultFrame('Analyst', { status: 'tool_heartbeat', elapsed_s: 3 }),
  );
  assert.ok(text().includes('Consulting Analyst: writing the answer…'), text());
  await finish(stream);
});

test('a frame of the consulted agent with no status leaves the line as it is', async () => {
  const { stream, send } = await consulting();
  await send(consultFrame('Analyst', { status: 'tool_start', tools: ['search_iocs'] }));
  await send(consultFrame('Analyst', { type: 'agentic_action', actions: 1 }), consultFrame('Writer', { type: 'agentic_action', actions: 1 }));
  assert.ok(text().includes('Consulting 2 agents…'), text());
  await send(consultFrame('Writer', { status: 'streaming' }));
  assert.ok(text().includes('Consulting Analyst: Search Iocs…'), text());
  await finish(stream);
});

test('the consults end when the agent moves on, or its turn is replayed, however they ended', async () => {
  const { stream, send } = await consulting();
  // Two consults; the agent's next step comes with neither having answered (one failed, one was stopped).
  await send(consultFrame('Analyst', { status: 'thinking' }), consultFrame('Writer', { status: 'thinking' }));
  assert.ok(text().includes('Consulting 2 agents…'), text());
  await send({ type: 'status', status: 'tool_start', tools: ['consult_agent'] }, consultFrame('Researcher', { status: 'thinking' }));
  assert.ok(text().includes('Consulting Researcher…'), text());

  // The turn re-attached is replayed from its start: the consults it had are its replay's.
  await send(consultFrame('Writer', { status: 'thinking' }));
  assert.ok(text().includes('Consulting 2 agents…'), text());
  await send({ type: 'thinking', resumed: true, elapsed_s: 5 }, consultFrame('Writer', { status: 'thinking' }));
  assert.ok(text().includes('Consulting Writer…'), text());
  await finish(stream);
});

test('a peer the consulted agent consults in turn shows under the agent consulted, and its answer ends no consult', async () => {
  const { stream, send } = await consulting();
  // The agent consulted consults its peer: the peer's frames say what it does, not the consult tool.
  await send(consultFrame('Analyst', { status: 'tool_start', tools: ['consult_agent'] }));
  assert.ok(text().includes('Consulting Analyst…') && !text().includes('Consult Agent'), text());
  await send(consultFrame('Analyst', { status: 'tool_start', tools: ['lookup_actor'] }, ['Researcher']));
  assert.ok(text().includes('Consulting Analyst: Lookup Actor…'), text());

  // The peer writing its answer to the agent consulted: the agent consulted is not answering yet.
  await send(consultFrame('Analyst', { status: 'streaming' }, ['Researcher']));
  assert.ok(text().includes('Consulting Analyst…') && !text().includes('writing the answer'), text());

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

test('two consults of one agent are two consults, each ending on its own answer', async () => {
  const { stream, send } = await consulting();
  await send(
    consultFrame('Analyst', { status: 'tool_start', tools: ['search_iocs'] }, [], 'c-1'),
    consultFrame('Analyst', { status: 'tool_start', tools: ['read_report'] }, [], 'c-2'),
  );
  assert.ok(text().includes('Consulting Analyst: 2 questions…'), text());

  await send(consultFrame('Writer', { status: 'thinking' }, [], 'c-3'));
  assert.ok(text().includes('Consulting 2 agents…'), text());

  // One consult of the Analyst answers: the other still runs.
  await send(consultFrame('Analyst', { status: 'streaming' }, [], 'c-1'), consultFrame('Writer', { status: 'streaming' }, [], 'c-3'));
  assert.ok(text().includes('Consulting Analyst: Read Report…'), text());
  await finish(stream);
});

test('a consult frame that arrives once the agent has moved on is not shown', async () => {
  const { stream, send } = await consulting();
  await send(consultFrame('Analyst', { status: 'tool_start', tools: ['search_iocs'] }));
  assert.ok(text().includes('Consulting Analyst: Search Iocs…'), text());

  // The agent's next step: a trailing frame of the consult does not bring its line back.
  await send({ type: 'status', status: 'thinking' });
  await send(consultFrame('Analyst', { status: 'tool_start', tools: ['read_report'] }), consultFrame('Analyst', { status: 'tool_heartbeat' }));
  assert.ok(!text().includes('Consulting'), text());

  // Its next batch of tools consults again.
  await send({ type: 'status', status: 'tool_start', tools: ['consult_agent'] }, consultFrame('Writer', { status: 'thinking' }));
  assert.ok(text().includes('Consulting Writer…'), text());
  await finish(stream);
});
