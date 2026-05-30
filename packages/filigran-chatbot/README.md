# @filigran/chatbot

Filigran chat panel — a standalone React + Tailwind chatbot component with SSE streaming, multi-agent support, and full markdown rendering.

## Features

- 🔄 **SSE Message Streaming** — Real-time response streaming with status indicators
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

Restores conversation history.

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
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

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

**Error event:**

```
data: {"type": "error", "content": "Something went wrong"}
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
- `'Ask a question...'`
- `'Stop generating'`
- `'New chat'`
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
