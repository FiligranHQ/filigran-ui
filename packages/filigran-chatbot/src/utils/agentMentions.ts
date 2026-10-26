import type { XtmAgent } from '../types';
import { referenceMatches, referenceTokens } from './conversationRefs';

/** An agent picked from the composer's `@` menu: `@key` in the text mentions it. */
export interface AgentMention {
  agentId: string;
  name: string;
  key: string;
}

/** How many agents the `@` menu offers at once, above the conversations. */
const AGENT_MENU_LIMIT = 5;

/** What `@` inserts for *agent*: its slug when it reads back as one token, else its name hyphenated. */
export function agentMentionKey(agent: Pick<XtmAgent, 'name' | 'slug'>): string | null {
  if (agent.slug && /^[\w-]+$/.test(agent.slug)) return agent.slug;
  const key = agent.name
    .toLowerCase()
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return key || null;
}

/** The agents answering the typed *query*, by key or name, at most `AGENT_MENU_LIMIT`. */
export function agentCandidates(agents: readonly XtmAgent[], query: string): AgentMention[] {
  const out: AgentMention[] = [];
  for (const agent of agents) {
    const key = agentMentionKey(agent);
    if (!key || !referenceMatches(query, { key, title: agent.name })) continue;
    out.push({ agentId: agent.id, name: agent.name, key });
    if (out.length >= AGENT_MENU_LIMIT) break;
  }
  return out;
}

/** *mentions* without those whose `@key` *text* no longer holds; the same array when none was dropped. */
export function pruneAgentMentions(mentions: AgentMention[], text: string): AgentMention[] {
  if (mentions.length === 0) return mentions;
  const tokens = new Set(referenceTokens(text));
  const kept = mentions.filter((m) => tokens.has(m.key.toLowerCase()));
  return kept.length === mentions.length ? mentions : kept;
}

/** *mentions* plus *pick*, unless that agent is already there. */
export function withAgentMention(mentions: AgentMention[], pick: AgentMention): AgentMention[] {
  return mentions.some((m) => m.agentId === pick.agentId) ? mentions : [...mentions, pick];
}

/** The agents a message mentions, in the order their `@key`s appear, each once. */
export function mentionedAgentIds(mentions: AgentMention[], text: string): string[] {
  const out: string[] = [];
  for (const token of referenceTokens(text)) {
    for (const m of mentions) {
      if (m.key.toLowerCase() === token && !out.includes(m.agentId)) out.push(m.agentId);
    }
  }
  return out;
}
