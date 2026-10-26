import { createContext, useContext } from 'react';

/** How the panel's parts reach the backend, and report the end of the user's session. */
export interface PanelRequests {
  /** `fetch`, through which a refusal saying the session ended reaches the host (`onSessionEnded`). */
  fetch: typeof fetch;
  /** A frame said the session ended: told to the host once per set of `requestHeaders`. */
  sessionEnded: (reason: string | undefined) => void;
}

// Outside a panel (a part rendered on its own) requests go out as they are.
const PanelRequestsContext = createContext<PanelRequests>({
  fetch: (input, init) => globalThis.fetch(input, init),
  sessionEnded: () => undefined,
});

export const PanelRequestsProvider = PanelRequestsContext.Provider;

export function usePanelRequests(): PanelRequests {
  return useContext(PanelRequestsContext);
}

/** The panel's `fetch` (see `PanelRequests.fetch`). */
export function usePanelFetch(): typeof fetch {
  return useContext(PanelRequestsContext).fetch;
}
