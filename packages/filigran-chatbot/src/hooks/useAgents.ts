import { useEffect, useState } from 'react';
import type { ApiEndpoints, BackendType, XtmAgent } from '../types';

const STORAGE_AGENT_KEY = 'filigranChatAgentSlug';

interface UseAgentsOptions {
  apiBaseUrl: string;
  apiEndpoints?: ApiEndpoints;
  backendType?: BackendType;
  requestHeaders?: Record<string, string>;
}

interface UseAgentsReturn {
  agents: XtmAgent[];
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

export function useAgents({ apiBaseUrl, apiEndpoints, backendType = 'rest', requestHeaders }: UseAgentsOptions): UseAgentsReturn {
  const [agents, setAgents] = useState<XtmAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<XtmAgent | null>(null);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  useEffect(() => {
    // Skip agents fetch if disabled, using single endpoint mode, or legacy backend
    if (apiEndpoints?.agents === null || apiEndpoints?.singleEndpoint || backendType === 'legacy') {
      return;
    }
    const agentsUrl = `${apiBaseUrl}${apiEndpoints?.agents ?? '/chat/agents'}`;
    fetch(agentsUrl, { headers: requestHeaders })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        const list = parseAgents(data);
        setAgents(list);
        if (list.length > 0 && !selectedAgent) {
          const savedSlug = localStorage.getItem(STORAGE_AGENT_KEY);
          const match = savedSlug ? list.find((a) => a.slug === savedSlug) : null;
          setSelectedAgent(match || list[0]);
        }
      })
      .catch(() => {});
  }, [apiBaseUrl, apiEndpoints, backendType, requestHeaders]);

  const handleSwitchAgent = (agent: XtmAgent, onSwitch?: () => void) => {
    if (agent.id === selectedAgent?.id) {
      setAgentMenuOpen(false);
      return;
    }
    setSelectedAgent(agent);
    if (agent.slug) localStorage.setItem(STORAGE_AGENT_KEY, agent.slug);
    setAgentMenuOpen(false);
    onSwitch?.();
  };

  return {
    agents,
    selectedAgent,
    setSelectedAgent,
    agentMenuOpen,
    setAgentMenuOpen,
    handleSwitchAgent,
  };
}
