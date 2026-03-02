import { useState, useEffect } from 'react';
import { ChatPanel, ChatToggleButton } from '@filigran/chatbot';
import type { ChatMode } from '@filigran/chatbot';

const App = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>('floating');
  const [isDark, setIsDark] = useState(true);

  // Put dark class on <html> so portal-based elements (tooltips, dropdowns) also get dark: styles
  // This one may need adaptation to work with any app
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <div>
      <div className="min-h-screen bg-gray-100 dark:bg-[#0d0d1a] transition-colors">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#1a1a2e] border-b border-gray-200 dark:border-white/10">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Filigran Chat Playground
          </h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
            <ChatToggleButton
              isOpen={isOpen}
              onToggle={() => setIsOpen((o) => !o)}
              label="Ask Assistant"
              accentColor="#7b5cff"
            />
          </div>
        </header>

        {/* Main content area */}
        <main className="p-8 max-w-3xl mx-auto">
          <div className="bg-white dark:bg-[#1e1e2e] rounded-xl p-6 border border-gray-200 dark:border-white/10 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Test Controls</h2>

            {/* Mode selector */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-white/50 mb-2">Display mode:</p>
              <div className="flex gap-2">
                {(['floating', 'sidebar', 'fullscreen'] as ChatMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      mode === m
                        ? 'border-[#7b5cff] bg-[#7b5cff]/10 text-[#7b5cff]'
                        : 'border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Open/close */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-white/50 mb-2">Panel:</p>
              <button
                type="button"
                onClick={() => setIsOpen((o) => !o)}
                className="px-4 py-2 text-sm rounded-md bg-[#7b5cff] text-white hover:bg-[#6a4de0] transition-colors"
              >
                {isOpen ? 'Close chat' : 'Open chat'}
              </button>
            </div>
          </div>

          {/* Verification checklist */}
          <div className="bg-white dark:bg-[#1e1e2e] rounded-xl p-6 border border-gray-200 dark:border-white/10">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Verification Checklist</h2>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-white/70">
              {[
                'All 3 modes render with correct positioning/dimensions',
                'Agent dropdown opens/closes, click-outside dismisses',
                'Mode switcher transitions between modes',
                'Send a message and verify SSE streaming renders progressively',
                'Markdown rendering: code blocks, copy button, lists, tables, links',
                'File attachment via button click and paste',
                'New chat clears state',
                'Conversation restoration on reload',
                'Dark/light mode toggle works correctly',
                'Toggle button shows open/closed state',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5 accent-[#7b5cff]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </main>

        {/* Chat panel */}
        {isOpen && (
          <ChatPanel
            mode={mode}
            onClose={() => setIsOpen(false)}
            onModeChange={setMode}
            topOffset={49}
            apiBaseUrl="/api/xtmone"
            agentDashboardUrl="https://xtm.example.com"
            user={{ firstName: 'Tester' }}
            accentColor="#7b5cff"
            promptSuggestions={[
              'Help me create a new simulation scenario',
              'What are the latest attack patterns?',
              'How do I configure detection rules?',
              'Summarize my recent findings',
            ]}
          />
        )}
      </div>
    </div>
  );
};

export default App;
