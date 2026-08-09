# Filigran Chat Playground

Test playground for `@filigran/chatbot` component development.

## Getting Started

```bash
yarn install
yarn workspace @filigran/chat-playground dev
```

Open <http://localhost:3020>. **No backend needed** — the dev server answers the
chat API itself (see [Mock backend](#mock-backend)).

The package is aliased to its **source**, so edits under
`packages/filigran-chatbot/src` hot-reload straight into the panel.

## What you can exercise

- Floating / sidebar / fullscreen modes, dark and light
- Every host callback the panel exposes (`onMessageFeedback`, `onTaskComplete`,
  `onDownloadError`, `onRelativeLinkClick`) — each one logs to the
  **Host callbacks** card, which is the only way to see that the panel really
  calls them
- The verification checklist on the page

## Mock backend

The dev server implements the REST contract from the
[package README](../../packages/filigran-chatbot/README.md#api-contract) —
agents, session restore, conversation history, streaming messages, uploads and
file downloads — in [`mock-api.ts`](./mock-api.ts). Conversations live in memory
and reset when the server restarts.

Type one of these into the panel to pick a scenario:

| Prompt              | What it exercises                                                                  |
| ------------------- | ---------------------------------------------------------------------------------- |
| `render everything` | Multi-line image alt text, a fence with no info string, a mis-delimited table, a `javascript:` link, lists, soft breaks, an image attachment and a working-file chip |
| `show me json`      | A whole message that is raw JSON — should render as a fenced `json` block            |
| `nested fences`     | A ` ```markdown ` block containing its own fences, plus trailing prose that must survive |
| `slow answer`       | A stalled turn: the elapsed counter ticks every second between heartbeats, then the waiting game takes over |
| `long thread`       | 200 backfilled messages — reload after sending to hit the session-restore path and the render window |

Anything else gets the `render everything` answer.

### Pointing at a real backend

```bash
CHAT_API_PROXY=http://localhost:8000 yarn workspace @filigran/chat-playground dev
```

The mock steps aside and `/api/xtmone` is proxied to that origin instead.

## Styling note

Two Tailwind builds run in this project: the playground's own, and the package's
`src/assets/index.css` compiled from source. They stay consistent because the
package stylesheet declares `@source '../'` (so it scans its own components no
matter which project's PostCSS root compiles it) and both declare the same
class-based `dark` variant. Change one and you must change the other.
