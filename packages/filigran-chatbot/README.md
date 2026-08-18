# @filigran/chatbot

Filigran chat panel — a standalone React + Tailwind chatbot component with SSE streaming, multi-agent support, and full markdown rendering.

## Features

- 🔄 **SSE Message Streaming** — Real-time response streaming with status indicators
- ⚡ **Mid-Run Steering** — Send messages while the agent is generating; they are injected into the running agentic loop instead of waiting for the turn to finish
- ✋ **Tool Approval** — When the agent stops at a tool that needs a human's consent, the turn pauses mid-answer and the reviewer approves, declines with a reason, or approves always — opt-in per host, see [Tool approval](#post-apibaseurlapiendpointsapprove)
- 🗂️ **Conversation History** — Switch between (and delete) past conversations from a header menu, or from a permanent sidebar in fullscreen mode (collapsible, searchable past 7 entries, rename in place)
- 🤖 **Multi-Agent Support** — Switch between different AI agents
- 📎 **File Attachments** — Upload and paste files (PDF, TXT, images)
- 📥 **Agent-Generated Files** — Renders downloadable file cards from agent output and strips the `[[FILE:id]]` markers from the prose
- 📝 **Full Markdown** — Tables (mis-delimited ones repaired), code blocks with copy button, lists, blockquotes, soft line breaks, inline images with a lightbox
- 🖼️ **Image Previews** — `data:image/*` charts and image attachments render inline, click to expand
- 📋 **Copy & Rate** — Copy any answer; optional 👍/👎 feedback wired to the host
- 🧰 **Composer Toolbar** — Prompt library and quota indicator, both driven by whether the host serves the route; plus a slot for the host's own controls
- 🧠 **Context Gauge** — Ring + percentage showing how full the model's context window is, so a long chat's silent summarising is visible before it happens
- 🎙️ **Dictation** — Speech-to-text via the browser's own Web Speech API; no endpoint, no key, hidden where unsupported
- ✍️ **Draft Recovery** — Unsent composer text is kept per conversation and restored when the panel reopens
- 🎨 **Customizable Theme** — Accent color and logo customization
- 📱 **3 Display Modes** — Floating, sidebar (resizable), and fullscreen
- 💾 **Persistence** — Conversation and sidebar width saved to localStorage
- 🛠️ **Tool Tracking** — Visual indicators for AI tool usage

## Installation

```bash
yarn add @filigran/chatbot
```

## Quick Start

```tsx
import { useState } from 'react';
import { ChatPanel, ChatToggleButton } from '@filigran/chatbot';
import '@filigran/chatbot/styles.css';

function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'floating' | 'sidebar' | 'fullscreen'>('floating');

  return (
    <>
      <ChatToggleButton isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} label="Ask Assistant" accentColor="#7b5cff" />
      {isOpen && (
        <ChatPanel mode={mode} onClose={() => setIsOpen(false)} onModeChange={setMode} apiBaseUrl="/api/assistant" user={{ firstName: 'John' }} />
      )}
    </>
  );
}
```

## Components

### `ChatPanel`

The main chat interface component.

```tsx
import { ChatPanel } from '@filigran/chatbot';
```

#### Props

