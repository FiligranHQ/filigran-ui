import { useEffect, useRef, useState } from 'react';
import type { AgentStatusState, IconProps } from '../types';
import {
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

interface ChatThinkingProps {
  agentStatus: AgentStatusState | null;
  logoIcon?: React.ReactNode;
  t: (key: string) => string;
}

type IconComponent = (props: IconProps) => React.JSX.Element;

interface StatusVisual {
  label: string;
  StatusIcon: IconComponent;
  showDots: boolean;
}

function resolveStatusVisual(agentStatus: AgentStatusState | null, t: (key: string) => string): StatusVisual {
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
        const label = count > 1 ? `${t('Delegating')} ${count} ${t('tasks')}…` : `${t('Delegating task')}…`;
        return { label, StatusIcon: UserPlusIcon, showDots: false };
      }
      if (lower.some((n) => n === 'check_task_status')) {
        const count = rawNames.filter((n) => n === 'check_task_status').length;
        const target = count > 1 ? `${count} ${t('background tasks')}` : t('background task');
        return { label: `${t('Waiting for')} ${target}…`, StatusIcon: SparklesIcon, showDots: false };
      }
      if (lower.some((n) => n === 'get_task_result')) {
        const count = rawNames.filter((n) => n === 'get_task_result').length;
        const from = count > 1 ? `${count} ${t('tasks')}` : t('task');
        return { label: `${t('Collecting results from')} ${from}…`, StatusIcon: SparklesIcon, showDots: false };
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
        label = unique.length === 1 ? `${unique[0]}…` : `${unique[0]} (+${unique.length - 1} more)…`;
      } else {
        label = t('Using tools…');
      }
      return { label, StatusIcon, showDots: false };
    }
    case 'analyzing':
      return { label: t('Analyzing results…'), StatusIcon: SparklesIcon, showDots: false };
    case 'steering':
      return { label: t('Incorporating your message…'), StatusIcon: SparklesIcon, showDots: true };
    case 'composing':
      return { label: t('Composing answer…'), StatusIcon: BrainIcon, showDots: true };
    case 'consulting': {
      const consultName = agentStatus.tools?.[0] ?? 'agent';
      return { label: `${t('Consulting')} ${consultName}…`, StatusIcon: UserPlusIcon, showDots: false };
    }
    case 'delegating': {
      const count = agentStatus.tools?.filter((n) => n === 'spawn_background_task').length ?? 0;
      return {
        label: count > 1 ? `${t('Delegating')} ${count} ${t('tasks')}…` : `${t('Delegating task')}…`,
        StatusIcon: UserPlusIcon,
        showDots: false,
      };
    }
    case 'polling': {
      const checkCount = agentStatus.tools?.filter((n) => n === 'check_task_status').length ?? 0;
      const target = checkCount > 1 ? `${checkCount} ${t('background tasks')}` : t('background task');
      return { label: `${t('Waiting for')} ${target}…`, StatusIcon: SparklesIcon, showDots: false };
    }
    case 'collecting': {
      const fetchCount = agentStatus.tools?.filter((n) => n === 'get_task_result').length ?? 0;
      const from = fetchCount > 1 ? `${fetchCount} ${t('tasks')}` : t('task');
      return { label: `${t('Collecting results from')} ${from}…`, StatusIcon: SparklesIcon, showDots: false };
    }
    case 'transferring': {
      const targetName = agentStatus.tools?.[0] ?? 'agent';
      return { label: `${t('Transferring to')} ${targetName}…`, StatusIcon: ExternalLinkIcon, showDots: false };
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
 * starts flowing.
 */
export function ThinkingTextBubble({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const cleaned = cleanReasoningText(content);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [cleaned]);

  if (cleaned.length < 3) return null;

  return (
    <div
      className="ml-11 mt-2.5 max-w-[75%] rounded-md border-l-2 bg-[var(--chat-accent)]/[0.03] py-2 pl-3 pr-3"
      style={{ animation: 'reasoningGlow 3s ease-in-out infinite, chat-fade-in 0.5s ease-out' }}
    >
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
        <p className="m-0 whitespace-pre-wrap break-words text-xs leading-5 text-gray-500 dark:text-white/45">{cleaned}</p>
      </div>
    </div>
  );
}

/** Render seconds as a compact elapsed label (e.g. `45s`, `3m 20s`). */
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/**
 * Elapsed time is only surfaced once the current operation has been
 * running long enough that the user could wonder whether it is stuck.
 */
const ELAPSED_DISPLAY_THRESHOLD_S = 15;

export const ChatThinking = ({ agentStatus, logoIcon, t }: ChatThinkingProps) => {
  const { label, StatusIcon, showDots } = resolveStatusVisual(agentStatus, t);
  const thinkingContent = agentStatus?.thinkingContent;
  const elapsedS = agentStatus?.elapsedS;
  const showElapsed = typeof elapsedS === 'number' && elapsedS >= ELAPSED_DISPLAY_THRESHOLD_S;

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
      {thinkingContent && <ThinkingTextBubble content={thinkingContent} />}
    </>
  );
};
