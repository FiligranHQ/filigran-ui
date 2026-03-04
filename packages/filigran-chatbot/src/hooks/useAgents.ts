import { useEffect, useState } from 'react';
import type { XtmAgent } from '../types';

const STORAGE_AGENT_KEY = 'filigranChatAgentSlug';

interface UseAgentsOptions {
  apiBaseUrl: string;
}

interface UseAgentsReturn {
  agents: XtmAgent[];
  selectedAgent: XtmAgent | null;
  setSelectedAgent: React.Dispatch<React.SetStateAction<XtmAgent | null>>;
  agentMenuOpen: boolean;
  setAgentMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSwitchAgent: (agent: XtmAgent, onSwitch?: () => void) => void;
}

export function useAgents({ apiBaseUrl }: UseAgentsOptions): UseAgentsReturn {
  const [agents, setAgents] = useState<XtmAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<XtmAgent | null>(null);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  useEffect(() => {
    fetch(`${apiBaseUrl}/chat/agents`)
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
  }, [apiBaseUrl]);

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
