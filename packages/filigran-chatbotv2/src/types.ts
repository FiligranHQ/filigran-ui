export type ChatMode = 'sidebar' | 'floating' | 'fullscreen';

export interface ChatPanelProps {
  mode: ChatMode;
  onClose: () => void;
  onModeChange: (mode: ChatMode) => void;
  topOffset?: number;
  apiBaseUrl: string;
  agentDashboardUrl?: string;
  user: { firstName: string };
  t?: (key: string) => string;
  accentColor?: string;
  logoIcon?: React.ReactNode;
  promptSuggestions?: string[];
}

export interface ChatToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  label?: string;
  accentColor?: string;
  icon?: React.ReactNode;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: ChatFile[];
  toolNames?: string[];
  toolCallCount?: number;
  iterations?: number;
}

export interface AgentStatusState {
  status: string;
  tools?: string[];
}

export interface ChatFile {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

export interface XtmAgent {
  id: string;
  name: string;
  slug: string | null;
  icon: string | null;
  description: string | null;
}

export interface IconProps {
  className?: string;
  size?: number;
}
