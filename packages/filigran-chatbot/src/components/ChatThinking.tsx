import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentStatusState, IconProps, Translate } from '../types';
import {
  AlertTriangleIcon,
  BrainIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  GlobeIcon,
  MailIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  UserPlusIcon,
  WrenchIcon,
} from './icons';
import { translate } from '../utils';
import { ChatWaitingGame } from './ChatWaitingGame';

interface ChatThinkingProps {
  agentStatus: AgentStatusState | null;
  logoIcon?: React.ReactNode;
  t: Translate;
  /** Host-level override for the waiting mini-game / dynamic messages. */
  miniGameEnabled?: boolean;
}

type IconComponent = (props: IconProps) => React.JSX.Element;

interface StatusVisual {
  label: string;
  StatusIcon: IconComponent;
  showDots: boolean;
}

/**
 * Whole-sentence keys, one per plural branch: a lookup-only `t` cannot select a
 * plural form, so the branch is chosen here and the locale translates the
 * finished sentence — including where the count sits in it.
 */
function delegatingLabel(count: number, t: Translate): string {
  return count > 1 ? translate(t, 'Delegating {count} tasks…', { count }) : t('Delegating one task…');
}

function pollingLabel(count: number, t: Translate): string {
  return count > 1 ? translate(t, 'Waiting for {count} background tasks…', { count }) : t('Waiting for one background task…');
}

function collectingLabel(count: number, t: Translate): string {
  return count > 1 ? translate(t, 'Collecting results from {count} tasks…', { count }) : t('Collecting results from one task…');
}

