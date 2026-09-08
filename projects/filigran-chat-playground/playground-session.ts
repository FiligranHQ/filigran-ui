/**
 * Who is using the playground, and on whose behalf its requests go out.
 *
 * The panel is a product surface, so the playground behaves like a product:
 * nothing is callable until someone signs in, and every request afterwards
 * carries *that person's* identity rather than a shared admin token. Two things
 * follow that the old shared-token setup could not show — per-user agent
 * visibility, and per-user conversation history.
 *
 * The credentials are spent once, against XTM One's ordinary login, purely to
 * establish that the account already exists. They are never stored, and the
 * local JWT that login returns is deliberately thrown away: the requests that
 * follow are signed with the playground's *own* platform key, which is the
 * path an embedded product actually takes.
 *
 * ## Why the session carries no server-side state
 *
 * `vite.config.ts` imports this file, which makes it a *config dependency*:
 * touching it — or `real-api.ts`, or `xtm-auth.ts` — restarts the whole dev
 * server. A `Map` of sessions held in the plugin's closure therefore died on
 * every edit to the very files you iterate on, while the browser kept a cookie
 * naming a session that no longer existed. The panel silently unmounted
 * mid-conversation and the page fell back to the sign-in screen.
 *
 * So the cookie *is* the session: it carries the email and its own HMAC, keyed
 * off the same deterministic secret the signing key comes from. Nothing to
 * lose on restart, and a reload picks up exactly where it left off.
 *
 * Nothing here is a security boundary — it is a dev tool, bound to localhost —
 * but no credential and no platform token is ever handed to the browser.
 */

import crypto from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { TrustSetup } from './xtm-auth';

export const SESSION_COOKIE = 'playground_session';
const LOGIN_PATH = '/api/v1/auth/login';
/** How long a sign-in lasts. Long enough to forget it is there. */
const SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface SessionStore {
  /** The cookie value standing for a signed-in *email*. */
  create: (email: string) => string;
  /** The email a cookie attests to, or null if absent, tampered with or stale. */
  emailFor: (cookie: string | undefined) => string | null;
  /** Mint the platform JWT this session's requests travel with. */
  tokenFor: (cookie: string | undefined, trust: TrustSetup) => string | null;
}

export function createSessionStore(secret: string): SessionStore {
  const key = crypto.createHash('sha256').update(`${secret}:session`).digest();
  const sign = (payload: string) => crypto.createHmac('sha256', key).update(payload).digest('base64url');

  function emailFor(cookie: string | undefined): string | null {
    if (!cookie) return null;
    const [payload, signature] = cookie.split('.');
    if (!payload || !signature) return null;

    const expected = sign(payload);
    // Constant-time compare. Not because a dev tool is under attack, but
    // because a hand-rolled `===` on a MAC is the kind of thing that gets
    // copied somewhere it does matter.
    if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;

    try {
      const { email, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { email?: string; exp?: number };
      if (!email || !exp || exp < Math.floor(Date.now() / 1000)) return null;
      return email;
    } catch {
      return null;
    }
  }

  return {
    create(email) {
      const payload = Buffer.from(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })).toString('base64url');
      return `${payload}.${sign(payload)}`;
    },
    emailFor,
    tokenFor(cookie, trust) {
      const email = emailFor(cookie);
      if (!email) return null;
      // Minted per request rather than cached: the JWT is short-lived, and a
      // cache would be the one piece of state a restart could strand again.
      return trust.identity.mint({ email, issuer: trust.issuer, audience: trust.audience });
    },
  };
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/**
 * Check the credentials against XTM One itself.
 *
 * This is the whole reason the playground asks for a password: XTM One
 * auto-provisions an account for any unrecognised email in a trusted platform
 * JWT, so without this step a typo would silently create a user. A successful
 * login is proof the account is already there.
 *
 * Returns the reason on failure so the login form can say something better
 * than "it did not work" — an unreachable backend and a wrong password are
 * very different problems for whoever is looking at the screen.
 */
export async function verifyAccountExists(target: string, email: string, password: string): Promise<{ ok: true } | { ok: false; status: number; reason: string }> {
  let res: Response;
  try {
    res = await fetch(`${target}${LOGIN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    return { ok: false, status: 502, reason: `Cannot reach XTM One at ${target} — ${(err as Error).message}` };
  }

  if (res.ok) return { ok: true };
  if (res.status === 401 || res.status === 400) {
    return { ok: false, status: 401, reason: 'Unknown account or wrong password. The account must already exist in XTM One.' };
  }
  return { ok: false, status: 502, reason: `XTM One rejected the sign-in (${res.status}).` };
}

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}
