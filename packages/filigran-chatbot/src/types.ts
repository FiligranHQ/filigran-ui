/** The modes the header's view switcher offers. */
export type ChatMode = 'sidebar' | 'floating' | 'fullscreen';
/**
 * Every mode the panel renders in. `inline` fills the host's container instead
 * of floating over the page, for a host that gives the chat a page of its own.
 */
export type ChatPanelMode = ChatMode | 'inline';

/**
 * The host's translation lookup, passed down to every component that renders
 * text. Key in, translated string out — the package never owns a dictionary of
 * its own, and never asks the host's `t` for more than a lookup: values are
 * spliced into the *translated* sentence by `translate()` in `utils`, so a key
 * is always a whole sentence and a locale stays free to reorder it.
 */
export type Translate = (key: string) => string;
export type BackendType = 'legacy' | 'rest' | 'ag-ui';
/** A user's rating of one assistant answer. */
export type MessageFeedback = 'up' | 'down';

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
  /**
   * Path for submitting tool-approval decisions when the agent pauses on a
   * gated tool call. The widget POSTs
   * `{ conversation_id, decisions: [{ tool_call_id, decision, rejection_reason }] }`
   * and the paused turn resumes on the same stream with the tool result.
   *
   * **No default, unlike every sibling entry, and that is deliberate.** Setting
   * this is what makes the widget advertise `supports_tool_approval` to the
   * backend, and advertising it is a promise to answer: a backend that pauses a
   * turn waits indefinitely for a decision, with no timeout and no safe default
   * action to take on the reviewer's behalf. If this path defaulted to XTM
   * One's own route, a host proxying the chat (OpenCTI, OpenAEV, OpenGRC) could
   * upgrade the widget without adding the matching proxy route, claim support,
   * receive the pause, POST the decision into a 404 — and hang the turn with
   * the user watching a spinner.
   *
   * While unset the widget never claims support and the backend degrades to a
   * plain assistant message explaining what it could not run, which is why an
   * un-updated host keeps working untouched.
   *
   * REST backend only: `legacy` and `ag-ui` never meet this gate.
   */
  approve?: string | null;
  /**
   * Base path for recovering what a paused turn is still waiting on, read as
   * `GET {apiBaseUrl}{pendingApprovals}/{conversation_id}/pending-approvals`
   * (the same base-plus-suffix idiom as {@link ApiEndpoints.download}). XTM
   * One serves it at `/chat/conversations`.
   *
   * `approval_required` is a single event on a stream, so a reload loses it —
   * including the `tool_call_id`s a decision has to name. The turn is left
   * waiting for an answer nobody can give, which reads as a chat that simply
   * stopped replying. The panel therefore asks once per conversation on mount;
   * an empty list is the ordinary answer.
   *
   * No default, for the same reason as {@link ApiEndpoints.approve}: a proxied
   * host has to expose the route before the panel starts calling it. Unset, the
   * live flow still works and only reload recovery is absent.
   *
   * A voice call also reads its `turn` here when the turn its question waits
   * on has been silent for 120 s: `running` keeps the wait.
   */
  pendingApprovals?: string | null;
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
  /**
   * Path for the prompt library shown in the composer toolbar.
   * Default: '/chat/prompts'. Set to null to hide the affordance.
   *
   * Visibility is data-driven on purpose: a host that does not serve this
   * route simply has no prompt button, so there is no separate "mode" to keep
   * in step with what the backend actually implements.
   */
  prompts?: string | null;
  /**
   * Path for the quota indicator shown in the composer toolbar.
   * Default: '/chat/quota'. Set to null to hide the affordance.
   */
  quota?: string | null;
  /**
   * Path for per-agent suggested actions shown on the welcome screen.
   * Default: '/chat/suggestions'. Set to null to always use the host's
   * `promptSuggestions` prop instead.
   *
   * Called as `GET {suggestions}?agent_slug=<slug>`. A backend that ignores
   * the parameter still answers with a generic set, so the same route carries
   * both today's generic suggestions and per-agent (later per-user) ones.
   */
  suggestions?: string | null;
  /**
   * Base path of the persisted message feedback resource. A rating is sent as
   * `POST {apiBaseUrl}{feedback}/{conversation_id}/messages/{message_id}/feedback`
   * with `{ rating: 'positive' | 'negative', comment: string | null }` and
   * retracted with a `DELETE` on the same URL. XTM One's platform router
   * serves it at `/chat/conversations`.
   *
   * No default, for the same reason as {@link ApiEndpoints.approve}: a host
   * proxying the chat names the route once it exposes it, and a panel upgraded
   * before its host never rates into a 404. Unset, the thumbs still render
   * when the host passes `onMessageFeedback`, as they always did.
   *
   * REST backend only, and not in `singleEndpoint` mode.
   */
  feedback?: string | null;
  /**
   * Path of the caller's workspaces, which the conversation list is grouped
   * by (XTM One serves it at `/chat/workspaces`). The panel lists them with
   * `GET {workspaces}`, creates one with `POST`, renames one with
   * `PATCH {workspaces}/{id}` and deletes one with `DELETE {workspaces}/{id}`;
   * it files a conversation with `PATCH {history}/{conversation_id}` and
   * `{ workspace_id }`, and starts one inside a workspace by sending
   * `workspace_id` with the session `POST`.
   *
   * No default, for the same reason as {@link ApiEndpoints.approve}: a
   * proxied host has to expose all of those routes before the panel offers
   * the feature. Unset (or a backend that refuses the list), the history is
   * the flat list it always was.
   *
   * REST backend only, and not in `singleEndpoint` mode.
   */
  workspaces?: string | null;
  /**
   * Path of the conversations a message can reference with `@` in the
   * composer (XTM One serves it at `/chat/conversation-references`). Typing
   * `@` opens a menu searched with
   * `GET {conversationReferences}?q=<typed text>&limit=8&exclude=<current conversation id>`,
   * answered with `{ conversations: [{ id, title, key, updated_at, is_own }] }`:
   * the conversations the user can open, most recent first. A pick inserts
   * `@<key>`, and the message is sent with the ids of the picks it still
   * holds as `referenced_conversation_ids` (at most 5); a restored user
   * message lists them under `conversation_refs`.
   *
   * No default, for the same reason as {@link ApiEndpoints.approve}: a proxied
   * host has to expose the route, and forward the field, before the composer
   * offers the menu. Unset, `@` is plain text and the message body is
   * unchanged.
   *
   * REST backend only, and not in `singleEndpoint` mode.
   */
  conversationReferences?: string | null;
  /**
   * Base path of the decks, reports and videos an answer made (XTM One serves
   * it at `/chat/artifacts`). Their cards download one through
   * `POST {apiBaseUrl}{artifacts}/{kind}/{id}/download` with `{ format }`, and
   * follow a video still rendering through `GET {apiBaseUrl}{artifacts}/{kind}/{id}`.
   *
   * No default, for the same reason as {@link ApiEndpoints.approve}: a proxied
   * host has to forward both routes before the cards offer them. Unset, the
   * cards still render, with `Open in XTM One` and no download.
   *
   * REST backend only.
   */
  artifacts?: string | null;
  /**
   * Path that stops the running turn on the backend, POSTed `{ conversation_id }`
   * by Stop. For a backend whose turns outlive their stream: the panel then waits
   * for the stream's `cancelled` frame rather than dropping the stream. Unset,
   * Stop drops the stream.
   *
   * No default. REST backend only.
   */
  cancel?: string | null;
  /**
   * Path that ends an agent's announced wait (`status: wait_start`) early,
   * POSTed `{ conversation_id }` by the waiting indicator's "Continue now".
   *
   * No default. REST backend only.
   */
  skipWait?: string | null;
  /**
   * Base path of a conversation's event stream, read as
   * `GET {apiBaseUrl}{events}/{conversation_id}/events?client_id=<panel>`: an
   * SSE stream of the turns this panel did not start (another tab, a reload
   * mid-turn), `user_message`, `conversation_title` and `approval_resolved`.
   * The message `POST` then carries the same id in `X-Chat-Client-Id`, so the
   * backend never relays a panel's own turn back to it.
   *
   * No default. REST backend only.
   */
  events?: string | null;
  /**
   * Base path of a conversation's older messages, read as
   * `GET {messagesPage}/{conversation_id}/messages?before=<oldest message id>&limit=50&supports_artifacts=true`
   * and answered with `{ messages, has_more }` (entries shaped like a restore's).
   * The restore's own `has_more` says whether there are any; "Load earlier
   * messages" then fetches them a page at a time.
   *
   * No default. REST backend only.
   */
  messagesPage?: string | null;
  /**
   * Path that deletes every conversation of the history, as `DELETE {clearAll}`:
   * the conversation list then offers "Clear all".
   *
   * No default. REST backend only.
   */
  clearAll?: string | null;
  /**
   * Path that reads text aloud: `POST {tts}` with `{ text, format: 'mp3' }`,
   * answered with the audio. Read aloud and the voice call
   * (`ChatPanelHandle.startVoiceCall`) then use the backend's voice, and the
   * browser's when the route fails.
   *
   * No default. REST backend only.
   */
  tts?: string | null;
}