function resolveStatusVisual(agentStatus: AgentStatusState | null, t: Translate): StatusVisual {
  if (!agentStatus) {
    return { label: t('Thinking...'), StatusIcon: BrainIcon, showDots: false };
  }
  switch (agentStatus.status) {
    case 'tool_start': {
      const rawNames = agentStatus.tools ?? [];
      const lower = rawNames.map((n) => n.toLowerCase());

      // Delegation tools have dedicated statuses
      if (lower.some((n) => n === 'spawn_background_task')) {
        const count = rawNames.filter((n) => n === 'spawn_background_task').length;
        return { label: delegatingLabel(count, t), StatusIcon: UserPlusIcon, showDots: false };
      }
      if (lower.some((n) => n === 'check_task_status')) {
        const count = rawNames.filter((n) => n === 'check_task_status').length;
        return { label: pollingLabel(count, t), StatusIcon: SparklesIcon, showDots: false };
      }
      if (lower.some((n) => n === 'get_task_result')) {
        const count = rawNames.filter((n) => n === 'get_task_result').length;
        return { label: collectingLabel(count, t), StatusIcon: SparklesIcon, showDots: false };
      }

      let StatusIcon: IconComponent = WrenchIcon;
      if (lower.some((n) => n.includes('search') || n.includes('list'))) {
        StatusIcon = SearchIcon;
      } else if (lower.some((n) => n.includes('read') || n.includes('get') || n.includes('query'))) {
        StatusIcon = DatabaseIcon;
      } else if (lower.some((n) => n.includes('send') || n.includes('create') || n.includes('draft') || n.includes('reply') || n.includes('flag'))) {
        StatusIcon = MailIcon;
      } else if (lower.some((n) => n.includes('code') || n.includes('execute'))) {
        StatusIcon = TerminalIcon;
      } else if (lower.some((n) => n.includes('web') || n.includes('browse'))) {
        StatusIcon = GlobeIcon;
      }
      let label: string;
      if (rawNames.length > 0) {
        const display = rawNames.map((n) => n.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
        const unique = Array.from(new Set(display));
        label = unique.length === 1 ? `${unique[0]}…` : translate(t, '{tool} (+{count} more)…', { tool: unique[0], count: unique.length - 1 });
      } else {
        label = t('Using tools…');
      }
      return { label, StatusIcon, showDots: false };
    }
    case 'awaiting_approval':
      // Not progress: the turn has stopped and the stream is held open while a
      // person decides. Shown only when the prompt itself is not rendered (a
      // host wiring `ChatMessages` without a decision handler) — otherwise the
      // prompt replaces this bubble entirely.
      return { label: t('Waiting for your approval…'), StatusIcon: AlertTriangleIcon, showDots: false };
    case 'analyzing':
      return { label: t('Analyzing results…'), StatusIcon: SparklesIcon, showDots: false };
    case 'steering':
      return { label: t('Incorporating your message…'), StatusIcon: SparklesIcon, showDots: true };
    case 'composing':
      return { label: t('Composing answer…'), StatusIcon: BrainIcon, showDots: true };
    case 'consulting': {
      const consultName = agentStatus.tools?.[0] ?? t('the agent');
      return { label: translate(t, 'Consulting {agent}…', { agent: consultName }), StatusIcon: UserPlusIcon, showDots: false };
    }
    case 'delegating': {
      const count = agentStatus.tools?.filter((n) => n === 'spawn_background_task').length ?? 0;
      return { label: delegatingLabel(count, t), StatusIcon: UserPlusIcon, showDots: false };
    }
    case 'polling': {
      const checkCount = agentStatus.tools?.filter((n) => n === 'check_task_status').length ?? 0;
      return { label: pollingLabel(checkCount, t), StatusIcon: SparklesIcon, showDots: false };
    }
    case 'collecting': {
      const fetchCount = agentStatus.tools?.filter((n) => n === 'get_task_result').length ?? 0;
      return { label: collectingLabel(fetchCount, t), StatusIcon: SparklesIcon, showDots: false };
    }
    case 'transferring': {
      const targetName = agentStatus.tools?.[0] ?? t('the agent');
      return { label: translate(t, 'Transferring to {agent}…', { agent: targetName }), StatusIcon: ExternalLinkIcon, showDots: false };
    }
    case 'thinking':
    default:
      return { label: t('Thinking...'), StatusIcon: BrainIcon, showDots: false };
  }
}

/**
 * Light markdown cleanup for reasoning prose. Preserves paragraph breaks so
 * multi-step reasoning stays readable inside the small scrolling window
 * instead of collapsing into one unbroken blob.
 */
export function cleanReasoningText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/^[ \t]*[-*>]+[ \t]*/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Most characters of the turn's reasoning the window renders. The window is
 * pinned to its newest line and shows about eight lines, while a long turn
 * accumulates hundreds of KB: laying all of it out again on every streamed
 * chunk only re-flows text nobody can see.
 */
const REASONING_WINDOW_MAX_CHARS = 6000;

/** Fewer visible characters than this is no reasoning to show. */
const MIN_REASONING_CHARS = 3;

/**
 * The text the reasoning window shows: the cleaned tail of the prose between
 * the turn's fenced blocks, opened at a paragraph break when one is near.
 * Fences pair up from the start of the whole text, as `cleanReasoningText`
 * pairs them: paired inside a cut tail instead, a block the cut split or a
 * block still streaming shifts every pair and strips the newest prose.
 */
function reasoningWindowText(content: string): string {
  if (content.length <= REASONING_WINDOW_MAX_CHARS) return cleanReasoningText(content);
  // [start, end) of the prose around each fenced block; an unclosed fence
  // stays prose, as `cleanReasoningText` leaves it.
  const prose: [number, number][] = [];
  let from = 0;
  for (let open = content.indexOf('```'); open !== -1; open = content.indexOf('```', from)) {
    const close = content.indexOf('```', open + 3);
    if (close === -1) break;
    prose.push([from, open]);
    from = close + 3;
  }
  prose.push([from, content.length]);
  const parts: string[] = [];
  let budget = REASONING_WINDOW_MAX_CHARS;
  for (let i = prose.length - 1; i >= 0 && budget > 0; i--) {
    const [start, end] = prose[i];
    const cut = Math.max(start, end - budget);
    parts.push(content.slice(cut, end));
    // + 1: each dropped block leaves a space, as in `cleanReasoningText`.
    budget -= end - cut + 1;
  }
  let tail = parts.reverse().join(' ');
  if (budget <= 0) {
    const paragraph = tail.indexOf('\n\n');
    if (paragraph !== -1 && paragraph < tail.length / 2) tail = tail.slice(paragraph + 2);
  }
  return cleanReasoningText(tail);
}

/**
 * Reasoning window — the model's reasoning prose rendered below the status
 * bubble while the agent works: smaller, dimmed text inside a capped-height
 * (max-h-40) window always pinned to the newest line, with a Cursor-style
 * top dissolve once full (soft gradient fade at the top only — the text reads
 * as scrolling up and dissolving; the bottom stays sharp) — framed by the
 * breathing accent left-border glow.  The window is intentionally NOT
 * user-scrollable (overflow-hidden, no scrollbar): the prose is ambient
 * feedback that scrolls up and dissolves; the full accumulated reasoning
 * stays readable afterwards via the message's reasoning details.  The window
 * (and the status bubble above it) disappears the moment the final answer
 * starts flowing.  `text` comes cleaned and tail-bounded from
 * `reasoningWindowText`; the glow lives on `.filigran-chat-reasoning` so
 * reduced motion can stop it.
 */
function ThinkingTextBubble({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div className="filigran-chat-reasoning ml-11 mt-2.5 max-w-[75%] rounded-md border-l-2 bg-[var(--chat-accent)]/[0.03] py-2 pl-3 pr-3">
      <div
        ref={ref}
        className={`max-h-40 overflow-hidden${
          isOverflowing
            ? // -webkit- twin first: Safari/WebKit ignores unprefixed mask-image
              // on older versions, which would silently drop the top dissolve.
              ' [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,rgb(0_0_0/0.25)_1.5rem,rgb(0_0_0/0.7)_3rem,black_4.5rem)]' +
              ' [mask-image:linear-gradient(to_bottom,transparent_0,rgb(0_0_0/0.25)_1.5rem,rgb(0_0_0/0.7)_3rem,black_4.5rem)]'
            : ''
        }`}
      >
        <p className="m-0 whitespace-pre-wrap break-words text-xs leading-5 text-gray-500 dark:text-white/45">{text}</p>
      </div>
    </div>
  );
}

/** Render seconds as a compact elapsed label (e.g. `45s`, `3m 20s`). */
function formatElapsed(seconds: number): string {
  // Floor at the boundary: `elapsed_s` comes from the backend and may be a
  // float, which would otherwise render as "45.3s" / "3m 20.5s".
  const total = Math.floor(seconds);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/**
 * Elapsed time is only surfaced once the current operation has been
 * running long enough that the user could wonder whether it is stuck.
 */
const ELAPSED_DISPLAY_THRESHOLD_S = 15;

/**
 * How long a working turn with no reasoning to show waits before the waiting
 * game fills the space, so a quick reply never flashes it.
 */
const WAITING_GAME_DELAY_MS = 5000;

/**
 * True once `active` has held for `delayMs`; false the moment it drops (the
 * `active &&` covers the render before the effect resets the state). Arms no
 * timer while `active` is false, so a host that disables the waiting game
 * schedules no timeouts or re-renders for it.
 */
function useSustained(active: boolean, delayMs: number): boolean {
  const [sustained, setSustained] = useState(false);
  useEffect(() => {
    setSustained(false);
    if (!active) return;
    const id = window.setTimeout(() => setSustained(true), delayMs);
    return () => window.clearTimeout(id);
  }, [active, delayMs]);
  return active && sustained;
}

export const ChatThinking = ({ agentStatus, logoIcon, t, miniGameEnabled = true }: ChatThinkingProps) => {
  const { label, StatusIcon, showDots } = resolveStatusVisual(agentStatus, t);
  const thinkingContent = agentStatus?.thinkingContent;

  // Tick the elapsed counter every second. The backend only reports a fresh
  // value once every ~10s (`tool_heartbeat`), so rendering that integer
  // directly makes the timer sit still and then jump ~10s at a time. Each
  // heartbeat re-anchors `elapsedStartMs` (the instant elapsed was zero); the
  // displayed seconds are derived from that anchor plus a local 1s ticker, so
  // the number moves smoothly and self-corrects on every beat. The interval
  // only runs while an anchor is present, and this state is local to the
  // indicator so the tick never re-renders the surrounding message list.
  const elapsedStartMs = agentStatus?.elapsedStartMs;
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (elapsedStartMs == null) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [elapsedStartMs]);

  // Fall back to the raw heartbeat value for backends/protocols that report
  // `elapsedS` without an anchor.
  const elapsedS = elapsedStartMs != null ? Math.max(0, (nowMs - elapsedStartMs) / 1000) : agentStatus?.elapsedS;
  const showElapsed = typeof elapsedS === 'number' && elapsedS >= ELAPSED_DISPLAY_THRESHOLD_S;
  // Reasoning wins over the waiting game: once the turn has reasoning to show,
  // the window stays through tool calls and silences until the answer streams.
  // The game only fills a wait that has none.
  const reasoningText = useMemo(() => reasoningWindowText(thinkingContent ?? ''), [thinkingContent]);
  const showReasoning = reasoningText.length >= MIN_REASONING_CHARS;
  const showGame = useSustained(miniGameEnabled && !showReasoning, WAITING_GAME_DELAY_MS);

  return (
    <>
      <div className="flex gap-3 items-center justify-start">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--chat-accent)]/15 to-[var(--chat-accent)]/5">
          <span className="text-[var(--chat-accent)] [&>svg]:w-4 [&>svg]:h-4">{logoIcon}</span>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-white/[0.03] px-4 py-3 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--chat-accent)]/[0.03] via-transparent to-[var(--chat-accent)]/[0.03] animate-pulse pointer-events-none" />
          <div className="relative flex items-center gap-2.5">
            {showDots ? (
              <div className="flex gap-[3px] items-center h-3.5 w-3.5 justify-center">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <span
                    key={i}
                    className="h-[5px] w-[5px] rounded-full bg-[var(--chat-accent)]/50"
                    style={{ animation: `chat-dot 1s ease-in-out infinite ${delay}s` }}
                  />
                ))}
              </div>
            ) : (
              <StatusIcon size={14} className="text-[var(--chat-accent)] animate-pulse transition-all duration-300" />
            )}
            <span className="text-sm text-gray-500 dark:text-white/50 transition-all duration-300">{label}</span>
            {showElapsed && <span className="text-xs text-gray-400 dark:text-white/30 tabular-nums shrink-0">{formatElapsed(elapsedS)}</span>}
          </div>
        </div>
      </div>
      {showReasoning ? <ThinkingTextBubble text={reasoningText} /> : showGame ? <ChatWaitingGame t={t} enabled={miniGameEnabled} /> : null}
    </>
  );
};
