/**
 * Which chat frames answer a voice call's spoken question.
 *
 * The panel reads two streams: the message stream of the turn it started
 * (frames not `relayed`) and the conversation's event stream, which relays the
 * turns it did not start (`relayed: true`). Only the turn that answers the
 * question may resolve it, and only with its FINAL `done`: the panel's own
 * turn, or - when the question was folded into a turn already running - the
 * turn `folded_into_active_turn` (or a steer's answer) names by `turn_id`. A
 * mid-turn segment commit (an intermediate `done`) never cuts the answer
 * short, and every other relayed frame is ignored.
 *
 * Only the agent the question addresses - the conversation's - is spoken. A
 * turn several mentioned agents answer carries `answered_by` on each reply:
 * the replies of the others are handed over as text with their name, never
 * spoken as the addressed agent's answer and never dropped. On such a turn the
 * addressed agent's own reply is attributed to it too, so the attribution is
 * compared with the addressed agent rather than read as "someone else".
 */

import { parseAnsweredBy } from './protocols/parseRestEvent';

/** A chat frame, as far as a voice call reads it. */
export interface VoiceFrame {
  type?: unknown;
  relayed?: unknown;
  turn_id?: unknown;
  intermediate?: unknown;
  content?: unknown;
  status?: unknown;
  agent_id?: unknown;
  answered_by?: unknown;
  mention_failed?: unknown;
  [field: string]: unknown;
}

/** A reply another agent wrote in the answering turn: shown with its name, never spoken. */
export interface VoiceAgentReply {
  agentId: string;
  agentName: string;
  /** A note written in place of an agent that did not answer (`mention_failed`). */
  failed: boolean;
  text: string;
}

/** The answer a voice call is waiting for. */
export interface PendingVoiceAnswer {
  /** The turn that answers the question, once known. */
  turnId: string | null;
  /** The question joined a turn already running: that turn's earlier segments answer what it was already doing. */
  folded: boolean;
  /** The agent the question addresses (the conversation's; `null` when none is known). A transfer in the turn moves it. */
  agentId: string | null;
  /** The addressed agent's committed replies so far: every one of its own turn (spoken with the final one), the last one of a folded turn. */
  segments: string[];
  /** The other agents' replies in the turn, in order, each with its text. */
  others: VoiceAgentReply[];
}

/** One line an answered question adds to the call's transcript. */
export interface VoiceTranscriptLine {
  content: string;
  /** Another agent's reply: shown with its name, never spoken. */
  agent?: { name: string; failed: boolean };
}

/**
 * The lines an answer adds to the call's transcript: the addressed agent's
 * answer, then every other agent's reply of the turn in order - never an
 * empty line.
 */
export function answerTranscriptLines(answer: { text: string; others: VoiceAgentReply[] }): VoiceTranscriptLine[] {
  const lines: VoiceTranscriptLine[] = answer.text.trim() ? [{ content: answer.text }] : [];
  for (const reply of answer.others) {
    if (!reply.text.trim()) continue;
    lines.push({ content: reply.text, agent: { name: reply.agentName, failed: reply.failed } });
  }
  return lines;
}

export type VoiceVerdict =
  /** Not about the pending answer (another turn, a keep-alive). */
  | { kind: 'ignore' }
  /** The answering turn is still working: keep waiting. */
  | { kind: 'progress' }
  /** `text` is the addressed agent's answer (empty when it said nothing after the question); `others` the rest of the turn. */
  | { kind: 'answer'; text: string; others: VoiceAgentReply[] }
  /** The answering turn ended without an answer, or none will come. */
  | { kind: 'failed' };

const TURN_PROGRESS = new Set(['thinking', 'status', 'stream', 'turn_started']);

/** What the idle check learns of the turn a spoken question waits on. */
export type TurnProbe = 'running' | 'over' | 'unknown';

/**
 * Read whether the turn still runs, for the idle check. A read that failed
 * says nothing about the turn (`unknown`): the wait goes on and the check is
 * asked again, rather than failing the answer of a long tool call over a
 * transient error.
 */
