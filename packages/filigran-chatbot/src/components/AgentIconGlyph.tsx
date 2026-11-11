import { createContext, useContext, type ReactNode } from 'react';
import type { ChatAgentIconRenderer } from '../types';
import { agentIconKind } from '../utils';

// Outside a panel (a part rendered on its own) a named icon is not drawn.
const AgentIconRendererContext = createContext<ChatAgentIconRenderer | undefined>(undefined);

export const AgentIconRendererProvider = AgentIconRendererContext.Provider;

/**
 * An agent's own icon: an image URL as an image, an emoji as text, a name
 * (an icon library's, such as `brain-circuit`) through the host's
 * `renderAgentIcon`, and `fallback` when none of them draws anything.
 */
export const AgentIconGlyph = ({
  icon,
  size,
  fallback,
  imageClassName,
  emojiClassName,
}: {
  icon: string | null | undefined;
  /** Pixels the glyph is drawn at. */
  size: number;
  fallback: ReactNode;
  imageClassName: string;
  emojiClassName: string;
}) => {
  const renderNamed = useContext(AgentIconRendererContext);
  const value = icon?.trim();
  const kind = agentIconKind(value);
  if (kind === 'image') return <img src={value} alt="" data-agent-icon="image" className={imageClassName} />;
  if (kind === 'emoji')
    return (
      <span data-agent-icon="emoji" className={emojiClassName}>
        {value}
      </span>
    );
  const named = value && renderNamed ? renderNamed(value, { size }) : null;
  if (named !== null && named !== undefined && named !== false)
    return (
      <span data-agent-icon="named" className="flex shrink-0 items-center">
        {named}
      </span>
    );
  return <>{fallback}</>;
};