| Prop                | Type                                      | Default      | Description                                                      |
| ------------------- | ----------------------------------------- | ------------ | ---------------------------------------------------------------- |
| `mode`              | `'floating' \| 'sidebar' \| 'fullscreen'` | **required** | Display mode                                                     |
| `onClose`           | `() => void`                              | **required** | Called when close button is clicked                              |
| `onModeChange`      | `(mode: ChatMode) => void`                | **required** | Called when user switches display mode                           |
| `apiBaseUrl`        | `string`                                  | **required** | Base URL for chat API endpoints                                  |
| `user`              | `{ firstName: string }`                   | **required** | Current user info                                                |
| `topOffset`         | `number`                                  | `0`          | Top offset in pixels (for sidebar/fullscreen with fixed headers) |
| `agentDashboardUrl` | `string`                                  | —            | URL for "Browse agents" / "Create agent" links                   |
| `t`                 | `(key: string) => string`                 | identity     | Translation function for i18n                                    |
| `accentColor`       | `string`                                  | `'#7b5cff'`  | Primary accent color (hex)                                       |
| `logoIcon`          | `React.ReactNode`                         | default icon | Custom logo/icon for the assistant                               |
| `promptSuggestions` | `string[]`                                | default list | Prompt suggestions shown on welcome screen                       |
| `pageContext`       | `Record<string, unknown>`                 | —            | Arbitrary host page context (e.g. `{ url: '/dashboard/...' }`) sent as `context` on each `rest` message so the agent knows where the user is. Must be JSON-serializable (skipped if not). Read fresh at send time; omitted when empty. |
| `resizable`         | `boolean`                                 | `false`      | Enable drag-to-resize for sidebar mode                           |
| `onWidthChange`     | `(width: number) => void`                 | —            | Called when sidebar width changes during resize                  |
| `onResizeStart`     | `() => void`                              | —            | Called when resize drag starts                                   |
| `onResizeEnd`       | `() => void`                              | —            | Called when resize drag ends                                     |
| `onMessageFeedback` | `(id, feedback, message) => void`         | —            | Enables 👍/👎 on completed assistant answers and receives each rating (`null` clears it). Omit to hide the affordance — the panel stores nothing itself. |
| `disableImagePreviews` | `boolean`                              | `false`      | Render image attachments as download cards instead of inline previews |
| `contextUsageEnabled` | `boolean`                               | `true`       | Show how full the model's context window is for the current conversation (ring + percentage in the composer toolbar). Data-driven, so it stays absent until the backend reports occupancy — see [Context usage](#context-usage). |
| `composerToolbar`   | `React.ReactNode`                         | —            | Extra controls appended to the composer toolbar. The escape hatch for host-specific affordances (XTM One's session-tool picker) — the package never learns what they are. Pass nothing and the toolbar simply has none. |

#### Resizable Sidebar Example

```tsx
function App() {
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  return (
    <div style={{ marginRight: sidebarWidth }}>
      <MainContent />
      <ChatPanel
        mode="sidebar"
        resizable={true}
        onWidthChange={setSidebarWidth}
        onResizeStart={() => setIsResizing(true)}
        onResizeEnd={() => setIsResizing(false)}
        // ... other props
      />
    </div>
  );
}
```

The sidebar width is persisted to `localStorage` under the key `filigranChatSidebarWidth`.

### `ChatToggleButton`

A floating action button to toggle the chat panel.

```tsx
import { ChatToggleButton } from '@filigran/chatbot';
```

#### Props

| Prop          | Type              | Default      | Description                    |
| ------------- | ----------------- | ------------ | ------------------------------ |
| `isOpen`      | `boolean`         | **required** | Whether the chat panel is open |
| `onToggle`    | `() => void`      | **required** | Called when button is clicked  |
| `label`       | `string`          | `'Chat'`     | Tooltip/aria label             |
| `accentColor` | `string`          | `'#7b5cff'`  | Button background color        |
| `icon`        | `React.ReactNode` | default icon | Custom icon                    |

## API Contract

The component expects your backend to implement these endpoints:

### `GET {apiBaseUrl}/chat/agents`

Returns available AI agents.

```json
[
  {
    "id": "agent-1",
    "name": "General Assistant",
    "slug": "general",
    "icon": null,
    "description": "A helpful general-purpose assistant"
  }
]
```

### `POST {apiBaseUrl}/chat/sessions`

Restores conversation history (and, implicitly, resolves the session).

**Request:**

```json
{
  "conversation_id": "uuid-here",
  "agent_slug": "general"
}
```

**Response:**

```json
{
  "conversation_id": "uuid-here",
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

The response **should echo a `conversation_id`**. When the stored
`conversation_id` no longer exists (e.g. the platform was reset but the
browser kept an old id in `localStorage`), the backend is expected to
transparently create a fresh conversation and return its **new** id with an
empty `messages` array. The component adopts whatever id the response returns
(persisting it to `localStorage`), so subsequent messages are never sent
against a dead conversation — which would otherwise fail with a
"conversation does not exist" error and force the user to manually start a new
conversation. If the endpoint responds with a non-2xx status, the component
silently resets the stored id and starts fresh on the next message.

Assistant history messages **should echo the same `attachments[]` array** that
was sent on the original `done` event (see [Agent-generated file attachments](#agent-generated-file-attachments)),
keyed by `file_id`. The component re-surfaces the download cards on restore,
so omitting them means download cards silently disappear after a page reload
even though streaming downloads work:

```json
{
  "messages": [
    {
      "role": "assistant",
      "content": "Here is your export. [[FILE:0f3a...]]",
      "attachments": [
        { "file_id": "0f3a...", "filename": "iocs.csv", "type": "csv", "size": 2048, "content_type": "text/csv", "file_tag": "download_file" }
      ]
    }
  ]
}
```

### `GET {apiBaseUrl}/chat/sessions`

Lists the user's past conversations for the history menu in the chat header.

**Response** (a bare array or `{ "conversations": [...] }`):

```json
[
  {
    "conversation_id": "uuid-here",
    "title": "What is the weather?",
    "updated_at": "2026-06-10T08:30:00Z",
    "message_count": 12
  }
]
```

Selecting a conversation restores it through the existing
`POST /chat/sessions` contract above. The endpoint is fetched lazily when the
history menu opens; a backend that doesn't implement it yet (404/405) simply
yields an empty list, so the menu shows its empty state instead of breaking
the chat. Set `apiEndpoints.history` to `null` to hide the history menu
entirely, or point it at a dedicated path if your proxy can't route `GET` on
the sessions path.

### `PATCH {apiBaseUrl}/chat/sessions/{conversation_id}`

Renames a conversation. Body: `{ "title": "..." }`. Only reached from the
fullscreen sidebar; a backend without the route simply fails the request and
the row reverts to its previous title.

### `DELETE {apiBaseUrl}/chat/sessions/{conversation_id}`

Deletes a conversation from the history menu. Any 2xx response counts as
success; deleting the active conversation resets the panel to a fresh chat so
the next message never targets a dead conversation id.

### `POST {apiBaseUrl}/chat/messages`

Sends a message and streams the response via SSE.

**Request:**

```json
{
  "content": "What is the weather?",
  "conversation_id": "uuid-or-null",
  "agent_slug": "general",
  "context": { "url": "/dashboard/analyses/reports/<id>/overview" }
}
```

The optional `context` object is forwarded verbatim from the `pageContext`
prop (REST backend only) and is omitted entirely when empty. Use it to make
the agent aware of the user's current location/page; the shape is up to the
host and can be extended later (page title, selected entity, user role, etc.).
It must be JSON-serializable — a non-serializable value (circular reference,
`BigInt`, …) is skipped rather than breaking the request.

**Response:** Server-Sent Events stream with these event types:

```
data: {"type": "status", "status": "thinking"}
data: {"type": "status", "status": "tool_start", "tools": ["search_web"]}
data: {"type": "status", "status": "analyzing"}
data: {"type": "status", "status": "streaming"}
data: {"type": "stream", "content": "The weather "}
data: {"type": "stream", "content": "today is sunny."}
data: {"type": "done", "content": "The weather today is sunny.", "conversation_id": "new-uuid", "tool_names": ["search_web"], "tool_call_count": 1, "iterations": 1, "reasoning": "Let me check the weather data first.", "tool_call_trace": [{"name": "search_web", "input": "{\"query\": \"weather\"}", "output": "Sunny, 24C", "success": true}], "transfer_chain": [{"agent_id": "uuid", "agent_name": "General"}], "is_truncated": false}
```

The optional `reasoning` field on `done` (and on restored session messages)
carries the accumulated model reasoning / pre-tool preamble prose for the
turn. When present it is surfaced in the per-message reasoning-details dialog
(the "i" button), mirroring the XTM One web chat.

The reasoning-details dialog also consumes three more optional `done` fields
(all parsed defensively — older backends without them fall back to the flat
tool-name list and the plain "i" affordance):

- `tool_call_trace` — array of `{ name, input, output, success }` entries
  rendered as expandable rows (numbered, success/failure icon, pretty-printed
  JSON input, output)
- `transfer_chain` — array of `{ agent_id, agent_name }` hops rendered as the
  agent transfer chain
- `is_truncated` — `true` when the agent's iteration budget was exhausted;
  the message then shows an always-visible amber warning triangle instead of
  the hover-only "i" and the dialog opens with a "Turn limit reached" banner

The same fields are read from restored session messages, so the dialog
survives a page reload.

#### Internal links

Assistant markdown links are routed through `onRelativeLinkClick` when they
are **internal to the host application**: relative hrefs (`/dashboard/...`)
and absolute http(s) hrefs on the **same origin** as the embedding page
(backends emit absolute links so they work from any chat surface — when the
chatbot is embedded in that very platform, e.g. the OpenCTI link inside
OpenCTI, the link is reduced to `pathname + search + hash` and navigates
in-app instead of opening a new tab). All other links open in a new tab.

#### Agent-generated file attachments

When an agent produces a downloadable file, the `done` event carries an `attachments` array and the streamed prose embeds `[[FILE:<file_id>]]` markers. The component strips those markers and renders a download card per attachment:

```json
{
  "type": "done",
  "content": "Here is your export. [[FILE:0f3a...]]",
  "conversation_id": "uuid",
  "attachments": [
    { "file_id": "0f3a...", "filename": "iocs.csv", "type": "csv", "size": 2048, "content_type": "text/csv", "file_tag": "download_file" }
  ]
}
```

Each attachment carries only `file_id` + display metadata — **never an absolute download URL**. Clicking a card issues:

```
GET {apiBaseUrl}{apiEndpoints.download ?? '/chat/files'}/{file_id}/download
```

with `credentials: 'include'` and your `requestHeaders`. Point `apiEndpoints.download` at your **own backend proxy** so the download is authenticated by your platform (the proxy mints any upstream token server-side) — the user never authenticates to the upstream chat service directly. Set `apiEndpoints.download` to `null` to disable download cards.

The `/chat/files` default applies to REST-style endpoints. In `singleEndpoint` mode there is no per-path routing, so the default is **not** applied — download cards stay disabled unless you set `apiEndpoints.download` explicitly to a proxy route.

Download failures (403/404/5xx/network) are reported through the optional `onDownloadError(error, attachment)` callback so the host can surface them via its own notification system (the chatbot has no toast surface of its own).

**Status values:**

- `thinking` — Agent is processing
- `tool_start` — Agent is using tools (with `tools` array)
- `tool_heartbeat` — Liveness signal during a long tool execution (with `tools` and `elapsed_s`). The widget keeps the current status label and renders a live elapsed-time indicator next to it once the execution exceeds ~15 s, so long operations (background tasks, agent consults) never look stuck
- `analyzing` — Agent is analyzing tool results
- `composing` — Agent is composing the response
- `streaming` — Content is being streamed
- `steering` — A mid-run steering message is being incorporated (see below)

**Error event:**

```
data: {"type": "error", "content": "Something went wrong"}
```

### `POST {apiBaseUrl}/chat/messages/steer`

Steers the agent mid-run: while a response is still streaming, Enter / the
accent Send button dispatches the typed text immediately instead of blocking
until the turn finishes. The widget POSTs:

```json
{
  "conversation_id": "uuid-here",
  "content": "Actually, filter by subregion instead",
  "agent_slug": "general"
}
```

A 2xx response means the message was persisted and will be injected into the
running agentic loop at the next iteration boundary. On a non-2xx response or
a network error the optimistic user bubble is rolled back and the text is
restored into the composer (prepended on its own line if the user already
typed something new) — so a backend without steering support degrades
gracefully and the message is never silently lost. Set `apiEndpoints.steer`
to `null` to disable the steering affordances entirely.

Steering only applies to text-only sends on the `rest` backend with a known
`conversation_id` (the first turn of a fresh conversation only receives its id
on `done`). Sends with attachments keep the legacy wait behavior. Esc stops
generating.

#### Multi-segment responses

A steered turn can produce **multiple response segments** on one SSE stream:
when the steering message arrives too late to be folded into the current
pass, the backend completes the current segment (an intermediate `done`
event) and then runs a follow-up pass for the steering message (a fresh
`thinking` status followed by more `stream` events and a final `done`). The
widget renders each segment as its own assistant message:

```
data: {"type": "status", "status": "steering"}
data: {"type": "stream", "content": "...current answer keeps streaming..."}
data: {"type": "done", "content": "First segment answer", "conversation_id": "uuid"}
data: {"type": "status", "status": "thinking"}
data: {"type": "stream", "content": "Follow-up answer to the steering message"}
data: {"type": "done", "content": "Follow-up answer to the steering message", "conversation_id": "uuid"}
```

### `POST {apiBaseUrl}{apiEndpoints.approve}`

Answers a turn that paused because the agent proposed a tool call requiring a
human's consent. **Opt-in: there is no default path.** The widget advertises
approval support to the backend only when `apiEndpoints.approve` is set, and
that flag is a promise — a backend that pauses a turn waits indefinitely for a
decision, with no timeout. A host that names a path it cannot route would
receive the pause, POST the decision into a 404, and hang the turn with the
user watching a spinner. Leave it unset and the backend degrades to an ordinary
assistant message explaining what it could not run, so an un-updated host keeps
working untouched.

When set, `supports_tool_approval: true` is sent on every `rest` message body.

**Server → client**, on the existing SSE stream, alongside `stream` / `status` /
`done`:

```
data: {"type": "approval_required", "conversation_id": "uuid-here", "proposals": [
  {
    "tool_call_id": "call_abc123",
    "tool_name": "opencti_delete_entity",
    "tool_description": "Permanently delete an entity from the platform.",
    "arguments": {"entity_id": "e-123", "cascade": true},
    "input_schema": {"type": "object", "properties": {
      "entity_id": {"type": "string", "description": "Entity to delete"},
      "cascade": {"type": "boolean", "description": "Also delete linked entities"}
    }},
    "source": "integration:opencti"
  }
]}
```

The turn is **not** over: no `done` arrives, the stream stays open and silent
(kept alive by SSE `: keepalive` comment lines, which the reader drops), and the
rest of the turn continues on it once a decision is sent. The progress bubble is
replaced by the prompt, which renders each argument next to its description from
`input_schema` — `cascade: true` is unjudgeable on its own, so a prompt showing
only names and values would be a rubber stamp.

**Client → server**, one decision per proposed call:

```json
{
  "conversation_id": "uuid-here",
  "decisions": [
    { "tool_call_id": "call_abc123", "decision": "approve" },
    { "tool_call_id": "call_ghi789", "decision": "reject", "rejection_reason": "Wrong target environment." },
    { "tool_call_id": "call_jkl012", "decision": "approve_always" }
  ]
}
```

| `decision`       | Effect                                                              |
| ---------------- | ------------------------------------------------------------------- |
| `approve`        | Runs with the arguments exactly as proposed                          |
| `reject`         | Does not run; the agent receives `rejection_reason` and can adapt    |
| `approve_always` | Runs, **and** saves a standing approval for this user                |

Every proposed `tool_call_id` must appear exactly once — the backend refuses a
partial set, because resuming with an undecided call leaves a `tool_use` block
without its `tool_result`, which the model providers reject outright. The prompt
therefore submits itself once the last card is decided. A set containing
`approve_always` waits for an explicit Confirm instead: it is the only verdict
whose reach outlives the turn (it applies to the user's unattended scheduled
runs too), so the warning has to be read before it is committed.

A decision carries no arguments. Correcting a wrong proposal is what
`reject` with a reason is for — rewriting a call under the agent's name would
leave a transcript crediting it with arguments it never chose.

On a non-2xx the prompt stays on screen with the failure noted and the controls
re-armed: the turn is still paused either way, so clearing the prompt would
strand it with nothing able to answer. A `409` means nothing is waiting any more
(the turn finished, was cancelled, or was answered elsewhere); the stream ending
then clears the prompt on its own. Stopping the turn also dismisses it — the
backend waits indefinitely by design, so abandoning the stream is the reviewer's
only other way out.

**Proxied hosts:** the decision goes through the same fetch path as every other
endpoint — relative to `apiBaseUrl` and honouring `requestHeaders` — so CSRF
wrappers and per-request context headers keep working. A proxy in front of the
chat must forward the request body whole (a proxy rebuilding it from a fixed
field list silently drops `supports_tool_approval`), never time out the
streaming turn, and pass SSE keepalives through untouched.

#### Recovering a prompt after a page reload

`approval_required` is a single event on a stream, so a reload loses it —
including the `tool_call_id`s a decision has to name — while the turn goes on
waiting for an answer that can no longer be given. To the user that is a chat
which simply stopped replying.

Set `apiEndpoints.pendingApprovals` (XTM One: `/chat/conversations`) and the
panel asks once per conversation, on mount and on every conversation switch:

```
GET {apiBaseUrl}{apiEndpoints.pendingApprovals}/{conversation_id}/pending-approvals
→ {
    "conversation_id": "uuid-here",
    "proposals": [ /* as the event carried */ ],
    "turn": "running" | "idle"
  }
```

An empty `proposals` is the ordinary answer. A non-empty one re-renders the same
prompt, and the decision is POSTed exactly as before. Like `approve` this has no
default and is skipped when unset, leaving the live flow untouched.

The recovered turn resumes with the reasoning and tool results it had already
produced — but **not on a stream**: the one it would have reported on died with
the old page, so the backend persists the answer and suppresses the live `done`
frame. So after a decision on a recovered prompt the panel shows its ordinary
working indicator and polls this route every 5s, using `turn` as the stop
condition: while it reads `running` it keeps waiting, and the moment it reads
`idle` it re-reads the conversation once — the answer is there. A resumed turn
that pauses *again* on a second gated call is picked up by the same poll, which
is the only way that prompt could reach the user with no stream open.

One bound applies server-side: after 30 minutes with **no sign of a client** and
no decision, the turn stops waiting and the pause is discarded. Any request about
the conversation counts as a sign, so while a recovered prompt is displayed the
panel re-reads this route every 10 minutes purely to say someone is still there —
a tab left open makes no requests of its own, and the bound is meant to limit
abandonment, never the person deciding.

REST backend only: `legacy` and `ag-ui` never meet this gate.

## Customization

### Custom Logo

```tsx
import { MyLogo } from './icons';

<ChatPanel
  logoIcon={<MyLogo size={24} />}
  // ...
/>;
```

### Custom Accent Color

```tsx
<ChatPanel
  accentColor="#00bcd4"
  // ...
/>
```

### Custom Prompt Suggestions

```tsx
<ChatPanel
  promptSuggestions={['Help me write a report', 'Analyze this data', 'Summarize recent activity']}
  // ...
/>
```

### Internationalization

```tsx
import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation();

  return (
    <ChatPanel
      t={t}
      // ...
    />
  );
}
```

**Translation keys used:**

- `'Thinking...'`
- `'Using tools…'`
- `'Analyzing results…'`
- `'Composing answer…'`
- `'Incorporating your message…'`
- `'Ask a question...'`
- `'Stop generating'`
- `'Send now'`
- `'Enter to send now · Esc to stop'`
- `'Attachments wait for the current response'`
- `'New chat'`
- `'Conversation history'`
- `'No conversations yet'`
- `'Untitled conversation'`
- `'New conversation'`
- `'Delete conversation'`
- `'just now'` / `'m ago'` / `'h ago'` / `'d ago'`
- `'Switch view'`
- `'Close'`
- `'Switch to another agent'`
- `'Browse agents'`
- `'Create agent'`
- `'Reasoning details'`
- `'Reasoning details — turn limit reached'`
- `'Model reasoning'`
- `'iterations'`
- `'transfer'` / `'transfers'`
- `'Transfer chain'`
- `'Turn limit reached.'`
- `"The agent's iteration budget was exhausted - execution stopped before completing all planned steps. The final response is a best-effort summary of work done so far."`
- `'Input'` / `'Output'` / `'(no output)'`
- `'Download'`
- `'tool call'` / `'tool calls'`
- `'Uses AI. Verify results.'`
- `'How can I help you, '`
- `'Suggestions'`
- `'Waiting for your approval…'`
- `'The agent needs your approval to run a tool:'` / `'The agent needs your approval to run these tools:'`
- `'Yes'` / `'No'` / `'Yes, always'` / `'Back'` / `'Confirm'` / `'Sending…'` / `'decided'`
- `'Approved'` / `'Declined'` / `'Always allowed'`
- `'Decline this call'`
- `'Why not? The agent sees this and can adapt (optional)'`
- `'e.g. wrong environment — use staging instead'`
- `'Also applies to your scheduled runs, until you revoke it'`
- `'“Yes, always” saves a preference for you. That tool will then run without asking — including on scheduled runs nobody is watching — until you revoke it.'`
- `'This turn is no longer waiting for a decision.'`
- `'Could not send your decision. Please try again.'`
- `'Floating'`
- `'Sidebar'`
- `'Full screen'`

## Styling

Import the CSS file to apply default styles:

```tsx
import '@filigran/chatbot/styles.css';
```

The component uses Tailwind CSS classes and CSS custom properties for theming. The accent color is applied via `--chat-accent` CSS variable.

### Composer toolbar

Two toolbar items are **data-driven rather than mode-driven**: they appear only
when the host serves the route, so the UI can never advertise something the
backend cannot answer, and there is no mode flag to keep in step.

| Endpoint | Default path | Response |
| --- | --- | --- |
| Prompt library | `GET {apiBaseUrl}/chat/prompts` | `[{ id, title, content, description? }]` (or `{ prompts: [...] }`) |
| Quota status | `GET {apiBaseUrl}/chat/quota` | `{ used: number, limit: number \| null, period: string }` |
| Agent suggestions | `GET {apiBaseUrl}/chat/suggestions?agent_slug=<slug>` | `["..."]` (or `{ suggestions: [...] }`, or objects with `prompt`/`label`/`text`) |

Set either to `null` in `apiEndpoints` to hide it. `limit: null` means no
ceiling — the indicator then shows consumption without a bar. The quota is
re-read whenever a turn finishes.

The welcome screen names the selected agent and shows its own suggestions —
which is also how switching agent is confirmed: the thread resets to that
screen, so without it nothing tells you who the next message will reach. When
the suggestions route is unavailable the host's `promptSuggestions` prop is used
instead, so the section is never empty.

Dictation needs no configuration at all: it uses the browser's own Web Speech
API, so the mic button appears wherever the API exists and is simply absent
elsewhere. Finalised phrases are appended to the composer (never replacing a
draft), interim words preview beside the button, and sending stops the mic so
the next words cannot land in a composer the user just emptied.

### Context usage

The composer also carries a context gauge — a small ring plus percentage
showing how full the model's context window is for the current conversation,
the affordance Cursor popularised. It answers one question: *is this
conversation about to get shorter than I think?* Long chats do not fail at the
window, they get silently summarised, and a user who cannot see that coming
reads the summary's gaps as the assistant forgetting.

Clicking it opens a breakdown: one stacked bar over the window plus a colour
legend, so "why is this chat 84 % full" has an answer the user can act on —
usually "the tool results", sometimes "the MCP tools you wired up".

Unlike the items above it needs no endpoint of its own. The backend reports the
occupancy on the frames it already sends:

| Frame | Extra keys | When |
| --- | --- | --- |
| `status: "thinking"` | `context_tokens`, `context_window`, `context_breakdown?` | Each agent-loop iteration, so the gauge climbs during a long turn |
| `done` | same | Closing value for the turn — a turn whose last iteration compacted ends lower than it peaked |
| Restored message (`POST /chat/sessions`) | same | On the newest assistant message, so a reload or conversation switch restores the gauge |

`context_tokens` and `context_window` are required together and the window must
be positive: a token count with no window to measure it against is not a ratio.
Anything else is ignored, so a backend that reports nothing simply has no gauge —
and a host on an older backend needs no configuration change.

`context_breakdown` is optional and validated independently, so a malformed one
costs the gauge its detail but never its number. Keys, all optional, in tokens:

| Key | Legend row |
| --- | --- |
| `system` | System prompt |
| `tools` | Tool definitions |
| `dynamic_tools` | MCP & dynamic tools |
| `summary` | Summarized conversation |
| `tool_results` | Tool results |
| `conversation` | Conversation |

Only positive values are shown, so a chat with no digest yet simply has no
"Summarized conversation" row. **The values must sum to `context_tokens`** — the
popover shows the lines and the headline together, and a breakdown whose parts
do not add up reads as broken numbers rather than as rounding. A producer doing
per-bucket integer division has to distribute the remainder rather than drop it.

Colours track the backend's own thresholds, not a design choice: neutral below
80 % (where XTM One's agent loop starts distilling older turns into a summary),
amber past it, red past 95 % (where it emergency-prunes). `used` is a
char-derived estimate of what the next call will carry — deliberately a forecast
rather than a receipt for the turn that just ended, which is why the figures are
prefixed with `~`.

Only the `rest` backend carries the figures today.

Anything host-specific goes through `composerToolbar`:

```tsx
<ChatPanel
  composerToolbar={<MySessionToolPicker />}
  {...rest}
