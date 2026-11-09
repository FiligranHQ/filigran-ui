# Changelog

Notable changes to `@filigran/chatbot`, so a host can see what an upgrade brings
before taking it.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the versions follow [semantic versioning](https://semver.org/spec/v2.0.0.html).
This file starts at 3.10.0; earlier releases are on the
[releases page](https://github.com/FiligranHQ/filigran-ui/releases).

## 3.20.0 — unreleased

### Added

- `ChatMarkerRenderer.standalone`: an answer that is the renderer's marker and
  nothing else shows the card alone, without the agent's name, the time or the
  actions, as a note between messages (a change of agent, for instance). Each
  answer showed its marker's card inside the answer's frame.
- The panel speaks German, Italian, Korean, Russian and Simplified Chinese on
  its own: a catalog for each, picked from `locale` by its language whatever
  the region (`de-de`, `it-it`, `ko-kr`, `ru-ru`, `zh-cn`). Those languages
  showed in English unless the host translated every key through `t`.
  Traditional Chinese tags (`zh-TW`, `zh-HK`, `zh-Hant`) keep falling back.
- An agent the backend marks `disable_chat: true` (`XtmAgent.disableChat`) is
  said `Not recommended for chat` in the agent picker, and the composer warns
  while it is the conversation's agent as the header names it. It stays
  selectable.
- The header names the channel a conversation was started in under the
  agent's name (`Agent · {channel}`), as its row does, when the host draws no
  `headerSubtitle`; `channelLabel` names it there too. The restore's
  `channel` names it before the list is read.
- The composer's warning also covers an agent the draft `@`-mentions that is
  not meant for chat, until the mention is removed.
- With workspaces, the list's `Not in a workspace` group has a `New
  conversation outside a workspace` button, beside each workspace's own.
- In a reply's "Working files" list, a file the same reply wrote again later,
  with the same name and kind of file (MIME type without its parameters, else
  the type label), carries a "Superseded" tag; its last version carries none.

### Changed

- The agent picker follows the conversation on screen: opening a conversation
  of another agent, or reading back one the host continued with another agent,
  picks that agent, so a new chat starts with it, after a reload too, and
  `onAgentChange` is called.
  An agent picked in the menu meanwhile stays picked. The picker kept the agent
  last picked in the menu, while the header named the conversation's.

### Fixed

- `maxTotalSize: Infinity` lifts the cap on the total size of a message's
  files, as a host with a per-file limit only passes it (XTM One's web chat and
  Office add-in). The panel read a value that is not finite as invalid and kept
  its 50 MB default total.
- A message sent from a new chat no longer comes back as the next new chat's
  draft: the draft leaves the conversation it was typed in as it is sent. The
  write of the emptied composer could land on the conversation the send
  created, leaving the sent text under the new chat's draft.
- An image's lightbox is named after the image (its alt text, or the file's
  name for an uploaded picture) and keeps `Image preview` for one with none; it
  read `Image preview` for every picture.
- Tab and Shift+Tab stay on the lightbox's own controls (Download when offered,
  Close) while it is open; they reached the page under it.
- An image's Expand button is visible while it has keyboard focus, so the focus
  given back after the lightbox closes can be seen. It showed on hover only.
- A refusal whose body has no `detail` shows its `error` when that is a
  sentence, as the products' proxies answer (`{ "error": "..." }`, beside a
  `status` or not), never a code (`invalid_token`, `Unauthorized`) nor a
  status's reason phrase (`Not Found`, `Too Many Requests`). It shows above
  the composer, in place of the answer, on a failed upload's chip, under the
  conversation list and on a conversation that could not be loaded. The panel
  showed its generic message instead.
- The status line has its own wording when it has no agent's name (`The agent
  is answering…`, `Consulting an agent…`, `Transferring to another agent…`),
  where it filled the name with a lowercase `the agent`: `the agent is
  answering…` started without a capital. A host translating through `t` in a
  language the panel has no catalog for translates these three keys; it
  translated `the agent` before, and shows them in English until it does.
- A host that can steer (a `steer` route, on by default) gets its conversation
  created before the first message, so the first turn can be steered. Where
  turns end with their stream (no `cancel`, `skipWait` or `events` route) the
  panel learned the conversation's id only at the turn's end, and a message
  typed while that first turn ran could not be sent.
- A steer the backend refuses because the turn just ended (409) goes out as
  the next message, as a send during a turn winding down does, whatever
  `holdSendsDuringTurn` says. Without it, the text went back to the composer
  and the user had to send it again.

## 3.19.1 — 2026-11-02

### Added

- The panel speaks German, Italian, Korean, Russian and Simplified Chinese on
  its own: a catalog for each, picked from `locale` by its language whatever
  the region (`de-de`, `it-it`, `ko-kr`, `ru-ru`, `zh-cn`). Those languages
  showed in English unless the host translated every key through `t`.
  Traditional Chinese tags (`zh-TW`, `zh-HK`, `zh-Hant`) keep falling back.
- Inline, as a sidebar and fullscreen, the composer's footer has a line of
  its own for what the keys do (`filigran-chat-composer-hint`), above the
  disclaimer: an idle composer reads
  `Enter to send · Shift+Enter for new line`, a busy one the status it read
  before, and the line keeps its height when empty. The floating window keeps
  one line, where a status takes the disclaimer's place.

### Fixed

- `filigran-chat-disclaimer` holds the disclaimer alone. It held the
  composer's status in its place while a turn ran or a file failed to
  upload; the status is now `filigran-chat-composer-hint`.
- A refusal whose body has no `detail` shows its `error` when that is a
  sentence, as the products' proxies answer (`{ "error": "..." }`, beside a
  `status` or not), never a code (`invalid_token`, `Unauthorized`) nor a
  status's reason phrase (`Not Found`, `Too Many Requests`). It shows above
  the composer, in place of the answer, on a failed upload's chip, under the
  conversation list and on a conversation that could not be loaded. The panel
  showed its generic message instead.
- The status line has its own wording when it has no agent's name (`The agent
  is answering…`, `Consulting an agent…`, `Transferring to another agent…`),
  where it filled the name with a lowercase `the agent`: `the agent is
  answering…` started without a capital. A host translating through `t` in a
  language the panel has no catalog for translates these three keys; it
  translated `the agent` before, and shows them in English until it does.
- A conversation list that could not be read (a refusal, a server or network
  error) says "Could not load your conversations." with a Retry, in the
  fullscreen list and the header's history menu, where it said "No
  conversations yet". A read that fails once the list was read keeps the
  conversations it showed; a backend without the route (404/405) still shows
  an empty list.

## 3.19.0 — 2026-11-02

### Added

- `collapseUnnamedFiles`: the files a reply carries but whose markers it does
  not name go behind one collapsed `Working files ({count})` line, all of them
  (`true`) or those a predicate picks, instead of one card each. Opened, each
  is listed with its card, after a thumbnail for a picture (fetched only once
  the list opens; the picture icon when there is no URL, the fetch fails or
  the bytes do not decode), and from 8 files a `Show less` closes it from its
  end. Opened while following the end, it stops following once it pushes the
  end out of view, so the list stays in view. Off unless the host asks.
- `renderReasoningAction`: a host's action in the corner of the reasoning
  window, shown while the window is and gone with it.
- An image's lightbox has a Download action when the panel can download the
  file, so a user's uploaded picture, which replaces its download card, can be
  downloaded.
- A `Scroll to bottom` button shows once the reader has scrolled up, and
  brings the view back to the end, following it again.
- Older messages load as the reader scrolling up nears the top, a second at
  least after the last load ended, never while the view follows the end, and
  only where the button would load them. A load that brings nothing (the
  backend failing) stops them until the conversation is opened again; the
  button still tries again. The button reads `Loading earlier messages…` while they load.
- `maxFileSize` limits each attached file, next to `maxTotalSize` (none by
  default). A file refused, whichever limit it went past (`maxFileSize`,
  `maxTotalSize`, `maxFileCount`), is named above the text field with why; it
  was dropped without a word. `onFileRefused(file, reason)` tells the host too
  (`ChatFileRefusal`).
- `acceptFileTypes` sets the file picker's `accept`, and refuses a pasted or
  dropped file of another type (`'file-type'`). A file the browser gives no
  MIME type (Chrome on Windows for `.md`, `.yaml`) is judged by the type its
  extension stands for, and refused by a MIME token when it stands for none.
- `placeholder` replaces "Ask a question...": a text, or a function of the
  agent selected.
- `onBeforeSend`'s draft says how many files the message carries
  (`fileCount`).
- The composer takes the focus after a send from it and after a switch to
  another conversation or a new one, unless the focus is in a field, a dialog
  or the host's page; opening the panel takes none.
- `onBeforeMove(conversation, workspace)` is asked before a drag or a row's
  Move menu files a conversation into a workspace (`workspace` is `null` when
  taking it out of one): `false`, or a promise of it, leaves the conversation
  where it was, e.g. once the user declined to share it with a workspace's
  members. One that throws or rejects refuses the move.
- `onConversationActionFailed(action, conversation, error)` is told when
  deleting, renaming, moving or clearing conversations fails (`'delete'`,
  `'rename'`, `'move'`, `'clearAll'`), with the backend's `detail` when it
  gave one; returning `true` keeps the panel's own notice from showing.
- A row of the conversation list shows the last message
  (`last_message_preview`) under its title, and a small icon for a
  conversation started in a messaging channel (`channel`), named `Started in
  {channel}`: Slack, Teams, WhatsApp, Telegram, Discord and Google Chat out
  of the box; `channelLabel(channel)` names another, or hides one (`null`).
  `ChatConversationSummary` gains the optional `lastMessagePreview` and
  `channel`.
- `sidebarSearchThreshold` sets how many conversations the list holds before
  its search box shows (default 7, as before; `0` shows it from the first).
- `headerTitle` and `headerSubtitle`, a node or a function of what is on
  screen (`ChatHeaderContext`: the conversation as the list holds it, and the
  agent), show a title beside the header's agent name and a line under it.
- `agentHref(agent)` makes the header's agent name a link, followed in place
  (an http(s) URL or a path of the host's origin), and `onAgentNameClick(agent)`
  takes a plain click on it; the chevron beside the name opens the agent
  picker then.
- `clearAllAction: 'archive'` words Clear all as an archive (`Archive all
  conversations`).
- `XtmAgent.badges`: short labels the agents list may send (`badges`, strings
  only), shown after the agent's name in the agent picker.
- `toolLabels`: the host's names for its tools, by raw name or as a function
  of it, in the status line (a consult's tools too) and the reasoning details.
  A name it does not give keeps the built-in one.
- `sidebarSections` also takes a function of the conversation list's search,
  `(search: ChatSidebarSearch) => ReactNode`, given what the search box holds,
  trimmed (`''` when empty). It is drawn again when the search or the function
  changes, so a host passes a stable one, and puts hooks in a component the
  function returns. With it the search box shows whatever the number of
  conversations, and a search no conversation of the user's own matches says
  "None of your conversations matches". Sections given as an element show as
  they are.

### Fixed

- The view keeps the last line in view when the thread's own box shrinks
  while following the end (the composer growing to several lines, a tray
  opening); only growth inside the thread was followed.
- Earlier messages already loaded, shown by the button, leave the reader
  where they were in every browser, as older messages fetched do.
- A failed upload's chip says why: the upload's `detail`
  (`ChatFile.uploadError`), or "Upload failed". It showed a bare ✕.
- A message holding a file that failed to upload is not sent until the user
  removes the file, turn or no turn; with no turn running it went without the
  file, and nothing said so.
- Files attached before a host turns `disableFileManagement` on stay shown
  and removable; they were hidden, yet still sent, or a failed one held every
  send without a word.
- Deleting, renaming or clearing conversations failed silently: the panel now
  says it under the conversation list, or under the header when the list is
  not shown, in the backend's words when it gives some. A refused rename
  still keeps the old title, and now undoes only that row: other changes to
  the list made meanwhile stay.
- The conversation list's search matches a conversation's last message and
  its agent's name too, not its title alone.
- A message sent in a conversation moves it to the top of its section at
  once, with the time and its text as the preview; it stayed where it was
  until the turn ended and the list was read again.
- A read-only panel showed the welcome screen's "Suggestions" heading over no
  suggestions: nothing can be sent there, so the section is left out.
- The status line says what the turn does where it said `Thinking...`:
  `{agent} is answering…` for each mentioned agent of a turn, with that
  agent's name before the statuses of its run, in the voice call too
  (`AgentStatusState.answeringAgentName`);
  `Transferring to {agent}…` on `transfer_start`; the setup step of
  `preparing` by its `phase` (`Loading conversation history…`, `Summarizing
  earlier conversation…`, `Recalling memory…`, `Connecting integrations…`,
  `Preparing tools…`, else `Preparing…`); `Compacting conversation context…`;
  `Saving response…` on `persisting`; and `Analyzing results (step {step})…`
  from the frame's `iteration` after the first step. A host's `statusLabel`
  reads them as `AgentStatusState.agentName`, `phase` and `iteration`.
- While mentioned agents answer, a message does not steer: it would reach
  whichever of them runs. It waits for the turn, held with
  `holdSendsDuringTurn`, as a message that cannot steer does.
- A stored answer the server's restart cut short (`interrupted: true`,
  `ChatMessage.interrupted`) is marked as a truncated one is, and its reasoning
  details say why.
- A finished answer with no text and no files says `No response was
  generated. Please try again.`; it showed `...`.
- A paste from an office suite or a spreadsheet (Excel, Word, PowerPoint,
  OneNote, LibreOffice, Numbers) puts the copied text in the composer. These
  apps copy a selection as its text, its HTML and a picture of it, and the
  panel attached the picture and dropped the text. A paste whose files are all
  images, with plain text and an HTML fragment that shows text, attaches
  nothing and reaches the text box; a screenshot, a browser's "Copy image" and
  a file copied in a file manager still attach. A picture copied together with
  text around it (an image and its caption in Word or Outlook) is read the same
  way: the text is pasted, the picture is not attached; copy the picture alone
  to attach it.
- Enter while an input method composes a word (Chinese, Japanese, Korean)
  confirms the word instead of sending the half-typed message, renaming a
  conversation or naming a workspace, and Escape then cancels the composition
  without stopping the turn, closing the field or clearing a search.
- A file dropped on the panel where it attaches none (a `readOnly` panel, one
  with `disableFileManagement` or no upload route, or the header and the
  conversation list of any panel) leaves the page where it is; the browser
  opened it in the tab, away from the chat. A host's own drop zone around the
  panel still receives the drop, and a picture or link dragged from a page
  still goes into a text field as its address.
- The composer's draft is written when the page goes away (`pagehide`) or is
  hidden, so a reload right after typing keeps it; a keystroke within the
  300 ms the draft waits before being written was lost. Two panels on one
  conversation write only the draft typed in them, so neither erases the
  other's.
- A search box hidden as the list shrinks below its threshold clears its
  query: the list stayed filtered by a search the user could neither see nor
  clear.

## 3.18.1 — 2026-11-02

### Fixed

- A message sent, or a file attached, before the panel's agents have loaded
  goes to the agent the host asked for (`initialAgent`); it went with no agent
  before, and the backend answered with the user's default one. The message
  shows at once and leaves when the agents land, whether from the composer,
  the handle or a voice call, and Stop lets it go meanwhile. One from the
  composer or a voice call does not wait for a history still being read back;
  the handle's `send` still does.

## 3.18.0 — 2026-10-31

### Added

- The status line follows a consult: `consult_progress` frames are read
  through every consult level, as an agent consulted may consult its own
  peers. It names the agent consulted and what the agent doing the work does
  (`Consulting {agent}: {tool}…`, `Consulting {agent}: {tool} (+{count}
  more)…`, `Consulting {agent}: writing the answer…`), or `Consulting {count}
  agents…` while several run (`Consulting {agent}: {count} questions…` when
  they ask one agent), and the consult's elapsed time runs on. Each consult is
  told apart by the frame's `consult_id`, else by the agent consulted. The
  consults end when the agent's own loop moves on, whether they answered or
  not, and a consult frame arriving after that is not shown. Only the agent
  consulted's own answer reads `writing the answer`, and a consult of a peer
  in turn shows as that peer's frames, not as `consult_agent`. It said
  `Thinking...` for the whole consult. A host's `statusLabel` reads the
  consult as `AgentStatusState.consult` (`ConsultStatus`); a host translating
  the panel's keys translates the new ones too.

## 3.17.0 — published within 3.18.0

### Added

- `reloadConversation()` on the handle reads the conversation on screen back
  from the server again, for a change the host made to it outside the panel (a
  message it stored, another agent taking it over). The messages it added are
  merged into the thread on screen, which keeps the composer's draft and what
  only the panel holds; one it edited or deleted shows as it was until the
  conversation is opened again. The conversation's agent replaces one a turn
  transferred it to, and the context gauge takes the newest reading. Nothing
  is read before the conversation is, nor while a turn runs in it; a read-back
  that fails, retried or not, leaves the thread as it is. `selectConversation`
  with the id on screen still does nothing.

## 3.16.1 — 2026-10-29

### Fixed

- An empty workspace's hint shows the glyph of its New conversation button,
  where it said `+`, a button the list does not have. Its key changed: a host
  translating `Drop a conversation here, or start one with +.` translates
  `Drop a conversation here, or start one with {icon}.` instead, keeping
  `{icon}` where the glyph goes. Until then the panel's own catalog answers
  for a `locale` it has one for (fr, es, ja), and English for any other.
- A long conversation shown inline or fullscreen no longer lets the page
  scroll the panel out of view: each message's screen-reader time, positioned
  outside the transcript's scroll, laid the page out as tall as the whole
  conversation.

## 3.16.0 — 2026-10-28

### Added

- `theme`: the host's colours, type and shapes (surfaces, menus, subtle and
  hover fills, text fields, text, secondary and muted text, borders, a user's message, an
  answer's text size, code), set as `--filigran-chat-*` variables on the panel
  root. Every entry left out keeps the panel's own look, light and dark, so a
  host that sets nothing sees the same panel (#460).

### Fixed

- In dark mode, the hover and focus colours an element carries show as they do
  in light mode (an accent border on hover, the composer's focus border); its
  dark colour used to hide them (#460).

## 3.15.2 — 2026-10-28

### Fixed

- The thread keeps the end of the conversation in view when what an answer
  carries takes its height after the answer rendered (an image, a chart, a file
  card): it used to stop short of it (#460).
- A message sent while the agent writes its answer shows above that answer,
  where the backend stores it, instead of below it with the rest of the answer
  streaming in above; the same for a message of another tab relayed during a
  relayed answer (#460).
- A turn whose stream drops is awaited for as long as the event stream takes
  to reopen (a backend restart), showing "Reconnecting…", instead of being
  marked stopped 15 s after the drop; an `error` or `cancelled` of the event
  stream naming it ends it at once, and one that ended out of sight is
  answered or stopped as the history read back says (#460).
- A stream its server keeps alive (comments at a keep-alive cadence) that then
  falls silent for 45 s is taken for dropped, so a stream a proxy left
  half-open is handed over instead of hanging, when the event stream can pick
  its turn up (#460).

## 3.15.1 — 2026-10-27

### Fixed

- A user's message keeps its line breaks: its bubble shows the lines and
  paragraphs it was sent with, instead of running them into one paragraph
  (#458).

## 3.15.0 — 2026-10-26

### Added

- `mode="inline"`: the panel fills the host's container instead of floating
  over the page, laid out like fullscreen (conversation list beside the
  thread), with no view switcher and no close button. For a host that gives
  the chat a page of its own.
- A host can own the conversation on screen (`conversationId`,
  `onConversationChange`), pick the agent selected first (`initialAgent`,
  `onAgentChange`) and drive the panel through its `ref`, a handle that is the
  same object for the panel's life:
  - `send(text, { extras, displayText })`: the backend receives *text* with
    `extras` in its body, and the user's bubble shows `displayText` (as with
    `onBeforeSend`'s, which wins when it gives one). It resolves to what
    became of the message: `'sent'` once the backend takes it, `'steered'`,
    `'held'`, `'dropped'` (empty, taken over, read-only, or the panel
    unmounted first) or `'failed'` (the backend refused it).
  - `newConversation`, `selectConversation`, `setDraft`, `focusComposer` and
    `stop`.
  - `getDraft()` reads the composer's text as it stands (typed, or set by
    `setDraft`), e.g. for a host taking over a held message (`draft.held`)
    to tell whether the composer still holds what was typed.
  - `scrollToMessage` jumps to a message and highlights it.
  - `reloadAgents()` reads the agent list again, keeping the agent picked
    unless it is gone (none is picked once the list is empty). A failed
    reload keeps the list it had, and only the latest reload lands.
  - `startVoiceCall()` starts a voice call (below).
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
  panel does not render, with what the panel read in it: `end`
  (`'provisional'` on an `error` or `cancelled` marked `provisional: true`,
  `'stored'` on an end naming the stored answer's `message_id`: a
  `done` that is not intermediate, a `cancelled`, an `error`) and `replayed`
  (the `thinking` frame of a turn replayed from its start, `resumed: true`).
- The panel renders the frames of a backend whose turns outlive their stream:
  a turn re-attached mid-way (`thinking.resumed`), an announced wait
  (`status: wait_start`, with a countdown, kept through what it reports
  meanwhile: `wait_status`, `tool_heartbeat`, `tool_progress`,
  `consult_progress`; streamed text or any other status ends it), `cancelled`,
  an intermediate `done` and the agent that `answered_by` a segment. A
  provisional end (an `error` or `cancelled` marked `provisional: true`; any
  other is final) ends the turn at once; the stored end that follows gives the
  answer its id and a `done`'s content.
- History is restored with no agent list (`apiEndpoints.agents: null`).
- A host can render its own cards for the `[[KIND:args]]` markers of an
  answer (`markerRenderers`), by marker name, and take over the built-in
  `FILE`, `PRESENTATION`, `REPORT` and `VIDEO` ones, including the items an
  answer carries with no marker. A card that throws, or a renderer that does,
  shows `This item could not be loaded.` and leaves the rest of the answer
  alone. A marker no renderer names stays text, as before.
- `transformMessageText` rewrites a message's text before it is shown, copied
  or read aloud (masking secrets, converting a channel's syntax); one that
  throws leaves the text as it came.
- `codeBlockRenderers` renders a fenced code block of a language the host
  names (`(code, { streaming }) => ReactNode`, matched case-insensitively) in
  place of the code block, e.g. a chart drawn from the block's data. A
  renderer that throws shows `This item could not be loaded.`, as a marker
  card does; a language no renderer names, or a renderer returning `null`,
  stays a code block.
- `onArtifactOpen` opens a deck, report or video in the host, in place of the
  link to XTM One.
- Slots for the host's own content: `headerActions`, `banner`,
  `composerHeader`, `transcriptFooter`, `welcome`, `renderMessageExtras` and
  `messageFooterActions` (given the message and `{ streaming }`,
  `ChatMessageSlotContext`: the message is the answer still being written),
  `sidebarRowActions`, `sidebarHeaderActions` and `sidebarSections`.
- `statusLabel`, `waitingMessages` and `renderWaitingPanel` adapt the status
  line and the waiting panel; `fontFamily` sets the panel's font.
- An agent's `icon` shows in the picker when it is an `https:` or
  `data:image/` URL, or emoji, and agents carrying a `group` are listed under
  its heading.
- `@` in the composer can mention agents (`agentMentions`): the agents of
  the agent list are offered above the conversations, and the message carries
  the ids of those it still mentions as `mentioned_agent_ids`, in mention
  order. A message that mentions an agent never steers the running turn.
- `steerAttachments` lets uploaded files steer the running turn (the steer
  route then takes `file_ids`), and `holdSendsDuringTurn` holds a message that
  cannot steer (files, references, mentions, body fields of its own, a turn
  that has just ended) and sends it as the next turn, with a way to cancel it
  meanwhile. Messages held one after another go together, keeping their body
  fields, and Stop gives back to the composer what the user typed for them;
  a message sent once the stopped turn ended goes out as it winds down.
- A voice call over the panel, started with `startVoiceCall()` on the handle
  (`voiceCallSupported()` tells a host whether to offer it): the browser's
  speech recognition listens, a phrase is sent after one second of silence
  (`onBeforeSend` sees `source: 'voice'`, a `ChatSendDraft.source` of its
  own), and the answer is said through `apiEndpoints.tts` in pieces of about
  200 characters, each requested while the one before plays, in the browser's
  voice where the route fails, the browser cannot play a piece, or no route is
  named. Only the final answer of the turn that answers the question is said
  (the panel's own, or the one a fold or a steer names), and only the
  addressed agent's: the other agents' replies show by name, `Did not answer`
  beside a failed one. Speaking over the answer, a tap or Skip stops it; a tap
  while it is awaited cancels the question and its turn, as `stop()` does; a turn silent for 120 s is checked through
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
  about again as it leaves (`turnRunning: false`, `held: true`), each send
  held with it on its own; taken over then, what the user typed for it goes
  back to the composer, after what they typed since, and a message all of
  whose sends are taken over is settled `'returned'`.
- `hideConversationList` hides the conversation list of inline and fullscreen
  modes, for a rail or a task pane: the header, thread and composer hold from
  320 px wide, and the header's history menu stands in for the list (open,
  delete, Clear all), while a referenced conversation still opens in the panel.
- `onHeldSendSettled(text, outcome)` tells the host what became of a message
  held until the turn ended: `'sent'`, `'failed'`, `'dropped'`, `'returned'`
  (given back to the composer by Stop, or by `onBeforeSend` taking it over as
  it leaves; told once the composer shows it, so `getDraft()` reads it) or
  `'cancelled'`.
- `onTurnRunningChange(running, info)` tells the host when a turn starts or
  stops running, own or relayed, and with `false` how it ended
  (`info.ended`: `'answered'`, `'stopped'` or `'failed'`): see
  [Host extensions](README.md#host-extensions) and
  [Turns that outlive their stream](README.md#turns-that-outlive-their-stream).
- `ChatMessage.answeredBy` (`{ agentId, agentName, agentIcon }`) and
  `ChatMessage.mentionFailed`, from the `answered_by` and `mention_failed` of
  each `done` frame (intermediate ones included) and of each restored entry,
  for a host's own rendering of a turn several agents answer. The panel's own
  rendering is unchanged.
- A `session_expired` frame on the message stream or the event stream ends
  the turn on screen at once, keeping what it wrote.
- `@filigran/chatbot/markdown` also exports the answer-marker helpers the
  panel reads markers with: `splitAnswerMarkers`, `stripAnswerMarkers`,
  `markerKinds` and the `AnswerPart` type (and `ChatArtifactKind`), still free
  of React and side effects, so a host renders, previews or strips markers
  exactly as the panel does.
- `onSessionEnded(reason)` tells the host the user's session ended: a
  `session_expired` frame on either stream, or a `401` whose body's
  `detail.code` is `session_expired` on any request the panel makes, with the
  frame's or the `detail`'s `reason`. It comes once per set of
  `requestHeaders`.
- `ChatMessage.raw`: the backend's own object for the message, a plain copy
  (the restored, paged or relayed entry; the `done` frame of a live answer,
  or the stored end after a provisional one), for the fields the panel does
  not read.
- `@filigran/chatbot/workspaces`, a React-free entry point with the panel's
  grouping of a conversation list by workspace: `parseWorkspaces` (which,
  given `userId`, tells the caller's own workspaces by `user_id` where the
  backend sends no `is_own`), `sortWorkspaces`, `groupConversations`
  (generic over the host's conversation and workspace types),
  `fileableWorkspaces`, `groupIsOpen`, `groupCanToggle`, `ELSEWHERE_GROUP`
  and the `WorkspaceGroup`, `GroupableConversation` and `ChatWorkspace` types.
- `prepareMarkdown` on `@filigran/chatbot/markdown`: the panel's markdown
  normalisation in its order, for a host's own markdown component.
- `waitingGameUrl` says where the waiting panel's invitation to play leads
  (an http(s) URL or a path of the host's origin), over
  `{agentDashboardUrl}/chat?arcade=play`.
- New exported types: `ChatPanelHandle`, `ChatPanelMode`, `ChatSendOptions`,
  `ChatSendOutcome`, `ChatSendDraft`, `ChatSendDecision`, `ChatHeldOutcome`,
  `ChatTurnEnd`, `ChatTurnOutcome`, `ChatMarkerRenderer`, `ChatMarkerContext`,
  `ChatCodeBlockRenderer`, `ChatCodeBlockContext`, `ChatStreamEventInfo`,
  `ChatMessageSlotContext`, `ChatAnsweredBy` and `AgentStatusState`.

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
  ended, an ordinary race) shows nothing. A steer stored that the backend
  says no turn will answer (`"answered": false`) stays, with a notice that it
  will be read with the next message, until that send.
- The composer's footer under a message that waits for the running turn
  (a reference, a mention) says `This message waits for the current response`,
  a new key, in place of `Referenced conversations wait for the current
  response`.

### Fixed

- A conversation read back after the user has already sent a message no
  longer replaces that turn: its history joins the thread in place once the
  turn ends (a stored message missing from the screen after the one stored
  before it), and its agent's name shows at once.
- Sending no longer throws on a page served over plain http, where
  `crypto.randomUUID` does not exist.

### Host opt-in

- `apiEndpoints.cancel` (no default): Stop asks the backend to end the turn and
  waits for the stream's `cancelled` frame, instead of dropping the stream. An
  answer of `{ "turn": "none" }` lets go of the turn at once and reads the
  conversation back, unless the Stop went before the panel's own send started
  its turn: it then carries `"awaiting_send": true`, and on `none` stays
  pending and is sent again, without the flag, as the turn starts; any other
  answer reached a turn, and nothing goes again. A refused Stop (e.g. `503`)
  keeps the turn running and says why above the composer; the status line
  keeps what the turn reported since the click.
- `apiEndpoints.skipWait` (no default): `Continue now` on an agent's wait.
- `apiEndpoints.events` (no default): the panel follows the conversation's
  event stream and renders turns started in another tab or before a reload,
  user messages sent elsewhere, new titles and approvals answered elsewhere;
  a panel whose own stream drops mid-turn picks the turn up from it, keeping
  the segments it closed. Stop during the handover ends the turn. A relayed
  turn the stream let go of while the page was hidden holds sends, and runs
  on for `onTurnRunningChange`, until the reopened stream replays it, or, 5 s
  after the page shows again or at once on a refused stream, until the
  conversation read back says how it ended. Every frame of a turn names it
  (`turn_id`): on the event stream, and on the message stream from its
  `turn_started` on; an event stream frame of a turn naming none is not read,
  and the console warns of it once per frame type. See
  [Turns that outlive their stream](README.md#turns-that-outlive-their-stream)
  for reconnection, the client id and replays.
- With `cancel`, `skipWait` or `events` named, a send made while a turn ended
  provisionally still winds down is held, as during a turn, until its stored
  end or its stream's close (the panel's own, for its own turn; another turn
  starting ends it too), at most 5 s: the backend still holds the
  conversation, and the message would join the ending turn unanswered. A
  relayed turn winds down across the event stream's reopening.
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
