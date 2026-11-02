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

/** The reason phrases of HTTP's error statuses (RFC 9110): the status's name, not what went wrong. */
const REASON_PHRASES = new Set(
  [
    'Bad Request',
    'Payment Required',
    'Not Found',
    'Method Not Allowed',
    'Not Acceptable',
    'Proxy Authentication Required',
    'Request Timeout',
    'Length Required',
    'Precondition Failed',
    'Content Too Large',
    'Payload Too Large',
    'URI Too Long',
    'Unsupported Media Type',
    'Range Not Satisfiable',
    'Expectation Failed',
    'Misdirected Request',
    'Unprocessable Content',
    'Unprocessable Entity',
    'Too Early',
    'Upgrade Required',
    'Precondition Required',
    'Too Many Requests',
    'Request Header Fields Too Large',
    'Unavailable For Legal Reasons',
    'Internal Server Error',
    'Not Implemented',
    'Bad Gateway',
    'Service Unavailable',
    'Gateway Timeout',
    'HTTP Version Not Supported',
  ].map((phrase) => phrase.toLowerCase()),
);

/** A code or a status's reason phrase, which says nothing a translated message does not. */
const isCode = (text: string) => IDENTIFIER.test(text) || REASON_PHRASES.has(text.toLowerCase());

/**
 * A body's `error` when it is a sentence (a host's proxy answering
 * `{ "error": "..." }`), not a code or reason phrase: one, or beside an
 * `error_description`, `status` or `statusCode` (the error bodies of OAuth,
 * Spring Boot, Fastify and Boom, whose `error` names the HTTP status).
 */
function errorSentence(body: Record<string, unknown>): string | null {
  if ('error_description' in body || 'status' in body || 'statusCode' in body) return null;
  const text = usable(body.error);
  return text && !isCode(text) ? text : null;
}

/**
 * A body's own `message` where it names its `statusCode` (Fastify, Boom,
 * NestJS: a message written for the client), unless a code or reason phrase.
 * Without one, a top-level `message` is as often a gateway's reason phrase
 * (`{ "message": "Unauthorized" }`) or a handler's internal error.
 */
function messageSentence(body: Record<string, unknown>): string | null {
  if (!('statusCode' in body)) return null;
  const text = usable(body.message);
  return text && !isCode(text) && text !== body.error ? text : null;
}

/**
 * The message of a refusal body: its `detail` when a string, or that object's
 * `message` (or `detail`); else its own `message` beside a `statusCode`; else
 * its `error` when a sentence; null when there is none worth showing.
 */
export function refusalDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const fields = body as Record<string, unknown>;
  const { detail } = fields;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const inner = detail as Record<string, unknown>;
    return usable(inner.message) ?? usable(inner.detail) ?? messageSentence(fields) ?? errorSentence(fields);
  }
  return usable(detail) ?? messageSentence(fields) ?? errorSentence(fields);
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
