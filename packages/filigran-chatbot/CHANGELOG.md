# Changelog

Notable changes to `@filigran/chatbot`, so a host can see what an upgrade brings
before taking it.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the versions follow [semantic versioning](https://semver.org/spec/v2.0.0.html).
This file starts at 3.10.0; earlier releases are on the
[releases page](https://github.com/FiligranHQ/filigran-ui/releases).

## 3.13.0 — unreleased

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
