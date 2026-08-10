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
 * Sessions live in memory and die with the dev server. Nothing here is a
 * security boundary — it is a dev tool, bound to localhost — but no credential
 * and no signed token is ever handed to the browser.
 */

import crypto from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { TOKEN_REFRESH_MARGIN_SECONDS, TOKEN_TTL_SECONDS, type TrustSetup } from './xtm-auth';

export const SESSION_COOKIE = 'playground_session';
const LOGIN_PATH = '/api/v1/auth/login';

interface Session {
  email: string;
  /** Cached platform JWT, reminted shortly before it expires. */
  token?: string;
  tokenExpiresAt?: number;
}

export interface SessionStore {
  create: (email: string) => string;
  emailFor: (id: string | undefined) => string | null;
  destroy: (id: string | undefined) => void;
  /** Mint (or reuse) the platform JWT this session's requests travel with. */
  tokenFor: (id: string | undefined, trust: TrustSetup) => string | null;
}

export function createSessionStore(): SessionStore {
  const sessions = new Map<string, Session>();

  return {
    create(email) {
      const id = crypto.randomUUID();
      sessions.set(id, { email });
      return id;
    },
    emailFor(id) {
      return (id && sessions.get(id)?.email) || null;
    },
    destroy(id) {
      if (id) sessions.delete(id);
    },
    tokenFor(id, trust) {
      const session = id ? sessions.get(id) : undefined;
      if (!session) return null;

      const now = Math.floor(Date.now() / 1000);
      if (session.token && session.tokenExpiresAt && session.tokenExpiresAt - TOKEN_REFRESH_MARGIN_SECONDS > now) {
        return session.token;
      }
      session.token = trust.identity.mint({ email: session.email, issuer: trust.issuer, audience: trust.audience });
      session.tokenExpiresAt = now + TOKEN_TTL_SECONDS;
      return session.token;
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
