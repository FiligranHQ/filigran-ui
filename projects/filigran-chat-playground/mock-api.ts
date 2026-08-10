import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * A dev-only stand-in for the XTM One REST chat API, so `yarn dev` gives you a
 * working panel with nothing else running.
 *
 * It implements the contract documented in the package README — agents,
 * sessions (restore / list / delete), streaming messages, uploads and file
 * downloads — and nothing more. Set `CHAT_API_PROXY=http://host:port` to talk to
 * a real backend instead; the plugin then stays out of the way.
 *
 * The canned answer is deliberately hostile: it carries every markdown shape
 * that has broken the renderer at some point (multi-line image alt text, a
 * fence with no info string, a table whose delimiter row is a column short, a
 * `javascript:` link, a markdown block containing its own fences). Ask for
 * "json" to get a bare-JSON reply, "long" for a thread long enough to exercise
 * the render window, or "slow" for a turn that stalls into the waiting game.
 */

const PATH_PREFIX = '/api/xtmone';

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
  messages: { role: 'user' | 'assistant'; content: string }[];
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

function json(res: ServerResponse, payload: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

/** Pick the scripted answer from what the user typed. */
function scriptFor(prompt: string): { text: string; stall: boolean; history: number } {
  const p = prompt.toLowerCase();
  if (p.includes('json')) return { text: BARE_JSON, stall: false, history: 0 };
  if (p.includes('fence') || p.includes('nested')) return { text: NESTED_FENCES, stall: false, history: 0 };
  if (p.includes('slow')) return { text: 'That took a while — the waiting game should have appeared.', stall: true, history: 0 };
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

const QUOTA_LIMIT = 500;

export function mockChatApi(): Plugin {
  const conversations = new Map<string, Conversation>();
  let seq = 0;
  // Start close to the amber threshold so the indicator is worth looking at.
  let quotaUsed = 360;

  return {
    name: 'filigran-mock-chat-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith(PATH_PREFIX)) return next();
        const path = url.pathname.slice(PATH_PREFIX.length);
        const method = req.method ?? 'GET';

        // ---- agents ----
        if (path === '/chat/agents') return json(res, AGENTS);

        // ---- composer toolbar: prompt library + quota ----
        if (path === '/chat/prompts') return json(res, PROMPTS);
        if (path === '/chat/quota') {
          // Creeps up as turns are spent, so the indicator visibly moves and
          // eventually crosses the amber and red thresholds.
          return json(res, { used: quotaUsed, limit: QUOTA_LIMIT, period: 'monthly' });
        }

        // ---- history list / delete ----
        if (path === '/chat/sessions' && method === 'GET') {
          const list = [...conversations.values()]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((c) => ({ conversation_id: c.id, title: c.title, updated_at: c.updatedAt, message_count: c.messages.length }));
          return json(res, list);
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
              messages: existing.messages.map((m) => ({ role: m.role, content: m.content })),
            });
          }
          // Mirror the real backend: a stale id transparently becomes a new one.
          const id = `conv-${++seq}`;
          conversations.set(id, { id, title: 'New conversation', updatedAt: new Date().toISOString(), messages: [] });
          return json(res, { conversation_id: id, messages: [] });
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
          const prompt = typeof body.content === 'string' ? body.content : '';
          const { text, stall, history } = scriptFor(prompt);

          let convId = typeof body.conversation_id === 'string' ? body.conversation_id : '';
          if (!convId || !conversations.has(convId)) {
            convId = `conv-${++seq}`;
            conversations.set(convId, { id: convId, title: 'New conversation', updatedAt: new Date().toISOString(), messages: [] });
          }
          const conv = conversations.get(convId)!;
          // Backends rewrite the title from the first message.
          if (conv.messages.length === 0 && prompt) conv.title = prompt.slice(0, 48);
          // "long" seeds enough backlog to push past the render window.
          if (history && conv.messages.length < history) {
            for (let i = conv.messages.length; i < history; i++) {
              conv.messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Backfilled message ${i + 1}` });
            }
          }
          conv.messages.push({ role: 'user', content: prompt });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

          send({ type: 'status', status: 'thinking' });
          await sleep(300);
          send({ type: 'status', status: 'thinking_text', content: 'Working out what the user wants, then checking how the answer will render.' });
          await sleep(400);
          send({ type: 'status', status: 'tool_start', tools: ['search_entities'] });
          // Heartbeats drive the elapsed counter; the panel ticks between them.
          send({ type: 'status', status: 'tool_heartbeat', tools: ['search_entities'], elapsed_s: 16 });
          await sleep(stall ? 9000 : 900);
          if (stall) send({ type: 'status', status: 'tool_heartbeat', tools: ['search_entities'], elapsed_s: 25 });
          send({ type: 'status', status: 'streaming' });

          for (let i = 0; i < text.length; i += 24) {
            send({ type: 'stream', content: text.slice(i, i + 24) });
            await sleep(12);
          }

          quotaUsed += 17;
          const answer = `${text}\n\n[[FILE:file-${seq}]]`;
          conv.messages.push({ role: 'assistant', content: answer });
          conv.updatedAt = new Date().toISOString();

          send({
            type: 'done',
            content: answer,
            conversation_id: convId,
            tool_names: ['search_entities'],
            tool_call_count: 1,
            iterations: 2,
            reasoning: 'Checked the rendering pipeline end to end, then wrote the answer.',
            tool_call_trace: [{ name: 'search_entities', input: '{"q":"apt"}', output: '{"hits":3}', success: true }],
            attachments: [
              { file_id: `file-${seq}`, filename: 'coverage.png', type: 'png', size: 4096, content_type: 'image/png', file_tag: 'download_file' },
              { file_id: `scratch-${seq}`, filename: 'notes.txt', type: 'txt', size: 512, content_type: 'text/plain', file_tag: 'working_file' },
            ],
          });
          return res.end();
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
