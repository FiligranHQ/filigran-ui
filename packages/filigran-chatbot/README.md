# @filigran/chatbot

Filigran chat panel — a standalone React + Tailwind chatbot component with SSE streaming, multi-agent support, and full markdown rendering.

## Features

- 🔄 **SSE Message Streaming** — Real-time response streaming with status indicators
- ⚡ **Mid-Run Steering** — Send messages while the agent is generating; they are injected into the running agentic loop instead of waiting for the turn to finish
- 🗂️ **Conversation History** — Switch between (and delete) past conversations from a history menu in the header
- 🤖 **Multi-Agent Support** — Switch between different AI agents
- 📎 **File Attachments** — Upload and paste files (PDF, TXT, images)
- 📥 **Agent-Generated Files** — Renders downloadable file cards from agent output and strips the `[[FILE:id]]` markers from the prose
- 📝 **Full Markdown** — Tables, code blocks with copy button, lists, blockquotes
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
data: {"type": "done", "content": "The weather today is sunny.", "conversation_id": "new-uuid", "tool_names": ["search_web"], "tool_call_count": 1, "iterations": 1}
```

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
- `'Download'`
- `'tool call'` / `'tool calls'`
- `'Uses AI. Verify results.'`
- `'How can I help you, '`
- `'Suggestions'`
- `'Floating'`
- `'Sidebar'`
- `'Full screen'`

## Styling

Import the CSS file to apply default styles:

```tsx
import '@filigran/chatbot/styles.css';
```

The component uses Tailwind CSS classes and CSS custom properties for theming. The accent color is applied via `--chat-accent` CSS variable.

## Peer Dependencies

- `react` >= 18
- `react-dom` >= 18
- `react-markdown` >= 10
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