/>
```

## Markdown Helpers

A host that renders assistant prose with its **own** markdown component (its
design tokens, its icon set) should still normalise the text the same way the
panel does, rather than maintaining a divergent copy. These pure
`string → string` helpers ship from the dedicated **`@filigran/chatbot/markdown`**
entry point — ~2 kB, no React, no CSS. Import them from there and never from the
package root, which is the full panel bundle:

```tsx
import {
  hardenNestedCodeFences,
  markdownUrlTransform,
  normalizeImageMarkdown,
  normalizeMarkdownTables,
  wrapBareJson,
} from '@filigran/chatbot/markdown';

const processed = hardenNestedCodeFences(
  normalizeMarkdownTables(wrapBareJson(normalizeImageMarkdown(content))),
);

<ReactMarkdown urlTransform={markdownUrlTransform}>{processed}</ReactMarkdown>;
```

Order matters: alt-text is flattened before anything reads line structure, and
the JSON wrap must see the raw payload before fences are hardened.

| Helper                    | Fixes                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `normalizeImageMarkdown`  | Multi-line `![alt](url)` alt text, which breaks the image into literal paragraphs plus a stray link             |
| `wrapBareJson`            | A whole message that is raw JSON — fenced as ```json so it stays readable and copyable                          |
| `normalizeMarkdownTables` | A delimiter row whose column count doesn't match the header, including tables nested in blockquotes / list items |
| `hardenNestedCodeFences`  | A ```markdown block containing its own ``` fences, which shatters the snippet into alternating code and prose   |
| `markdownUrlTransform`    | react-markdown's default sanitiser stripping `data:image/*` URIs (code-interpreter charts). Still blocks `javascript:` and non-image `data:` |

None of them touch content they don't apply to — an already-valid document is
returned byte-identical.

## Peer Dependencies

- `react` >= 18
- `react-dom` >= 18
- `react-markdown` >= 10
- `remark-breaks` >= 4
- `remark-gfm` >= 4

---

## Development

To develop locally:

```bash
cd packages/filigran-chatbot
yarn dev
```

To build:

```bash
yarn build
```

To publish:

```bash
yarn publish --access public
```

Or from the monorepo root:

```bash
yarn publish:filigran-chatbot
```