/** A reusable prompt the user can insert into the composer. */
export interface ChatPromptTemplate {
  id: string;
  title: string;
  /** The text inserted into the composer when picked. */
  content: string;
  description?: string;
}

/**
 * Agentic quota headroom for the current user, as the composer indicator needs
 * it — deliberately just the three numbers it renders. Where the limit comes
 * from (user override, group, platform, licence) is the host platform's own
 * business and has no place on an embedded surface.
 */
export interface ChatQuotaStatus {
  used: number;
  /** null means unlimited — the indicator then shows usage without a bar. */
  limit: number | null;
  /**
   * The period the limit applies to: `daily`, `monthly` and `yearly` are
   * translated ("today", "this month", "this year"), any other value is shown
   * as sent.
   */
  period: string;
  /**
   * Whose actions count against the limit: `global` is one allowance shared
   * by every user of the platform, which the indicator says in its tooltip.
   * Absent reads as the user's own.
   */
  scope?: 'user' | 'global';
}

/**
 * One tool call the agent wants to make and is waiting on a human to approve.
 *
 * `inputSchema` travels alongside `arguments` so each value can be rendered
 * with the tool's own description of what it means. That pairing is the whole
 * point: `cascade: true` is unjudgeable on its own, while "cascade — also
 * delete linked entities" is a decision someone can actually make. A prompt
 * that shows names and values alone is a rubber stamp wearing the costume of a
 * safety control.
 */
export interface ToolApprovalProposal {
  /**
   * Identity of the proposed call, and the key every decision is sent back on.
   * Never the tool name: one turn can propose the same tool twice with
   * different arguments.
   */
  toolCallId: string;
  /** Empty when the backend named no tool; the UI labels that case itself. */
  toolName: string;
  toolDescription?: string;
  arguments: Record<string, unknown>;
  /** JSON Schema the arguments came from, used to label each one. */
  inputSchema?: Record<string, unknown>;
  /** Where the tool comes from, e.g. `integration:opencti`. */
  source?: string;
}

