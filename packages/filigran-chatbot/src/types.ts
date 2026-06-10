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
  /**
   * Path for steering the agent mid-run (sending a message while a response
   * is still streaming). Default: '/chat/messages/steer'. The widget POSTs
   * `{ conversation_id, content, agent_slug }`; a 2xx response means the
   * message was persisted and will be injected into the running agentic loop
   * at the next iteration boundary. On a non-2xx response the optimistic
   * bubble is rolled back and the text is restored into the composer, so a
   * backend without steering support degrades gracefully. Set to null to
   * disable mid-run steering entirely.
   */
  steer?: string | null;
  /** Path for fetching agents. Default: '/chat/agents'. Set to null to disable. */
  agents?: string | null;
  /** Path for fetching session history. Default: '/chat/sessions'. Set to null to disable. */
  sessions?: string | null;
  /**
   * Path for the multi-conversation history menu. Defaults to the sessions
   * path: the widget lists past conversations via `GET {history}` and deletes
   * one via `DELETE {history}/{conversation_id}`. Set to null to hide the
   * history menu (e.g. when the backend only implements the session-restore
   * POST contract).
   */
  history?: string | null;
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
   *
   * Exception: in `singleEndpoint` mode the `/chat/files` default is NOT
   * applied (there is no per-path routing), so download cards stay disabled
   * unless this path is set explicitly to a proxy route.
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
  /**
   * Called when an agent-generated file download fails (non-2xx response or
   * network error). Lets the host surface the failure through its own
   * notification system (the chatbot has no toast surface of its own).
   */
  onDownloadError?: (error: unknown, attachment: ChatAttachment) => void;
  /** Maximum number of files attachable in one chat context. Default: 10. */
  maxFileCount?: number;
  /** Maximum total size in bytes for attached files. Default: 50 * 1024 * 1024 (50 MB). */
  maxTotalSize?: number;
  /** Additional HTTP headers added to chatbot API requests (messages, sessions, agents, uploads). */
  requestHeaders?: Record<string, string>;
  /**
   * Arbitrary contextual metadata about the host page/application, forwarded
   * to the backend alongside every message as a `context` JSON object so the
   * agent is aware of where the user is.
   *
   * The shape is up to the host. Today it typically carries the current
   * relative URL, e.g.
   * `{ url: '/dashboard/analyses/reports/<id>/overview' }`, and can be
   * extended later (page title, selected entity, user role, etc.).
   *
   * Must be JSON-serializable — it is sent via `JSON.stringify`. A
   * non-serializable value (circular reference, `BigInt`, etc.) is skipped
   * rather than thrown, so it can never break message sending.
   *
   * Read fresh at send time, so it always reflects the page the user is on
   * when the message is sent (not when the panel was opened). Only emitted
   * for the `rest` backend, and omitted entirely when empty.
   */
  pageContext?: Record<string, unknown>;
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
  /**
   * Accumulated model reasoning / pre-tool preamble prose for the turn
   * (from `thinking_text` events), surfaced in the reasoning-details panel
   * after the answer completes — mirroring the XTM One web chat.
   */
  reasoning?: string;
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

/**
 * A past conversation surfaced in the history menu (REST backend only).
 * Listed via `GET {apiBaseUrl}{apiEndpoints.history ?? apiEndpoints.sessions ?? '/chat/sessions'}`
 * — the optional `apiEndpoints.history` override takes precedence when the
 * proxy cannot route GET/DELETE on the sessions path.
 */
export interface ChatConversationSummary {
  conversationId: string;
  title: string;
  /** ISO timestamp of the last activity, used for the relative-time label. */
  updatedAt?: string;
  messageCount?: number;
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