export async function probeTurn(read: () => Promise<{ running: boolean } | null>): Promise<TurnProbe> {
  try {
    const state = await read();
    if (!state) return 'unknown';
    return state.running ? 'running' : 'over';
  } catch {
    return 'unknown';
  }
}

export function newPendingAnswer(agentId: string | null = null): PendingVoiceAnswer {
  return { turnId: null, folded: false, agentId, segments: [], others: [] };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** The agent a reply of a multi-agent turn names (`answered_by`), when it gives both its id and its name. */
function attribution(frame: VoiceFrame): { agentId: string; agentName: string } | null {
  const by = parseAnsweredBy(frame.answered_by);
  return by?.agentId && by.agentName?.trim() ? { agentId: by.agentId, agentName: by.agentName } : null;
}

/**
 * Read one frame against the pending answer. Mutates `pending` as the answer
 * builds up (the answering turn once named, each committed segment, the other
 * agents' replies).
 */
export function classifyVoiceFrame(pending: PendingVoiceAnswer, frame: VoiceFrame): VoiceVerdict {
  const turnId = typeof frame.turn_id === 'string' && frame.turn_id !== '' ? frame.turn_id : null;
  if (frame.relayed === true) {
    // A turn the panel did not start answers the question only when the
    // question was folded into it.
    if (pending.turnId === null || turnId !== pending.turnId) return { kind: 'ignore' };
  } else if (frame.type === 'folded_into_active_turn') {
    // The question joined a turn that was already running: its frames follow
    // under this id. Queued for the next turn with no turn running
    // (`folded: false`), nothing answers it now. Without an id, the idle
    // check settles the wait.
    if (turnId !== null) {
      pending.turnId = turnId;
      pending.folded = true;
    } else if (frame.folded === false) {
      return { kind: 'failed' };
    }
    return { kind: 'progress' };
  } else if (turnId !== null && pending.turnId === null) {
    // The panel's own turn names itself once it runs.
    pending.turnId = turnId;
  }
  const type = frame.type;
  if (
    type === 'status' &&
    frame.status === 'transfer_start' &&
    typeof frame.agent_id === 'string' &&
    frame.agent_id &&
    // Only a transfer in the answering turn - named above - moves the
    // addressed agent; a frame naming no turn counts too.
    (turnId === null || turnId === pending.turnId)
  ) {
    // The conversation now belongs to the agent it was transferred to.
    pending.agentId = frame.agent_id;
  }
  if (typeof type === 'string' && TURN_PROGRESS.has(type)) return { kind: 'progress' };
  if (type === 'done') {
    const content = text(frame.content);
    const final = frame.intermediate !== true;
    const by = attribution(frame);
    if (by !== null && by.agentId !== pending.agentId) {
      // An agent the question did not address answered in this turn.
      if (content) pending.others.push({ ...by, failed: frame.mention_failed === true, text: content });
      if (!final) return { kind: 'progress' };
      return { kind: 'answer', text: pending.segments.join('\n\n'), others: pending.others };
    }
    if (!final) {
      // A folded turn's segments answer what it was doing before the
      // question joined it; the last of them stands for its reply only when
      // another agent's reply ends the turn.
      if (content) pending.segments = pending.folded ? [content] : [...pending.segments, content];
      return { kind: 'progress' };
    }
    const spoken = pending.folded ? [content] : [...pending.segments, content];
    return { kind: 'answer', text: spoken.filter(Boolean).join('\n\n'), others: pending.others };
  }
  if (type === 'cancelled' || type === 'error') return { kind: 'failed' };
  return { kind: 'ignore' };
}

/** Words of *value*, lower-cased, for comparing what was heard with what is being said. */
function words(value: string): string[] {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/**
 * Whether speech heard while the call speaks is the user talking over it
 * (barge-in) rather than its own voice coming back through the microphone:
 * at least two words, and not mostly words of what is being said.
 */
export function isBargeIn(heard: string, speaking: string): boolean {
  const said = words(heard);
  if (said.length < 2) return false;
  const spoken = new Set(words(speaking));
  const echoed = said.filter((w) => spoken.has(w)).length;
  return echoed / said.length < 0.6;
}
