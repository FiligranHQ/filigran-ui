import { useCallback, useState } from 'react';
import type { ApiEndpoints, BackendType, ChatWorkspace } from '../types';
import { parseWorkspaces, refusalMessage } from '../utils/workspaces';

interface UseWorkspacesOptions {
  apiBaseUrl: string;
  apiEndpoints?: ApiEndpoints;
  backendType?: BackendType;
  requestHeaders?: Record<string, string>;
}

/** What a workspace write answered: done, or the backend's reason. */
export type WorkspaceWriteResult = { ok: true; workspace?: ChatWorkspace } | { ok: false; error: string | null };

interface UseWorkspacesReturn {
  /** The host named the route (`apiEndpoints.workspaces`) and the backend answered the list. */
  workspacesEnabled: boolean;
  workspaces: ChatWorkspace[];
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<WorkspaceWriteResult>;
  renameWorkspace: (id: string, name: string) => Promise<WorkspaceWriteResult>;
  deleteWorkspace: (id: string) => Promise<WorkspaceWriteResult>;
}

/**
 * The caller's workspaces, which the conversation list is grouped by.
 *
 * Off unless the host names `apiEndpoints.workspaces` (see its doc: no
 * default). A backend that refuses the list - not licensed, an older proxy -
 * also leaves it off, so the history stays the flat list it always was.
 */
export function useWorkspaces({ apiBaseUrl, apiEndpoints, backendType = 'rest', requestHeaders }: UseWorkspacesOptions): UseWorkspacesReturn {
  const [workspaces, setWorkspaces] = useState<ChatWorkspace[]>([]);
  const [answered, setAnswered] = useState(false);

  const path = apiEndpoints?.workspaces;
  const configured = backendType === 'rest' && !apiEndpoints?.singleEndpoint && typeof path === 'string' && path.length > 0;
  const url = configured ? `${apiBaseUrl}${path}` : null;

  const refreshWorkspaces = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url, { method: 'GET', headers: { ...(requestHeaders ?? {}) } });
      if (!res.ok) {
        setAnswered(false);
        setWorkspaces([]);
        return;
      }
      setWorkspaces(parseWorkspaces(await res.json()));
      setAnswered(true);
    } catch {
      setAnswered(false);
      setWorkspaces([]);
    }
  }, [url, requestHeaders]);

  const write = useCallback(
    async (method: 'POST' | 'PATCH' | 'DELETE', target: string, body?: Record<string, unknown>): Promise<WorkspaceWriteResult> => {
      try {
        const res = await fetch(target, {
          method,
          headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(requestHeaders ?? {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (!res.ok) return { ok: false, error: await refusalMessage(res) };
        const created = res.status === 204 ? [] : parseWorkspaces([await res.json().catch(() => null)]);
        await refreshWorkspaces();
        return { ok: true, workspace: created[0] };
      } catch {
        return { ok: false, error: null };
      }
    },
    [requestHeaders, refreshWorkspaces],
  );

  const createWorkspace = useCallback(
    async (name: string) => (url ? write('POST', url, { name: name.trim() }) : { ok: false as const, error: null }),
    [url, write],
  );
  const renameWorkspace = useCallback(
    async (id: string, name: string) =>
      url ? write('PATCH', `${url}/${encodeURIComponent(id)}`, { name: name.trim() }) : { ok: false as const, error: null },
    [url, write],
  );
  const deleteWorkspace = useCallback(
    async (id: string) => (url ? write('DELETE', `${url}/${encodeURIComponent(id)}`) : { ok: false as const, error: null }),
    [url, write],
  );

  return {
    workspacesEnabled: configured && answered,
    workspaces,
    refreshWorkspaces,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
  };
}
