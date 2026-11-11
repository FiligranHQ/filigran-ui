import { Chip } from '@filigran/design-system';

import type { Translate } from '../types';
import { translate, translateAround } from '../utils';
import { AgentIconGlyph } from './AgentIconGlyph';

/**
 * The greeting, as one sentence the locale owns end to end. The agent's name is
 * markup (it carries the accent colour), so it cannot be spliced into a string —
 * hence the split around its slot rather than three separate fragments.
 */
const Greeting = ({ firstName, agentName, t }: { firstName: string; agentName?: string; t: Translate }) => {
  if (!agentName) return <>{translate(t, 'How can I help you, {name}?', { name: firstName })}</>;
  const { before, after, hasSlot } = translateAround(t, 'How can {agent} help you, {name}?', 'agent', { name: firstName });
  return (
    <>
      {before}
      {hasSlot && <span className="text-[var(--chat-accent)]">{agentName}</span>}
      {after}
    </>
  );
};

interface ChatWelcomeProps {
  firstName: string;
  /** The panel's mark, drawn when the agent has no icon of its own the panel or the host can draw. */
  logoIcon: React.ReactNode;
  /**
   * The selected agent's own icon (an image URL, an emoji, or a name the host
   * draws through `renderAgentIcon`), as the header and the conversation rows
   * show it: the screen names who is about to answer by its mark too.
   */
  agentIcon?: string | null;
  /**
   * Already translated by the caller — see `ChatPanel`. Only the agent's own
   * suggestions (or the host's list): an empty list shows no suggestion at all,
   * the package hard-codes none.
   */
  promptSuggestions: string[];
  /** Left out when nothing can be sent: the suggestions are not offered then. */
  onPromptClick?: (prompt: string) => void;
  /** Selected agent, so the screen says who is about to answer. */
  agentName?: string;
  /**
   * @deprecated Ignored since the empty state was made short: the agent's
   * description is prose written for the agent picker and the agent page (it can
   * run to twenty lines), never a greeting. Kept so existing callers still type.
   */
  agentDescription?: string | null;
  /** True while agent-specific suggestions are being fetched. */
  suggestionsLoading?: boolean;
  t: Translate;
}

/**
 * The new-conversation screen: the agent's own mark, one greeting line naming
 * the agent, and the agent's own suggestions as design-system chips.
 * Deliberately short: the composer below is what the screen is for.
 */
export const ChatWelcome = ({ firstName, logoIcon, agentIcon, promptSuggestions, onPromptClick, agentName, suggestionsLoading = false, t }: ChatWelcomeProps) => (
  <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
    <span data-chat-welcome-mark="" className="flex items-center justify-center text-[var(--chat-accent)] mb-3 [&>svg]:w-10 [&>svg]:h-10">
      <AgentIconGlyph
        icon={agentIcon}
        size={40}
        fallback={logoIcon}
        imageClassName="w-10 h-10 chat-radius-sm object-cover"
        emojiClassName="text-title-jumbo leading-none"
      />
    </span>

    {/*
      Naming the agent here is the only confirmation that switching in the
      header actually took effect: the thread resets to this screen, so without
      it nothing tells you which agent the next message will reach.
      `key` on the heading restarts the fade whenever the agent changes, so the
      switch is visible rather than a silent text swap.
    */}
    <h2
      key={agentName ?? 'default'}
      className="text-xl font-medium text-center chat-text-900/100"
      style={{ fontFamily: '"Geologica", sans-serif', animation: 'chat-fade-in 0.35s ease-out' }}
    >
      <Greeting firstName={firstName} agentName={agentName} t={t} />
    </h2>

    {/* No suggestions without something to click: none served by the agent or
        the host, or nothing can be sent (a read-only panel). */}
    {onPromptClick && (suggestionsLoading || promptSuggestions.length > 0) && (
      <div role="group" aria-label={t('Suggestions')} aria-busy={suggestionsLoading || undefined} className="mt-5 flex w-full max-w-[480px] flex-wrap justify-center gap-2">
        {suggestionsLoading
          ? // Placeholder chips of the chip's own box rather than an empty gap:
            // the row is about to be replaced by the new agent's own suggestions.
            [0, 1, 2].map((i) => <div key={i} aria-hidden className="h-6 w-32 chat-radius-sm chat-skeleton-card animate-pulse" />)
          : // The design system's Chip with onClick: filled, 24px, its label cut at
            // 250px with its own tooltip carrying the whole prompt while it is cut.
            // The focus ring takes the brand colour (the host's, else the accent).
            promptSuggestions.map((prompt) => (
              <Chip key={prompt} label={prompt} onClick={() => onPromptClick(prompt)} className="focus-visible:ring-filigran-brand-primary" />
            ))}
      </div>
    )}
  </div>
);
