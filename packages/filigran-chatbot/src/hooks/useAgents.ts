import { useEffect, useState } from 'react';
import type { ApiEndpoints, BackendType, XtmAgent } from '../types';
import { readStorage, STORAGE_KEYS, storageKey, writeStorage } from '../utils/storage';

interface UseAgentsOptions {
  apiBaseUrl: string;
  apiEndpoints?: ApiEndpoints;
  backendType?: BackendType;
  requestHeaders?: Record<string, string>;
  /** Namespace of the browser-storage keys (see `storageKeyPrefix` on the panel). */
  storageKeyPrefix?: string;
  /** Agent selected once the list loads, by id or slug; wins over the remembered one. */
  initialAgent?: string;
  /** Called when the user (or the host, through the panel handle) picks another agent. */
  onAgentChange?: (agent: XtmAgent) => void;
}

interface UseAgentsReturn {
  agents: XtmAgent[];
  /** True while the first fetch is in flight. */
  agentsLoading: boolean;
  /**
   * Set when the agent list could not be retrieved — the backend is
   * unreachable, or answered an error. Distinguishes "still loading" from
   * "there is nothing to load", which an empty array alone cannot.
   */
  agentsError: boolean;
  /** True once the list is known (loaded, failed, or not fetched at all). */
  agentsSettled: boolean;
  selectedAgent: XtmAgent | null;
  setSelectedAgent: React.Dispatch<React.SetStateAction<XtmAgent | null>>;
  agentMenuOpen: boolean;
  setAgentMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSwitchAgent: (agent: XtmAgent, onSwitch?: () => void) => void;
}

/**
 * Normalize the raw agents list response.
 * Defensive: the endpoint may answer with something other than a JSON array
 * (an error envelope, an HTML error page that happens to parse), and an
 * `agents.map is not a function` thrown in ChatHeader blanks the whole panel.
 * Accepts both the bare array and the `{ agents: [...] }` envelope, mirroring
 * what useConversations tolerates, and drops entries without an agent id.
 */
function parseAgents(data: unknown): XtmAgent[] {
  const rawList = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.agents)
      ? ((data as Record<string, unknown>).agents as unknown[])
      : [];
  return rawList.filter((raw): raw is XtmAgent => !!raw && typeof raw === 'object' && typeof (raw as XtmAgent).id === 'string');
}

/** The agent named by *key*, matched on id first, then slug. */
export function findAgent(agents: XtmAgent[], key: string | null | undefined): XtmAgent | undefined {
  if (!key) return undefined;
  return agents.find((a) => a.id === key) ?? agents.find((a) => a.slug === key);
}

export function useAgents({
  apiBaseUrl,
  apiEndpoints,
  backendType = 'rest',
  requestHeaders,
  storageKeyPrefix,
  initialAgent,
  onAgentChange,
}: UseAgentsOptions): UseAgentsReturn {
  const agentsDisabled = apiEndpoints?.agents === null || !!apiEndpoints?.singleEndpoint || backendType === 'legacy';
  const agentStorageKey = storageKey(storageKeyPrefix, STORAGE_KEYS.agentSlug);
  const [agents, setAgents] = useState<XtmAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState(false);
  const [agentsSettled, setAgentsSettled] = useState(agentsDisabled);
  const [selectedAgent, setSelectedAgent] = useState<XtmAgent | null>(null);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  useEffect(() => {
    // Skip agents fetch if disabled, using single endpoint mode, or legacy backend
    if (agentsDisabled) {
      setAgentsSettled(true);
      return;
    }
    const agentsUrl = `${apiBaseUrl}${apiEndpoints?.agents ?? '/chat/agents'}`;
    setAgentsLoading(true);
    setAgentsError(false);
    fetch(agentsUrl, { headers: requestHeaders })
      .then((res) => {
        // A non-2xx is a failure, not an empty catalogue. Mapping it to `[]`
        // was why an unreachable backend left the menu spinning forever with
        // nothing to explain it.
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        const list = parseAgents(data);
        setAgents(list);
        if (list.length > 0 && !selectedAgent) {
          const savedSlug = readStorage('local', agentStorageKey);
          const match = findAgent(list, initialAgent) ?? (savedSlug ? list.find((a) => a.slug === savedSlug) : undefined);
          setSelectedAgent(match || list[0]);
        }
      })
      .catch(() => {
        setAgents([]);
        setAgentsError(true);
      })
      .finally(() => {
        setAgentsLoading(false);
        setAgentsSettled(true);
      });
  }, [apiBaseUrl, apiEndpoints, backendType, requestHeaders, agentsDisabled]);

  const handleSwitchAgent = (agent: XtmAgent, onSwitch?: () => void) => {
    if (agent.id === selectedAgent?.id) {
      setAgentMenuOpen(false);
      return;
    }
    setSelectedAgent(agent);
    if (agent.slug) writeStorage('local', agentStorageKey, agent.slug);
    setAgentMenuOpen(false);
    onAgentChange?.(agent);
    onSwitch?.();
  };

  return {
    agents,
    agentsLoading,
    agentsError,
    agentsSettled,
    selectedAgent,
    setSelectedAgent,
    agentMenuOpen,
    setAgentMenuOpen,
    handleSwitchAgent,
  };
}
