# @filigran/chatbot

Filigran chat panel — a standalone React + Tailwind chatbot component with SSE streaming, multi-agent support, and full markdown rendering.

## Features

- 🔄 **SSE Message Streaming** — Real-time response streaming with status indicators
- ⚡ **Mid-Run Steering** — Send messages while the agent is generating; they are injected into the running agentic loop instead of waiting for the turn to finish
- ✋ **Tool Approval** — When the agent stops at a tool that needs a human's consent, the turn pauses mid-answer and the reviewer approves, declines with a reason, or approves always — opt-in per host, see [Tool approval](#post-apibaseurlapiendpointsapprove)
- 🗂️ **Conversation History** — Switch between (and delete) past conversations from a header menu, or from a permanent sidebar in fullscreen mode (collapsible, searchable past 7 entries, rename in place)
- 🤖 **Multi-Agent Support** — Switch between different AI agents
- 🔗 **Conversation References** — Type `@` in the composer to point the agent at another conversation; opt-in per host, see [Conversation references](#conversation-references)
- 📎 **File Attachments** — Upload and paste files (PDF, TXT, images)
- 📥 **Agent-Generated Files** — Renders downloadable file cards from agent output and strips the `[[FILE:id]]` markers from the prose
- 📝 **Full Markdown** — Tables (mis-delimited ones repaired), code blocks with copy button, lists, blockquotes, soft line breaks, inline images with a lightbox
- 🖼️ **Image Previews** — `data:image/*` charts and image attachments render inline, click to expand
- 📋 **Message Footer** — Every message says when it was sent; copy any message, rate an answer 👍/👎 (stored by the backend or handed to the host, with an optional comment on a 👎) and have it read aloud — see [Message feedback](#message-feedback)
- 🧰 **Composer Toolbar** — Prompt library and quota indicator, both driven by whether the host serves the route; plus a slot for the host's own controls
- 🧠 **Context Gauge** — Ring + percentage showing how full the model's context window is, so a long chat's silent summarising is visible before it happens
- 🎙️ **Dictation** — Speech-to-text via the browser's own Web Speech API; no endpoint, no key, hidden where unsupported
- ✍️ **Draft Recovery** — Unsent composer text is kept per conversation and restored when the panel reopens
- 🎨 **Customizable Theme** — Accent color and logo customization
- 📱 **4 Display Modes** — Floating, sidebar (resizable), fullscreen and inline
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
| `mode`              | `'floating' \| 'sidebar' \| 'fullscreen' \| 'inline'` | **required** | Display mode; `inline` fills the host's container — see [Inline mode and the handle](#inline-mode-and-the-handle) |
| `onClose`           | `() => void`                              | —            | Called when the close button is clicked; the button shows only with it (never in inline mode) |
| `onModeChange`      | `(mode: ChatMode) => void`                | —            | Called when the user switches display mode; the view switcher shows only with it (never in inline mode) |
| `apiBaseUrl`        | `string`                                  | **required** | Base URL for chat API endpoints                                  |
| `backendType`       | `'rest' \| 'legacy' \| 'ag-ui'`           | `'rest'`     | The backend's protocol: XTM One's Chat API, a single POST endpoint with Flowise-style SSE events, or [AG-UI](https://github.com/ag-ui-protocol/ag-ui) |
| `user`              | `{ firstName: string }`                   | **required** | Current user info                                                |
| `topOffset`         | `number`                                  | `0`          | Top offset in pixels (for sidebar/fullscreen with fixed headers) |
| `agentDashboardUrl` | `string`                                  | —            | XTM One URL for the "Browse agents" / "Create agent" links and the waiting panel's "Play Space Invaders in XTM One" link (`{url}/chat?arcade=play`, http(s) only, unless `waitingGameUrl` says where) |
| `waitingGameUrl`    | `string`                                  | —            | Where the waiting panel's invitation to play leads, over `{agentDashboardUrl}/chat?arcade=play`: an http(s) URL or a path of the host's origin (`/…`); anything else links nothing |
| `miniGameEnabled`   | `boolean`                                 | `true`       | Show the waiting panel during longer waits: rotating messages and the invitation to play XTM One's arcade (the package ships no game of its own) |
| `onPlayWaitingGame` | `() => void`                              | —            | Open the arcade in place instead of linking to XTM One, for a host that runs it itself (the XTM One floating assistant) |
| `t`                 | `(key: string) => string`                 | —            | The host's translations; a key it returns unchanged falls back to the panel's catalog in `locale` (none without `locale`) — see [Internationalization](#internationalization) |
| `accentColor`       | `string`                                  | `'#7b5cff'`  | Primary accent color (hex)                                       |
| `logoIcon`          | `React.ReactNode`                         | default icon | Custom logo/icon for the assistant                               |
| `promptSuggestions` | `string[]`                                | default list | Prompt suggestions shown on welcome screen                       |
| `draftBorderColor`  | `string`                                  | —            | Color of the line above the composer (e.g. a draft context)      |
| `draftLabel`        | `string`                                  | —            | Accepted, and not shown                                          |
| `pageContext`       | `Record<string, unknown>`                 | —            | Arbitrary host page context (e.g. `{ url: '/dashboard/...' }`) sent as `context` on each `rest` message so the agent knows where the user is. Must be JSON-serializable (skipped if not). Read fresh at send time; omitted when empty. |
| `resizable`         | `boolean`                                 | `false`      | Enable drag-to-resize for sidebar mode                           |
| `onWidthChange`     | `(width: number) => void`                 | —            | Called when sidebar width changes during resize                  |
| `onResizeStart`     | `() => void`                              | —            | Called when resize drag starts                                   |
| `onResizeEnd`       | `() => void`                              | —            | Called when resize drag ends                                     |
| `pushContentSelector` | `string`                                | —            | CSS selector of the host's content, given a right padding of the sidebar's width while the panel is in sidebar mode (`--chatbot-sidebar-width` on `:root` holds it either way) |
| `disableFileManagement` | `boolean`                             | `false`      | No attaching or pasting files in the composer                    |
| `maxFileCount`      | `number`                                  | `10`         | Most files attached to one message                               |
| `maxTotalSize`      | `number`                                  | 50 MB        | Most bytes the files attached to one message add up to           |
| `onMessageFeedback` | `(id, feedback, message) => void`         | —            | Receives each rating of an answer (`null` clears it); `id` is the message's persisted id when the backend reported one (`done.message_id`, a restored entry's `id`), else the panel's own. On its own it enables 👍/👎 and the panel stores nothing; with `apiEndpoints.feedback` set it is called once the backend has stored the rating. With neither, no thumbs. |
| `locale`            | `string`                                  | browser's    | BCP 47 language tag of the platform's language (e.g. `'fr-FR'`): the language of the panel's catalog for what `t` does not translate, of its message times and of read-aloud. Unset, the browser's — except that a host passing `t` gets no catalog then |
| `disableImagePreviews` | `boolean`                              | `false`      | Render image attachments as download cards instead of inline previews |
| `contextUsageEnabled` | `boolean`                               | `true`       | Show how full the model's context window is for the current conversation (ring + percentage in the composer toolbar). Data-driven, so it stays absent until the backend reports occupancy — see [Context usage](#context-usage). |
| `notifyOnComplete`  | `boolean`                                 | `true`       | Tell the user a long turn ended while they were not watching the chat: away (the tab hidden, another window), the page title flashes and a browser notification shows (when already granted); away or with the panel closed or hidden, `onTaskComplete` is called |
| `onTaskComplete`    | `(title: string, body: string) => void`   | —            | The host's own toast for a long turn that ended while the user was not watching the chat, with the translated `title` and `body` |
| `composerToolbar`   | `React.ReactNode`                         | —            | Extra controls appended to the composer toolbar. The escape hatch for host-specific affordances (XTM One's session-tool picker) — the package never learns what they are. Pass nothing and the toolbar simply has none. |
| `storageKeyPrefix`  | `string`                                  | —            | Namespaces every key the panel keeps in browser storage (`<prefix>:filigranChatConversationId`, …), for a host mounting more than one panel |
| `conversationId`    | `string \| null`                          | —            | The conversation on screen when the host owns it (a `?c=` URL); `null` is a new chat. Left `undefined`, the panel remembers its own, and a host-owned one is never written to storage |
| `onConversationChange` | `(id: string \| null) => void`         | —            | Called whenever the conversation on screen changes, whoever changed it (a first answer, New chat, the history) |
| `initialAgent`      | `string`                                  | —            | Agent selected once the list loads, by id or slug, over the remembered one |
| `onAgentChange`     | `(agent: XtmAgent) => void`               | —            | Called when another agent is picked |
| `readOnly`          | `boolean`                                 | `false`      | Hides the composer: a conversation the user may read but not write to |
| `readOnlyNotice`    | `React.ReactNode`                         | —            | Shown in place of the composer while `readOnly` |
| `getRequestExtras`  | `() => Record<string, unknown>`           | —            | Fields merged into every message body, read at send time (the host's own per-message options). They never override the panel's fields |
| `onStreamEvent`     | `(event, { relayed, end?, replayed? }) => void` | —      | Every frame received, on the message stream or the [event stream](#turns-that-outlive-their-stream) (`relayed: true`), including those the panel does not render, with what the panel read in it (`end`: `'provisional'` or `'stored'`; `replayed`) — see [Host extensions](#host-extensions) |
| `onSessionEnded`    | `(reason: string \| undefined) => void`   | —            | The user's session ended: a `session_expired` frame on either stream, or a `401` whose `detail.code` is `session_expired` on any request the panel makes; *reason* is the frame's or the `detail`'s `reason`. Called once per set of `requestHeaders` |
| `markerRenderers`   | `Record<string, ChatMarkerRenderer>`      | —            | The host's cards for answer markers, by name — see [Host extensions](#host-extensions) |
| `codeBlockRenderers` | `Record<string, ChatCodeBlockRenderer>`  | —            | The host's rendering of fenced code blocks, by language: `(code, { streaming }) => React.ReactNode` — see [Host extensions](#host-extensions) |
| `transformMessageText` | `(text, message) => string`            | —            | Rewrites a message's text before it is shown, copied or read aloud; one that throws leaves the text as it came |
| `onArtifactOpen`    | `(artifact: ChatArtifact) => void`        | —            | Opens a deck, report or video in the host, in place of the `Open in XTM One` link |
| `headerActions` / `banner` / `composerHeader` / `transcriptFooter` / `welcome` | `React.ReactNode` | — | The host's content in the header, above the thread, above the composer, after the last message, or in place of the welcome screen |
| `renderMessageExtras` / `messageFooterActions` | `(message, { streaming }) => React.ReactNode` | — | The host's content under a message, and controls in a finished answer's footer; `streaming` while the message is the answer still being written. `message.raw` holds the backend's own fields — see [Host extensions](#host-extensions) |
| `sidebarRowActions` | `(conversation) => React.ReactNode`       | —            | The host's controls on a row of the conversation list |
| `sidebarHeaderActions` / `sidebarSections` | `React.ReactNode`  | —            | The host's controls beside New conversation, and sections under the list |
| `statusLabel`       | `(status: AgentStatusState) => string \| undefined` | — | The status line's text for a status, over the built-in one |
| `waitingMessages`   | `string[]`                                | built-in     | The waiting panel's rotating messages, already translated |
| `renderWaitingPanel` | `() => React.ReactNode`                  | —            | Replaces the waiting panel's content (its messages and the invitation to play) |
| `fontFamily`        | `string`                                  | —            | Font of the panel's text |
| `theme`             | `ChatPanelTheme`                          | —            | The host's colours, type and shapes; see [Custom Theme](#custom-theme) |
| `agentMentions`     | `boolean`                                 | `false`      | `@` also mentions agents of the agent list; the message carries their ids as `mentioned_agent_ids` |
| `steerAttachments`  | `boolean`                                 | `false`      | Uploaded files may steer the running turn (the steer route takes `file_ids`) |
| `onReady`           | `() => void`                              | —            | Called once, when the panel has chosen its agent and read back the conversation on screen; handle calls made earlier wait for it and then run in order |
| `onHeldSendSettled` | `(text, outcome) => void`                 | —            | What became of a message held until the turn ended (`send` resolved `'held'`): `'sent'`, `'failed'`, `'dropped'`, `'returned'` (given back to the composer: held when Stop ended its turn, or taken over by `onBeforeSend` as it leaves; told once the composer shows it, so `getDraft()` reads it) or `'cancelled'`. A message sent after a stopped turn ended goes out once that turn winds down |
| `onTurnRunningChange` | `(running: boolean, info?: ChatTurnEnd) => void` | —     | A turn started or stopped running on screen, own or relayed: the state of the Stop button and of `draft.turnRunning`; with `false` comes how it ended, `info.ended`: `'answered'`, `'stopped'` or `'failed'` — see [Host extensions](#host-extensions). After a provisional end (see [Turns that outlive their stream](#turns-that-outlive-their-stream)) `false` comes at once, while sends are still held as the turn winds down: until its stored end or its stream's close, at most 5 s |
| `onBeforeSend`      | `(draft) => false \| { text?, displayText?, extras? } \| void` | — | Sees every non-empty send first and takes it over (`false`), rewords it, shows the user's bubble other words or adds body fields (a message with fields of its own is held with `holdSendsDuringTurn`) — see [Host extensions](#host-extensions) |
| `hideConversationList` | `boolean`                              | `false`      | Hides the conversation list of fullscreen and inline modes, for a rail or a task pane (usable from 320 px wide); the header's history menu stands in for it — see [Host extensions](#host-extensions) |
| `holdSendsDuringTurn` | `boolean`                               | `false`      | A message that cannot steer is held and sent when the turn ends, instead of waiting in the composer. A turn winding down after a provisional end (until its stored end or its stream's close, at most 5 s) holds sends with or without it |

Plain-data props (`requestHeaders`, `apiEndpoints`, `pageContext`, `promptSuggestions`) are compared by content and callback props are called
through a stable wrapper, so building them inline is fine. `t` and `logoIcon` are used as given: keep them stable (`useCallback` / `useMemo`),
or every render of the host re-renders every message in the thread.

#### Inline mode and the handle

`mode="inline"` fills the host's container: the conversation list sits beside
the thread as in fullscreen, and there is no view switcher or close button.
With a `ref`, the host drives it:

```tsx
const chat = useRef<ChatPanelHandle>(null);

<div style={{ height: '100%' }}>
  <ChatPanel
    ref={chat}
    mode="inline"
    conversationId={searchParams.get('c')}
    onConversationChange={(id) => setSearchParams(id ? { c: id } : {})}
    storageKeyPrefix="chat-page"
    // ...
  />
</div>;

chat.current?.newConversation({ agent: 'threat-hunter' });
chat.current?.send('Summarize this report', { extras: { mode: 'deep_investigation' } });
```

| Method | What it does |
| --- | --- |
| `send(text, { extras, displayText })` | Sends *text* as the user, leaving the composer's draft alone; `extras` join that one message's body, and the user's bubble shows `displayText` in place of *text* (as `onBeforeSend`'s `displayText`, which wins when it gives one). Resolves to `'sent'` (once the backend takes it), `'steered'` (joined the running turn), `'held'` (sent when the turn ends - also, with or without `holdSendsDuringTurn`, while a turn ended provisionally winds down, after `onTurnRunningChange(false)`), `'dropped'` (empty, taken over by `onBeforeSend`, `readOnly`, or the panel unmounted first) or `'failed'` (the backend refused it) |
| `newConversation({ workspaceId, agent })` | Starts a new chat, in a workspace and with an agent (id or slug) if given |
| `selectConversation(id)` | Opens a conversation; the one on screen is left as it is |
| `setDraft(text)` / `focusComposer()` | Fills / focuses the composer |
| `getDraft()` | The composer's text as it stands (typed by the user, or set by `setDraft`), e.g. for `onBeforeSend` taking over a held message (`draft.held`) to tell whether the composer still holds what was typed for it |
| `stop()` | Same as the Stop button; during a voice call it also drops the question awaited and stops speaking |
| `startVoiceCall()` | Starts a [voice call](#voice-call) over the panel; `false` when this browser has no speech recognition or the panel is `readOnly` |
| `reloadAgents()` | Reads the agent list again, keeping the agent picked unless it is gone |
| `reloadConversation()` | Reads the conversation on screen back from the server again, for a change the host made to it outside the panel (a message it stored, another agent taking it over). Its latest messages are merged into the thread on screen, which keeps what only the panel holds (earlier pages, a stopped answer, a send that failed) and the composer's draft, and the conversation's agent replaces one a turn transferred it to. While a turn runs in it, nothing is read until that turn ends. A read-back that fails leaves the thread as it is. Does nothing without a conversation, or without the REST sessions route (`legacy`, `ag-ui`, `singleEndpoint`, `sessions: null`) |
| `scrollToMessage(id)` | Scrolls to a message by its server id and highlights it; `false` when it is not on screen |

#### Host extensions

A host adds what is its own without the package learning about it. An answer
marker `[[KIND:args]]` renders the host's card where it stands, once the answer
is done (`renderWhileStreaming` to show it earlier); a renderer named `FILE`,
`PRESENTATION`, `REPORT` or `VIDEO` replaces the built-in card, and a marker no
renderer names stays text:

```tsx
const markers = useMemo(
  () => ({
    WORK_ITEM: { render: (id) => <WorkItemCard id={id} /> },
    INVESTIGATION: { render: (id) => <InvestigationBlock id={id} />, fullWidth: true },
  }),
  [],
);

<ChatPanel
  markerRenderers={markers}
  transformMessageText={maskSecrets}
  banner={<ChannelContinuityBanner />}
  composerHeader={<DesktopMachineBar />}
  renderMessageExtras={(m) => <RunnerActivity message={m} />}
  // ...
/>;
```

A fenced code block whose language a host renderer names (`codeBlockRenderers`,
matched case-insensitively) renders that node in place of the code block -
a chart drawn from the block's data, for instance. The renderer gets the
block's text and `streaming`, true while the answer is still coming (the block
may then be incomplete); a language no renderer names, or a renderer that
returns `null` (a block it cannot read), stays a code block:

```tsx
const codeBlocks = useMemo(
  () => ({
    chart: (code: string, { streaming }: { streaming: boolean }) => (streaming ? <ChartSkeleton /> : <Chart spec={code} />),
  }),
  [],
);

<ChatPanel codeBlockRenderers={codeBlocks} />;
```

A card or a code block renderer that throws shows `This item could not be
loaded.` and leaves the rest of the answer on screen. A marker's arguments come from the model's answer:
treat them as untrusted input, never as markup or a URL to follow unchecked. Like `t`, the function props are used as given: keep
them stable, and a new one re-renders every message, which is also how to
refresh what they render.

`onBeforeSend(draft)` sees every non-empty send first, synchronously:
`draft.text`, `draft.source` (`'composer'`, `'host'` or `'voice'`) and
`draft.turnRunning` (a turn is running). It returns `false` to take the send
over (the composer keeps its draft), or an object: `text` rewords what the
backend receives, `displayText` is what the user's bubble shows, and `extras`
adds body fields. The panel's own fields cannot be set this way, and a message
with fields of its own never steers: it is held with `holdSendsDuringTurn`. A
message held while a turn ran is asked about again as it leaves as a new turn
(`turnRunning: false`, `held: true`), each send held with it on its own; taken
over then, what the user typed for it goes back to the composer, after what
was typed since. A held message every send of which is taken over is settled
`'returned'` (`'dropped'` when the user typed nothing for it).

A host that wraps what the user typed in context of its own (the open document,
the page) sends one text and shows another: `onBeforeSend` returns `text`, what
the backend receives, and `displayText`, what the user's bubble shows. A held
message keeps both, and a conversation read back shows what the backend stored:

```tsx
<ChatPanel
  onBeforeSend={({ text }) => ({ text: `${documentContext()}\n\n${text}`, displayText: text })}
  // ...
/>;
```

A host's own send does the same through the handle (the send hook's
`displayText` wins when it gives one):

```tsx
chat.current?.send(`${documentContext()}\n\n${typed}`, { displayText: typed });
```

`onTurnRunningChange(running)` tells the host when a turn starts or stops
running - on screen, where it shows the Stop button, the status line and the
waiting panel, or a relayed turn let go of while the page was hidden; the
state `onBeforeSend` reports as `draft.turnRunning` - so it never re-derives
it from `onStreamEvent`. `true` comes with the panel's
own send and with a turn the [event stream](#turns-that-outlive-their-stream)
relays; `false` once that turn ends: its stream closes after the last `done`
(an intermediate `done` goes on), an `error`, `cancelled` or `session_expired`
frame comes, Stop lets go of it, a new conversation replaces it, or the panel
unmounts in the middle of it. A turn handed over to the event stream stays
running meanwhile, and so does a relayed turn let go of while the page was
hidden, until the reopened stream replays it or the conversation read back
says how it ended. It is called on changes only.

With `false` comes how the turn ended, `info.ended` (`ChatTurnOutcome`), so a
host running a sequence of turns goes on only while they are answered:

- `'answered'`: its last `done` came, with nothing after it saying otherwise;
  for a relayed turn that ended out of sight (nothing replayed it, or the event
  stream could not reopen), the conversation read back holds an answer stored
  after what was shown (an `error` or a `cancelled` the backend stores as an
  answer reads the same);
- `'stopped'`: a `cancelled` frame (even after the last `done`), a
  `session_expired` frame, Stop, a new conversation, the panel unmounting, a
  stream that closed before its last `done` with no event stream to carry the
  turn to its end (a turn the event stream does carry ends as its replay does),
  or a relayed turn that ended out of sight with no answer read back (none
  stored, or the conversation could not be read back);
- `'failed'`: an `error` frame, or a send the backend refused or could not be
  reached for.

```tsx
<ChatPanel
  onTurnRunningChange={(running, info) => {
    setAgentWorking(running);
    if (!running && info?.ended !== 'answered') cancelSequence();
  }}
/>
```

Each answer says which agent wrote it, for a host's own rendering
(`renderMessageExtras`, `messageFooterActions`): `message.answeredBy`
(`{ agentId, agentName, agentIcon }`, from `answered_by`) and
`message.mentionFailed` (`mention_failed`: a note written in place of a
mentioned agent that could not answer), read from every `done` frame,
intermediate ones included, and from each restored entry.

Both slots get the message and `{ streaming }`, true while it is the answer
still being written (`messageFooterActions` shows on a finished answer only,
so it is always false there). `message.raw` is the backend's own object for
the message, a plain copy the panel reads nothing from: the restored entry
(paged or relayed ones too), or the `done` frame that closed a live answer
(intermediate ones included) and, after a provisional end, the stored end. A
host reads its backend's fields there (a trace id, a channel, a format)
without fetching the conversation again; their shape is the backend's to
define. A message no backend object describes yet (one being written, a user
message sent from this panel) has none.

```tsx
<ChatPanel
  renderMessageExtras={(m, { streaming }) => (streaming ? null : <TraceLink id={m.raw?.llm_trace_id as string | undefined} />)}
/>
```

`onStreamEvent(frame, info)` gives every frame as received, with what the
panel read in it, so a host never re-derives either: `info.relayed` (a turn
the event stream relays), `info.end` - `'provisional'` on an `error` or
`cancelled` marked `provisional: true` (its stored end follows),
`'stored'` on an end naming the stored answer's `message_id` (a `done` that is
not intermediate, a `cancelled`, an `error`) - and `info.replayed` on the
`thinking` frame (`resumed: true`) of a turn replayed from its start, whose
frames then restate it so far.

`onSessionEnded(reason)` says the user's session ended, as the backend tells
it: a `session_expired` frame on either stream, or a `401` whose body's
`detail.code` is `session_expired` (`{"detail": {"code": "session_expired",
"reason": "idle"}}`) on any request the panel makes. *reason* is the
frame's or the `detail`'s `reason`, `undefined` when it gives none. It comes
once, whichever request or stream said it first, and again only once
`requestHeaders` change. Signing the user out is the host's: the panel ends
the turn on screen, and a refused read-back offers Retry.

`hideConversationList` gives the thread the panel's whole width in inline (or
fullscreen) mode, for a rail beside the host's own content or an add-in's task
pane: the header, thread and composer hold from 320 px wide. The history is
still there, in the header's history menu (open, delete, Clear all), and a
referenced conversation's chip still opens it; the `sidebar*` slots render
nothing meanwhile. To drop the history altogether, set `apiEndpoints.history`
to `null` instead.

#### Voice call

`startVoiceCall()` on the handle opens a call over the panel, for a host's own
button (`voiceCallSupported()` says whether the browser can hold one): the
browser's speech recognition listens in `locale`, a phrase is sent after one
second of silence (as the user, `onBeforeSend` seeing `source: 'voice'`), and
the answer is said through `apiEndpoints.tts` in pieces of about 200
characters, played in order, the next one requested while one plays, each
piece the route fails or the browser cannot play (or every piece, without the
route) in the browser's voice. Then it listens again. The thread under the
call shows the conversation as usual; a `transformMessageText` that throws
leaves the answer said and shown as it came.

- Only the answer to the question is said: the final `done` of the panel's own
  turn, or of the turn a `folded_into_active_turn` frame (or the steer
  route's `turn_id`) names, never a turn of another tab and never a mid-turn
  segment on its own. A steer stored that the backend says no turn took
  (`"answered": false`) gets no answer, and the call listens again. Only the
  addressed agent (the conversation's, or the one a `transfer_start` hands it
  to) speaks; replies the turn's other agents give (`answered_by`) show by
  name, `Did not answer` beside one that carries `mention_failed`.
- Speech over the answer (barge-in), a tap on the call or Skip stops it and
  listens; a tap while the answer is awaited cancels the question and stops
  its turn, and so does the handle's `stop()`. The microphone can be muted;
  the call mutes it itself when the recogniser fails five times in a row with
  nothing heard between (a refused or missing microphone, no network, a
  language it lacks), silence (`no-speech`) and an aborted session aside.
- A question held while a turn runs (`holdSendsDuringTurn`) is awaited once
  it goes out; one that never does (`onBeforeSend` takes it over as it
  leaves, Stop, a failed send) gets no answer, and the call listens again.
- A turn silent for 120 s is checked through `apiEndpoints.pendingApprovals`
  (its `turn: 'running'`): still running, the call waits on; over (or with no
  such route), it gives up on that question and listens again.

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

The sidebar width is persisted to `localStorage` under the key `filigranChatSidebarWidth` (`<storageKeyPrefix>:filigranChatSidebarWidth` with a prefix).

### `ChatToggleButton`

A floating action button to toggle the chat panel.

```tsx
import { ChatToggleButton } from '@filigran/chatbot';
```

#### Props

| Prop          | Type                      | Default      | Description                                                                |
| ------------- | ------------------------- | ------------ | -------------------------------------------------------------------------- |
| `isOpen`      | `boolean`                 | **required** | Whether the chat panel is open                                             |
| `onToggle`    | `() => void`              | **required** | Called when button is clicked                                              |
| `label`       | `string`                  | built-in     | Button text, already translated by the host; omit for `t('Ask Assistant')` |
| `t`           | `(key: string) => string` | —            | The host's translations; the panel's catalog in `locale` answers the rest  |
| `locale`      | `string`                  | browser's    | The default label's language, by the panel's rule (see Internationalization) |
| `accentColor` | `string`                  | `'#7b5cff'`  | Button background color                                                    |
| `icon`        | `React.ReactNode`         | default icon | Custom icon                                                                |

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
    { "id": "msg-1", "role": "user", "content": "Hello", "created_at": "2026-06-10T08:30:00Z" },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "Hi! How can I help?",
      "created_at": "2026-06-10T08:30:04Z",
      "feedback": { "rating": "positive", "comment": null }
    }
  ]
}
```

`id`, `created_at` and `feedback` are optional, and so are `answered_by`
(`{ agent_id, agent_name, agent_icon }`, the agent that wrote an answer of a
turn several agents answered) and `mention_failed` (`true` on a note written
in place of an agent that could not answer), handed to the host as
`message.answeredBy` and `message.mentionFailed`. `id` is the message's
persisted id, what its rating is stored against (see
[Message feedback](#message-feedback));
`created_at` (ISO 8601) is when it was sent, shown in its footer - a message
without one shows no time. `feedback` is the caller's own rating of an
assistant answer: the thumbs are then locked on it ("Feedback already
submitted").

The response **should echo a `conversation_id`**. When the stored
`conversation_id` no longer exists (e.g. the platform was reset but the
browser kept an old id in `localStorage`), the backend is expected to
transparently create a fresh conversation and return its **new** id with an
empty `messages` array. The component adopts whatever id the response returns
(persisting it to `localStorage`), so subsequent messages are never sent
against a dead conversation — which would otherwise fail with a
"conversation does not exist" error and force the user to manually start a new
conversation. If the endpoint responds with a non-2xx status, the component
silently resets the stored id and starts fresh on the next message, except
when it says nothing of the conversation: a `502`, `503` or `504` (or no
answer at all) keeps the id and reads it back once the backend answers, and a
`401` or `403` (expired credentials) keeps it, shows the response's `detail`
(or "This conversation could not be loaded.") with a Retry button, and reads
it back as soon as `requestHeaders` change.

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

With [workspaces](#workspaces) on, the same route files a conversation:
`{ "workspace_id": "uuid" }`, or `{ "workspace_id": null }` to take it out of
its workspace. A refusal's `detail` is shown under the list.

### Workspaces

The fullscreen conversation list can be grouped by workspace, the way a
desktop assistant groups its projects: one collapsible group per workspace
(the collapsed ones are remembered per browser), a conversation started
inside a workspace with its group's compose button, a workspace created,
renamed or deleted from the list, and a conversation moved between groups
from its row menu or by dragging it onto a group.

The feature is off until the host names the route:
`apiEndpoints.workspaces` has **no default**, for the same reason as
`apiEndpoints.approve` - a proxied host must expose every route below before
the panel offers them. A backend that refuses the list (not licensed, an
older proxy) also leaves the list flat.

| Request | Purpose |
| --- | --- |
| `GET {apiBaseUrl}{workspaces}` | The caller's workspaces: a bare array or `{ "workspaces": [...] }` of `{ id, name, is_default, is_own, can_manage, is_archived }`. Archived ones are left out. |
| `POST {apiBaseUrl}{workspaces}` | Create one: `{ "name": "..." }`. |
| `PATCH {apiBaseUrl}{workspaces}/{id}` | Rename one: `{ "name": "..." }`. |
| `DELETE {apiBaseUrl}{workspaces}/{id}` | Delete one (never offered for the default). Its conversations are expected back in no workspace (`workspace_id: null`), never moved to a default; the history is reloaded after the delete. |
| `PATCH {apiBaseUrl}{history}/{conversation_id}` | File a conversation: `{ "workspace_id": "uuid" \| null }`. |
| `POST {apiBaseUrl}{sessions}` | Carries `workspace_id` when the conversation is started inside a workspace. |

`GET {history}` entries carry `workspace_id` (`null` for none). A conversation
in no workspace is a normal state, listed under "Not in a workspace": a new
conversation starts there unless it is started inside a workspace. A workspace the
caller may only read (`can_manage: false`) gets a group only while it holds
one of their conversations, and conversations filed in a workspace the list
does not return are grouped under "Other workspaces". XTM One serves all of it
at `/chat/workspaces` and `/chat/sessions`.

### Conversation references

Typing `@` in the composer - at the start of the text or after a space, never
inside a word or an email (`a@b`) - opens a menu of the user's other
conversations, searched by title or key as they type. A pick inserts `@<key> `, and the
message goes out with the conversations it still references, so the agent reads
them; a `@word` typed by hand stays plain text, and so does a pick whose `@key`
is edited out before sending. The arrows move in the menu, Enter or Tab insert,
Escape closes it.

The feature is off until the host names the route:
`apiEndpoints.conversationReferences` has **no default**, for the same reason
as `apiEndpoints.approve` - a proxied host must expose the route, and forward
the new body field, before the composer offers the menu. Unset, `@` is plain
text and the message body is unchanged.

| Request | Purpose |
| --- | --- |
| `GET {apiBaseUrl}{conversationReferences}?q=<text>&limit=8&exclude=<conversation_id>` | The menu: `{ "conversations": [{ id, title, key, updated_at, is_own }] }` (or a bare array), the conversations the user can open, most recent first, that `q` matches (case-insensitive): every word of `q` (split on spaces, `-` and `_`) is in the title, or the key starts with `q` - so a key typed back (`@hi-bob` for "Hi Bob"), or a key that is not made of the title's words (an accent folded, a title without Latin letters), still finds its conversation. `q` is omitted for a bare `@`, `exclude` while the conversation is not created yet. `key` is what the pick inserts after `@`, always the backend's own. `is_own: false` marks a conversation shared with the user ("Shared with you"). |
| `POST {apiBaseUrl}{messages}` | Carries `referenced_conversation_ids: string[]`: the picks the text still holds, in the order they appear, each once, at most 5. Omitted when there is none. |
| `POST {apiBaseUrl}{sessions}` | A restored user message may carry `conversation_refs: [{ conversation_id, title, key }]`. |

The references of a sent message show as chips above it, also after a reload.
A chip opens its conversation in the panel when the conversation list holds it
(the list is read as soon as the thread shows a reference), and is a plain label
otherwise - a conversation shared with the user, say. While an answer streams,
a message with a reference waits for it instead of steering the running turn:
a steer reaches the agent as text alone, so it would never read what the
message references. Once the text references five conversations the menu says
so instead of offering more. The picks of an unsent draft are kept with its text, so a
draft restored when the panel reopens still references what it did.

XTM One serves it at `/chat/conversation-references`; a host behind its own
proxy names its route, relative to its `apiBaseUrl` (e.g.
`conversationReferences: '/conversation-references'`).

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

With [conversation references](#conversation-references) on, a message that
references another conversation also carries `referenced_conversation_ids`.

The optional `context` object is forwarded verbatim from the `pageContext`
prop (REST backend only) and is omitted entirely when empty. Use it to make
the agent aware of the user's current location/page; the shape is up to the
host and can be extended later (page title, selected entity, user role, etc.).
It must be JSON-serializable — a non-serializable value (circular reference,
`BigInt`, …) is skipped rather than breaking the request.

A refusal before the stream (a non-2xx answer: a rate limit, a refused
option, an unknown conversation) shows the response's `detail` in place of the
answer - a string, or the `message` (or `detail`) of an object - and
"Unable to connect. Please check the configuration." when it has none; the
handle's `send` resolves `'failed'`.

**Response:** Server-Sent Events stream with these event types:

```
data: {"type": "status", "status": "thinking"}
data: {"type": "status", "status": "tool_start", "tools": ["search_web"]}
data: {"type": "status", "status": "analyzing"}
data: {"type": "status", "status": "streaming"}
data: {"type": "stream", "content": "The weather "}
data: {"type": "stream", "content": "today is sunny."}
data: {"type": "done", "content": "The weather today is sunny.", "conversation_id": "new-uuid", "message_id": "msg-2", "tool_names": ["search_web"], "tool_call_count": 1, "iterations": 1, "reasoning": "Let me check the weather data first.", "tool_call_trace": [{"name": "search_web", "input": "{\"query\": \"weather\"}", "output": "Sunny, 24C", "success": true}], "transfer_chain": [{"agent_id": "uuid", "agent_name": "General"}], "is_truncated": false}
```

A `done` may carry `answered_by` and `mention_failed`, as a restored entry
does, and a `{"type": "session_expired", "reason": "idle"}` frame (the user's
session ended, the stream ends with it) ends the turn on screen there and
then, keeping what it wrote; it does the same on the event stream.

The optional `message_id` on `done` is the answer's persisted id: without it
(and without a restore naming the message) the answer cannot be rated through
`apiEndpoints.feedback`.

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
- `wait_start` — The agent pauses (with `seconds` and `reason`): the reason and a countdown show, with `Continue now` when the host names `skipWait`. The pause stays on screen through `wait_status` (what it watches changed state), `tool_heartbeat`, `tool_progress` and `consult_progress`; streamed text or any other status ends it
- `analyzing` — Agent is analyzing tool results
- `composing` — Agent is composing the response
- `streaming` — Content is being streamed
- `steering` — A mid-run steering message is being incorporated (see below)

**Error event:**

```
data: {"type": "error", "content": "Something went wrong"}
```

An `error` ends the turn for good, and so does a `cancelled`, unless marked
`provisional: true` (see
[Turns that outlive their stream](#turns-that-outlive-their-stream)).

### `POST {apiBaseUrl}/chat/messages/steer`

Steers the agent mid-run: while a response is still streaming, Enter / the
accent Send button dispatches the typed text immediately instead of blocking
until the turn finishes. The widget POSTs:

```json
{
  "conversation_id": "uuid-here",
  "content": "Actually, filter by subregion instead",
  "agent_slug": "general",
  "file_ids": ["file-uuid"]
}
```

`file_ids` is sent only with `steerAttachments` set, for files already
uploaded: by default a message with attachments does not steer.

A 2xx response means the message was persisted and will be injected into the
running agentic loop at the next iteration boundary (`turn_id`, when the body
names it, is the turn it joined), whatever else the body says: XTM One's
`{"status": "stored", "turn_id": null}` (stored in the thread, handed to no turn
it can name) keeps the bubble and resolves `'steered'` too. With
`"answered": false` the backend knows no turn took it: the bubble stays and a
notice above the composer says the message will be read with the next one,
until the next send. On a non-2xx
response or a network error nothing was stored: the optimistic user bubble is
rolled back, the text is restored into the composer (prepended on its own line
if the user already typed something new), the send resolves `'failed'` and the
refusal's `detail`, when there is one, shows above the composer — so a backend
without steering support degrades gracefully and the message is never silently
lost. A `409` means no turn is running any more, an ordinary race: no notice
shows, and with `holdSendsDuringTurn` the message is held and sent as the next
turn instead of going back to the composer. Set `apiEndpoints.steer` to `null`
to disable the steering affordances entirely.

Steering only applies to sends on the `rest` backend with a known
`conversation_id` (the first turn of a fresh conversation only receives its id
on `done`). A message with attachments steers only with `steerAttachments`
(once every file is uploaded); one carrying conversation references, agent
mentions or body fields of its own (`send`'s `extras`, `onBeforeSend`'s
`extras`) never steers, since a steer reaches the agent as text alone: it waits
for the turn to end (`holdSendsDuringTurn`), and `onBeforeSend` is asked again,
with `turnRunning: false`, before it goes out. A file that failed to upload
neither steers nor waits: while a turn runs, winds down or is let go of with
the event stream, the composer offers no send and says why, and once no turn
holds the conversation the message goes without that file. `send` and a voice
call attach no files, so this never holds them. Esc stops generating.

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
then clears the prompt on its own. Stopping the turn also dismisses it (and,
with `cancel`, asks the backend to end it).

**Proxied hosts:** the decision goes through the same fetch path as every other
endpoint — relative to `apiBaseUrl` and honouring `requestHeaders` — so CSRF
wrappers and per-request context headers keep working. A proxy in front of the
chat must forward the request body whole (a proxy rebuilding it from a fixed
field list silently drops `supports_tool_approval`), never time out the
streaming turn, and pass SSE keepalives through untouched.

#### Acting on the host page

The same path answers `act_on_page` (XTM One #5559): with `apiEndpoints.approve`
set **and** `onRelativeLinkClick` passed — the host's opt-in, since it hands the
panel its navigation — the panel also sends `supports_page_actions: true`, and the
agent may act on the page the panel is mounted in. The host's proxy must forward
the approve route's body whole (a `page_action` answer carries no `decisions`).
Without that opt-in a frame is answered `page_actions_not_supported`, with the
page neither read nor acted on. Each step arrives on the stream as a
`status` frame with `event: "page_action_required"`; the panel performs it
(`click`, `open` — a hover, or a click when hovering opens nothing —, `type`, then
Enter only in a field that says it is a search - `type="search"`,
`role="searchbox"`, inside `role="search"`, or named like one (a `name`, `id`,
`placeholder`, `aria-label` or `title` whose whole words include "search",
"query", "filter" or "find", and only when it is the form's sole field) - never
in a form of one unnamed field, which is as likely a create or
rename dialog,
or `navigate` through `onRelativeLinkClick` — never
a page load, which would end the turn) and POSTs
`{ conversation_id, page_action: { action_id, ok, error, url, title, snapshot } }`.
`ok` is the action's own outcome, so a step is never retried because reading the
page back failed; when that read throws, `ok` stands and `error` carries
`snapshot_failed: …` with an empty snapshot. A stopped turn (Stop, New chat,
switching conversation) abandons the action instead of acting on the page.

The snapshot (`utils/pageSnapshot.ts`) lists one line per element a user could
act on — `[e1] link "Reports" -> /dashboard/analyses/reports`, with states such as
`(selected)`, `(pressed)`, `(menu)` for a closed menu or `(collapsed)` for a closed
group
— and leaves out the panel itself, hidden and inert content, and every secret
value: a `type="password"` field, and anything whose `autocomplete` marks it as a
password, a one-time code or a card field, so a revealed password is masked too.
A list cut off at the size cap ends with `[truncated]`. A state the host shows by
styling alone is invisible to it: mark toggles
with `aria-pressed`, the current item with `aria-current`, and a clickable card
with `role="button"`. A `409` means the
turn no longer waits for that action, and the panel drops it.

Actions that would leave the page are refused rather than performed, each
answered with `ok: false` and a reason: a `navigate` off-site, a `click` on a
link to another origin or one opening a new tab, a `type` on anything that is
not a text field, a read-only field, a masked one (a password, one-time code
or card field), a file input (whose chooser is an operating-system window), a
target that is disabled - including one disabled by its `<fieldset>` - and one
no longer visible when the action runs. A click never completes a native default that
would leave the page: an anchor's navigation and a form's submission are
cancelled while the host's own handlers still run. Clicking an in-host link is
routed through `onRelativeLinkClick` rather than clicked, for the same reason a
`navigate` is. An action this version does not know is answered as
`unsupported_action` instead of being dropped, so a backend running ahead of the
panel is not left waiting out its timeout.

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

### Turns that outlive their stream

A backend whose turns keep running when their stream drops (XTM One's own web
chat) opts into six more routes, none with a default:

| `apiEndpoints` key | Request | What it does |
| --- | --- | --- |
| `cancel` | `POST {cancel}` with `{ conversation_id }` | Stop asks the backend to end the turn; the panel keeps reading until the stream's `cancelled` frame (or lets go after 10 s, or at once on a network error or an answer of `{ "turn": "none" }`, reading the conversation back for an end it had not read yet). A Stop pressed before the panel's own send started its turn (its stream delivered nothing yet) carries `"awaiting_send": true`, and its `none` says nothing of that turn: the Stop stays pending and is sent again, without the flag, as the turn starts (or as the answer comes, the turn started meanwhile); any other answer reached a turn, and nothing goes again. A backend may keep a Stop with that flag for the send's turn, and must then take a second cancel of one turn; a Stop without it says nothing of a later send. A refusal (non-2xx) keeps the turn running and shows its `detail` above the composer |
| `skipWait` | `POST {skipWait}` with `{ conversation_id }` | `Continue now` on `status: wait_start` (`{ seconds, reason }`), for as long as the pause lasts (see the status values) |
| `events` | `GET {events}/{conversation_id}/events?client_id=<id>` → SSE | Turns this panel did not start (another tab, a reload mid-turn), `user_message`, `conversation_title`, `approval_resolved`; every frame of a turn names it (`turn_id`, below) |
| `messagesPage` | `GET {messagesPage}/{conversation_id}/messages?before=<message id>&limit=50&supports_artifacts=true` → `{ messages, has_more }` | "Load earlier messages" past the restored ones, offered when the restore answers `has_more: true` |
| `clearAll` | `DELETE {clearAll}` | "Clear all conversations" in the conversation list and the header's history menu, confirmed first |
| `tts` | `POST {tts}` with `{ text, format: 'mp3' }` → audio | Read aloud in the backend's voice; the browser's when it fails |

The event stream is opened once the conversation's history is read back (not
while it could not be, for want of an agent or a reachable backend) and
reconnected with backoff while the page is visible. Once the page has been
hidden for 60 s it is closed (under HTTP/1.1 a background tab would otherwise
hold one of the browser's six connections to the origin), and the relayed turn
it fed is let go of: the segment it was writing goes, those it closed stay.
Shown again, the stream reopens, the backend's snapshot replays a turn still
running, and the conversation is read back for what ended meanwhile. The turn
let go of may run on: sends wait for it (as while a turn winds down) and
`onTurnRunningChange` says nothing until the reopened stream replays it or
shows another turn. Not replayed within 5 s of the page showing again, or
with the stream refused, it ended: the conversation is read back, and the
turn ends as it says (`info.ended`), 10 s at most after. The backend may end
the event stream at any time; a stream it ends, or that drops, is reopened,
from the shortest delay again once it had delivered a frame or lived 5 s (one
that closes at once backs off); a relayed turn on screen then runs on only if
the snapshot replays it within 5 s, or ends as the conversation read back
says.
A `404` or `405` stops it, and a `401` or `403` stops it until
`requestHeaders` change, when it is tried once more (a refreshed token picks
it up).

With `events` named, every frame of a turn names it with the same `turn_id`
wherever it goes: each turn frame of the event stream (`thinking`, `status`,
`stream`, `done`, `error`, `cancelled`, `approval_required`, and the replay of
a turn), and each frame of the message stream from its `turn_started` (or
`folded_into_active_turn`) on. A turn frame of the event stream naming none is
not read, and the console warns of it once per frame type. A backend without
`events` need name no turn: each turn is then the one its own stream carries.

With `events` named, every message, steer, decision, page-action answer, Stop
and "Continue now" carries the same id in `X-Chat-Client-Id` (the
pending-approval reads and the history do not), which the backend uses to
never relay a panel's own turn back to it; frames naming the `turn_id` of the
panel's own turn are dropped too. When the panel's own stream drops mid-turn,
or ends without the turn's last frame (`done`, `error`, `session_expired` or
`cancelled`), it takes a new id and picks the turn up from the event stream,
keeping the segments it closed. It shows "Reconnecting…" for as long as the
event stream takes to reopen (a backend restarting, up to 15 minutes), then
waits 5 s for the snapshot to replay the turn; an `error` or `cancelled` of
the event stream naming that turn ends it as a relayed turn's end would, and
with nothing in time the turn ended out of sight, answered or stopped as the
history read back says. When the event stream cannot open (no conversation
to follow yet) or answers an error other than a gateway's (502, 503, 504),
the turn is not awaited that long. A stream whose `: keepalive` comments came
at a keep-alive cadence and that then sends nothing for 45 s (a proxy that left
it half-open) is taken for dropped the same way, when the event stream can
pick its turn up; a backend without one keeps a silent stream open, as before. A message sent while a turn writes its answer shows above that
answer, where the backend stores it. A read-back that waited for a turn to end joins the thread in
place: each stored message missing from the screen goes after the one stored
before it, so nothing lands above messages it follows.

A relayed turn uses the frames of `POST /chat/messages`, plus:

- `{"type": "thinking", "resumed": true, "elapsed_s": 42}` — a turn re-attached
  mid-way: the segment being written follows, whole (XTM One's snapshot holds
  that one only); the segments an intermediate `done` closed stay on screen.
  Replaying a turn it lost sight of (a relayed turn on a reopened event
  stream, its own turn after its stream dropped, a relayed turn let go of
  while the page was hidden), the panel reads the conversation back as the
  turn runs on: the segments closed meanwhile (stored by then) take their
  place before the one being written, matched to those on screen by
  `message_id`, else by text, so none shows twice; a bubble matched keeps
  what it shows (a user bubble's `displayText`, its files) and takes the
  stored id. A replay naming another turn means the one on screen ended
  meanwhile: the answer it was writing goes, its stored copy read back.
- `{"type": "done", "intermediate": true, …}` — a segment closed, the turn goes on.
- A provisional end — an `error` or `cancelled` marked `provisional: true` (a
  Stop's acknowledgement, a failed loop; any other is final, and nothing of
  its turn is awaited after it) — ends the turn on screen at once; the stored
  end of the same turn that follows it (a `done`, `cancelled` or `error`
  carrying `message_id`) only gives the answer its id, and a `done` its stored
  text and all a live `done` carries (attachments, reasoning, tool trace, the
  agent that answered, context usage, a transfer); also while the panel's own
  turn runs, whose context usage and agent then stay. The panel's own stream
  is read on for it. The backend still holds the conversation until then, so
  the panel holds sends meanwhile, as during a turn (with or without
  `holdSendsDuringTurn`): until that stored end or the stream's close (of
  the panel's own stream, for its own turn; another turn starting ends it
  too), at most 5 s. A relayed turn winds down across the event stream's
  reopening, whose replay of it holds sends too.
- `{"type": "folded_into_active_turn", "turn_id": "…"}` (message stream) — the
  message joined a turn already running, whose frames follow.

### Decks, reports and videos

An answer that made a deck, a report or a video carries a marker where it shows
it: `[[PRESENTATION:<id>]]` (`[[PRESENTATION:<id>#/<slide id>]]` for one
slide), `[[REPORT:<id>]]`, `[[VIDEO:<id>]]`. The panel sends
`supports_artifacts: true` with every message and session restore of the REST
backend, and XTM One then describes each one in the answer's `artifacts`; the
panel draws a card where its marker stands. A marker is never shown as text, a
descriptor whose marker is missing renders after the prose, and a marker with
no descriptor renders nothing.

| Field | Meaning |
| --- | --- |
| `kind`, `id`, `title` | `presentation`, `report` or `video`, and what it is called. |
| `url` | Its page in XTM One: the card's `Open in XTM One` (http(s) only, new tab). |
| `slide_count`, `slide_ref` | A deck's slides, and the slide its marker named. |
| `section_count` | A report's sections. |
| `scene_count`, `duration_ms`, `status`, `progress` | A video's scenes and length, and its newest render (`pending`, `running`, `ready`, `failed`, `cancelled`; progress 0-100). |
| `downloads` | The formats it downloads in: `pdf`, `pptx`, `pptx_native`, `mp4`. Empty until a video has a finished render. |

The downloads go through the host, like file downloads, once it names the
route: `apiEndpoints.artifacts` has **no default**, for the same reason as
`apiEndpoints.approve`. Unset, the cards show and link to XTM One, with no
download buttons.

| Request | Purpose |
| --- | --- |
| `POST {apiBaseUrl}{artifacts}/{kind}/{id}/download` | `{ "format": "pdf" }`: the file, saved under its `Content-Disposition` name. A failure goes to `onDownloadError` with the name of the file asked for. |
| `GET {apiBaseUrl}{artifacts}/{kind}/{id}` | The descriptor as of now: a card asks again 10 seconds after each answer, one request at a time, for 15 minutes at most, while its video renders. |

XTM One serves both at `/chat/artifacts`.

### Message feedback

Every message ends with a footer. An assistant answer (once it has finished
streaming) shows when it was sent, the "i" reasoning details, **Copy
response**, 👍 / 👎 and **Read aloud**; a user message shows **Copy message**
and its time, right-aligned. The time is written in the `locale` prop's
language (the time alone today, the date and time before; the full date in
the tooltip). Time and "i" are always visible; the other actions appear when
the message is hovered or focused, and always on a touch screen. A rating
given, or the answer being read, stays visible.

The thumbs render when `apiEndpoints.feedback` is set **or**
`onMessageFeedback` is passed. **Opt-in: `feedback` has no default path**
(the same choice as `approve`): a host names its route, or the panel stores
nothing.

```
POST   {apiBaseUrl}{apiEndpoints.feedback}/{conversation_id}/messages/{message_id}/feedback
       { "rating": "positive" | "negative", "comment": string | null }
       -> 200 { "rating": ..., "comment": ... }
DELETE {apiBaseUrl}{apiEndpoints.feedback}/{conversation_id}/messages/{message_id}/feedback
       -> 204
```

Both are sent with `credentials: 'include'` and your `requestHeaders`
(XTM One: `feedback: '/chat/conversations'`). `message_id` is the answer's
persisted id — the `done` event's `message_id`, or the restored entry's
`id` — so an answer the backend did not identify shows no thumbs.

- A thumb is shown as given at once and rolled back, with "Could not submit
  feedback." (or "Could not retract feedback." for a retraction) under the
  message, when the backend refuses it or cannot be reached.
- Clicking the given thumb again retracts it (`DELETE`).
- Once a 👎 is stored the panel asks what went wrong: **Save** re-posts the
  rating with the comment (trimmed, at most 2000 characters), **Skip** keeps
  the rating without one.
- A rating restored with the conversation (`feedback` on a restored entry) is
  final: only its thumb is shown, "Feedback already submitted".
- `onMessageFeedback`, when passed too, is called once the backend has
  stored the rating. On its own it receives every rating and the panel
  stores nothing (no comment step, since the callback has nowhere to put
  one).

REST backend only, and not in `singleEndpoint` mode (there is no per-path
routing to name a feedback route with).

**Read aloud** uses the browser's own speech synthesis — or the backend's
voice when the host names `apiEndpoints.tts` — hidden where neither exists, and absent on an answer with nothing to say (code only). It
reads the answer's text without its markdown or file markers, in the `locale`
prop's language, one answer at a time; switching conversation, sending a
message or leaving the panel stops it.

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

### Custom Theme

`theme` gives the panel the host's design system. Each entry is a CSS value
and sets the `--filigran-chat-*` variable named beside it on the panel root,
where everything the panel renders (its dialogs and menus included) reads it;
an entry left out keeps the panel's own look, light and dark. A host's own
variables (`var(--x)`) follow its light and dark modes, so one value serves
both. The same variables may be set in CSS on an ancestor instead.

| Entry              | Variable                            | Styles |
| ------------------ | ----------------------------------- | ------ |
| `surface`          | `--filigran-chat-surface`           | The background inline and fullscreen |
| `surfaceRaised`    | `--filigran-chat-surface-raised`    | The background as a sidebar or floating card, and of its dialogs and menus |
| `surfaceSubtle`    | `--filigran-chat-surface-subtle`    | Cards, search boxes, a table's or a code block's header |
| `surfaceHover`     | `--filigran-chat-surface-hover`     | A row or a button under the pointer |
| `inputSurface`     | `--filigran-chat-input-surface`     | A text field: the composer (no fill unless set), a rename field, the feedback and approval comments |
| `headerBackground` | `--filigran-chat-header-background` | The header's background, a colour or an image (`none` for the surface alone) |
| `text`             | `--filigran-chat-text`              | Text |
| `textMuted`        | `--filigran-chat-text-muted`        | Times, labels, hints and placeholders |
| `textSecondary`    | `--filigran-chat-text-secondary`    | Table cells, chips, descriptions, notices |
| `border`           | `--filigran-chat-border`            | Dividers, outlines, a gauge's track and the loading skeleton |
| `textSize`         | `--filigran-chat-text-size`         | An answer's prose, its headings in proportion, and a user's message unless `userTextSize` |
| `userBackground`, `userText`, `userRadius`, `userPadding`, `userTextSize` | `--filigran-chat-user-*` | A user's message |
| `fontMono`, `codeSize`, `codeSurface` | `--filigran-chat-font-mono`, `-code-size`, `-code-surface` | Code, in a block or inline |

```tsx
<ChatPanel
  theme={{
    surface: 'var(--page-background)',
    text: 'var(--text-primary)',
    userBackground: 'color-mix(in oklab, var(--accent) 10%, transparent)',
    userText: 'var(--text-primary)',
    textSize: '1rem',
  }}
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

The panel speaks English, French, Spanish and Japanese on its own: it ships a
catalog for each and picks one from `locale` (`fr-FR` reads French; English, or
a language it lacks, is its own keys). A host in another language translates
through `t`. A host with nothing to add only passes `locale`:

```tsx
<ChatPanel locale={user.language} /* ... */ />
```

`t` is an optional override, asked first for every key — key in, translated
string out, so any i18n library works. Where it returns something other than
the key, its wording wins; where it returns the key (a host catalog that does
not have it), the panel's own catalog answers, in `locale`'s language:

```tsx
import { useTranslation } from 'react-i18next';

function App() {
  const { t, i18n } = useTranslation();
  return <ChatPanel t={t} locale={i18n.language} /* ... */ />;
}
```

Which catalog answers, by what the host passes:

| `t` | `locale` | A key `t` does not translate shows in |
| --- | --- | --- |
| — | given | the panel's catalog for `locale` (English for a language it lacks) |
| — | — | the panel's catalog for the browser's language |
| given | given | the panel's catalog for `locale` |
| given | — | English: the panel's catalog is not used |

`ChatToggleButton` takes the same `t` and `locale` for its default label, by the same rule.

#### Values inside sentences

A key is always a **whole sentence**, with `{placeholder}` slots for the values.
The panel fills the slots in _after_ the lookup, so a locale is free to move the
value, and a translator sees the sentence rather than a fragment of one:

| Key | Renders as |
| --- | --- |
| `'Waiting for {count} background tasks…'` | Waiting for 3 background tasks… |
| `'Transferred from {agent}'` | Transferred from Threat Analyst |
| `'{percent}% full'` | 84% full |
| `'How can {agent} help you, {name}?'` | How can **Threat Analyst** help you, John? |

Two consequences worth knowing when writing a translation:

- **Plurals are separate keys** — `'1 tool call'` and `'{count} tool calls'`,
  `'Delegating one task…'` and `'Delegating {count} tasks…'`. A lookup cannot
  select a plural form, so the panel picks the sentence and the locale
  translates it whole; a language with more plural forms than English can route
  the plural key through its own rules.
- **A missing slot is not fatal** — a translation that drops a `{placeholder}`
  renders the rest of the sentence as it is, and the value is simply absent.
  That includes the greeting, where the agent's name is markup: a locale that
  rewords the sentence without `{agent}` gets the sentence, not a name dangling
  off the end of it.

`promptSuggestions` (and any suggestions the backend serves) also go through
`t`, so a host may pass either keys or final text.

#### Translation keys

The catalogs are `src/i18n/<language>.ts`, one entry per key: the list of
everything a host may override. `yarn test` fails when a key the source uses
is missing from a catalog, or a translation drops one of its placeholders, so
a new string ships translated with the feature that adds it.

## Styling

Import the CSS file to apply default styles:

```tsx
import '@filigran/chatbot/styles.css';
```

The component uses Tailwind CSS classes and CSS custom properties for theming. The accent color is applied via `--chat-accent` CSS variable.

The stylesheet is isolated from the host page in both directions. Every utility
is scoped to the panel (`.filigran-chatbot` and its descendants) and declared
outside any cascade layer, and the theme variables (`--radius-*`, `--spacing`,
`--color-*`, ...) are declared on the panel root only, never on `:root` or
`:host`. The host's own utilities and `:root` tokens - a Tailwind build shipped
without layers, such as the Filigran design system's - therefore never restyle
the panel, and loading the stylesheet neither styles the host page nor
redeclares the host's own variables. Panel overlays (menus, dialogs, tooltips,
the image viewer) render inside the panel root, so they keep its styles; so
does `ChatToggleButton`, which carries the `filigran-chatbot` class itself. A
host element rendered outside the panel does not get the panel's variables:
declare its own.

### Composer toolbar

Two toolbar items are **data-driven rather than mode-driven**: they appear only
when the host serves the route, so the UI can never advertise something the
backend cannot answer, and there is no mode flag to keep in step.

| Endpoint | Default path | Response |
| --- | --- | --- |
| Prompt library | `GET {apiBaseUrl}/chat/prompts` | `[{ id, title, content, description? }]` (or `{ prompts: [...] }`) |
| Quota status | `GET {apiBaseUrl}/chat/quota` | `{ used: number, limit: number \| null, period: string, scope?: 'user' \| 'global' }` |
| Agent suggestions | `GET {apiBaseUrl}/chat/suggestions?agent_slug=<slug>` | `["..."]` (or `{ suggestions: [...] }`, or objects with `prompt`/`label`/`text`) |

Set either to `null` in `apiEndpoints` to hide it. `limit: null` means no
ceiling — the indicator then shows consumption without a bar. The quota is
re-read whenever a turn finishes. The periods XTM One sets a quota for
(`daily`, `monthly`, `yearly`) are translated (`today`, `this month`,
`this year`), any other one is shown as sent; `scope: 'global'` says the
limit is shared across all users.

A host behind its own proxy points the routes at it, relative to its
`apiBaseUrl` — OpenCTI and OpenAEV pass
`{ prompts: '/prompts', quota: '/quota', feedback: '/conversations' }`
(`feedback`: see [Message feedback](#message-feedback)).

The welcome screen names the selected agent and shows its own suggestions —
which is also how switching agent is confirmed: the thread resets to that
screen, so without it nothing tells you who the next message will reach. When
the suggestions route is unavailable the host's `promptSuggestions` prop is used
instead, so the section is never empty.

Dictation needs no configuration at all: it uses the browser's own Web Speech
API, so the mic button appears inside the text field, next to Send, wherever
the API exists and is simply absent elsewhere. It is not a toolbar item, so it
never adds the toolbar row on its own. While it listens the field turns red and
reads `Listening...`, finalised phrases are appended to the composer (never
replacing a draft), interim words preview in the line under it, and every send
(Enter, Send, Send now) stops the mic and drops the phrase still being
recognised, so no words can land in a composer the user just emptied. Stopping
the mic by hand keeps that last phrase.

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
`string → string` helpers ship, with the answer-marker helpers below, from the dedicated **`@filigran/chatbot/markdown`**
entry point — ~5 kB, no React, no CSS. Import them from there and never from the
package root, which is the full panel bundle:

```tsx
import { markdownUrlTransform, prepareMarkdown } from '@filigran/chatbot/markdown';

// After the host's own rewriting, if any (its API's URLs).
const processed = prepareMarkdown(rewriteOwnUrls(content));

<ReactMarkdown urlTransform={markdownUrlTransform}>{processed}</ReactMarkdown>;
```

`prepareMarkdown` is the panel's own pipeline, in its order:
`hardenNestedCodeFences(normalizeMarkdownTables(wrapBareJson(normalizeImageMarkdown(content))))`.
Order matters: alt-text is flattened before anything reads line structure, and
the JSON wrap must see the raw payload before fences are hardened. Each step
is exported too.

| Helper                    | Fixes                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `prepareMarkdown`         | All four below, in the panel's order                                                                            |
| `normalizeImageMarkdown`  | Multi-line `![alt](url)` alt text, which breaks the image into literal paragraphs plus a stray link             |
| `wrapBareJson`            | A whole message that is raw JSON — fenced as ```json so it stays readable and copyable                          |
| `normalizeMarkdownTables` | A delimiter row whose column count doesn't match the header, including tables nested in blockquotes / list items |
| `hardenNestedCodeFences`  | A ```markdown block containing its own ``` fences, which shatters the snippet into alternating code and prose   |
| `markdownUrlTransform`    | react-markdown's default sanitiser stripping `data:image/*` URIs (code-interpreter charts). Still blocks `javascript:` and non-image `data:` |

None of them touch content they don't apply to — an already-valid document is
returned byte-identical.

The same entry point reads the `[[KIND:args]]` markers of an answer exactly as
the panel does, for a host that renders answers, previews or notifications of
its own:

```ts
import { markerKinds, splitAnswerMarkers, stripAnswerMarkers, type AnswerPart } from '@filigran/chatbot/markdown';

const kinds = markerKinds(['WORK_ITEM', 'INVESTIGATION']); // the host's own kinds
const parts: AnswerPart[] = splitAnswerMarkers(content, isStreaming, kinds);
const preview = stripAnswerMarkers(content, kinds);
```

| Helper | What it does |
| --- | --- |
| `markerKinds(names)` | The host's marker names upper-cased, deduplicated and sorted, invalid ones (anything but `A-Z`, `0-9`, `_`, starting with a letter) dropped: the `kinds` the two others take |
| `splitAnswerMarkers(content, streaming?, kinds?)` | The answer as ordered parts: `{ type: 'text', value }`, `{ type: 'file', fileId }`, `{ type: 'artifact', kind, id, slideRef? }` (`PRESENTATION`, `REPORT`, `VIDEO`, the id lower-cased, a deck's `#/<slide>`), and `{ type: 'marker', kind, args }` for a kind in `kinds` (a built-in one named there included, its arguments as written). A marker cut off at the end is dropped, and so, while `streaming`, is a chunk that stopped inside a marker's name (`[[PRES`). A marker of a kind no one names stays text |
| `stripAnswerMarkers(content, kinds?)` | The answer with its markers removed (copy, a preview, a notification); prose with none is returned untouched |

## Workspace Helpers

A host listing conversations in a sidebar of its own groups them by workspace
exactly as the panel's list does, from the dedicated **`@filigran/chatbot/workspaces`**
entry point — pure functions, no React, no CSS:

```ts
import { ELSEWHERE_GROUP, groupConversations, groupIsOpen, parseWorkspaces } from '@filigran/chatbot/workspaces';

const workspaces = parseWorkspaces(workspaceList, { userId: me.id });
const { groups, unfiled } = groupConversations(
  conversations.map((c) => ({ ...c, conversationId: c.id, workspaceId: c.workspace_id })),
  workspaces,
  { matches: search ? (c) => c.title.toLowerCase().includes(search) : undefined },
);
```

| Helper | What it does |
| --- | --- |
| `parseWorkspaces(data, { userId? })` | The backend's list (a bare array or `{ workspaces }`) as `ChatWorkspace`s; entries without an id or a name, and archived ones, are left out. A workspace is the caller's own (`isOwn`) by its `is_own`, else, where the backend sends none, by its `user_id` being `userId` |
| `sortWorkspaces(workspaces)` | The caller's own default first, then by name |
| `groupConversations(conversations, workspaces, { matches? })` | `{ groups, unfiled }`: a group (`{ workspace, key, conversations }`) per workspace the caller may file into, empty or not, and per one they may only read while it holds one of their conversations; those filed in a workspace not listed go to one group keyed `ELSEWHERE_GROUP` (`workspace: null`). With `matches` only the matching conversations stay, and groups left empty go. Each conversation needs `conversationId` and `workspaceId`; the host's own type passes through whole |
| `fileableWorkspaces(workspaces)` | The workspaces a conversation can be moved into (`canManage`), in list order |
| `groupIsOpen(key, collapsed, group, activeConversationId, searching)` / `groupCanToggle(group, activeConversationId, searching)` | Whether a group shows its conversations (collapsed, unless it holds the conversation on screen; always while searching), and whether its toggle may fold it |

## Peer Dependencies

- `react` >= 18
- `react-dom` >= 18
- `react-markdown` >= 10
- `remark-breaks` >= 4
- `remark-gfm` >= 4

## Dependencies

- `unified` ^11 and `remark-parse` ^11 — the ranges react-markdown 10 depends on, so a host resolves them to the copies it already has. The panel
  uses them to find the top-level blocks of a streaming answer, and re-renders only the blocks that can still change.

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

To run the unit tests (Node's built-in test runner, with an esbuild loader for JSX and Node's own type stripping for TypeScript; Node 22.18 / 23.6 or later):

```bash
yarn test
```

To publish:

```bash
yarn publish --access public
```

Or from the monorepo root:

```bash
yarn publish:filigran-chatbot
```