/**
 * A reviewer's verdict on one proposed call.
 *
 * There is deliberately no "edit the arguments" verdict. Rewriting a call under
 * the agent's name would leave a transcript crediting it with arguments it
 * never chose, and turn a yes/no judgement into authoring. A wrong proposal is
 * corrected by rejecting it with a reason the agent can act on.
 */
export type ToolApprovalVerdict = 'approve' | 'approve_always' | 'reject';

/** One decision, ready to be sent back to the paused turn. */
export interface ToolApprovalDecision {
  toolCallId: string;
  verdict: ToolApprovalVerdict;
  /**
   * Why the call was declined. Optional, and the agent's only signal to correct
   * itself — with argument editing gone, a rejection *is* the correction
   * channel.
   */
  rejectionReason?: string;
}

/**
 * How full the model's context window is for the current conversation, as the
 * composer gauge needs it — a ratio, so both halves are required.
 *
 * `used` is the backend's own estimate of what the next turn will carry, not a
 * billed token count: it is the figure the agent loop budgets its compaction
 * against, which is what makes the gauge predictive of the summarising the user
 * is about to see rather than a receipt for the turn that just ended.
 */
export interface ChatContextUsage {
  /** Estimated tokens currently occupying the window. */
  used: number;
  /** The model's context window, in tokens. Always > 0. */
  limit: number;
  /** Where those tokens went, when the backend reports it. */
  breakdown?: ChatContextBreakdown;
}

/**
 * What the context is being spent on, in tokens.
 *
 * Buckets are grouped by what the user can *do* about each: they can start a new
 * chat (`conversation`), they cannot shrink the agent's persona (`system`), and
 * the two the backend manages on their behalf (`summary`, `toolResults`) are
 * what explain a long chat that seems to have forgotten things.
 *
 * Every key is optional and only non-zero ones are reported, so a backend that
 * measures a different set — or none — still renders. Tool definitions are
 * included even though some backends may not count them in their compaction
 * gate; the gauge is meant to reflect what the prompt actually carries.
 */
export interface ChatContextBreakdown {
  /** The agent's system prompt and any in-run instructions. */
  system?: number;
  /** Schemas of the platform's built-in tools. */
  tools?: number;
  /** Schemas of the agent's own integrations, MCP servers and custom tools. */
  dynamicTools?: number;
  /** Digests of earlier turns produced by the backend's compaction. */
  summary?: number;
  /** The user's and assistant's own messages. */
  conversation?: number;
  /** Output of tool calls still held verbatim in the context. */
  toolResults?: number;
}

/**
 * What a host's design system sets on the panel (`ChatPanelProps.theme`):
 * CSS values, each the `--filigran-chat-*` variable named beside it.
 */
export interface ChatPanelTheme {
  /** The panel's background inline and fullscreen (`--filigran-chat-surface`). */
  surface?: string;
  /** The panel's background as a sidebar or floating card, and its dialogs' (`--filigran-chat-surface-raised`). */
  surfaceRaised?: string;
  /** Inputs, cards, a table's or a code block's header: a shade off the surface (`--filigran-chat-surface-subtle`). */
  surfaceSubtle?: string;
  /** A row or a button under the pointer (`--filigran-chat-surface-hover`). */
  surfaceHover?: string;
  /** The header's background image, `none` for the surface alone (`--filigran-chat-header-background`). */
  headerBackground?: string;
  /** Text (`--filigran-chat-text`). */
  text?: string;
  /** Faint text: times, labels, hints (`--filigran-chat-text-muted`). */
  textMuted?: string;
  /** Secondary text: table cells, chips, list items, notices (`--filigran-chat-text-secondary`). */
  textSecondary?: string;
  /** Dividers and outlines (`--filigran-chat-border`). */
  border?: string;
  /** The size of an answer's prose, its headings in proportion (`--filigran-chat-text-size`). */
  textSize?: string;
  /** A user's message: background, text, corners, padding and size (`--filigran-chat-user-*`). */
  userBackground?: string;
  userText?: string;
  userRadius?: string;
  userPadding?: string;
  userTextSize?: string;
  /** Code: its font, size and background (`--filigran-chat-font-mono`, `-code-size`, `-code-surface`). */
  fontMono?: string;
  codeSize?: string;
  codeSurface?: string;
}

