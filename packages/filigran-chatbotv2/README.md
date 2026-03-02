# @filigran/chatbot

Filigran chat panel — a standalone React + Tailwind chatbot component with SSE streaming, multi-agent support, and full markdown rendering.

## Features

- 🔄 **SSE Message Streaming** — Real-time response streaming with status indicators
- 🤖 **Multi-Agent Support** — Switch between different AI agents
- 📎 **File Attachments** — Upload and paste files (PDF, TXT, images)
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
      <ChatToggleButton
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        label="Ask Assistant"
        accentColor="#7b5cff"
      />
      {isOpen && (
        <ChatPanel
          mode={mode}
          onClose={() => setIsOpen(false)}
          onModeChange={setMode}
          apiBaseUrl="/api/assistant"
          user={{ firstName: 'John' }}
        />
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

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `'floating' \| 'sidebar' \| 'fullscreen'` | **required** | Display mode |
| `onClose` | `() => void` | **required** | Called when close button is clicked |
| `onModeChange` | `(mode: ChatMode) => void` | **required** | Called when user switches display mode |
| `apiBaseUrl` | `string` | **required** | Base URL for chat API endpoints |
| `user` | `{ firstName: string }` | **required** | Current user info |
| `topOffset` | `number` | `0` | Top offset in pixels (for sidebar/fullscreen with fixed headers) |
| `agentDashboardUrl` | `string` | — | URL for "Browse agents" / "Create agent" links |
| `t` | `(key: string) => string` | identity | Translation function for i18n |
| `accentColor` | `string` | `'#7b5cff'` | Primary accent color (hex) |
| `logoIcon` | `React.ReactNode` | default icon | Custom logo/icon for the assistant |
| `promptSuggestions` | `string[]` | default list | Prompt suggestions shown on welcome screen |
| `resizable` | `boolean` | `false` | Enable drag-to-resize for sidebar mode |
| `onWidthChange` | `(width: number) => void` | — | Called when sidebar width changes during resize |
| `onResizeStart` | `() => void` | — | Called when resize drag starts |
| `onResizeEnd` | `() => void` | — | Called when resize drag ends |

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

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | **required** | Whether the chat panel is open |
| `onToggle` | `() => void` | **required** | Called when button is clicked |
| `label` | `string` | `'Chat'` | Tooltip/aria label |
| `accentColor` | `string` | `'#7b5cff'` | Button background color |
| `icon` | `React.ReactNode` | default icon | Custom icon |

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

### `POST {apiBaseUrl}/chat/messages`

Sends a message and streams the response via SSE.

**Request:**
```json
{
  "content": "What is the weather?",
  "conversation_id": "uuid-or-null",
  "agent_slug": "general"
}
```

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
/>
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
  promptSuggestions={[
    'Help me write a report',
    'Analyze this data',
    'Summarize recent activity',
  ]}
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

## Versioning Strategy

This monorepo contains two versions of the chatbot package:

| Version | Folder | Local Workspace Name | npm Package |
|---------|--------|---------------------|-------------|
| v1.x | `packages/filigran-chatbot` | `@filigran/chatbot-legacy` | `@filigran/chatbot@1.x` |
| v2.x | `packages/filigran-chatbotv2` | `@filigran/chatbot` | `@filigran/chatbot@2.x` |

### Why Different Local Names?

Yarn workspaces require unique package names within the monorepo. When you run:

```bash
yarn workspace @filigran/chatbot build
```

Yarn needs to know which folder to use. If two packages share the same `name` in their `package.json`, Yarn fails with:

```
Error: Duplicate workspace name @filigran/chatbot
```

**For npm publishing**, this isn't a problem — npm differentiates packages by version number, not by source location.

### Working with v2 (Active Development)

v2 is the active version. To develop locally:

```bash
cd packages/filigran-chatbotv2
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

### Working with v1 (Legacy/Maintenance)

v1 uses the local name `@filigran/chatbot-legacy` to avoid conflicts. If you need to publish a patch to v1:

1. **Temporarily rename** the package in `packages/filigran-chatbot/package.json`:
   ```json
   "name": "@filigran/chatbot"
   ```

2. **Publish** the patch:
   ```bash
   cd packages/filigran-chatbot
   yarn build
   yarn publish --access public
   ```

3. **Revert** the name back to `@filigran/chatbot-legacy`:
   ```json
   "name": "@filigran/chatbot-legacy"
   ```

### Using in Other Packages

To depend on v2 within the monorepo:

```json
{
  "dependencies": {
    "@filigran/chatbot": "workspace:*"
  }
}
```

To depend on v1 (legacy):

```json
{
  "dependencies": {
    "@filigran/chatbot-legacy": "workspace:*"
  }
}
```

Note: External consumers install from npm and won't see the `-legacy` suffix — they just use `@filigran/chatbot@1` or `@filigran/chatbot@2`.
