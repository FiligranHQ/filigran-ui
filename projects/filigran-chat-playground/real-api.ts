import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { ensurePlaygroundAgent } from './playground-agent';

/**
 * Point the playground at a real XTM One instead of the built-in mock, so the
 * panel can be exercised against real agents, real streaming and real data.
 *
 *   CHAT_API_PROXY=http://localhost:8100 \
 *   CHAT_API_EMAIL=admin@filigran.io CHAT_API_PASSWORD=… \
 *   yarn workspace @filigran/chat-playground dev
 *
 * Two things a bare Vite proxy could not do:
 *
 * 1. **Path.** The panel calls `{apiBaseUrl}/chat/agents` and `apiBaseUrl` here
 *    is `/api/xtmone`, but XTM One serves the embedded chat under
 *    `/api/v1/platform`. Rewritten here rather than by changing `apiBaseUrl`,
 *    so one build works against both the mock and the real backend.
 *
 * 2. **Auth.** Every route needs a bearer token, and obtaining one is async —
 *    which Vite's synchronous `proxyReq` hook cannot express. Hence a
 *    middleware that forwards the request itself. The token is attached inside
 *    the dev server, so it never reaches the browser: not in the bundle, not in
 *    devtools, not in a screenshot of the playground.
 *
 * Give it `CHAT_API_TOKEN` if you already have one, or
 * `CHAT_API_EMAIL` + `CHAT_API_PASSWORD` and it logs in for you. Read from the
 * environment only — nothing is written to disk, and no credential belongs in a
 * committed file.
 */

const PATH_PREFIX = '/api/xtmone';
/** Where XTM One mounts the embedded chat API. */
const DEFAULT_PREFIX = '/api/v1/platform';
const LOGIN_PATH = '/api/v1/auth/login';

interface RealApiConfig {
  target: string;
  prefix: string;
  token?: string;
  email?: string;
  password?: string;
  /** Create/refresh the renderer-stressing agent on the target instance. */
  bootstrapAgent: boolean;
}

export function readRealApiConfig(env: NodeJS.ProcessEnv): RealApiConfig | null {
  const target = env.CHAT_API_PROXY;
  if (!target) return null;
  return {
    target: target.replace(/\/$/, ''),
    prefix: env.CHAT_API_PREFIX ?? DEFAULT_PREFIX,
    token: env.CHAT_API_TOKEN,
    email: env.CHAT_API_EMAIL,
    password: env.CHAT_API_PASSWORD,
    // Opt-in: it writes to whichever instance you are pointed at.
    bootstrapAgent: env.CHAT_PLAYGROUND_AGENT === '1' || env.CHAT_PLAYGROUND_AGENT === 'true',
  };
}

/**
 * Resolve a bearer token, once, and reuse it.
 *
 * Lazy on purpose: the dev server has to start even when XTM One is not running
 * yet, so a failure here is reported and retried on the next request rather
 * than aborting start-up — bringing the backend up afterwards then just works.
 */
function createTokenResolver(config: RealApiConfig) {
  let cached: string | null = config.token ?? null;
  let inFlight: Promise<string | null> | null = null;

  return async function resolveToken(): Promise<string | null> {
    if (cached) return cached;
    if (!config.email || !config.password) return null;
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const res = await fetch(`${config.target}${LOGIN_PATH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: config.email, password: config.password }),
        });
        if (!res.ok) {
          console.warn(`  [real-api] login failed (${res.status}) — requests will go out unauthenticated`);
          return null;
        }
        const body = (await res.json()) as Record<string, unknown>;
        const token =
          typeof body.access_token === 'string' ? body.access_token : typeof body.token === 'string' ? body.token : null;
        if (!token) {
          console.warn('  [real-api] login response carried no token');
          return null;
        }
        cached = token;
        console.log(`  [real-api] authenticated as ${config.email}`);
        return token;
      } catch (err) {
        console.warn(`  [real-api] cannot reach ${config.target} — ${(err as Error).message}`);
        return null;
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
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

export function realChatApi(config: RealApiConfig): Plugin {
  const resolveToken = createTokenResolver(config);

  return {
    name: 'filigran-real-chat-api',
    apply: 'serve',
    configureServer(server) {
      console.log(`  [real-api] proxying ${PATH_PREFIX} -> ${config.target}${config.prefix}`);
      // Warm the token so the first chat request does not pay for the login.
      void resolveToken().then(() => {
        if (config.bootstrapAgent) void ensurePlaygroundAgent({ target: config.target, resolveToken });
      });

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? '/';
        if (!rawUrl.startsWith(PATH_PREFIX)) return next();

        const token = await resolveToken();
        const upstream = `${config.target}${config.prefix}${rawUrl.slice(PATH_PREFIX.length)}`;

        // Forward the client's headers minus the ones that describe *this* hop
        // (host, connection, and any length that no longer matches once the
        // body is re-sent).
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          const key = k.toLowerCase();
          if (key === 'host' || key === 'connection' || key === 'content-length' || key === 'accept-encoding') continue;
          if (typeof v === 'string') headers[k] = v;
        }
        if (token) headers.Authorization = `Bearer ${token}`;

        try {
          const upstreamRes = await fetch(upstream, {
            method: req.method,
            headers,
            body: await readBody(req),
            // Node's fetch buffers by default only when the body is read as a
            // whole; streaming it below is what keeps SSE incremental.
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
