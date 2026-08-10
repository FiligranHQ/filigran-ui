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

### Pointing at a real XTM One

```bash
CHAT_API_PROXY=http://localhost:8100 \
CHAT_API_EMAIL=admin@filigran.io CHAT_API_PASSWORD=… \
yarn workspace @filigran/chat-playground dev
```

The mock steps aside and the dev server forwards `/api/xtmone/*` to a real
instance — real agents, real streaming, real data. Start XTM One with
`./dev-podman.sh` from that repo.

Two things the dev server does for you (see [`real-api.ts`](./real-api.ts)):

- **Rewrites the path.** The panel calls `{apiBaseUrl}/chat/agents`, XTM One
  serves the embedded chat under `/api/v1/platform`. Override with
  `CHAT_API_PREFIX` (e.g. `/api/v1/chat` for the native router).
- **Attaches the bearer token**, inside the dev server, so it never reaches the
  browser. Pass `CHAT_API_TOKEN` if you already have one, or the email/password
  pair and it logs in for you. Credentials come from the environment only —
  none of this belongs in a committed file.

#### A real agent that stresses the renderer

Against a real backend the scenarios above are gone — the agents answer for
real. To get both, add `CHAT_PLAYGROUND_AGENT=1` and the dev server creates (or
refreshes) a **Rendering Playground** agent on the instance you are pointed at,
whose persona tells it to weave the renderer-breaking shapes into every reply:
a mis-delimited table, a fence with no language, nested fences, an inert
`javascript:` link, soft breaks. Pick it from the agent menu.

Being a real agent, it exercises the real path — token pacing, tool statuses,
transfers — which the mock can only imitate.

It is created through the ordinary API rather than added to XTM One's seeded
built-ins on purpose: agents have no per-agent platform gating, so a seeded
entry would ship to every deployment. Opt-in, because it writes to whichever
instance you chose.

The login is lazy and retried, so starting the playground before XTM One works:
bring the backend up and the next request picks up a token. While it is down,
the agent menu says so rather than spinning.

## Styling note

Two Tailwind builds run in this project: the playground's own, and the package's
`src/assets/index.css` compiled from source. They stay consistent because the
package stylesheet declares `@source '../'` (so it scans its own components no
matter which project's PostCSS root compiles it) and both declare the same
class-based `dark` variant. Change one and you must change the other.
