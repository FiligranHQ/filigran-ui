# Changelog

Notable changes to `@filigran/chatbot`, so a host can see what an upgrade brings
before taking it.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the versions follow [semantic versioning](https://semver.org/spec/v2.0.0.html).
This file starts at 3.10.0; earlier releases are on the
[releases page](https://github.com/FiligranHQ/filigran-ui/releases).

## 3.15.0 — unreleased

### Added

- `mode="inline"`: the panel fills the host's container instead of floating
  over the page, laid out like fullscreen (conversation list beside the
  thread), with no view switcher and no close button. For a host that gives
  the chat a page of its own.
- A host can own the conversation on screen (`conversationId`,
  `onConversationChange`), pick the agent selected first (`initialAgent`,
  `onAgentChange`) and drive the panel through its `ref` (`send`,
  `newConversation`, `selectConversation`, `setDraft`, `focusComposer`,
  `stop`). The handle is the same object for the panel's life, and `send`
  resolves to what became of the message: `'sent'` once the backend takes
  it, `'steered'`, `'held'`, `'dropped'` (empty, taken over, read-only, or
  the panel unmounted first) or `'failed'` (the backend refused it).
- `onClose` and `onModeChange` are optional: the header shows the close
  button and the view switcher only when they are given.
- `storageKeyPrefix` namespaces every key the panel keeps in browser storage,
  for a host that mounts more than one panel.
- `readOnly` hides the composer, with `readOnlyNotice` in its place, and
  the panel then sends nothing, from the handle or the welcome screen's
  suggestions.
- `getRequestExtras` adds the host's own fields to each message body (the
  panel's own fields, set by it or not, are never taken from there), and
  `onStreamEvent` hands the host every frame received, including those the
  panel does not render.
- The panel renders the frames of a backend whose turns outlive their stream:
  a turn re-attached mid-way (`thinking.resumed`), an announced wait
  (`status: wait_start`, with a countdown), `cancelled`, an intermediate
  `done` and the agent that `answered_by` a segment. A provisional end (an
  `error` or `cancelled` with neither `message_id` nor `reason`) ends the turn
  on screen at once, and the stored end of the same turn that follows it gives
  the answer its persisted id, and a `done` its text and all a live `done`
  carries, opening no second answer (the panel's own stream is read on for
  it).
- History is restored with no agent list (`apiEndpoints.agents: null`).
- A host can render its own cards for the `[[KIND:args]]` markers of an
  answer (`markerRenderers`), by marker name, and take over the built-in
  `FILE`, `PRESENTATION`, `REPORT` and `VIDEO` ones, including the items an
  answer carries with no marker. A card that throws, or a renderer that does,
  shows `This item could not be loaded.` and leaves the rest of the answer
  alone. A marker no renderer names stays text, as before.
- `transformMessageText` rewrites a message's text before it is shown, copied
  or read aloud (masking secrets, converting a channel's syntax).
- `codeBlockRenderers` renders a fenced code block of a language the host
  names (`(code, { streaming }) => ReactNode`, matched case-insensitively) in
  place of the code block, e.g. a chart drawn from the block's data. A
  renderer that throws shows `This item could not be loaded.`, as a marker
  card does; a language no renderer names, or a renderer returning `null`,
  stays a code block.
- `onArtifactOpen` opens a deck, report or video in the host, in place of the
  link to XTM One.
- Slots for the host's own content: `headerActions`, `banner`,
  `composerHeader`, `transcriptFooter`, `welcome`, `renderMessageExtras`,
  `messageFooterActions`, `sidebarRowActions`, `sidebarHeaderActions` and
  `sidebarSections`.
- `statusLabel`, `waitingMessages` and `renderWaitingPanel` adapt the status
  line and the waiting panel; `fontFamily` sets the panel's font.
- An agent's `icon` shows in the picker when it is an image URL or an emoji,
  and agents carrying a `group` are listed under its heading.
- `@` in the composer can mention agents (`agentMentions`): the agents of
  the agent list are offered above the conversations, and the message carries
  the ids of those it still mentions as `mentioned_agent_ids`, in mention
  order. A message that mentions an agent never steers the running turn.
- `steerAttachments` lets uploaded files steer the running turn (the steer
  route then takes `file_ids`), and `holdSendsDuringTurn` holds a message that
  cannot steer (files, references, mentions, body fields of its own, a turn
  that has just ended) and sends it as the next turn, with a way to cancel it
  meanwhile. Messages held one after another go together, keeping their body
  fields, and Stop gives back to the composer what the user typed for them.
- `scrollToMessage` on the panel's handle jumps to a message and highlights it.
- `getDraft()` on the panel's handle reads the composer's text as it stands
  (typed, or set by `setDraft`), e.g. for a host taking over a held message
  (`draft.held`) to tell whether the composer still holds what was typed.
- A voice call over the panel, started with `startVoiceCall()` on the handle
  (`voiceCallSupported()` tells a host whether to offer it): the browser's
  speech recognition listens, a phrase is sent after one second of silence
  (`onBeforeSend` sees `source: 'voice'`), and the answer is said through
  `apiEndpoints.tts` in pieces of about 200 characters, in the browser's voice
  where the route fails or is not named. Only the final answer of the turn
  that answers the question is said (the panel's own, or the one a fold or a
  steer names), and only the addressed agent's: the other agents' replies show
  by name, `Did not answer` beside a failed one. Speaking over the answer, a
  tap or Skip stops it; a tap while it is awaited cancels the question and its
  turn, as `stop()` does; a turn silent for 120 s is checked through
  `apiEndpoints.pendingApprovals` and given up on once over.
- Stable `data-testid`s for host tests: `filigran-chat-panel`,
  `filigran-chat-transcript`, `filigran-chat-user-message`,
  `filigran-chat-assistant-message`, `filigran-chat-composer`,
  `filigran-chat-approval`, `filigran-chat-disclaimer`.
- `onReady` tells the host when the panel has chosen its agent and read back
  the conversation on screen; calls through the handle made before then wait
  for it, and all of them run in order (a new conversation's agent is in
  place before the send that follows it).
- `onBeforeSend` sees every send first, from the composer or the handle: it
  can take a send over, or reword it and add fields to its body. It can also
  return `displayText`: the backend receives `text`, and the user's bubble
  (live, steered or held) shows `displayText`, for a host that wraps what the
  user typed in context of its own. A message held while a turn ran is asked
  about again as it leaves (`turnRunning: false`, `held: true`); taken over
  then, what the user typed for it goes back to the composer, after what they
  typed since, and it is settled `'returned'`.
- `hideConversationList` hides the conversation list of inline and fullscreen
  modes, for a rail or a task pane: the header, thread and composer hold from
  320 px wide, and the header's history menu stands in for the list (open,
  delete, Clear all), while a referenced conversation still opens in the panel.
- `reloadAgents()` on the handle reads the agent list again, keeping the agent
  picked unless it is gone (none is picked once the list is empty). A failed
  reload keeps the list it had, and only the latest reload lands.
- `onHeldSendSettled(text, outcome)` tells the host what became of a message
  held until the turn ended: `'sent'`, `'failed'`, `'dropped'`, `'returned'`
  (given back to the composer by Stop, or by `onBeforeSend` taking it over as
  it leaves) or `'cancelled'`.
- `ChatSendDraft.source` can be `'voice'`, for a question spoken in a voice call.
- `onTurnRunningChange(running)` tells the host when a turn starts or stops
  running on screen, own or relayed: the state of the Stop button, the status
  line and `draft.turnRunning`. `false` comes once the turn's stream closes
  after its last `done` (not an intermediate one), on `error`, `cancelled` or
  `session_expired`, on Stop, a new conversation, or the panel unmounting
  mid-turn; it is called on changes only. With `false` comes how the turn
  ended, `onTurnRunningChange(false, { ended })` (`ChatTurnEnd`,
  `ChatTurnOutcome`): `'answered'` (its last `done`), `'stopped'` (`cancelled`,
  even after the last `done`, `session_expired`, Stop, a new conversation, the
  panel unmounting, or a stream closed before its last `done` that nothing
  carried on) or `'failed'` (an `error` frame, or a send refused or
  unreachable). A host no longer re-derives either from `onStreamEvent`.
- `send(text, { displayText })` on the handle: the backend receives *text*
  and the user's bubble shows `displayText`, as with `onBeforeSend`'s
  `displayText` (which wins when it gives one).
- `ChatMessage.answeredBy` (`{ agentId, agentName, agentIcon }`) and
  `ChatMessage.mentionFailed`, from the `answered_by` and `mention_failed` of
  each `done` frame (intermediate ones included) and of each restored entry,
  for a host's own rendering of a turn several agents answer. The panel's own
  rendering is unchanged.
- A `session_expired` frame on the message stream or the event stream ends
  the turn on screen at once, keeping what it wrote, rather than handing an
  own turn over to an event stream that cannot replay it.
- `@filigran/chatbot/markdown` also exports the answer-marker helpers the
  panel reads markers with: `splitAnswerMarkers`, `stripAnswerMarkers`,
  `markerKinds` and the `AnswerPart` type (and `ChatArtifactKind`), still free
  of React and side effects, so a host renders, previews or strips markers
  exactly as the panel does.
- New exported types: `ChatPanelHandle`, `ChatPanelMode`, `ChatSendOptions`,
  `ChatSendOutcome`, `ChatSendDraft`, `ChatSendDecision`, `ChatHeldOutcome`,
  `ChatMarkerRenderer`, `ChatMarkerContext`, `ChatCodeBlockRenderer`,
  `ChatCodeBlockContext`, `ChatStreamEventInfo`, `ChatAnsweredBy` and
  `AgentStatusState`.

### Changed

- The panel ships its own translations (es, fr, ja, beside English) and
  speaks `locale`'s language without the host translating anything. `t` is
  now an override: the host's wording wins where it translates a key, the
  panel's catalog answers where it returns the key. A host translating every
  key, as before, sees no change. `ChatToggleButton` takes `locale` too.
  A host that passes `t` but no `locale` keeps the panel in English where its
  `t` returns the key; a host passing neither now gets the browser's
  language where the panel has it, rather than English.
- A stopped answer says `Stopped`, rather than vanishing when nothing was
  written yet.
- The Send, attach, close and view-switcher buttons have accessible names.
- Files dragged over the thread attach on drop (wherever uploads are on), and
  the drop does not reach the host's own drop zones.
- A conversation being read back shows a skeleton rather than the welcome
  screen.
- An agent icon shows only from an `https:` URL or a `data:image/` one.
- A conversation whose restore fails because the backend is unreachable or
  answers 502, 503 or 504 keeps its id, rather than being dropped for a new
  chat, and is read back once the backend answers (retried with backoff, and
  at once when the browser is back online or the page is shown again, never
  over a turn in progress); any other error still resets it.
- A conversation whose restore answers 401 or 403 (expired credentials) keeps
  its id too, rather than being dropped for a new chat (a host's `?c=`
  survives): the panel shows the response's `detail` (or `This conversation
  could not be loaded.`) with a Retry button, and reads the conversation back
  as soon as `requestHeaders` change.
- A message the backend refuses before streaming (a non-2xx answer) shows the
  response's `detail` (a string, or the `message` or `detail` of an object)
  instead of `Unable to connect. Please check the configuration.`, which stays
  for a refusal that says nothing; `send` still resolves `'failed'`.
- The stylesheet declares Tailwind's theme variables (`--color-*`,
  `--radius-*`, `--shadow-*`, ...) on the panel root only, no longer on
  `:root` and `:host`, so loading it never redeclares a host's own variables;
  the `@property` fallbacks of browsers without it are kept to the panel's
  elements too. A host element outside the panel no longer inherits them.
- A fenced code block's language label shows the whole language
  (`objective-c`, not `objective`).
- A long agent name in the header is cut short rather than pushing the
  header's controls off a narrow panel.
- A steer the backend refuses shows the refusal's `detail` above the composer,
  the text going back to the composer as before; a `409` (the turn has just
  ended, an ordinary race) shows nothing.

### Fixed

- A conversation read back after the user has already sent a message no
  longer replaces that turn: its history goes above the turn once the turn
  ends, and its agent's name shows at once.
- Sending no longer throws on a page served over plain http, where
  `crypto.randomUUID` does not exist.

### Host opt-in

- `apiEndpoints.cancel` (no default): Stop asks the backend to end the turn and
  waits for the stream's `cancelled` frame, instead of dropping the stream. An
  answer of `{ "turn": "none" }` lets go of the turn at once and reads the
  conversation back, unless it came before the panel's own send started its
  turn: the Stop then stays pending and is sent again as the turn starts. A
  refused Stop (e.g. `503`) keeps the turn running and says why above the
  composer; the status line keeps what the turn reported since the click.
- `apiEndpoints.skipWait` (no default): `Continue now` on an agent's wait.
- `apiEndpoints.events` (no default): the panel follows the conversation's
  event stream, and renders turns started in another tab or before a reload,
  user messages sent elsewhere, new titles and approvals answered elsewhere.
  Refused with 401 or 403, the stream is tried once more each time
  `requestHeaders` change, so a refreshed token picks it up.
  Messages, steers, decisions, page-action answers, Stop, "Continue now" and
  the event stream itself then carry `X-Chat-Client-Id`, so a panel's own
  turns are never relayed back to it. A panel whose own stream drops
  mid-turn, or ends without the turn's last frame, picks the turn up from the
  event stream under a new id, keeping the segments it closed; Stop meanwhile
  sticks. The stream is followed only once the conversation's history is on
  screen, and a turn stopped here, named or not, stays stopped. A dropped or
  ended stream is reopened with backoff, from the shortest delay again once
  it delivered a frame or lived 5 s; a relayed turn on screen then runs on
  only if the reopened stream replays it within 5 s (the segment being
  written; those an intermediate `done` closed stay), and otherwise ends and
  the conversation is read back. A replayed turn reads the conversation back
  too, while it runs on: the segments it closed while the stream was away
  come back, in order, before the one being written, each shown once. Once the page has been hidden for 60 s the
  stream is closed, and the relayed turn it fed taken off screen; shown
  again, the stream reopens (its snapshot replays a turn still running) and
  the conversation is read back for what ended meanwhile. The stored end of a
  relayed turn ended provisionally lands on its answer also while the panel's
  own turn runs, and one naming no turn too.
- With `cancel`, `skipWait` or `events` named, a send made while a turn ended
  provisionally still winds down is held, as during a turn, until its stored
  end, the stream's close or 5 s: the backend still holds the conversation,
  and the message would join the ending turn unanswered.
- With `cancel`, `skipWait` or `events` named, a new chat's conversation is
  created before its first message, so Stop, "Continue now" and steering
  reach the backend from the first turn.
- `apiEndpoints.messagesPage` (no default): "Load earlier messages" fetches
  older messages from the backend a page at a time, when the restore says
  there are some (`has_more`), and keeps the reader where they were.
- `apiEndpoints.clearAll` (no default): the conversation list and the
  header's history menu offer "Clear all conversations", confirmed first.
- `apiEndpoints.tts` (no default): read aloud uses the backend's voice, a
  long answer in several bounded requests played in turn, and the browser's
  voice for what is left when the route fails.

## 3.14.0 — 2026-10-19

### Added

- A deck, report or video the assistant made shows as a card where its
  `[[PRESENTATION:…]]`, `[[REPORT:…]]` or `[[VIDEO:…]]` marker stands (#450):
  its title, its slides, sections or scenes and length, a video's render
  progress, and `Open in XTM One`. The marker never shows as text, mid-stream
  or after a reload, and copy and read aloud skip it. The panel tells XTM One
  it renders them (`supports_artifacts`); XTM One describes each one in the
  answer's `artifacts`.
- The fullscreen history can be grouped by workspace (#276): one foldable group
  per workspace the user can file into, then `Not in a workspace` and
  `Other workspaces`. A workspace is created, renamed and deleted from the
  list, and a conversation is started in one, or moved to one from its row menu
  or by dragging it onto a group.

### Host opt-in

- `apiEndpoints.artifacts` (no default; XTM One serves `/chat/artifacts`) lets
  the deck, report and video cards download them (PDF and PowerPoint for a
  deck, PDF for a report, MP4 for a rendered video) and follow a video while
  it renders, through the host's proxy. Without it the cards show and link to
  XTM One, with no download. A failed download goes to `onDownloadError`, with
  the name of the file asked for.
- `apiEndpoints.workspaces` (no default, like `approve`) turns the workspace
  groups on, once the host's proxy forwards the workspace routes. A backend
  that refuses the list leaves the history flat, as before.

## 3.13.0 — 2026-10-16

### Added

- The assistant can act on the page the panel is mounted in (#441). The agent
  asks for one step at a time — take a snapshot, click, open a menu, type, or
  navigate — and the panel answers each with a fresh reading of the page.
- The reading lists one line per control a user could act on, with its role,
  accessible name, state and in-app destination, so the agent can name the one
  it means.
- `Acting on the page…` shows on the status line while a step runs.

### Host opt-in

- The panel offers the capability only when the host sets `apiEndpoints.approve`
  **and** passes `onRelativeLinkClick`, because its proxy has to forward the
  answer whole. A host that offers neither is unaffected, and a step arriving
  without that opt-in is refused without the page being read or touched.

### Security

- A reading never carries a secret: a password, a one-time code or a card field
  is masked by `type` and by `autocomplete`, and its contents cannot surface
  through an enclosing control's name or value, nor through a heading above it.
  Hidden, `aria-hidden`, `inert` and closed `<details>` content stays out, as
  does the panel's own.
- A step that would leave the page is refused rather than performed: another
  origin, a link that opens a tab, a path that resolves off-site. A click or a
  form submission that would load a page is cancelled while the host's own
  handlers still run.
- A step is refused on a control the user could not use either: disabled,
  read-only, a masked field, a file chooser, or one no longer visible when the
  step runs.
- A step ends with the turn that asked for it. Stop, New chat, switching
  conversation and closing the panel all end it, and one arriving afterwards is
  answered rather than left to time out.

## 3.12.2 — 2026-10-02

### Fixed

- The panel keeps its own styles inside a host that ships its Tailwind utilities
  outside any cascade layer: the message action icons were invisible and the
  header hover backgrounds round instead of square (#431).

## 3.12.1 — 2026-10-01

### Fixed

- The reader can scroll up while the agent reasons or streams. The transcript
  follows the end only while the reader is there; scrolling up stops the follow,
  and returning to the bottom or sending a message resumes it (#429).

## 3.12.0 — 2026-09-30

### Added

- Every message ends with a footer: an answer shows its time, reasoning details,
  Copy response, thumbs up / down and Read aloud; a user message shows Copy and
  its time.
- Message times follow the new `locale` prop, and an answer is dated when it
  completes, so the live time matches the time after a reload.
- Persisted feedback through the new `apiEndpoints.feedback`, optimistic and
  rolled back on error; a rating restored with the conversation is locked (#419).

## 3.11.1 — 2026-09-29

### Changed

- The dictation button sits inside the composer, before Send, so its toolbar row
  no longer appears alone in hosts with nothing else to put there.
- Listening is visible on the field itself, and the composer height no longer
  shifts.
- Every send cancels dictation and drops the phrase still being recognised, so
  no words land in a composer that was just emptied.

## 3.11.0 — 2026-09-29

### Changed

- A streamed answer is rendered block by block: a chunk re-parses only the blocks
  it can still change.
- Streamed text and reasoning are applied once per animation frame rather than
  once per network read.
- The markdown renderers keep their identity, so the live answer's DOM, a
  selection in it and its images are no longer rebuilt per chunk.

## 3.10.0 — 2026-09-26

### Changed

- The waiting game is a link to the XTM One arcade rather than an embedded game
  (#411).

### Fixed

- The agent's reasoning stays on screen instead of being replaced by the waiting
  game (#409).
