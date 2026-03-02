import { useRef } from 'react';
import type { ChatMode, XtmAgent } from '../types';
import {
  ChevronDownIcon,
  CloseIcon,
  EditIcon,
  ExternalLinkIcon,
  FloatingIcon,
  FullscreenExitIcon,
  FullscreenIcon,
  SidebarIcon,
  UserPlusIcon,
} from './icons';
import { Dropdown } from './Dropdown';
import { Spinner } from './Spinner';
import { Tooltip } from './Tooltip';

interface ChatHeaderProps {
  mode: ChatMode;
  agentName: string;
  agents: XtmAgent[];
  selectedAgent: XtmAgent | null;
  agentMenuOpen: boolean;
  onAgentMenuToggle: () => void;
  onAgentMenuClose: () => void;
  onSwitchAgent: (agent: XtmAgent) => void;
  modeMenuOpen: boolean;
  onModeMenuToggle: () => void;
  onModeMenuClose: () => void;
  onModeChange: (mode: ChatMode) => void;
  onNewChat: () => void;
  onClose: () => void;
  logoIcon: React.ReactNode;
  agentDashboardUrl?: string;
  t: (key: string) => string;
}

const modeOptions: { mode: ChatMode; label: string; getIcon: (p: { size: number; className: string }) => React.ReactNode }[] = [
  { mode: 'floating', label: 'Floating', getIcon: (p) => <FloatingIcon {...p} /> },
  { mode: 'sidebar', label: 'Sidebar', getIcon: (p) => <SidebarIcon {...p} /> },
  { mode: 'fullscreen', label: 'Full screen', getIcon: (p) => <FullscreenIcon {...p} /> },
];

export const ChatHeader = ({
  mode,
  agentName,
  agents,
  selectedAgent,
  agentMenuOpen,
  onAgentMenuToggle,
  onAgentMenuClose,
  onSwitchAgent,
  modeMenuOpen,
  onModeMenuToggle,
  onModeMenuClose,
  onModeChange,
  onNewChat,
  onClose,
  logoIcon,
  agentDashboardUrl,
  t,
}: ChatHeaderProps) => {
  const agentAnchorRef = useRef<HTMLButtonElement>(null);
  const modeAnchorRef = useRef<HTMLButtonElement>(null);

  const CurrentModeIcon = mode === 'sidebar' ? SidebarIcon : mode === 'fullscreen' ? FullscreenExitIcon : FloatingIcon;

  return (
    <div className={`flex items-center px-3 py-2 min-h-[48px] border-b border-gray-200 dark:border-white/10 bg-gradient-to-br from-[var(--chat-accent-dark)]/[0.13] to-[var(--chat-accent)]/[0.07] ${mode === 'floating' ? 'rounded-t-xl' : ''}`}>
      <button
        ref={agentAnchorRef}
        type="button"
        onClick={onAgentMenuToggle}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      >
        <span className="text-[var(--chat-accent)] [&>svg]:w-[18px] [&>svg]:h-[18px]">{logoIcon}</span>
        {agentName}
        <ChevronDownIcon size={16} className="text-gray-400 dark:text-white/40" />
      </button>

      <Dropdown open={agentMenuOpen} onClose={onAgentMenuClose} anchorRef={agentAnchorRef} width={280}>
        <span className="block px-4 pt-3 pb-1 text-[0.68rem] tracking-[1px] uppercase text-gray-400 dark:text-white/40">
          {t('Switch to another agent')}
        </span>
        {agents.length === 0 && (
          <div className="px-4 py-2">
            <Spinner size={16} />
          </div>
        )}
        <div>
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSwitchAgent(agent)}
              className={`w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ${
                agent.id === selectedAgent?.id ? 'bg-[var(--chat-accent)]/10' : ''
              }`}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-[var(--chat-accent)]/20 to-[var(--chat-accent)]/5">
                <span className="text-[var(--chat-accent)] [&>svg]:w-4 [&>svg]:h-4">{logoIcon}</span>
              </div>
              <div className="min-w-0">
                <div className="text-[0.8125rem] font-medium text-gray-900 dark:text-white truncate">{agent.name}</div>
                {agent.description && <div className="text-[0.7rem] text-gray-500 dark:text-white/40 truncate">{agent.description}</div>}
              </div>
            </button>
          ))}
        </div>
        <hr className="border-gray-200 dark:border-white/10" />
        <div>
          {agentDashboardUrl && (
            <button
              type="button"
              onClick={() => {
                onAgentMenuClose();
                window.open(`${agentDashboardUrl}/agents`, '_blank');
              }}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <ExternalLinkIcon size={18} className="text-gray-400 dark:text-white/40 shrink-0" />
              <span className="text-[0.8125rem] text-gray-700 dark:text-white/70">{t('Browse agents')}</span>
            </button>
          )}
          {agentDashboardUrl && (
            <button
              type="button"
              onClick={() => {
                onAgentMenuClose();
                window.open(`${agentDashboardUrl}/agents/new`, '_blank');
              }}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <UserPlusIcon size={18} className="text-gray-400 dark:text-white/40 shrink-0" />
              <span className="text-[0.8125rem] text-gray-700 dark:text-white/70">{t('Create agent')}</span>
            </button>
          )}
        </div>
      </Dropdown>

      <div className="flex-1" />

      <Tooltip title={t('New chat')}>
        <button
          type="button"
          onClick={onNewChat}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 mr-0.5 text-gray-600 dark:text-white/70 transition-colors"
        >
          <EditIcon size={20} />
        </button>
      </Tooltip>

      <Tooltip title={t('Switch view')}>
        <button
          ref={modeAnchorRef}
          type="button"
          onClick={onModeMenuToggle}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 mr-0.5 text-gray-600 dark:text-white/70 transition-colors"
        >
          <CurrentModeIcon size={20} />
        </button>
      </Tooltip>

      <Dropdown open={modeMenuOpen} onClose={onModeMenuClose} anchorRef={modeAnchorRef} placement="bottom-end" width={180}>
        <span className="block px-4 pt-3 pb-1 text-[0.68rem] tracking-[1px] uppercase text-gray-400 dark:text-white/40">{t('Switch to')}</span>
        <div className="pb-1">
          {modeOptions.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => {
                onModeChange(opt.mode);
                onModeMenuClose();
              }}
              className={`w-full flex items-center gap-3 px-4 py-1 text-left hover:bg-gray-100 dark:hover:bg-white/10 transition-colors ${
                mode === opt.mode ? 'bg-[var(--chat-accent)]/10' : ''
              }`}
            >
              {opt.getIcon({ size: 18, className: 'text-gray-400 dark:text-white/40' })}
              <span className="text-[0.8125rem] text-gray-700 dark:text-white/70">{t(opt.label)}</span>
            </button>
          ))}
        </div>
      </Dropdown>

      <Tooltip title={t('Close')}>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-white/70 transition-colors"
        >
          <CloseIcon size={20} />
        </button>
      </Tooltip>
    </div>
  );
};
