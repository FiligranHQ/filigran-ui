import type { AgentStatusState, IconProps } from '../types';
import { BrainIcon, DatabaseIcon, GlobeIcon, MailIcon, SearchIcon, SparklesIcon, TerminalIcon, WrenchIcon } from './icons';

interface ChatThinkingProps {
  agentStatus: AgentStatusState | null;
  logoIcon?: React.ReactNode;
  t: (key: string) => string;
}

type IconComponent = (props: IconProps) => React.JSX.Element;

function resolveStatusLabel(agentStatus: AgentStatusState | null, t: (key: string) => string): { label: string; StatusIcon: IconComponent } {
  if (!agentStatus) {
    return { label: t('Thinking...'), StatusIcon: BrainIcon };
  }
  switch (agentStatus.status) {
    case 'tool_start': {
      const rawNames = agentStatus.tools ?? [];
      const lower = rawNames.map((n) => n.toLowerCase());
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
      return { label, StatusIcon };
    }
    case 'analyzing':
      return { label: t('Analyzing results…'), StatusIcon: SparklesIcon };
    case 'composing':
      return { label: t('Composing answer…'), StatusIcon: BrainIcon };
    case 'thinking':
    default:
      return { label: t('Thinking...'), StatusIcon: BrainIcon };
  }
}

export const ChatThinking = ({ agentStatus, logoIcon, t }: ChatThinkingProps) => {
  const { label, StatusIcon } = resolveStatusLabel(agentStatus, t);

  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-[var(--chat-accent)]/20 to-[var(--chat-accent)]/5">
        <span className="text-[var(--chat-accent)] [&>svg]:w-3.5 [&>svg]:h-3.5">{logoIcon}</span>
      </div>
      <div className="rounded-[10px] bg-gray-50 dark:bg-white/[0.03] px-4 py-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--chat-accent)]/[0.02] via-transparent to-[var(--chat-accent)]/[0.02] animate-pulse pointer-events-none" />
        <div className="relative flex items-center gap-2.5">
          <StatusIcon size={16} className="text-[var(--chat-accent)] animate-pulse" />
          <span className="text-[0.8rem] text-gray-500 dark:text-white/50 transition-all duration-300">{label}</span>
          <span className="flex gap-[3px] items-center ml-1">
            {[0, 0.15, 0.3].map((delay, i) => (
              <span
                key={i}
                className="h-[5px] w-[5px] rounded-full bg-[var(--chat-accent)]/50"
                style={{ animation: `chat-dot 1s ease-in-out infinite ${delay}s` }}
              />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
};
