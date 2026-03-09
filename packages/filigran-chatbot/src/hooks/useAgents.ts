import { useEffect, useState } from 'react';
import type { ApiEndpoints, BackendType, XtmAgent } from '../types';

const STORAGE_AGENT_KEY = 'filigranChatAgentSlug';

interface UseAgentsOptions {
  apiBaseUrl: string;
  apiEndpoints?: ApiEndpoints;
  backendType?: BackendType;
}

interface UseAgentsReturn {
  agents: XtmAgent[];
  selectedAgent: XtmAgent | null;
  setSelectedAgent: React.Dispatch<React.SetStateAction<XtmAgent | null>>;
  agentMenuOpen: boolean;
  setAgentMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSwitchAgent: (agent: XtmAgent, onSwitch?: () => void) => void;
}

export function useAgents({ apiBaseUrl, apiEndpoints, backendType = 'rest' }: UseAgentsOptions): UseAgentsReturn {
  const [agents, setAgents] = useState<XtmAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<XtmAgent | null>(null);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  useEffect(() => {
    // Skip agents fetch if disabled, using single endpoint mode, or legacy backend
    if (apiEndpoints?.agents === null || apiEndpoints?.singleEndpoint || backendType === 'legacy') {
      return;
    }
    const agentsUrl = `${apiBaseUrl}${apiEndpoints?.agents ?? '/chat/agents'}`;
    fetch(agentsUrl)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: XtmAgent[]) => {
        setAgents(data);
        if (data.length > 0 && !selectedAgent) {
          const savedSlug = localStorage.getItem(STORAGE_AGENT_KEY);
          const match = savedSlug ? data.find((a) => a.slug === savedSlug) : null;
          setSelectedAgent(match || data[0]);
        }
      })
      .catch(() => {});
  }, [apiBaseUrl, apiEndpoints]);

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
