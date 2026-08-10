/**
 * Make the playground a *real* registered XTM One platform, authenticating the
 * same way OpenCTI and OpenAEV do.
 *
 * There is no token handed out by XTM One to be replayed. Each platform holds
 * its own Ed25519 key, signs its own short-lived JWTs, and publishes the public
 * half at `{iss}/xtm/auth/jwks`. XTM One trusts a JWT when:
 *
 *   - the header says `alg: EdDSA`,
 *   - `iss` matches an **active** platform registration *by exact string*,
 *   - the signature verifies against a key fetched live from that issuer's JWKS,
 *   - `aud` equals XTM One's own normalised `base_url`, and `exp` is future,
 *   - `sub`, `email` and `jti` are present.
 *
 * The local user is then resolved from the `email` claim. Reference:
 * `backend/app/core/xtm_auth.py` and `_resolve_trusted_platform_jwt` in
 * `backend/app/api/deps.py`.
 *
 * ## Why the playground authenticates the user first
 *
 * XTM One **auto-provisions** an account for an unrecognised `email` claim —
 * correct for a product whose users are already trusted, wrong for a dev tool
 * where a typo would quietly leave a real row behind. So the playground's login
 * spends the credentials against XTM One's ordinary `/auth/login` and mints a
 * JWT only once that succeeds. The password proves the account exists; it is
 * used for nothing else and never stored.
 */

import crypto from 'node:crypto';

/** PKCS#8 prefix for a raw Ed25519 private seed (RFC 8410 §7). */
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/** How long a minted JWT stays valid. Short, because it is minted per request. */
const TOKEN_TTL_SECONDS = 300;

const b64url = (input: Buffer | string): string =>
  (typeof input === 'string' ? Buffer.from(input) : input).toString('base64url');

/**
 * Derive the keypair from a secret rather than generating a fresh one.
 *
 * Deterministic on purpose: the `kid` then survives a dev-server restart, so
 * XTM One's cached JWKS stays valid instead of every reload forcing a refetch.
 * Mirrors the HKDF derivation XTM One performs on its own `secret_key`
 * (`_derive_ed25519_keypair`), down to the `info` strings — same shape, so the
 * two implementations can be compared when one of them misbehaves.
 */
function deriveKeypair(secret: string) {
  const hkdf = (info: string, length = 32) =>
    Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret, 'utf-8'), Buffer.alloc(0), Buffer.from(info), length));

  const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, hkdf('xtm:jwt:ed25519:seed::v1')]),
    format: 'der',
    type: 'pkcs8',
  });

  // Node exports Ed25519 public keys as SPKI DER; the raw 32 bytes a JWK needs
  // are the tail, after a fixed 12-byte algorithm header.
  const spki = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
  const publicRaw = spki.subarray(spki.length - 32);

  const kid = crypto.createHash('sha256').update(hkdf('xtm:jwt:ed25519:kid::v1')).digest().subarray(0, 8).toString('hex');

  return { privateKey, publicRaw, kid };
}

export interface XtmIdentity {
  /** The JWKS document to serve at `/xtm/auth/jwks`. */
  jwks: { keys: Array<Record<string, string>> };
  /** Mint a JWT asserting *email*, for the given issuer and audience. */
  mint: (params: { email: string; issuer: string; audience: string }) => string;
}

export function createIdentity(secret: string): XtmIdentity {
  const { privateKey, publicRaw, kid } = deriveKeypair(secret);

  return {
    jwks: {
      keys: [{ kty: 'OKP', crv: 'Ed25519', use: 'sig', kid, alg: 'EdDSA', x: publicRaw.toString('base64url') }],
    },
    mint({ email, issuer, audience }) {
      const now = Math.floor(Date.now() / 1000);
      const signingInput = [
        b64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid })),
        b64url(
          JSON.stringify({
            iss: issuer,
            aud: audience,
            // `sub` is the issuer-local user identifier. Namespaced so it can
            // never be mistaken for an XTM One user id.
            sub: `playground:${email}`,
            email,
            jti: crypto.randomUUID(),
            iat: now,
            exp: now + TOKEN_TTL_SECONDS,
          }),
        ),
      ].join('.');
      // `null` algorithm: Ed25519 prescribes its own hash, and Node rejects an
      // explicit digest for it.
      return `${signingInput}.${b64url(crypto.sign(null, Buffer.from(signingInput), privateKey))}`;
    },
  };
}

/**
 * Normalise a URL the way XTM One's `_normalize_url` does, so the `aud` we mint
 * matches the one it compares against: lowercase scheme and host, default port
 * stripped, no trailing slash.
 */