export interface ChatPanelProps {
  mode: ChatPanelMode;
  /** Shows the close button; inline mode has none. */
  onClose?: () => void;
  /** Shows the view switcher; inline mode has none. */
  onModeChange?: (mode: ChatMode) => void;
  topOffset?: number;
  apiBaseUrl: string;
  /** Custom API endpoint configuration. */
  apiEndpoints?: ApiEndpoints;
  /**
   * The XTM One URL: the header's "Browse agents" / "Create agent" links, and
   * the waiting panel's invitation to play the arcade there
   * (`{agentDashboardUrl}/chat?arcade=play`, unless `waitingGameUrl` says
   * where). Only an http(s) URL is linked.
   */
  agentDashboardUrl?: string;
  /**
   * Where the waiting panel's invitation to play leads, over
   * `{agentDashboardUrl}/chat?arcade=play`: an http(s) URL or a path of the
   * host's own origin (`/…`); anything else links nothing.
   */
  waitingGameUrl?: string;
  user: { firstName: string };
  /**
   * The host's translations, over the panel's own catalog: a key it returns
   * unchanged falls back to the catalog in `locale`, or to English when no
   * `locale` is passed.
   */
  t?: Translate;
  accentColor?: string;
  logoIcon?: React.ReactNode;
  promptSuggestions?: string[];
  /** Accepted, and not shown. */
  draftLabel?: string;
  /** Color of the line above the composer (e.g. a draft context). */
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
  /**
   * Show the waiting panel during longer waits: rotating status messages and
   * an invitation to play XTM One's Space Invaders arcade, in a new tab
   * through `agentDashboardUrl` or in place through `onPlayWaitingGame`. The
   * package ships no game of its own. Host-level master switch. Default: true.
   */
  miniGameEnabled?: boolean;
  /**
   * Opens the arcade in place instead of linking to XTM One, for a host that
   * runs it itself (the XTM One floating assistant). Wins over the link.
   */
  onPlayWaitingGame?: () => void;
  /**
   * Notify the user when a long-running turn finishes while they are not
   * watching the chat — away (tab hidden / another window) via a document-title
   * flash and a browser notification (when already granted), or in-app with the
   * chat panel closed/hidden via the `onTaskComplete` host toast. Default: true.
   */
  notifyOnComplete?: boolean;
  /**
   * Called when a long turn finishes and the user is not actively watching the
   * chat (away, or in-app with the chat panel closed/hidden) so the host can
   * raise its own in-app toast (the chatbot has no toast surface of its own).
   * Receives the already-translated `title` and `body`.
   */
  onTaskComplete?: (title: string, body: string) => void;
  /**
   * Receives each rating of an assistant answer. `messageId` is the persisted
   * id when the backend reported one (`serverId`), else the panel's own id;
   * `feedback` is `null` when the user clears a previous rating.
   *
   * With {@link ApiEndpoints.feedback} set the panel stores the rating itself
   * and calls this once the backend accepted it. Without it, passing this is
   * what shows the 👍/👎 affordance: the host stores the rating, so a host with
   * neither shows no buttons.
   */
  onMessageFeedback?: (messageId: string, feedback: MessageFeedback | null, message: ChatMessage) => void;
  /**
   * The user's language as a BCP 47 tag (`'fr'`, `'en-US'`): the language the
   * panel speaks (its own catalog: en, es, fr, ja) where `t` does not
   * translate a key, formats the time under each message and is the language
   * answers are read aloud in. Default: the browser's own, except that a host
   * passing `t` and no `locale` gets no catalog.
   */
  locale?: string;
  /**
   * Disable the inline preview of image attachments (they render as ordinary
   * download cards instead). Previews fetch the image through the host download
   * proxy, so hosts that meter or restrict that endpoint can opt out.
   * Default: false.
   */
  disableImagePreviews?: boolean;
  /**
   * Show how full the model's context window is for the current conversation
   * — a small ring plus percentage in the composer toolbar, so the user can
   * see a long chat approaching the point where the agent starts summarising
   * older turns and decide to split the work instead. Default: true.
   *
   * A host-level master switch, not a mode flag: the gauge is data-driven and
   * simply absent until the backend reports occupancy (only the XTM One REST
   * backend does today), so leaving this on costs nothing on a backend that
   * says nothing.
   */
  contextUsageEnabled?: boolean;
  /**
   * Rendered into the composer toolbar, after the built-in controls.
   *
   * The escape hatch for anything the package has no business knowing about —
   * XTM One's session-tool picker (integrations, MCP servers, knowledge bases)
   * being the motivating case. A host that passes nothing gets no extra
   * controls, so this doubles as the "product" toolbar: there is no mode flag
   * to keep in step, only the presence or absence of what a host provides.
   */
  composerToolbar?: React.ReactNode;
  /**
   * Namespaces every key the panel keeps in browser storage (conversation,
   * agent, drafts, widths), for a host mounting more than one panel.
   */
  storageKeyPrefix?: string;
  /**
   * The conversation on screen, when the host owns it (a `?c=` URL): `null`
   * is a new chat. Left `undefined`, the panel remembers its own.
   */
  conversationId?: string | null;
  /** Called whenever the conversation on screen changes, whoever changed it. */
  onConversationChange?: (conversationId: string | null) => void;
  /** Agent selected once the list loads, by id or slug, over the remembered one. */
  initialAgent?: string;
  /** Called when another agent is picked. */
  onAgentChange?: (agent: XtmAgent) => void;
  /** Hides the composer: a conversation the user may read but not write to. */
  readOnly?: boolean;
  /** Shown in place of the composer while `readOnly`. */
  readOnlyNotice?: React.ReactNode;
  /**
   * Fields merged into every REST message body, read at send time: the host's
   * own per-message options (tool selection, run mode). They never override
   * the panel's fields (`content`, `conversation_id`, …).
   */
  getRequestExtras?: () => Record<string, unknown> | undefined;
  /**
   * Every frame received, on the message stream (`relayed: false`) or the event
   * stream (`relayed: true`), including those the panel does not render: the
   * host's way to react to backend-specific events.
   */
  onStreamEvent?: (event: Record<string, unknown>, info: ChatStreamEventInfo) => void;
  /**
   * The user's session ended: a `session_expired` frame on either stream, or a
   * `401` whose body's `detail.code` is `session_expired` on any request the
   * panel makes. *reason* is the frame's or the `detail`'s `reason`, when it
   * gives one. Called once per set of `requestHeaders`: again only once they
   * change.
   */
  onSessionEnded?: (reason: string | undefined) => void;
  /**
   * Cards for the `[[KIND:args]]` markers an answer embeds, by marker name
   * (`WORK_ITEM`, `INVESTIGATION`): rendered where the marker stands. Naming
   * `FILE`, `PRESENTATION`, `REPORT` or `VIDEO` replaces the built-in card. A
   * marker no renderer names stays text.
   */
  markerRenderers?: Record<string, ChatMarkerRenderer>;
  /**
   * Renderers for fenced code blocks, by the fence's language (```` ```chart ````,
   * matched case-insensitively): the node returned stands in place of the code
   * block (a chart, a diagram, a table drawn from the block's data). The
   * renderer gets the block's text, and `streaming` while the answer is still
   * coming, when the block may be incomplete. One that throws, or whose node
   * does, shows `This item could not be loaded.` and leaves the rest of the
   * answer alone. A language no renderer names stays a code block.
   */
  codeBlockRenderers?: Record<string, ChatCodeBlockRenderer>;
  /**
   * Rewrites a message's text before it is shown, copied or read aloud: the
   * host's own markup (masking secrets, converting a channel's syntax). One
   * that throws leaves the text as it came.
   */
  transformMessageText?: (text: string, message: ChatMessage) => string;
  /** Opens a deck, report or video in the host itself, in place of the link to XTM One. */
  onArtifactOpen?: (artifact: ChatArtifact) => void;
  /** Controls added to the header, before New chat. */
  headerActions?: React.ReactNode;
  /** Shown above the thread: notices about the conversation as a whole. */
  banner?: React.ReactNode;
  /** Shown above the composer, inside it: what the next message will act on. */
  composerHeader?: React.ReactNode;
  /** Shown after the last message, inside the thread. */
  transcriptFooter?: React.ReactNode;
  /** Replaces the welcome screen of an empty conversation. */
  welcome?: React.ReactNode;
  /** Rendered under a message's content, before its footer; `context.streaming` while the answer is still coming. */
  renderMessageExtras?: (message: ChatMessage, context: ChatMessageSlotContext) => React.ReactNode;
  /** Controls added to a finished message's footer. */
  messageFooterActions?: (message: ChatMessage, context: ChatMessageSlotContext) => React.ReactNode;
  /** Controls added to a conversation's row in the conversation list. */
  sidebarRowActions?: (conversation: ChatConversationSummary) => React.ReactNode;
  /** Controls added beside New conversation, atop the conversation list. */
  sidebarHeaderActions?: React.ReactNode;
  /** Sections added under the conversation list (conversations shared with the user). */
  sidebarSections?: React.ReactNode;
  /** The status line's text for a status, over the built-in one; `undefined` keeps it. */
  statusLabel?: (status: AgentStatusState) => string | undefined;
  /** The rotating messages of the waiting panel, already translated. */
  waitingMessages?: string[];
  /** Replaces the waiting panel's content (its messages and the invitation to play). */
  renderWaitingPanel?: () => React.ReactNode;
  /** Font of the panel's text; the package's own otherwise. */
  fontFamily?: string;
  /**
   * The host's colours, type and shapes, as CSS values (a host's own
   * variables, `var(--x)`, follow its light and dark modes); each one unset
   * keeps the panel's own. The same `--filigran-chat-*` variables can be set
   * in CSS on an ancestor instead.
   */
  theme?: ChatPanelTheme;
  /**
   * Called once, when the panel has chosen its agent and read back the
   * conversation on screen. Calls made through the handle before then wait
   * for it, and run in order.
   */
  onReady?: () => void;
  /**
   * Sees every send first, from the composer or the handle: `false` takes it
   * over (nothing is sent, the composer keeps its text), an object rewords it
   * (`text`), shows the user something other than what is sent (`displayText`)
   * or adds fields to its body (`extras`).
   */
  onBeforeSend?: (draft: ChatSendDraft) => ChatSendDecision;
  /**
   * What became of a message held until the turn ended (a send that resolved
   * `'held'`): sent, refused, dropped (nothing of it the user typed: Stop ended
   * its turn, or `onBeforeSend` took it over as it leaves), given back to the
   * composer (the same, with what the user typed for it; told once the
   * composer shows it, so `getDraft` reads it), or cancelled (by the user, or
   * a new conversation). A message sent after a stopped turn ended goes out
   * once that turn winds down. Messages held together settle together.
   */
  onHeldSendSettled?: (text: string, outcome: ChatHeldOutcome) => void;
  /**
   * Called when a turn starts or stops running: on screen (the Stop button and
   * the status line show), or a relayed turn let go of while the page was
   * hidden; the state `ChatSendDraft.turnRunning` reports. True for the
   * panel's own turn from its send, and for a turn the event stream relays;
   * false once it ends - its stream closes after the last `done` (an
   * intermediate one goes on), an `error`, `cancelled` or `session_expired`
   * frame, a Stop, a new conversation - and when the panel unmounts during a
   * turn. A relayed turn let go of with the event stream runs on until the
   * reopened stream replays it, or the conversation read back says how it
   * ended. Called on changes only, never with the value it last gave. With
   * `false` comes how the turn ended (`info.ended`): answered, stopped or
   * failed (see `ChatTurnOutcome`). After a provisional end (an `error` or
   * `cancelled` whose stored end is still to come, from a backend whose turns
   * outlive their stream) `false` comes at once, while the panel still holds
   * sends as the turn winds down: until its stored end or its stream's close,
   * at most 5 s.
   */
  onTurnRunningChange?: (running: boolean, info?: ChatTurnEnd) => void;
  /**
   * Uploaded files may steer the running turn: the steer route takes
   * `file_ids`. Without it, a message with files waits for the turn to end.
   */
  steerAttachments?: boolean;
  /**
   * A message that cannot steer the running turn (files that cannot steer,
   * references, mentions, fields of its own, a turn that just ended) is held
   * and sent as the next turn once it ends,
   * rather than waiting in the composer. A turn winding down after a
   * provisional end (until its stored end or its stream's close, at most 5 s;
   * see `onTurnRunningChange`) holds sends with or without it.
   */
  holdSendsDuringTurn?: boolean;
  /**
   * `@` in the composer also mentions the agents of the agent list (above the
   * conversations, when those are offered): the message carries the ids of
   * the agents it still mentions as `mentioned_agent_ids`, in mention order.
   * A message that mentions an agent never steers the running turn.
   */
  agentMentions?: boolean;
  /**
   * Hides the conversation list that fullscreen and inline modes show beside
   * the thread, for a panel too narrow for both (a rail, a task pane; the
   * thread, header and composer hold at 320 px). The history stays: the
   * header's history menu lists, opens and deletes conversations and offers
   * Clear all, and a referenced conversation still opens in the panel. The
   * `sidebar*` slots render nothing meanwhile. Default: false.
   */
  hideConversationList?: boolean;
}

