/**
 * A real XTM One agent whose job is to stress the renderer.
 *
 * The mock backend fakes SSE, so it proves nothing about how the panel behaves
 * against a real agentic loop — real token pacing, real tool statuses, real
 * transfers. Pointing at a real XTM One fixes that but loses the deliberately
 * hostile content the mock was written to produce.
 *
 * This gets both: a genuine agent, created through the normal API, told by its
 * persona to emit the shapes that have broken the renderer before.
 *
 * Installed on demand, from a button on the page. It used to run itself at
 * start-up behind `CHAT_PLAYGROUND_AGENT=1`, which meant it effectively never
 * ran — nobody sets an env var they have not read about, and when it did fail
 * the reason went to the terminal rather than to the person looking at the
 * screen. Writing to whichever instance you are pointed at should be a
 * deliberate click anyway.
 *
 * Deliberately created through `POST /agents` rather than added to XTM One's
 * seeded built-ins: agents have no per-agent platform gating, so a seeded entry
 * would ship to every deployment, customers included. Here it exists only on
 * the instance a developer chose to point at.
 */

const AGENT_SLUG = 'rendering-playground';

/**
 * The persona. Written as instructions rather than a fixed script so the reply
 * varies run to run — a renderer that only survives one canned string is not
 * actually proven.
 */
const PERSONA = `You are the Rendering Playground agent. You exist to exercise a chat
renderer, not to be helpful in the ordinary sense.

Whatever the user asks, answer it *and* weave in the markdown constructions
listed below. Vary the wording, ordering and subject matter between replies —
the point is to prove the renderer handles the shapes, not one fixed string.

Always include, somewhere in the answer:

1. A pipe table whose delimiter row has ONE FEWER column than the header row.
   This is deliberate: it reproduces what models emit when they miscount, and
   the renderer is expected to repair it. Do not correct it.
2. A fenced code block with NO language after the opening backticks.
3. A second fenced block WITH a language tag (python, json, bash — vary it).
4. A bulleted list with at least one nested level, and an ordered list.
5. A blockquote containing inline code, bold and italic.
6. Two links: one ordinary https link, and one written as
   [do not click](javascript:alert(1)) — the renderer must render it inert.
7. Two lines separated by a single newline (a soft break), not a blank line.
8. A horizontal rule.

When the user's message mentions:
- "json"  — reply with NOTHING but a raw JSON object. No prose, no code fence.
- "fences" or "nested" — include a \`\`\`markdown block that itself contains
  \`\`\`json and \`\`\` fences, and make sure prose follows it after it closes.
- "long" — write at least 40 short paragraphs before anything else.
- "table" — include several tables, some well-formed, some mis-delimited.

Never explain that you are testing the renderer unless asked. Just answer.`;

interface AgentBootstrapConfig {
  target: string;
  resolveToken: () => Promise<string | null>;
}

interface AgentPayload {
  slug: string;
  name: string;
  description: string;
  icon: string;
  persona: string;
  output_format: string;
  tags: string[];
}

const PAYLOAD: AgentPayload = {
  slug: AGENT_SLUG,
  name: 'Rendering Playground',
  description: 'Emits markdown shapes that stress the chat renderer — tables, fences, links, images. For development only.',
  icon: 'FlaskConical',
  persona: PERSONA,
  output_format: 'markdown',
  tags: ['playground', 'development'],
};

export type AgentState = 'installed' | 'absent' | 'unknown';

export interface AgentOutcome {
  /** What the page should show once the dust settles. */
  state: AgentState;
  /** Plain sentence for the person looking at the screen, not a log line. */
  message: string;
}

/** Is the agent already on the instance? Drives the button's label. */
export async function playgroundAgentState(config: AgentBootstrapConfig): Promise<AgentOutcome> {
  const found = await findAgent(config);
  if (typeof found === 'string') return { state: 'unknown', message: found };
  return found
    ? { state: 'installed', message: `"${PAYLOAD.name}" is on this instance — pick it in the agent menu.` }
    : { state: 'absent', message: `"${PAYLOAD.name}" is not on this instance yet.` };
}

/** The existing agent, `null` if absent, or a human-readable reason we cannot tell. */
async function findAgent(config: AgentBootstrapConfig): Promise<Record<string, unknown> | null | string> {
  const token = await config.resolveToken();
  if (!token) return 'Sign in first — the agent is created as you.';
  try {
    const res = await fetch(`${config.target}/api/v1/agents`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return `Could not list agents (HTTP ${res.status}).`;
    const raw = (await res.json()) as unknown;
    const list = Array.isArray(raw) ? raw : ((raw as Record<string, unknown>)?.agents as unknown[]) ?? [];
    return (list.find((a) => (a as Record<string, unknown>)?.slug === AGENT_SLUG) as Record<string, unknown>) ?? null;
  } catch (err) {
    return `Could not reach ${config.target} — ${(err as Error).message}`;
  }
}

/**
 * Create the agent, or refresh its persona if it is already there.
 *
 * Never throws: an instance where agent creation is gated (no licence, no
 * permission) should get a sentence explaining that, not a broken page.
 */
export async function ensurePlaygroundAgent(config: AgentBootstrapConfig): Promise<AgentOutcome> {
  const token = await config.resolveToken();
  if (!token) return { state: 'unknown', message: 'Sign in first — the agent is created as you.' };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const existing = await findAgent(config);
  if (typeof existing === 'string') return { state: 'unknown', message: existing };

  try {
    if (existing?.id) {
      // Refresh rather than skip: the persona is the part being iterated on,
      // so a stale one would quietly defeat the whole exercise.
      // PUT, not PATCH: XTM One exposes no PATCH on this route and answered
      // 405. Every field of UpdateAgentRequest is optional, so a PUT carrying
      // just these two is still a partial update.
      const res = await fetch(`${config.target}/api/v1/agents/${existing.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ persona: PERSONA, description: PAYLOAD.description }),
      });
      return res.ok
        ? { state: 'installed', message: `Refreshed "${PAYLOAD.name}" with the current persona.` }
        : { state: 'installed', message: `It is already there, but the persona could not be refreshed (HTTP ${res.status}).` };
    }

    const res = await fetch(`${config.target}/api/v1/agents`, { method: 'POST', headers, body: JSON.stringify(PAYLOAD) });
    if (res.ok) return { state: 'installed', message: `Created "${PAYLOAD.name}" — pick it in the agent menu.` };
    return { state: 'absent', message: `Creation failed (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}` };
  } catch (err) {
    return { state: 'unknown', message: `Could not reach ${config.target} — ${(err as Error).message}` };
  }
}
