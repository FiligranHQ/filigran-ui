import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { ensurePlaygroundAgent, playgroundAgentState } from './playground-agent';
import { createIdentity, establishTrust, type TrustSetup } from './xtm-auth';
import { createSessionStore, readCookie, sendJson, verifyAccountExists, SESSION_COOKIE } from './playground-session';

/**
 * Run the playground as a genuine XTM One client — a registered platform with
 * its own signing key and signed-in users — rather than a mock, or a proxy
 * holding one shared admin token.
 *
 *   CHAT_API_PROXY=http://localhost:8100 yarn workspace @filigran/chat-playground dev
 *
 * Then sign in on the page with an XTM One account. From that point the panel
 * shows *that user's* agents and *that user's* conversations, obtained over the
 * same trusted-platform JWT path OpenCTI and OpenAEV use. Nothing is mocked and
 * no credential reaches the browser.
 *
 * Four jobs, none of which a bare Vite proxy could do:
 *
 * 1. **Publish a JWKS.** XTM One verifies our JWTs by fetching the public key
 *    from `{iss}/xtm/auth/jwks` — so the dev server has to serve one.
 * 2. **Sign in.** Credentials are checked against XTM One and discarded; see
 *    `playground-session.ts` for why a password is asked for at all.
 * 3. **Rewrite the path.** The panel calls `{apiBaseUrl}/chat/agents`; XTM One
 *    serves the embedded chat under `/api/v1/platform`. Done here rather than
 *    by changing `apiBaseUrl`, so one build works against mock and real alike.
 * 4. **Attach the JWT.** Minted per signed-in user, inside the dev server, and
 *    async — which Vite's synchronous `proxyReq` hook cannot express.
 */

const PATH_PREFIX = '/api/xtmone';
/** Where XTM One mounts the embedded chat API. */
const DEFAULT_PREFIX = '/api/v1/platform';
/** Must match XTM One's own `PLATFORM_REGISTRATION_TOKEN`; this is its default. */
const DEFAULT_REGISTRATION_TOKEN = 'xtm-default-registration-token';
const JWKS_PATH = '/xtm/auth/jwks';
const AUTH_PREFIX = '/api/playground';

interface RealApiConfig {
  target: string;
  prefix: string;
  registrationToken: string;
  identifier: string;
  secret: string;
  issuer?: string;
  audience?: string;
  port: number;
}

/** Where XTM One listens under `./dev-podman.sh`. */
const DEFAULT_TARGET = 'http://localhost:8100';

export function readRealApiConfig(env: NodeJS.ProcessEnv, port: number): RealApiConfig {
  const target = env.CHAT_API_PROXY ?? DEFAULT_TARGET;
  return {
    target: target.replace(/\/$/, ''),
    prefix: env.CHAT_API_PREFIX ?? DEFAULT_PREFIX,
    registrationToken: env.PLATFORM_REGISTRATION_TOKEN ?? DEFAULT_REGISTRATION_TOKEN,
    identifier: env.CHAT_PLAYGROUND_IDENTIFIER ?? 'chat-playground',
    // Any stable string works — it only has to stay the same across restarts so
    // the published `kid` does too.
    secret: env.CHAT_PLAYGROUND_JWT_SECRET ?? 'filigran-chat-playground-dev',
    issuer: env.CHAT_PLAYGROUND_ISSUER,
    audience: env.CHAT_PLAYGROUND_AUDIENCE,
    port,
  };
}

/**
 * Collect a request body, or undefined for methods that carry none.
 *
 * Returned as an `ArrayBuffer`: neither `Buffer` nor a `Buffer`-backed
 * `Uint8Array` satisfies `BodyInit` under the DOM fetch typings this project
 * compiles against. Kept as bytes rather than a string so a binary upload
 * survives the hop intact.
 */
