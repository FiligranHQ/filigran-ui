/**
 * A happy-dom page installed as the global environment, for tests that render
 * the panel with `react-dom`, plus a scripted backend to answer its requests.
 */
import { Window } from 'happy-dom';

// DOM classes Node also defines: the page's own must win, or events created by
// its elements would not be the ones React listens for.
const FORCE_PAGE_GLOBALS = new Set(['Event', 'EventTarget', 'CustomEvent', 'MessageEvent', 'localStorage', 'sessionStorage', 'navigator']);

const KEEP_NODE_GLOBALS = new Set([
  'fetch',
  'Request',
  'Response',
  'Headers',
  'ReadableStream',
  'TextEncoder',
  'TextDecoder',
  'AbortController',
  'AbortSignal',
  'URL',
  'URLSearchParams',
  'crypto',
  'FormData',
  'Blob',
  'File',
  'DOMException',
  'console',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'queueMicrotask',
  'structuredClone',
  'performance',
]);

export function installDom(url = 'http://host.test/chat'): Window {
  const window = new Window({ url });
  const target = globalThis as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(window)) {
    if (KEEP_NODE_GLOBALS.has(key) || key === 'globalThis' || key === 'global') continue;
    if (key in globalThis && !FORCE_PAGE_GLOBALS.has(key)) continue;
    try {
      target[key] = (window as unknown as Record<string, unknown>)[key];
    } catch {
      // Read-only on this runtime: Node's own stays.
    }
  }
  target.window = window;
  target.document = window.document;
  for (const key of FORCE_PAGE_GLOBALS) {
    Object.defineProperty(globalThis, key, { value: (window as unknown as Record<string, unknown>)[key], configurable: true, writable: true });
  }
  target.IS_REACT_ACT_ENVIRONMENT = true;
  return window;
}

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/** An SSE response the test writes to, frame by frame. */
export function sseStream() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: () => new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    send: (frame: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`)),
    /** The connection drops mid-stream. */
    fail: () => controller.error(new TypeError('network error')),
    close: () => {
      try {
        controller.close();
      } catch {
        // Already closed or cancelled.
      }
    },
  };
}

/** *res* with a body that errors once *signal* aborts, as a real `fetch` does. */
function abortable(res: Response, signal: AbortSignal | null | undefined): Response {
  if (!signal || !res.body) return res;
  if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const reader = res.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      signal.addEventListener('abort', () => {
        try {
          controller.error(new DOMException('The operation was aborted.', 'AbortError'));
        } catch {
          // Already closed.
        }
        void reader.cancel().catch(() => undefined);
      });
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return new Response(body, { status: res.status, headers: res.headers });
}

type Route = (req: RecordedRequest) => Response | Promise<Response | undefined> | undefined;

/** Replace `fetch` with *routes*, tried in order; unmatched requests answer 404. */
export function fakeBackend(routes: Route[]) {
  const requests: RecordedRequest[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    let body: unknown = init?.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // Kept as sent.
      }
    }
    const req = { method: init?.method ?? 'GET', url, headers, body };
    requests.push(req);
    for (const route of routes) {
      const res = await route(req);
      if (res) return abortable(res, init?.signal);
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return requests;
}

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/** Let pending promises, timers of 0 ms and React updates settle. */
export async function settle(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
