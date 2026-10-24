import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * A dev-only stand-in for the XTM One REST chat API, so `yarn dev` gives you a
 * working panel with nothing else running.
 *
 * It implements the contract documented in the package README — agents,
 * sessions (restore / list / delete), streaming messages, uploads, file
 * downloads and the `@` conversation references — under `/api/xtmone`, and
 * XTM One's web-chat routes under `/api/xtmone-web`. Set
 * `CHAT_API_PROXY=http://host:port` to talk to a real backend instead; the
 * plugin then stays out of the way.
 *
 * The canned answer is deliberately hostile: it carries every markdown shape
 * that has broken the renderer at some point (multi-line image alt text, a
 * fence with no info string, a table whose delimiter row is a column short, a
 * `javascript:` link, a markdown block containing its own fences). Ask for
 * "json" to get a bare-JSON reply, "long" for a thread long enough to exercise
 * the render window, "slow" for a turn that stalls into the waiting game,
 * "wait" for an announced pause that "Continue now" ends early, or "fail" for
 * a turn that ends with a provisional error and then the stored end, as XTM
 * One's does.
 */

const PATH_PREFIX = '/api/xtmone';
/**
 * The same API as XTM One's own web chat serves it (`/api/v1/web`): turns
 * outlive their stream, the conversation has an event stream, and Stop, "Continue
 * now", older pages, clear-all and read-aloud have routes of their own.
 */
const NATIVE_PREFIX = '/api/xtmone-web';
/** How many messages a web restore returns; older ones are paged. */
const RESTORE_WINDOW = 50;
/** The most messages one page of older ones holds, as the backend caps it. */
const MAX_MESSAGE_PAGE_SIZE = 500;
/**
 * How long an event stream lives before the mock ends it: a backend may end
 * the stream at any time, and the panel reopens it, the snapshot resyncing it.
 * Short, so a dev session sees it happen.
 */
const EVENTS_LIFETIME_MS = 2 * 60 * 1000;

/** A 160×100 bar chart in the accent colour — stands in for a code-interpreter
 *  plot, and is obviously *there* when an image preview renders correctly. */
const SAMPLE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAKAAAABkCAIAAACO1KzYAAABd0lEQVR4nO3RMW5CQRBEQQ7KTXxBYu5C4sROHVkI8Zn+PSW9eNS7dXk8vlXcZXyBDg1weYDLA1we4PIAlwe4PMDlAS4PcHmAywNcHuDyAJcHuDzA5QEuD3B5gMsDXB7g8gCXB7g8wOUBLm878Nf154XGZz8fYMDVAS4PcHmAywNcHuDyAJcHuDzA5QEuD3B5gMsLB35t3t+FgAFXB7g8wOUBLg9weYDLA1we4OF9mT8YPg8w4Jh9mT8YPg8w4Jh9mT8YPg/wUcBvfy9gwIABp30fYMCAAQMGDBgw4M8ChxwMnwcYMOAzzwMMGPCZ5wEGDPjM8wADBnzmef8Bp+3LPBg+D/Ci9wKevwY47mD4PMCL3gt4/hrguIPh8wAvei/g+WuA4w6GzwO86L2A568BjjsYPg/wovcCnr8GOO5g+DzAi94LeP4a4LiD4fMAL3ov4PlrgOMOhs8DvOi9gOevAY47GD4P8KL3Ap6/dizw7XZXcYDLA1zeLwIf164Bx0MfAAAAAElFTkSuQmCC';
const SAMPLE_PNG_URI = `data:image/png;base64,${SAMPLE_PNG}`;

// Deliberately more than a handful: the header's agent picker only shows its
// search field once the list is long enough to be worth scanning.
const AGENTS = [
  { id: 'a1', name: 'General Assistant', slug: 'general', icon: null, description: 'Answers anything' },
  { id: 'a2', name: 'Threat Analyst', slug: 'threat', icon: null, description: 'CTI specialist' },
  { id: 'a3', name: 'Detection Engineer', slug: 'detection', icon: null, description: 'Writes and reviews detection rules' },
  { id: 'a4', name: 'Incident Responder', slug: 'ir', icon: null, description: 'Triages and contains incidents' },
  { id: 'a5', name: 'Malware Reverser', slug: 'malware', icon: null, description: 'Static and dynamic analysis' },
  { id: 'a6', name: 'Report Writer', slug: 'reporting', icon: null, description: 'Drafts intelligence reports' },
  { id: 'a7', name: 'Phishing Triage', slug: 'phishing', icon: null, description: 'Reviews reported emails' },
  { id: 'a8', name: 'Exposure Manager', slug: 'exposure', icon: null, description: 'Tracks attack surface findings' },
];