function readBody(req: IncomingMessage): Promise<ArrayBuffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      if (!chunks.length) return resolve(undefined);
      const buf = Buffer.concat(chunks);
      resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    });
  });
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await readBody(req);
  if (!body) return {};
  try {
    return JSON.parse(Buffer.from(body).toString('utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function realChatApi(config: RealApiConfig): Plugin {
  const sessions = createSessionStore(config.secret);
  // Derived once, at start-up: the JWKS must be servable before any trust is
  // established, because XTM One fetches it *during* the request that
  // establishes it.
  const identity = createIdentity(config.secret);

  /**
   * The registration + proof.
   *
   * Deferred rather than done at start-up for two reasons: XTM One may not be
   * running yet (the dev server must still boot), and proving the chain needs
   * an account known to exist — which a signed-in session provides.
   *
   * Re-established on demand, not only at sign-in: this file is a Vite config
   * dependency, so editing it restarts the server and clears `trust`, and an
   * already-signed-in browser would otherwise get 401s until it signed in
   * again. `null` while unproven; the string form is the diagnosis.
   */
  let trust: TrustSetup | null = null;
  let trustError: string | null = null;
  let inFlight: Promise<TrustSetup | null> | null = null;

  function ensureTrust(probeEmail: string): Promise<TrustSetup | null> {
    if (trust) return Promise.resolve(trust);
    // Deduped: a page reload fires several requests at once, and each one
    // would otherwise start its own registration round.
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const result = await establishTrust({ ...config, identity, probeEmail });
        if (typeof result === 'string') {
          trustError = result;
          console.warn(`  [real-api] platform trust not established — ${result}`);
          return null;
        }
        trust = result;
        trustError = null;
        console.log(`  [real-api] registered as "${config.identifier}" (iss ${result.issuer}, aud ${result.audience})`);
        return trust;
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  }

  return {
    name: 'filigran-real-chat-api',
    apply: 'serve',
    configureServer(server) {
      console.log(`  [real-api] ${PATH_PREFIX} -> ${config.target}${config.prefix} — sign in on the page to start`);

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? '/';
        const path = rawUrl.split('?')[0];
        const sessionId = readCookie(req.headers.cookie, SESSION_COOKIE);

        // ── The JWKS XTM One fetches to verify our signatures ──────────────
        if (path === JWKS_PATH) {
          return sendJson(res, 200, identity.jwks, { 'Cache-Control': 'no-store' });
        }

        // ── Sign-in, session, sign-out ─────────────────────────────────────
        if (path === `${AUTH_PREFIX}/session`) {
          const email = sessions.emailFor(sessionId);
          return sendJson(res, 200, { email, connected: Boolean(email), target: config.target, trustError });
        }

        if (path === `${AUTH_PREFIX}/logout`) {
          return sendJson(res, 200, { connected: false }, { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax` });
        }

        if (path === `${AUTH_PREFIX}/login`) {
          if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
          const body = await readJson(req);
          const email = typeof body.email === 'string' ? body.email.trim() : '';
          const password = typeof body.password === 'string' ? body.password : '';
          if (!email || !password) return sendJson(res, 400, { error: 'Email and password are required.' });

          const verified = await verifyAccountExists(config.target, email, password);
          if (!verified.ok) return sendJson(res, verified.status, { error: verified.reason });

          // Only now — with an account proven to exist — is it safe to mint a
          // JWT for this email: an unknown one would have XTM One provision it.
          const established = await ensureTrust(email);
          if (!established) return sendJson(res, 502, { error: trustError ?? 'Could not establish platform trust.' });

          const cookie = sessions.create(email);
          console.log(`  [real-api] signed in as ${email}`);
          return sendJson(res, 200, { email, connected: true }, { 'Set-Cookie': `${SESSION_COOKIE}=${cookie}; Path=/; HttpOnly; SameSite=Lax` });
        }

        // ── The renderer-stressing agent, installed from a button ─────────
        if (path === `${AUTH_PREFIX}/agent`) {
          const email = sessions.emailFor(sessionId);
          const established = email ? await ensureTrust(email) : null;
          if (!established) {
            return sendJson(res, 200, { state: 'unknown', message: trustError ?? 'Sign in first — the agent is created as you.' });
          }
          const agentConfig = { target: config.target, resolveToken: async () => sessions.tokenFor(sessionId, established) };
          const outcome = req.method === 'POST' ? await ensurePlaygroundAgent(agentConfig) : await playgroundAgentState(agentConfig);
          return sendJson(res, 200, outcome);
        }

        // ── Everything else the panel calls ────────────────────────────────
        if (!rawUrl.startsWith(PATH_PREFIX)) return next();

        // A cookie that survived a server restart still names a verified
        // account, so re-registering off it is safe — and is what keeps an
        // edit to this file from logging the browser out.
        const email = sessions.emailFor(sessionId);
        const established = email ? await ensureTrust(email) : null;

        const token = established && sessions.tokenFor(sessionId, established);
        if (!token) {
          // Hand the request to the mock rather than refusing it. Requiring a
          // reachable XTM One just to look at the panel made the playground
          // unusable exactly when you most want it — no backend, or none of
          // your business. The page states plainly that the data is mock, and
          // the panel only mounts here once someone has chosen that.
          return next();
        }

        const upstream = `${config.target}${config.prefix}${rawUrl.slice(PATH_PREFIX.length)}`;

        // Forward the client's headers minus the ones that describe *this* hop
        // (host, connection, and any length that no longer matches once the
        // body is re-sent). The session cookie is dropped too — it means
        // nothing upstream, and the JWT below is the real credential.
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          const key = k.toLowerCase();
          if (key === 'host' || key === 'connection' || key === 'content-length' || key === 'accept-encoding' || key === 'cookie') continue;
          if (typeof v === 'string') headers[k] = v;
        }
        headers.Authorization = `Bearer ${token}`;

        try {
          const upstreamRes = await fetch(upstream, {
            method: req.method,
            headers,
            body: await readBody(req),
            redirect: 'manual',
          });

          res.statusCode = upstreamRes.status;
          upstreamRes.headers.forEach((value, key) => {
            // Length and encoding describe the upstream framing, not ours.
            if (key === 'content-length' || key === 'content-encoding' || key === 'transfer-encoding') return;
            res.setHeader(key, value);
          });

          if (!upstreamRes.body) {
            res.end();
            return;
          }

          // Pump chunk by chunk rather than awaiting the whole body: a streamed
          // reply must reach the panel as it is produced, otherwise the whole
          // point of testing against a real agent is lost.
          const reader = upstreamRes.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
            // SSE responses are not chunk-flushed automatically behind
            // Connect's response wrapper.
            (res as ServerResponse & { flush?: () => void }).flush?.();
          }
          res.end();
        } catch (err) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'real-api proxy failed', detail: (err as Error).message, upstream }));
        }
      });
    },
  };
}
