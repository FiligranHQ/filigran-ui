# Filigran Chat Playground

Test playground for `@filigran/chatbot` component development.

## Getting Started

Start XTM One (`./dev-podman.sh` in that repo), then:

```bash
yarn install
yarn workspace @filigran/chat-playground dev
```

Open <http://localhost:3020> and **sign in with an XTM One account**. From then
on the agents, conversations and answers are real — see
[Connected to XTM One](#connected-to-xtm-one). No backend to hand? Use the
[mock](#mock-backend).

The package is aliased to its **source**, so edits under
`packages/filigran-chatbot/src` hot-reload straight into the panel.

## What you can exercise

- Floating / sidebar / fullscreen modes, dark and light
- Every host callback the panel exposes (`onMessageFeedback`, `onTaskComplete`,
  `onDownloadError`, `onRelativeLinkClick`) — each one logs to the
  **Host callbacks** card, which is the only way to see that the panel really
  calls them
- The verification checklist on the page

## Connected to XTM One

The playground is a **registered platform**, authenticating exactly the way
OpenCTI and OpenAEV do. No token is handed out by XTM One to be replayed: the
playground holds its own Ed25519 key, signs short-lived EdDSA JWTs, and
publishes the public half at `/xtm/auth/jwks` for XTM One to fetch. See
[`xtm-auth.ts`](./xtm-auth.ts).

That matters beyond convenience — it is the only place this code path gets
exercised outside a full product deployment.

| Variable | Default | What it is for |
| --- | --- | --- |
| `CHAT_API_PROXY` | `http://localhost:8100` | The XTM One to talk to |
| `PLATFORM_REGISTRATION_TOKEN` | `xtm-default-registration-token` | Must match XTM One's own |
| `CHAT_API_PREFIX` | `/api/v1/platform` | `/api/v1/chat` for the native router |
| `CHAT_PLAYGROUND_ISSUER` | auto | Only if XTM One cannot reach the playground at the URL it picks |
| `CHAT_PLAYGROUND_AUDIENCE` | discovered | Overrides XTM One's `base_url`, read from its OAuth discovery document |

Three things the dev server handles for you (see [`real-api.ts`](./real-api.ts)):

- **Registers and then proves it.** Registering only writes a row, which tells
  you nothing. The dev server follows it with a real authenticated call, so a
  successful start-up means an embedded product would work identically. The
  issuer has to be reachable *from wherever XTM One runs*, so candidates are
  tried in turn — `localhost` first, then the container host aliases.
- **Rewrites the path.** The panel calls `{apiBaseUrl}/chat/agents`; XTM One
  serves the embedded chat under `/api/v1/platform`. Done in the dev server so
  one build works against both mock and real.
- **Signs the JWT per user**, inside the dev server. Nothing signed and no
  credential ever reaches the browser.

### Why it asks for a password

XTM One **auto-provisions an account** for an unrecognised `email` claim in a
trusted platform JWT — right for a product whose users are already trusted,
wrong for a dev tool where a typo would silently leave a real user behind. So
the playground spends the credentials once against XTM One's ordinary
`/auth/login` purely to establish that the account exists, then throws them
away, along with the local JWT that login returns. Everything afterwards is
signed with the playground's own platform key.

Sign-in is a hard gate: with no identity there is nothing to make requests as,
and an unauthenticated panel would render an empty agent list indistinguishable
from a real one.

Being signed in survives a dev-server restart. That is not a nicety: this file,
`real-api.ts` and `xtm-auth.ts` are all imported by `vite.config.ts`, which
makes them **config dependencies** — editing any of them restarts the server.
Session state kept in the plugin's closure therefore died on every edit to the
files you iterate on, while the browser held a cookie naming a session that no
longer existed, and the panel unmounted mid-conversation. So the cookie carries
the email and its own HMAC instead, and trust is re-established on demand.
Anything you are tempted to cache in that closure has the same problem.

#### A real agent that stresses the renderer

Add `CHAT_PLAYGROUND_AGENT=1` and the dev server creates (or refreshes) a
**Rendering Playground** agent on the instance you are pointed at, whose persona
tells it to weave the renderer-breaking shapes into every reply: a mis-delimited
table, a fence with no language, nested fences, an inert `javascript:` link,
soft breaks. Pick it from the agent menu.

Being a real agent, it exercises the real path — token pacing, tool statuses,
transfers — which the mock can only imitate.

It is created through the ordinary API rather than added to XTM One's seeded
built-ins on purpose: agents have no per-agent platform gating, so a seeded
entry would ship to every deployment. Opt-in, because it writes to whichever
instance you chose.

## Mock backend

```bash
CHAT_API_MOCK=1 yarn workspace @filigran/chat-playground dev
```

No backend, no sign-in. The dev server implements the REST contract from the
[package README](../../packages/filigran-chatbot/README.md#api-contract) —
agents, session restore, conversation history, streaming messages, uploads and
file downloads — in [`mock-api.ts`](./mock-api.ts). Conversations live in memory
and reset when the server restarts.

Worth keeping for renderer work and for working offline, because the scenarios
below are deterministic in a way a real agent is not. It is not the default,
because passing against a mock of your own contract proves very little.

Type one of these into the panel to pick a scenario:

| Prompt              | What it exercises                                                                  |
| ------------------- | ---------------------------------------------------------------------------------- |
| `render everything` | Multi-line image alt text, a fence with no info string, a mis-delimited table, a `javascript:` link, lists, soft breaks, an image attachment and a working-file chip |
| `show me json`      | A whole message that is raw JSON — should render as a fenced `json` block            |
| `nested fences`     | A ` ```markdown ` block containing its own fences, plus trailing prose that must survive |
| `slow answer`       | A stalled turn: the elapsed counter ticks every second between heartbeats, then the waiting game takes over |
| `long thread`       | 200 backfilled messages — reload after sending to hit the session-restore path and the render window |

Anything else gets the `render everything` answer.

## Styling note

Two Tailwind builds run in this project: the playground's own, and the package's
`src/assets/index.css` compiled from source. They stay consistent because the
package stylesheet declares `@source '../'` (so it scans its own components no
matter which project's PostCSS root compiles it) and both declare the same
class-based `dark` variant. Change one and you must change the other.