const KITCHEN_SINK = `Here is a **feature sweep** of the markdown pipeline.

An inline image whose alt text the model spread over several lines:

![a chart of quarterly
detection coverage, rendered
by the code interpreter](${SAMPLE_PNG_URI})

A fenced block with *no* info string — this used to collapse into inline code:

\`\`\`
def hello(name):
    return f"hi {name}"
\`\`\`

The same thing, tagged:

\`\`\`python
sum([1, 2, 3])
\`\`\`

A table whose delimiter row is one column short (models miscount constantly):

| Tool | Status | Duration |
|---|---|
| search_entities | ok | 1.2s |
| fetch_report | failed | 0.3s |

A blocked link: [do not click](javascript:alert(1)) — and a real one:
[the docs](https://docs.filigran.io).

> A blockquote, with \`inline code\`, **bold** and _italic_.

- first bullet
- second bullet
  - nested bullet

1. ordered one
2. ordered two

---

A soft line break follows this line
and this line must stay on its own.
`;

const BARE_JSON = JSON.stringify(
  { verdict: 'the whole message is raw JSON', nested: { scores: [1, 2, 3] }, note: 'it should render as a fenced json block' },
  null,
  2,
);

const NESTED_FENCES = `Here is a prompt template. Its own fences must not shatter the block:

\`\`\`markdown
# Report template

Summarise the findings below.

\`\`\`json
{ "severity": "high" }
\`\`\`

End of template.
\`\`\`

And this trailing prose must survive.
`;

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  /**
   * `meta` is whatever the turn's `done` frame carried (tool names, reasoning,
   * trace, attachments, context figures). Stored so a restore can re-surface
   * it exactly as the real backend does — see the note at the `done` frame.
   * `id` and `createdAt` come back on a restore as `id` / `created_at`, and so
   * does the user's rating of an answer (`feedback`).
   */
  messages: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
    meta?: Record<string, unknown>;
    feedback?: { rating: 'positive' | 'negative'; comment: string | null };
  }[];
  /** Context tokens the next turn would carry — drives the composer gauge. */
  contextTokens: number;
}

/**
 * Plausible composition of a context of *total* tokens, for the gauge's detail
 * popover. Buckets sum to `total` exactly — the popover shows both the lines and
 * the headline, so a breakdown that does not add up reads as a bug in the
 * numbers. The `summary` line only appears past the compaction gate, which is
 * where a real backend would first have a digest to show.
 */
