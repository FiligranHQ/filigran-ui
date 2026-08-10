interface ChatWelcomeProps {
  firstName: string;
  logoIcon: React.ReactNode;
  promptSuggestions: string[];
  onPromptClick: (prompt: string) => void;
  /** Selected agent, so the screen says who is about to answer. */
  agentName?: string;
  agentDescription?: string | null;
  /** True while agent-specific suggestions are being fetched. */
  suggestionsLoading?: boolean;
  t: (key: string) => string;
}

export const ChatWelcome = ({
  firstName,
  logoIcon,
  promptSuggestions,
  onPromptClick,
  agentName,
  agentDescription,
  suggestionsLoading = false,
  t,
}: ChatWelcomeProps) => (
  <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
    <span className="text-[var(--chat-accent)] mb-4 [&>svg]:w-12 [&>svg]:h-12 drop-shadow-[0_0_12px_var(--chat-accent-40)]">{logoIcon}</span>

    {/*
      Naming the agent here is the only confirmation that switching in the
      header actually took effect: the thread resets to this screen, so without
      it nothing tells you which agent the next message will reach.
      `key` on the heading restarts the fade whenever the agent changes, so the
      switch is visible rather than a silent text swap.
    */}
    <h2
      key={agentName ?? 'default'}
      className="text-xl font-medium mb-1 text-center text-gray-900 dark:text-white"
      style={{ fontFamily: '"Geologica", sans-serif', animation: 'chat-fade-in 0.35s ease-out' }}
    >
      {agentName ? (
        <>
          {t('How can ')}
          <span className="text-[var(--chat-accent)]">{agentName}</span>
          {t(' help you, ')}
          {firstName}?
        </>
      ) : (
        <>
          {t('How can I help you, ')}
          {firstName}?
        </>
      )}
    </h2>

    {agentDescription && (
      <p className="mb-5 max-w-[320px] text-center text-[0.75rem] leading-5 text-gray-500 dark:text-white/40">{agentDescription}</p>
    )}
    {!agentDescription && <span className="mb-5" />}

    <div className="w-full max-w-[320px]">
      <span className="block text-center mb-2 text-[0.65rem] tracking-[1.5px] uppercase text-[var(--chat-accent)] font-semibold">
        {t('Suggestions')}
      </span>
      {suggestionsLoading ? (
        // Placeholder rows rather than an empty gap: the list is about to be
        // replaced by the new agent's own suggestions.
        <div aria-hidden className="space-y-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100/50 dark:bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : (
        promptSuggestions.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPromptClick(prompt)}
            className="w-full text-left text-[0.8125rem] text-gray-800 dark:text-white py-1.5 px-3 mb-1 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent transition-colors hover:bg-[var(--chat-accent-10)] hover:border-[var(--chat-accent-50)]"
          >
            {t(prompt)}
          </button>
        ))
      )}
    </div>
  </div>
);