export function normalizeUrl(url: string): string {
  const parsed = new URL(url.trim());
  const scheme = parsed.protocol.replace(':', '').toLowerCase();
  const defaultPort = scheme === 'http' ? '80' : scheme === 'https' ? '443' : '';
  const port = parsed.port && parsed.port !== defaultPort ? `:${parsed.port}` : '';
  const path = parsed.pathname.replace(/\/$/, '');
  return `${scheme}://${parsed.hostname.toLowerCase()}${port}${path}`;
}

/**
 * Issuer URLs to try, in order.
 *
 * The issuer is not merely a label: XTM One fetches the JWKS from it, so it has
 * to be reachable **from wherever XTM One runs**. Under `dev-podman.sh` the API
 * runs on the host, so `localhost` is right — but a fully containerised backend
 * would see its own container under that name and needs the host alias instead.
 * Rather than make the developer know which they have, each candidate is
 * registered and then *proved* with a real authenticated call.
 */
function issuerCandidates(explicit: string | undefined, port: number): string[] {
  if (explicit) return [normalizeUrl(explicit)];
  return [`http://localhost:${port}`, `http://host.containers.internal:${port}`, `http://host.docker.internal:${port}`];
}

/**
 * Ask XTM One which URL it believes it is.
 *
 * The `aud` claim has to equal its normalised `base_url`, which is a server-side
 * setting the playground cannot see — and guessing it from the proxy target is
 * wrong the moment the two differ. Its OAuth discovery document is public and
 * reports exactly that value as `issuer`, so ask rather than assume.
 */
async function discoverAudience(target: string): Promise<string | null> {
  try {
    const res = await fetch(`${target}/.well-known/oauth-authorization-server`);
    if (!res.ok) return null;
    const body = (await res.json()) as { issuer?: unknown };
    return typeof body.issuer === 'string' ? normalizeUrl(body.issuer) : null;
  } catch {
    return null;
  }
}

interface RegistrationParams {
  target: string;
  registrationToken: string;
  identifier: string;
  issuer: string;
}

async function register({ target, registrationToken, identifier, issuer }: RegistrationParams): Promise<string | null> {
  const res = await fetch(`${target}/api/v1/platform/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${registrationToken}` },
    body: JSON.stringify({
      platform_identifier: identifier,
      platform_url: issuer,
      platform_title: 'Chat Playground',
      platform_version: 'dev',
      contract: 'CE',
    }),
  });
  if (res.ok) return null;
  return `${res.status} ${(await res.text()).slice(0, 200)}`;
}

export interface TrustSetup {
  identity: XtmIdentity;
  /** The issuer that was proved to work end to end. */
  issuer: string;
  audience: string;
}

interface EstablishParams {
  target: string;
  /** Where the embedded chat API lives, e.g. `/api/v1/platform`. */
  prefix: string;
  registrationToken: string;
  identifier: string;
  /** The same identity whose JWKS the dev server publishes. */
  identity: XtmIdentity;
  issuer?: string;
  audience?: string;
  port: number;
  /** An email known to exist, used to prove the chain. */
  probeEmail: string;
}

/**
 * Register the playground and prove the trust chain really works.
 *
 * Registering is not enough to know anything: it only writes a row. The proof
 * is a genuine authenticated request signed with our key — that exercises the
 * JWKS fetch, the signature check, the audience comparison and the user lookup
 * in one go. A 200 means an embedded product would work identically.
 */
export async function establishTrust(params: EstablishParams): Promise<TrustSetup | string> {
  const { identity } = params;
  const audience = params.audience
    ? normalizeUrl(params.audience)
    : ((await discoverAudience(params.target)) ?? normalizeUrl(params.target));
  const failures: string[] = [];

  for (const issuer of issuerCandidates(params.issuer, params.port)) {
    const registerError = await register({
      target: params.target,
      registrationToken: params.registrationToken,
      identifier: params.identifier,
      issuer,
    });
    if (registerError) {
      // A rejected registration is the same for every candidate (a bad token,
      // an unreachable backend), so there is nothing to gain by continuing.
      return `registration rejected — ${registerError}`;
    }

    const token = identity.mint({ email: params.probeEmail, issuer, audience });
    const probe = await fetch(`${params.target}${params.prefix}/chat/agents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (probe.ok) return { identity, issuer, audience };
    failures.push(`${issuer} -> ${probe.status}`);
  }

  return (
    `no issuer worked (${failures.join(', ')}). XTM One must be able to fetch ` +
    `\${issuer}/xtm/auth/jwks, and the JWT audience must equal its own base_url ` +
    `(assumed "${audience}" — override with CHAT_PLAYGROUND_AUDIENCE). ` +
    `Its log states the exact reason: "XTM JWT rejected: ...".`
  );
}

