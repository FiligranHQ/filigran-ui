export type ChatMode = 'sidebar' | 'floating' | 'fullscreen';
export type BackendType = 'legacy' | 'rest' | 'ag-ui';

/**
 * Custom API endpoint configuration.
 * When using single endpoint mode (like OpenCTI's /chatbot), set singleEndpoint to true
 * and the component will POST everything to apiBaseUrl directly.
 */
export interface ApiEndpoints {
  /** If true, all requests go to apiBaseUrl as POST. Default false uses REST-style endpoints. */
  singleEndpoint?: boolean;
  /** Path for sending messages. Default: '/chat/messages' */
  messages?: string;
  /** Path for fetching agents. Default: '/chat/agents'. Set to null to disable. */
  agents?: string | null;
  /** Path for fetching session history. Default: '/chat/sessions'. Set to null to disable. */
  sessions?: string | null;
}

export interface ChatPanelProps {
  mode: ChatMode;
  onClose: () => void;
  onModeChange: (mode: ChatMode) => void;
  topOffset?: number;
  apiBaseUrl: string;
  /** Custom API endpoint configuration. */
  apiEndpoints?: ApiEndpoints;
  agentDashboardUrl?: string;
  user: { firstName: string };
  t?: (key: string) => string;
  accentColor?: string;
  logoIcon?: React.ReactNode;
  promptSuggestions?: string[];
  /** Enable resizable sidebar (drag to resize). Only applies when mode is 'sidebar'. */
  resizable?: boolean;
  /** Callback when sidebar width changes during resize. */
  onWidthChange?: (width: number) => void;
  /** Callback when resize drag starts. */
  onResizeStart?: () => void;
  /** Callback when resize drag ends. */
  onResizeEnd?: () => void;
  /** 
   * CSS selector for the main content element that should be pushed when sidebar is open.
   * When set, the component will automatically apply margin-right to push the content.
   * Example: '#main-content' or '.app-content'
   */
  pushContentSelector?: string;
  /**
   * Backend protocol to use.
   * - 'rest': XTM One Chat API (default)
   * - 'legacy': Single POST endpoint with Flowise-style SSE events
   * - 'ag-ui': AG-UI protocol (https://github.com/ag-ui-protocol/ag-ui)
   */
  backendType?: BackendType;
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
