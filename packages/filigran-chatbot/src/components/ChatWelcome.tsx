interface ChatWelcomeProps {
  firstName: string;
  logoIcon: React.ReactNode;
  promptSuggestions: string[];
  onPromptClick: (prompt: string) => void;
  t: (key: string) => string;
}

export const ChatWelcome = ({ firstName, logoIcon, promptSuggestions, onPromptClick, t }: ChatWelcomeProps) => (
  <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
    <span className="text-[var(--chat-accent)] mb-4 [&>svg]:w-12 [&>svg]:h-12 drop-shadow-[0_0_12px_var(--chat-accent-40)]">{logoIcon}</span>
    <h2 className="text-xl font-medium mb-6 text-center text-gray-900 dark:text-white" style={{ fontFamily: '"Geologica", sans-serif' }}>
      {t('How can I help you, ')}
      {firstName}?
    </h2>
    <div className="w-full max-w-[320px]">
      <span className="block text-center mb-2 text-[0.65rem] tracking-[1.5px] uppercase text-[var(--chat-accent)] font-semibold">
        {t('Suggestions')}
      </span>
      {promptSuggestions.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onPromptClick(prompt)}
          className="w-full text-left text-[0.8125rem] text-gray-800 dark:text-white py-1.5 px-3 mb-1 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent transition-colors hover:bg-[var(--chat-accent-10)] hover:border-[var(--chat-accent-50)]"
        >
          {t(prompt)}
        </button>
      ))}
    </div>
  </div>
);