/** What a marker card is drawn from. */
export interface ChatMarkerContext {
  message: ChatMessage;
  /** The answer is still streaming. */
  streaming: boolean;
}

/** How one kind of `[[KIND:args]]` marker renders. */
export interface ChatMarkerRenderer {
  /** The card for one marker; *args* is everything after `KIND:`. */
  render: (args: string, context: ChatMarkerContext) => React.ReactNode;
  /** Show it while the answer streams; by default it shows once the answer is done. */
  renderWhileStreaming?: boolean;
  /** Give it the thread's full width rather than the prose's. */
  fullWidth?: boolean;
}

/** What a code block renderer is drawn from. */
export interface ChatCodeBlockContext {
  /** The answer is still streaming: the block may not be complete yet. */
  streaming: boolean;
}

/** Renders one fenced code block of a language (see `ChatPanelProps.codeBlockRenderers`); *code* is the block's text. `null` keeps the block as code. */
export type ChatCodeBlockRenderer = (code: string, context: ChatCodeBlockContext) => React.ReactNode;

/** What a message slot (`renderMessageExtras`, `messageFooterActions`) is drawn with. */
export interface ChatMessageSlotContext {
  /** The message is the answer still being written. */
  streaming: boolean;
}

/** Where a frame passed to `onStreamEvent` came from, and what the panel read in it. */
export interface ChatStreamEventInfo {
  /** True for a turn this panel did not start, relayed by the event stream. */
  relayed: boolean;
  /**
   * The frame ends a turn: `'provisional'` for an `error` or `cancelled` marked
   * `provisional: true` (its stored end follows), `'stored'` for
   * an end carrying the stored answer's `message_id` (a `done` that is not
   * intermediate, a `cancelled` or an `error`). Absent on any other frame.
   */
  end?: 'provisional' | 'stored';
  /** The frame acknowledges a turn replayed from its start (`thinking` with `resumed`). */
  replayed?: boolean;
}

