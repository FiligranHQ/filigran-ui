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
  /** Path for uploading files. Default: '/chat/upload'. Set to null to disable file uploads. */
  upload?: string | null;
  /**
   * Base path for downloading agent-generated files. Default: '/chat/files'.
   * The download URL is built as
   * `${apiBaseUrl}${download}/${fileId}/download`, resolved against the
   * host app's own backend proxy. This keeps the download authenticated by
   * the host platform (e.g. OpenCTI / OpenAEV session) — the proxy mints
   * any upstream token server-side, so the user never authenticates to the
   * upstream chat service directly. Set to null to disable download chips.
   */
  download?: string | null;
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
  /** Optional text shown as a small chip in the chat header (e.g. draft context). */
  draftLabel?: string;
  /** Optional color used for the chat header bottom border in draft context. */
  draftBorderColor?: string;
  /** Enable resizable sidebar (drag to resize). Only applies when mode is 'sidebar'. */
  resizable?: boolean;
  /** Callback when sidebar width changes during resize. */
  onWidthChange?: (width: number) => void;
  /** Callback when resize drag starts. */
  onResizeStart?: () => void;
  /** Callback when resize drag ends. */
  onResizeEnd?: () => void;
  /** Disable file attachment and file paste management in the chat input. */
  disableFileManagement?: boolean;
  /** Called when a relative markdown link is clicked in assistant messages. */
  onRelativeLinkClick?: (href: string) => void;
  /** Maximum number of files attachable in one chat context. Default: 10. */
  maxFileCount?: number;
  /** Maximum total size in bytes for attached files. Default: 50 * 1024 * 1024 (50 MB). */
  maxTotalSize?: number;
  /** Additional HTTP headers added to chatbot API requests (messages, sessions, agents, uploads). */
  requestHeaders?: Record<string, string>;
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
  /** Agent-generated downloadable files attached to an assistant message. */
  attachments?: ChatAttachment[];
  toolNames?: string[];
  toolCallCount?: number;
  iterations?: number;
}

/**
 * An agent-generated file produced during a chat turn (via the backend
 * `generate_file` tool / custom-tool `$output_files`). Rendered as a
 * download card in assistant messages.
 *
 * Intentionally carries no absolute URL: the download is resolved against
 * the host app's backend proxy from `fileId` (see `ApiEndpoints.download`)
 * so the user stays authenticated to the host platform only.
 */
export interface ChatAttachment {
  fileId: string;
  filename: string;
  /** Short extension-style label surfaced under the filename (e.g. "PDF"). */
  type?: string;
  size?: number;
  contentType?: string;
  /**
   * `download_file` → prominent download card (user deliverable).
   * `working_file` → de-emphasized scratch/working artifact chip.
   */
  fileTag?: 'download_file' | 'working_file';
}

export interface AgentStatusState {
  status: string;
  tools?: string[];
  thinkingContent?: string;
}

export interface ChatFile {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  rawFile?: File;
  /** Server-side file ID returned after upload. */
  fileId?: string;
  /** Upload status: 'pending' while uploading, 'done' when uploaded, 'error' on failure. */
  uploadStatus?: 'pending' | 'done' | 'error';
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
