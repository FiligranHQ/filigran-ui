/**
 * What the panel's rendering tests share: the page, a panel mounted in a fresh
 * container per test, and the routes of a backend holding one agent and one
 * conversation (`c1`).
 */
import { afterEach, beforeEach } from 'node:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { installDom, json, settle, sseStream, type RecordedRequest } from './dom.ts';

installDom();
const { ChatPanel } = await import('../src/components/ChatPanel.tsx');

export type Props = import('../src/types.ts').ChatPanelProps;
export type Handle = import('../src/types.ts').ChatPanelHandle;

export const AGENTS = [{ id: 'a1', name: 'Hunter', slug: 'hunter', icon: null, description: null }];

export const BASE_PROPS: Props = { mode: 'inline', apiBaseUrl: '/api', user: { firstName: 'Ada' } };

/** The current test's container: a live binding, replaced before each test. */
export let container: HTMLElement;

/**
 * Mount the panel of each test of the file in a fresh container, unmounted
 * after it: `render` lays the test's props over *baseProps*, and `unmount`
 * takes the panel down mid-test, leaving the container to render again.
 */
export function mountPanels(baseProps: Props = BASE_PROPS) {
  let root: Root;
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  const render = async (props: Partial<Props>, ref?: React.Ref<Handle>) => {
    await act(async () => {
      root.render(<ChatPanel {...baseProps} {...props} ref={ref} />);
    });
    await act(async () => settle());
  };
  const unmount = async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
  };
  return { render, unmount };
}

export const agentsRoute = (req: RecordedRequest) => (req.url === '/api/chat/agents' ? json(AGENTS) : undefined);

/** The read-back of `c1`: its *messages*, and *extra* fields of the answer. */
export const restoreRoute =
  (messages: unknown[] = [], extra: Record<string, unknown> = {}) =>
  (req: RecordedRequest) =>
    req.url === '/api/chat/sessions' && req.method === 'POST' ? json({ conversation_id: 'c1', messages, ...extra }) : undefined;

/** The event stream of `c1`, a fresh stream per subscription. */
export function eventsRoute(subscriptions: ReturnType<typeof sseStream>[]) {
  return (req: RecordedRequest) => {
    if (!req.url.startsWith('/api/chat/conversations/c1/events')) return undefined;
    const events = sseStream();
    subscriptions.push(events);
    return events.response();
  };
}

export const text = () => container.textContent ?? '';

/** Close what a test left open, inside `act`: the panel answers it with updates. */
export const finish = (...streams: { close: () => void }[]) =>
  act(async () => {
    for (const stream of streams) stream.close();
    await settle();
  });