/** What a host can do to a mounted panel, through its `ref`. */
export interface ChatPanelHandle {
  /** Send *text* as the user, leaving the composer's own draft alone; resolves to what became of it. */
  send: (text: string, options?: ChatSendOptions) => Promise<ChatSendOutcome>;
  /** Start a new conversation, in a workspace and with an agent (id or slug) if given. */
  newConversation: (options?: { workspaceId?: string; agent?: string }) => void;
  selectConversation: (conversationId: string) => void;
  /** Replace the composer's text. */
  setDraft: (text: string) => void;
  /**
   * The composer's text as it stands (what the user typed, or `setDraft` set):
   * e.g. for `onBeforeSend` taking over a held message (`draft.held`), to tell
   * whether the composer still holds what was typed for it.
   */
  getDraft: () => string;
  focusComposer: () => void;
  /** Same as the Stop button; also cancels the question a voice call awaits, and stops it speaking. */
  stop: () => void;
  /**
   * Start a voice call over the panel: the browser listens, a phrase is sent
   * after a second of silence (`onBeforeSend` sees `source: 'voice'`), and the
   * answer is spoken through {@link ApiEndpoints.tts} (the browser's voice
   * without it), until the user ends the call. Only the final answer of the
   * turn that answers the question is spoken, and only the addressed agent's;
   * the other agents' replies are shown by name. `false` when it cannot
   * start: no speech recognition in this browser (`voiceCallSupported()`), or
   * `readOnly`.
   */
  startVoiceCall: () => boolean;
  /** Read the agent list again, keeping the agent picked unless it is gone. */
  reloadAgents: () => void;
  /** Scroll to a message on screen (by its server id) and highlight it; false when it is not there. */
  scrollToMessage: (messageId: string) => boolean;
}

/** A send about to leave, as `onBeforeSend` sees it. */
export interface ChatSendDraft {
  text: string;
  /** Typed in the composer, sent through the handle, or spoken in a voice call. */
  source: 'composer' | 'host' | 'voice';
  /** A turn is running. */
  turnRunning: boolean;
  /**
   * A message held while a turn ran, asked about again as it leaves, the turn
   * over (`turnRunning: false`), each send held with it on its own. `false`
   * then gives what the user typed for it (its text, files, references and
   * mentions) back to the composer, after what they typed since. A held
   * message every send of which is taken over is settled `'returned'` by
   * `onHeldSendSettled`, or `'dropped'` when the user typed none of it (a
   * host's or a voice call's).
   */
  held?: boolean;
}

