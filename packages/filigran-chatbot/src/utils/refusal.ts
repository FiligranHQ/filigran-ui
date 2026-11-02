/**
 * What a backend says when it refuses a request, and how the panel tells a
 * new set of credentials from the one refused.
 */

/** Long enough for a sentence, short enough that an error page is never shown. */
const MAX_DETAIL_LENGTH = 500;

const usable = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= MAX_DETAIL_LENGTH ? text : null;
};

/** An identifier, as a code is written (`invalid_token`, `Unauthorized`); a sentence in any script is not one. */
const IDENTIFIER = /^[\w.-]+$/;

/** *value* when it is a sentence the backend wrote, not a code. */
function sentence(value: unknown): string | null {
  const text = usable(value);
  return text && !IDENTIFIER.test(text) ? text : null;
}

/**
 * The message of a refusal body: its `detail` when a string, or that object's
 * `message` (or `detail`), as XTM One answers; else its `error` when a
 * sentence, as the products' proxies answer (`{ "error": "..." }`, beside a
 * `status` or not); null when there is none worth showing.
 */
export function refusalDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const { detail, error } = body as Record<string, unknown>;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const inner = detail as Record<string, unknown>;
    return usable(inner.message) ?? usable(inner.detail) ?? sentence(error);
  }
  return usable(detail) ?? sentence(error);
}

/** The message of a refused response's JSON body, null when it has none (or is not JSON). */
export async function readRefusalDetail(res: Response): Promise<string | null> {
  try {
    return refusalDetail(await res.json());
  } catch {
    return null;
  }
}

/** A key that changes exactly when the request headers do, whatever their order. */
export function requestHeadersKey(headers: Record<string, string> | undefined): string {
  if (!headers) return '';
  return JSON.stringify(Object.entries(headers).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
