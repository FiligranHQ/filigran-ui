import { useEffect, useRef } from 'react';
import type { AgentStatusState, IconProps } from '../types';
import { BrainIcon, DatabaseIcon, ExternalLinkIcon, GlobeIcon, MailIcon, SearchIcon, SparklesIcon, TerminalIcon, UserPlusIcon, WrenchIcon } from './icons';

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
        const label = count > 1
          ? `${t('Delegating')} ${count} ${t('tasks')}…`
          : `${t('Delegating task')}…`;
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
    case 'composing':
      return { label: t('Composing answer…'), StatusIcon: BrainIcon, showDots: true };
    case 'consulting': {
      const consultName = agentStatus.tools?.[0] ?? 'agent';
      return { label: `${t('Consulting')} ${consultName}…`, StatusIcon: UserPlusIcon, showDots: false };
    }
    case 'delegating': {
      const count = agentStatus.tools?.filter((n) => n === 'spawn_background_task').length ?? 0;
      return { label: count > 1 ? `${t('Delegating')} ${count} ${t('tasks')}…` : `${t('Delegating task')}…`, StatusIcon: UserPlusIcon, showDots: false };
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

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/[*\->]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ThinkingTextBubble({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const cleaned = stripMarkdown(content);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [cleaned]);

  if (cleaned.length < 3) return null;

  return (
    <div
      ref={ref}
      className="ml-11 max-w-[70%] max-h-20 overflow-hidden relative rounded-md border-l-2 bg-[var(--chat-accent)]/[0.03] pl-3 pr-3 py-2"
      style={{ animation: 'reasoningGlow 3s ease-in-out infinite, chat-fade-in 0.5s ease-out' }}
    >
      <p className="text-[13px] leading-[1.35rem] text-gray-400 dark:text-white/40 break-words m-0">
        {cleaned}
      </p>
      <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white/90 dark:from-[#1e1e2e]/90 to-transparent pointer-events-none" />
    </div>
  );
}

export const ChatThinking = ({ agentStatus, logoIcon, t }: ChatThinkingProps) => {
  const { label, StatusIcon, showDots } = resolveStatusVisual(agentStatus, t);
  const thinkingContent = agentStatus?.thinkingContent;

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
          </div>
        </div>
      </div>
      {thinkingContent && <ThinkingTextBubble content={thinkingContent} />}
    </>
  );
};