/**
 * What became of a send: the backend took it as a new turn, it joined the
 * running one, it waits for that turn to end (or for one ended provisionally
 * to wind down, with or without `holdSendsDuringTurn`), it went nowhere, or
 * the backend refused it.
 */
export type ChatSendOutcome = 'sent' | 'steered' | 'held' | 'dropped' | 'failed';

/** What became of a held message once its turn ended (see `onHeldSendSettled`). */
export type ChatHeldOutcome = 'sent' | 'failed' | 'dropped' | 'returned' | 'cancelled';

/**
 * How a turn ended (see `onTurnRunningChange`):
 * - `'answered'`: its last `done` came (not an intermediate one), and nothing
 *   after it said otherwise; for a relayed turn that ended out of sight (no
 *   replay, or an event stream that could not reopen), the conversation read
 *   back holds an answer stored after what was shown;
 * - `'stopped'`: it ended short of its answer - a `cancelled` frame (even
 *   after the last `done`), a `session_expired` frame, Stop, a new
 *   conversation, the panel unmounting, a stream that closed before its last
 *   `done` with no event stream to carry the turn to its end, or a relayed
 *   turn that ended out of sight with no answer read back (none stored, or no
 *   read-back);
 * - `'failed'`: an `error` frame, or a send the backend refused or could not
 *   be reached for, before the turn streamed anything.
 */
export type ChatTurnOutcome = 'answered' | 'stopped' | 'failed';

/** What `onTurnRunningChange(false, info)` says of the turn that ended. */
export interface ChatTurnEnd {
  ended: ChatTurnOutcome;
}

/**
 * What `onBeforeSend` decides: `false` takes the send over, an object adjusts it.
 * `text` is what the backend receives; `displayText` is what the user's bubble
 * shows in its place (a prompt wrapped in the host's context, shown as typed).
 * Without `displayText` the bubble shows the text sent. A conversation read
 * back shows what the backend stored.
 */
export type ChatSendDecision = false | { text?: string; displayText?: string; extras?: Record<string, unknown> } | void;

/** Per-send options of {@link ChatPanelHandle.send}. */
export interface ChatSendOptions {
  /** Merged into that one message's request body (see `getRequestExtras`). */
  extras?: Record<string, unknown>;
  /**
   * What the user's bubble shows in place of the text sent, as `onBeforeSend`'s
   * `displayText` does (which wins when it gives one).
   */
  displayText?: string;
}

export interface ChatToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  /** Overrides the built-in label; already translated by the host. */
  label?: string;
  t?: Translate;
  /** BCP 47 tag of the label's language when the host does not translate it (see `ChatPanelProps.locale`). */
  locale?: string;
  accentColor?: string;
  icon?: React.ReactNode;
}

export interface ChatMessage {
  /** The panel's own key for the row; stable for the life of the row. */
  id: string;
  /**
   * The backend's id for the message: the `done` event's `message_id` for a
   * live answer, the entry's `id` for a restored one. What feedback is stored
   * against; absent until the backend reports it.
   */
  serverId?: string;
  role: 'user' | 'assistant';
  content: string;
  /** When the message was sent: the entry's `created_at` for a restored one. */
  timestamp: Date;
  /**
   * True for a restored message whose backend did not say when it was sent:
   * `timestamp` is then the time of the restore, and the footer shows no time
   * rather than that one.
   */
  timestampUnknown?: boolean;
  /**
   * The rating the user gave this answer before the conversation was restored.
   * The panel locks the thumbs on it ("Feedback already submitted").
   */
  feedback?: ChatMessagePersistedFeedback;
  /**
   * The agent that produced *this* message, when the backend says so.
   *
   * Takes precedence over the panel-wide name, which is the currently selected
   * agent and therefore wrong for history: reopening a thread used to relabel
   * every past answer with whoever happened to be picked in the menu. Optional,
   * because no backend records per-message attribution yet — the panel falls
   * back to the conversation's agent, then to the selected one.
   */
  agentName?: string;
  /**
   * The agent that wrote this answer, as the backend names it (`answered_by`
   * of its `done` frame or restored entry): on a turn several agents answer,
   * each reply names its own. Absent when the backend does not say.
   */
  answeredBy?: ChatAnsweredBy;
  /**
   * The answer is a note written in place of a mentioned agent that could not
   * answer (`mention_failed`).
   */
  mentionFailed?: boolean;
  files?: ChatFile[];
  /**
   * The conversations a user message references with `@` (see
   * {@link ApiEndpoints.conversationReferences}), shown as chips.
   */
  conversationRefs?: ChatConversationRef[];
  /** The turn was stopped while writing this answer. */
  stopped?: boolean;
  /** Agent-generated downloadable files attached to an assistant message. */
  attachments?: ChatAttachment[];
  /** The decks, reports and videos an assistant message made, in marker order. */
  artifacts?: ChatArtifact[];
  toolNames?: string[];
  toolCallCount?: number;
  iterations?: number;
  /**
   * Accumulated model reasoning / pre-tool preamble prose for the turn
   * (from `thinking_text` events), surfaced in the reasoning-details dialog
   * after the answer completes — mirroring the XTM One web chat.
   */
  reasoning?: string;
  /**
   * Per-tool-call execution trace (name, input, output, success) for the
   * reasoning-details dialog — same shape the XTM One web chat renders as
   * expandable rows. Optional: backends without trace support fall back to
   * the flat `toolNames` list.
   */
  toolCallTrace?: ToolCallTraceEntry[];
  /** Agent transfer chain for the turn (reasoning-details dialog). */
  transferChain?: TransferChainEntry[];
  /**
   * True when the agent's iteration budget was exhausted and the final
   * response is a best-effort summary — surfaced as an amber warning on the
   * reasoning-details affordance, mirroring the XTM One web chat.
   */
  isTruncated?: boolean;
  /**
   * The backend's own fields for the message, as it sent them: the restored
   * (or paged, or relayed) entry, or the `done` frame - or the stored end -
   * that closed a live answer. A plain copy, whose fields are the backend's to
   * define; the panel reads none of it. Absent on a message no backend object
   * describes yet (one being written, a user message sent from this panel).
   */
  raw?: Record<string, unknown>;
}