function mockContextBreakdown(total: number): Record<string, number> {
  // Fixed overheads first: the persona and the tool schemas do not grow with
  // the thread, which is exactly what makes them worth showing separately.
  const system = Math.min(6_000, total);
  const tools = Math.min(14_000, total - system);
  const dynamicTools = Math.min(9_000, total - system - tools);
  const rest = total - system - tools - dynamicTools;
  const toolResults = Math.round(rest * 0.45);
  const summary = total >= CONTEXT_WINDOW * 0.8 ? Math.round(rest * 0.18) : 0;
  return {
    system,
    tools,
    dynamic_tools: dynamicTools,
    conversation: rest - toolResults - summary,
    tool_results: toolResults,
    ...(summary ? { summary } : {}),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

function openSse(res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

/** Half a second of a soft tone, as a WAV: what the mock reads every answer aloud with. */
function toneWav(): Buffer {
  const rate = 8000;
  const samples = rate / 2;
  const buf = Buffer.alloc(44 + samples);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples, 40);
  for (let i = 0; i < samples; i++) buf[44 + i] = 128 + Math.round(30 * Math.sin((2 * Math.PI * 440 * i) / rate));
  return buf;
}

function json(res: ServerResponse, payload: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

/** Pick the scripted answer from what the user typed. */
function scriptFor(prompt: string): { text: string; stall: boolean; history: number; fail?: boolean } {
  const p = prompt.toLowerCase();
  if (p.includes('json')) return { text: BARE_JSON, stall: false, history: 0 };
  if (p.includes('fence') || p.includes('nested')) return { text: NESTED_FENCES, stall: false, history: 0 };
  if (p.includes('slow')) return { text: 'That took a while — the waiting game should have appeared.', stall: true, history: 0 };
  if (p.includes('fail')) return { text: 'I encountered an error: the mock was asked to fail.', stall: false, history: 0, fail: true };
  if (p.includes('long')) return { text: KITCHEN_SINK, stall: false, history: 200 };
  return { text: KITCHEN_SINK, stall: false, history: 0 };
}

const PROMPTS = [
  { id: 'p1', title: 'Summarise an incident', content: 'Summarise the following incident for a non-technical reader:\n\n', description: 'Plain-language write-up' },
  { id: 'p2', title: 'Draft detection rule', content: 'Write a Sigma rule detecting the behaviour described below:\n\n', description: 'Sigma, with a short rationale' },
  { id: 'p3', title: 'Enrich an indicator', content: 'Enrich this indicator with everything the connected platforms know:\n\n' },
  { id: 'p4', title: 'Compare two campaigns', content: 'Compare these two campaigns on TTPs, infrastructure and victimology:\n\n' },
  { id: 'p5', title: 'Triage a phishing email', content: 'Triage the reported email below and recommend an action:\n\n' },
  { id: 'p6', title: 'Explain an attack path', content: 'Explain this attack path step by step, then propose mitigations:\n\n' },
];

/** Suggested opening actions, keyed by agent slug with a generic fallback. */
const SUGGESTIONS: Record<string, string[]> = {
  default: ['Summarise my recent findings', 'What changed since yesterday?', 'Help me get started'],
  general: ['Summarise my recent findings', 'What changed since yesterday?', 'Help me get started'],
  threat: ['Profile a threat actor', 'What are the latest attack patterns?', 'Correlate these indicators'],
  detection: ['Review this detection rule', 'Where are my coverage gaps?', 'Convert this rule to Sigma'],
  ir: ['Triage this alert', 'Draft an incident timeline', 'What should I contain first?'],
  malware: ['Analyse this sample', 'Extract indicators from this binary', 'Explain this obfuscation'],
  reporting: ['Draft an intelligence report', 'Summarise this campaign for an exec', 'Build a briefing outline'],
  phishing: ['Triage this reported email', 'Is this sender spoofed?', 'Draft a user response'],
  exposure: ['What is newly exposed?', 'Prioritise my attack surface', 'Which assets need patching?'],
};

const QUOTA_LIMIT = 500;

/**
 * A conversation shared with the tester, so the `@` menu shows its "Shared
 * with you" hint, and its chip - not in the tester's own history - stays a
 * plain label.
 */
const SHARED_CONVERSATION = { id: 'shared-1', title: 'Weekly threat brief', updatedAt: '2026-09-28T09:00:00Z' };

/** The `@key` of a title - the XTM One rule, ASCII only: a slug, cut at 48. */
function referenceKey(title: string, id: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return slug || `conversation-${id.slice(0, 6)}`;
}

// Context gauge: a 200k window filled 21 % per turn, so five turns land on
// 21 / 42 / 63 / 84 / 100 % — deliberately stepped to hit every band the
// indicator has, including the amber one between 80 % and 95 % (where the real
// backend starts summarising older turns) that a coarser step jumps straight
// over.
const CONTEXT_WINDOW = 200_000;
const CONTEXT_PER_TURN = 42_000;

export function mockChatApi(): Plugin {
  const conversations = new Map<string, Conversation>();
  let seq = 0;
  // Start close to the amber threshold so the indicator is worth looking at.
  let quotaUsed = 360;


  // ---- the web chat's turns, which belong to the conversation ----
  interface ActiveTurn {
    id: string;
    convId: string;
    /** The panel that started it: never relayed back to it. */
    origin?: string;
    startedAt: number;
    cancelled: boolean;
    /** Ends the wait in progress early. */
    skip: () => void;
    /**
     * What a panel attaching mid-turn is replayed: the segment being written,
     * as XTM One's journal keeps it (an intermediate `done` starts it over).
     */
    journal: { status?: Record<string, unknown>; thinking: string; text: string };
    /** The message streams following it; `null` ends them. */
    followers: Set<(frame: Record<string, unknown> | null) => void>;
  }
  const activeTurns = new Map<string, ActiveTurn>();
  // As XTM One: a Stop saying it awaits a send (`awaiting_send`) that finds no
  // turn is kept, by the panel's client id, for the turn that send starts.
  const keptStops = new Map<string, number>();
  const KEPT_STOP_MS = 30000;
  const listeners = new Map<string, Set<{ clientId?: string; send: (frame: Record<string, unknown>) => void }>>();

  function broadcast(convId: string, frame: Record<string, unknown>, exceptClient?: string) {
    for (const listener of listeners.get(convId) ?? []) {
      if (!exceptClient || listener.clientId !== exceptClient) listener.send(frame);
    }
  }

  /** Run a turn detached from any stream: it goes on, and is stored, whoever is watching. */
  function startTurn(conv: Conversation, prompt: string, origin?: string): ActiveTurn {
    const turn: ActiveTurn = {
      id: `turn-${++seq}`,
      convId: conv.id,
      origin,
      startedAt: Date.now(),
      cancelled: false,
      skip: () => undefined,
      journal: { thinking: '', text: '' },
      followers: new Set(),
    };
    activeTurns.set(conv.id, turn);
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        turn.skip = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    void (async () => {
      for await (const raw of turnFrames(conv, prompt, { cancelled: () => turn.cancelled, wait })) {
        const frame: Record<string, unknown> = { ...raw, turn_id: turn.id };
        if (frame.type === 'stream') turn.journal.text += String(frame.content ?? '');
        else if (frame.type === 'status' && frame.status === 'thinking_text') turn.journal.thinking += String(frame.content ?? '');
        else if (frame.type === 'status') {
          turn.journal.status = frame;
          // As XTM One's journal: a new iteration or a retracted answer
          // starts the answer over, a transfer the reasoning.
          if (frame.status === 'thinking' || frame.status === 'stream_retract') turn.journal.text = '';
          else if (frame.status === 'transfer_start') turn.journal.thinking = '';
        } else if (frame.type === 'done' && frame.intermediate === true) {
          // A closed segment is stored: a replay brings back the next one only.
          turn.journal.text = '';
          turn.journal.thinking = '';
        }
        for (const follow of turn.followers) follow(frame);
        broadcast(conv.id, { ...frame, relayed: true }, origin);
      }
      activeTurns.delete(conv.id);
      for (const follow of turn.followers) follow(null);
      if (conv.messages.filter((m) => m.role === 'user').length === 1) {
        broadcast(conv.id, { type: 'conversation_title', conversation_id: conv.id, title: conv.title }, origin);
      }
    })();
    return turn;
  }

  /** What a panel attaching to a running turn sees first: where it stands. */
  function replay(turn: ActiveTurn): Record<string, unknown>[] {
    const frames: Record<string, unknown>[] = [
      { type: 'thinking', turn_id: turn.id, resumed: true, elapsed_s: Math.round((Date.now() - turn.startedAt) / 1000) },
    ];
    if (turn.journal.status) frames.push(turn.journal.status);
    if (turn.journal.thinking) frames.push({ type: 'status', status: 'thinking_text', content: turn.journal.thinking, turn_id: turn.id });
    if (turn.journal.text) frames.push({ type: 'stream', content: turn.journal.text, turn_id: turn.id });
    return frames.map((frame) => ({ ...frame, relayed: true }));
  }

  /** Stream *turn* to *res* until it ends; a dropped stream leaves the turn running. */
  function followTurn(turn: ActiveTurn, req: IncomingMessage, res: ServerResponse) {
    const follow = (frame: Record<string, unknown> | null) => {
      if (frame) res.write(`data: ${JSON.stringify(frame)}\n\n`);
      else res.end();
    };
    turn.followers.add(follow);
    req.on('close', () => turn.followers.delete(follow));
  }

  /** A stored message as a restore (or a page of older ones) returns it. */
  function restoredEntry(m: Conversation['messages'][number]) {
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      created_at: m.createdAt,
      ...(m.meta ?? {}),
      ...(m.role === 'assistant' && m.feedback ? { feedback: m.feedback } : {}),
    };
  }

  /** Record the user's message in its conversation, creating it if needed. */
  function prepareTurn(body: Record<string, unknown>) {
    const prompt = typeof body.content === 'string' ? body.content : '';
    const { history } = scriptFor(prompt);

    let convId = typeof body.conversation_id === 'string' ? body.conversation_id : '';
    if (!convId || !conversations.has(convId)) {
      convId = `conv-${++seq}`;
      conversations.set(convId, { id: convId, title: 'New conversation', updatedAt: new Date().toISOString(), messages: [], contextTokens: 0 });
    }
    const conv = conversations.get(convId)!;
    // Backends rewrite the title from the first message.
    if (conv.messages.length === 0 && prompt) conv.title = prompt.slice(0, 48);
    // "long" seeds enough backlog to push past the render window.
    if (history && conv.messages.length < history) {
      // Dated yesterday, a minute apart, so the footer shows a date on them.
      const start = Date.now() - 24 * 60 * 60 * 1000 - history * 60 * 1000;
      for (let i = conv.messages.length; i < history; i++) {
        conv.messages.push({
          id: `msg-${++seq}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Backfilled message ${i + 1}`,
          createdAt: new Date(start + i * 60 * 1000).toISOString(),
        });
      }
    }
    // What the message referenced with `@`, kept as the real backend
    // keeps it, so a restore shows the chips again.
    const referenced = Array.isArray(body.referenced_conversation_ids) ? body.referenced_conversation_ids.slice(0, 5) : [];
    const conversationRefs = referenced.flatMap((id) => {
      const target = id === SHARED_CONVERSATION.id ? SHARED_CONVERSATION : typeof id === 'string' ? conversations.get(id) : undefined;
      return target && target.id !== convId ? [{ conversation_id: target.id, title: target.title, key: referenceKey(target.title, target.id) }] : [];
    });
    const userMessage = {
      id: `msg-${++seq}`,
      role: 'user' as const,
      content: prompt,
      createdAt: new Date().toISOString(),
      ...(conversationRefs.length > 0 ? { meta: { conversation_refs: conversationRefs } } : {}),
    };
    conv.messages.push(userMessage);
    return { conv, prompt, userMessage };
  }

  /**
   * One turn's frames, from the first status to `done`. *wait* is how it
   * pauses (skippable on the web chat), and *cancelled* is checked between
   * steps: a stopped turn ends with `cancelled` and stores no answer.
   */
  async function* turnFrames(
    conv: Conversation,
    prompt: string,
    { cancelled, wait }: { cancelled: () => boolean; wait: (ms: number) => Promise<unknown> },
  ): AsyncGenerator<Record<string, unknown>, void> {
    const { text, stall, fail } = scriptFor(prompt);
    const waitTurn = prompt.toLowerCase().includes('wait');
    // A stopped turn, as XTM One ends one: the Stop's acknowledgement (a
    // provisional end, marked so), then the stored end once the cut answer is
    // persisted.
    async function* stopped(): AsyncGenerator<Record<string, unknown>, void> {
      yield { type: 'cancelled', provisional: true };
      await sleep(150);
      const messageId = `msg-${++seq}`;
      conv.messages.push({ id: messageId, role: 'assistant', content: 'The request was cancelled.', createdAt: new Date().toISOString() });
      yield { type: 'cancelled', message_id: messageId, conversation_id: conv.id };
    }
    // The window fills as the thread grows. The real backend hangs these
    // on the per-iteration `thinking` frame, so the gauge climbs during
    // the turn rather than jumping at the end.
    conv.contextTokens = Math.min(conv.contextTokens + CONTEXT_PER_TURN, CONTEXT_WINDOW);
    yield { type: 'status', status: 'thinking', iteration: 1, context_tokens: conv.contextTokens, context_window: CONTEXT_WINDOW, context_breakdown: mockContextBreakdown(conv.contextTokens) };
    await wait(300);
    if (cancelled()) return yield* stopped();
    yield { type: 'status', status: 'thinking_text', content: 'Working out what the user wants, then checking how the answer will render.' };
    await wait(400);
    if (cancelled()) return yield* stopped();
    if (waitTurn) {
      // An announced pause, which `Continue now` (skip-wait) ends early.
      yield { type: 'status', status: 'wait_start', seconds: 20, reason: 'Waiting for the sandbox to start…' };
      await wait(20000);
      if (cancelled()) return yield* stopped();
    }
    yield { type: 'status', status: 'tool_start', tools: ['search_entities'] };
    // Heartbeats drive the elapsed counter; the panel ticks between them.
    yield { type: 'status', status: 'tool_heartbeat', tools: ['search_entities'], elapsed_s: 16 };
    await wait(stall ? 9000 : 900);
    if (cancelled()) return yield* stopped();
    if (stall) yield { type: 'status', status: 'tool_heartbeat', tools: ['search_entities'], elapsed_s: 25 };
    if (fail) {
      // A failed loop: the provisional error, then the stored `done` carrying it.
      yield { type: 'error', content: text, provisional: true };
      await sleep(150);
      const messageId = `msg-${++seq}`;
      conv.messages.push({ id: messageId, role: 'assistant', content: text, createdAt: new Date().toISOString() });
      return yield { type: 'done', content: text, conversation_id: conv.id, message_id: messageId };
    }
    yield { type: 'status', status: 'streaming' };

    for (let i = 0; i < text.length; i += 24) {
      yield { type: 'stream', content: text.slice(i, i + 24) };
      await sleep(12);
      if (cancelled()) return yield* stopped();
    }

    quotaUsed += 17;
    const answer = `${text}\n\n[[FILE:file-${seq}]]`;

    // The turn's metadata, streamed on `done` and stored with the answer.
    // Kept as one object so the streamed and stored metadata match.
    const turnMeta: Record<string, unknown> = {
      tool_names: ['search_entities'],
      tool_call_count: 1,
      iterations: 2,
      context_tokens: conv.contextTokens,
      context_window: CONTEXT_WINDOW,
      context_breakdown: mockContextBreakdown(conv.contextTokens),
      reasoning: 'Checked the rendering pipeline end to end, then wrote the answer.',
      tool_call_trace: [{ name: 'search_entities', input: '{"q":"apt"}', output: '{"hits":3}', success: true }],
      attachments: [
        { file_id: `file-${seq}`, filename: 'coverage.png', type: 'png', size: 4096, content_type: 'image/png', file_tag: 'download_file' },
        { file_id: `scratch-${seq}`, filename: 'notes.txt', type: 'txt', size: 512, content_type: 'text/plain', file_tag: 'working_file' },
      ],
    };

    // The persisted id rides on `done`: it is what the answer is rated by.
    const messageId = `msg-${++seq}`;
    conv.messages.push({ id: messageId, role: 'assistant', content: answer, createdAt: new Date().toISOString(), meta: turnMeta });
    conv.updatedAt = new Date().toISOString();

    yield { type: 'done', content: answer, conversation_id: conv.id, message_id: messageId, ...turnMeta };
  }

  return {
    name: 'filigran-mock-chat-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const native = url.pathname.startsWith(NATIVE_PREFIX);
        if (!native && !url.pathname.startsWith(PATH_PREFIX)) return next();
        const path = url.pathname.slice((native ? NATIVE_PREFIX : PATH_PREFIX).length);
        const method = req.method ?? 'GET';

        if (native) {
          // ---- the conversation's event stream ----
          const events = /^\/chat\/conversations\/([^/]+)\/events$/.exec(path);
          if (events && method === 'GET') {
            const convId = decodeURIComponent(events[1]);
            if (!conversations.has(convId)) return json(res, { detail: 'Conversation not found' }, 404);
            openSse(res);
            const send = (frame: Record<string, unknown>) => res.write(`data: ${JSON.stringify(frame)}\n\n`);
            const listener = { clientId: url.searchParams.get('client_id') ?? undefined, send };
            const running = activeTurns.get(convId);
            if (running && running.origin !== listener.clientId) replay(running).forEach(send);
            if (!listeners.has(convId)) listeners.set(convId, new Set());
            listeners.get(convId)!.add(listener);
            const keepalive = setInterval(() => res.write(': keepalive\n\n'), 15000);
            const lifetime = setTimeout(() => res.end(), EVENTS_LIFETIME_MS);
            req.on('close', () => {
              clearInterval(keepalive);
              clearTimeout(lifetime);
              listeners.get(convId)?.delete(listener);
            });
            return;
          }

          // ---- Stop, "Continue now", what a turn waits on ----
          // 202 either way, as XTM One answers: `turn` says whether one was running.
          if ((path === '/chat/messages/cancel' || path === '/chat/messages/skip-wait') && method === 'POST') {
            const body = await readBody(req);
            const turn = typeof body.conversation_id === 'string' ? activeTurns.get(body.conversation_id) : undefined;
            const status = path.endsWith('/cancel') ? 'cancelled' : 'wait_skipped';
            const clientId = typeof req.headers['x-chat-client-id'] === 'string' ? req.headers['x-chat-client-id'] : undefined;
            if (path.endsWith('/cancel') && clientId) {
              // Any other Stop of that panel reaches its turn, or says nothing of a later one.
              if (!turn && body.awaiting_send === true) keptStops.set(clientId, Date.now() + KEPT_STOP_MS);
              else keptStops.delete(clientId);
            }
            if (!turn) return json(res, { status, turn: 'none' }, 202);
            if (path.endsWith('/cancel')) turn.cancelled = true;
            turn.skip();
            return json(res, { status, turn: 'local' }, 202);
          }
          const pending = /^\/chat\/conversations\/([^/]+)\/pending-approvals$/.exec(path);
          if (pending && method === 'GET') {
            return json(res, { proposals: [], turn: activeTurns.has(decodeURIComponent(pending[1])) ? 'running' : 'idle' });
          }

          // ---- steering joins the running turn ----
          if (path === '/chat/messages/steer' && method === 'POST') {
            const body = await readBody(req);
            const turn = typeof body.conversation_id === 'string' ? activeTurns.get(body.conversation_id) : undefined;
            // No turn to hand it to (or it ended in between): 409, never stored.
            if (!turn) return json(res, { detail: 'No response is currently being generated for this conversation' }, 409);
            const message = { id: `msg-${++seq}`, role: 'user' as const, content: String(body.content ?? ''), createdAt: new Date().toISOString() };
            conversations.get(turn.convId)?.messages.push(message);
            broadcast(turn.convId, { type: 'user_message', message: { id: message.id, role: 'user', content: message.content, created_at: message.createdAt } }, req.headers['x-chat-client-id'] as string | undefined);
            return json(res, { status: 'steered', turn_id: turn.id });
          }

          // ---- older messages, clear all, read aloud ----
          const page = /^\/chat\/sessions\/([^/]+)\/messages$/.exec(path);
          if (page && method === 'GET') {
            const conv = conversations.get(decodeURIComponent(page[1]));
            const index = conv?.messages.findIndex((m) => m.id === url.searchParams.get('before')) ?? -1;
            if (!conv || index < 0) return json(res, { detail: 'Message not found' }, 404);
            const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), MAX_MESSAGE_PAGE_SIZE);
            const from = Math.max(0, index - limit);
            return json(res, { messages: conv.messages.slice(from, index).map(restoredEntry), has_more: from > 0 });
          }
          if (path === '/chat/sessions' && method === 'DELETE') {
            conversations.clear();
            res.statusCode = 204;
            return res.end();
          }
          if (path === '/chat/tts' && method === 'POST') {
            req.resume();
            res.setHeader('Content-Type', 'audio/wav');
            return res.end(toneWav());
          }
        }

        // ---- agents ----
        if (path === '/chat/agents') return json(res, AGENTS);

        // ---- composer toolbar: prompt library + quota ----
        if (path === '/chat/prompts') return json(res, PROMPTS);
        if (path === '/chat/suggestions') {
          // Per-agent today, per-user later — the parameter is the seam.
          const slug = url.searchParams.get('agent_slug') ?? '';
          return json(res, SUGGESTIONS[slug] ?? SUGGESTIONS.default);
        }
        if (path === '/chat/quota') {
          // Creeps up as turns are spent, so the indicator visibly moves and
          // eventually crosses the amber and red thresholds. A platform-wide
          // quota, so the tooltip says it is shared.
          return json(res, { used: quotaUsed, limit: QUOTA_LIMIT, period: 'monthly', scope: 'global' });
        }

        // ---- message feedback ----
        const feedbackRoute = /^\/chat\/conversations\/([^/]+)\/messages\/([^/]+)\/feedback$/.exec(path);
        if (feedbackRoute && (method === 'POST' || method === 'DELETE')) {
          const conv = conversations.get(decodeURIComponent(feedbackRoute[1]));
          const message = conv?.messages.find((m) => m.id === decodeURIComponent(feedbackRoute[2]) && m.role === 'assistant');
          if (!message) return json(res, { detail: 'Message not found' }, 404);
          if (method === 'DELETE') {
            delete message.feedback;
            res.statusCode = 204;
            return res.end();
          }
          const body = await readBody(req);
          if (body.rating !== 'positive' && body.rating !== 'negative') return json(res, { detail: 'rating must be positive or negative' }, 422);
          const comment = typeof body.comment === 'string' && body.comment.trim() ? body.comment.trim().slice(0, 2000) : null;
          message.feedback = { rating: body.rating, comment };
          return json(res, message.feedback);
        }

        // ---- @ conversation references ----
        if (path === '/chat/conversation-references' && method === 'GET') {
          const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
          const exclude = url.searchParams.get('exclude');
          const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 8, 1), 20);
          const own = [...conversations.values()]
            .filter((c) => c.messages.length > 0)
            .map((c) => ({ id: c.id, title: c.title, updated_at: c.updatedAt, is_own: true }));
          const shared = { id: SHARED_CONVERSATION.id, title: SHARED_CONVERSATION.title, updated_at: SHARED_CONVERSATION.updatedAt, is_own: false };
          // The contract: every word of `q` in the title, or the key starting with `q`.
          const words = q.split(/[\s_-]+/).filter(Boolean);
          const list = [...own, shared]
            .map((c) => ({ ...c, key: referenceKey(c.title, c.id) }))
            .filter((c) => c.id !== exclude && (!q || c.key.startsWith(q) || (words.length > 0 && words.every((w) => c.title.toLowerCase().includes(w)))))
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .slice(0, limit);
          return json(res, { conversations: list });
        }

        // ---- history list / delete ----
        if (path === '/chat/sessions' && method === 'GET') {
          const list = [...conversations.values()]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((c) => ({ conversation_id: c.id, title: c.title, updated_at: c.updatedAt, message_count: c.messages.length }));
          return json(res, list);
        }
        if (path.startsWith('/chat/sessions/') && method === 'PATCH') {
          const body = await readBody(req);
          const conv = conversations.get(decodeURIComponent(path.slice('/chat/sessions/'.length)));
          if (!conv) return json(res, { error: 'not found' }, 404);
          if (typeof body.title === 'string' && body.title.trim()) conv.title = body.title.trim();
          return json(res, { conversation_id: conv.id, title: conv.title });
        }
        if (path.startsWith('/chat/sessions/') && method === 'DELETE') {
          conversations.delete(decodeURIComponent(path.slice('/chat/sessions/'.length)));
          return json(res, { ok: true });
        }

        // ---- session restore ----
        if (path === '/chat/sessions' && method === 'POST') {
          const body = await readBody(req);
          const requested = typeof body.conversation_id === 'string' ? body.conversation_id : null;
          const existing = requested ? conversations.get(requested) : undefined;
          if (existing) {
            return json(res, {
              conversation_id: existing.id,
              // Each assistant message comes back with the metadata its turn
              // produced, exactly as the real backend re-surfaces it — so a
              // restored turn keeps its reasoning-details button, download
              // cards, tool trace and context reading instead of degrading to
              // bare prose.
              // The web chat returns the latest messages and pages the rest.
              messages: (native ? existing.messages.slice(-RESTORE_WINDOW) : existing.messages).map(restoredEntry),
              ...(native ? { has_more: existing.messages.length > RESTORE_WINDOW } : {}),
            });
          }
          // Mirror the real backend: a stale id transparently becomes a new one.
          const id = `conv-${++seq}`;
          conversations.set(id, { id, title: 'New conversation', updatedAt: new Date().toISOString(), messages: [], contextTokens: 0 });
          return json(res, { conversation_id: id, messages: [], ...(native ? { has_more: false } : {}) });
        }

        // ---- uploads ----
        if (path === '/chat/upload' && method === 'POST') {
          // The panel only needs an id back; the bytes are irrelevant here.
          req.resume();
          req.on('end', () => json(res, { file_id: `upload-${++seq}` }));
          return;
        }

        // ---- file download (any id serves the sample image) ----
        if (/^\/chat\/files\/.+\/download$/.test(path)) {
          res.setHeader('Content-Type', 'image/png');
          return res.end(Buffer.from(SAMPLE_PNG, 'base64'));
        }

        // ---- streaming message ----
        if (path === '/chat/messages' && method === 'POST') {
          const body = await readBody(req);
          const clientId = typeof req.headers['x-chat-client-id'] === 'string' ? req.headers['x-chat-client-id'] : undefined;
          const running = native && typeof body.conversation_id === 'string' ? activeTurns.get(body.conversation_id) : undefined;
          openSse(res);
          const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

          // The web chat's turn is the conversation's: a message sent while one
          // runs joins it, and this stream follows that turn to its end.
          if (running) {
            const conv = conversations.get(running.convId)!;
            conv.messages.push({ id: `msg-${++seq}`, role: 'user', content: String(body.content ?? ''), createdAt: new Date().toISOString() });
            send({ type: 'folded_into_active_turn', turn_id: running.id });
            return followTurn(running, req, res);
          }

          const { conv, prompt, userMessage } = prepareTurn(body);
          if (!native) {
            for await (const frame of turnFrames(conv, prompt, { cancelled: () => false, wait: sleep })) send(frame);
            return res.end();
          }
          broadcast(conv.id, { type: 'user_message', message: { id: userMessage.id, role: 'user', content: userMessage.content, created_at: userMessage.createdAt } }, clientId);
          const keptUntil = clientId ? keptStops.get(clientId) : undefined;
          if (clientId) keptStops.delete(clientId);
          const turn = startTurn(conv, prompt, clientId);
          // A Stop kept for this send stops its turn as it starts.
          if (keptUntil !== undefined && keptUntil > Date.now()) turn.cancelled = true;
          // As XTM One's stream names its turn first.
          send({ type: 'turn_started', turn_id: turn.id });
          return followTurn(turn, req, res);
        }

        // ---- steering ----
        if (path === '/chat/messages/steer' && method === 'POST') {
          req.resume();
          req.on('end', () => json(res, { ok: true }));
          return;
        }

        return json(res, { error: 'not implemented by the mock', path }, 404);
      });
    },
  };
}