/** The agent an answer names as its author (`answered_by`); either field may be missing. */
export interface ChatAnsweredBy {
  agentId?: string;
  agentName?: string;
  /** An image URL or an emoji, as `XtmAgent.icon`. */
  agentIcon?: string;
}

/** A rating as the feedback endpoint stores it. */
export interface ChatMessagePersistedFeedback {
  rating: 'positive' | 'negative';
  comment: string | null;
}

/** One tool call in the reasoning-details execution trace. */
export interface ToolCallTraceEntry {
  name: string;
  input?: string;
  output?: string;
  success: boolean;
}

/** One hop in the agent transfer chain shown in the reasoning-details dialog. */
export interface TransferChainEntry {
  agentId: string;
  agentName: string;
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

/** What an answer can make besides a file. */
export type ChatArtifactKind = 'presentation' | 'report' | 'video';

/**
 * A deck, report or video an answer made, as the backend describes it: the
 * `artifacts` of a `done` event or of a restored answer, sent because the panel
 * says it renders them (`supports_artifacts`). Rendered as a card where its
 * `[[PRESENTATION:<id>]]`, `[[REPORT:<id>]]` or `[[VIDEO:<id>]]` marker stands.
 */
export interface ChatArtifact {
  kind: ChatArtifactKind;
  id: string;
  title: string;
  /** The page that shows it in XTM One; linked only when it is http(s). */
  url?: string;
  /** The slide a deck's marker points at. */
  slideRef?: string;
  slideCount?: number;
  sectionCount?: number;
  sceneCount?: number;
  durationMs?: number;
  /** A video's newest render: `pending`, `running`, `ready`, `failed` or `cancelled`. */
  status?: string;
  /** That render's progress, 0-100. */
  progress?: number;
  /** The formats it downloads in: `pdf`, `pptx`, `pptx_native`, `mp4`. Empty until a video is rendered. */
  downloads: string[];
}

/** What the agent is doing, as the status line shows it. */
export interface AgentStatusState {
  status: string;
  tools?: string[];
  thinkingContent?: string;
  /**
   * Seconds the current tool batch has been executing (from periodic
   * `tool_heartbeat` events) — rendered as a live elapsed-time indicator
   * so long executions (background tasks, consults) never look stuck.
   */
  elapsedS?: number;
  /**
   * Wall-clock instant (ms) at which the current tool batch started, derived
   * from `elapsedS` on each heartbeat. Heartbeats only arrive every ~10s, so
   * rendering `elapsedS` directly makes the timer sit still and then jump.
   * Anchoring here lets the indicator tick once a second locally and
   * re-synchronise on every beat.
   */
  elapsedStartMs?: number;
  /** `wait_start`: how long the agent pauses, why, and since when (ms). */
  waitSeconds?: number;
  waitReason?: string;
  waitStartMs?: number;
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
  /**
   * The agent this conversation belongs to, when the backend reports it — so
   * the history list can say which agent a thread is with before you open it.
   * Undefined on backends that do not send it, null-ish for conversations that
   * genuinely have no agent.
   */
  agentName?: string;
  /**
   * The workspace the conversation is filed in (`null`: none), when the
   * backend reports it. Undefined on backends that do not.
   */
  workspaceId?: string | null;
}

/**
 * A conversation the composer's `@` menu offers (see
 * {@link ApiEndpoints.conversationReferences}).
 */
export interface ChatConversationReferenceCandidate {
  id: string;
  title: string;
  /** What the pick inserts after `@`: the backend's own, never one computed here. */
  key: string;
  updatedAt?: string;
  /** False for a conversation shared with the user. */
  isOwn: boolean;
}

/** A conversation a message references with `@<key>`. */
export interface ChatConversationRef {
  conversationId: string;
  title: string;
  key: string;
  /** As the menu offered it: `false` keeps the "Shared with you" hint. Absent reads as the user's own. */
  isOwn?: boolean;
}

/** A workspace the conversation list is grouped by. */
export interface ChatWorkspace {
  id: string;
  name: string;
  /** The caller owns it: a colleague's default shared with them is not theirs. */
  isOwn: boolean;
  isDefault: boolean;
  /** Whether the caller may file conversations into it, rename or delete it. */
  canManage: boolean;
}

export interface XtmAgent {
  id: string;
  name: string;
  slug: string | null;
  /** An image URL or an emoji; anything else shows the panel's logo. */
  icon: string | null;
  description: string | null;
  /** The heading the agent picker lists it under; ungrouped agents come first. */
  group?: string;
}

export interface IconProps {
  className?: string;
  size?: number;
}
