import { useState, useEffect, useCallback } from 'react';
import { ChatPanel, ChatToggleButton } from '@filigran/chatbot';
import type { ChatMode, MessageFeedback } from '@filigran/chatbot';

interface LogEntry {
  at: string;
  text: string;
}

/**
 * Height of the top bar, in pixels. Shared by the bar itself and the panel's
 * `topOffset` so the two cannot drift apart — a hardcoded offset that no longer
 * matches the bar leaves the panel overlapping it by the difference.
 */
const HEADER_HEIGHT = 56;

/** Prompts that steer the built-in mock towards a specific scenario. */
const SCENARIOS: { prompt: string; label: string; covers: string }[] = [
  { prompt: 'render everything', label: 'Kitchen sink', covers: 'images, tables, code, lists, links, soft breaks' },
  { prompt: 'show me json', label: 'Bare JSON', covers: 'a whole message that is raw JSON' },
  { prompt: 'nested fences', label: 'Nested fences', covers: 'a ```markdown block containing its own fences' },
  { prompt: 'slow answer', label: 'Slow turn', covers: 'elapsed counter, stall, waiting game' },
  { prompt: 'long thread', label: 'Long thread', covers: '200 backfilled messages — render window' },
];

/**
 * Stand-in for a host-owned composer control. XTM One passes its session-tool
 * picker here; the package never learns what integrations or MCP servers are.
 * Any host that passes nothing simply has no such control — that is the whole
 * "product mode", with no flag to keep in step.
 */
const HostToolbarSlot = ({ onClick, active }: { onClick: () => void; active: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    title="Host-supplied control (stands in for the session-tool picker)"
    className={`h-7 rounded-lg px-2 text-[0.7rem] transition-colors ${
      active
        ? 'bg-[#7b5cff]/10 text-[#7b5cff]'
        : 'text-gray-400 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/10'
    }`}
  >
    Tools{active ? ' · 3' : ''}
  </button>
);

const App = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>('floating');
  const [isDark, setIsDark] = useState(true);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [hostToolActive, setHostToolActive] = useState(false);

  // Put dark class on <html> so portal-based elements (tooltips, dropdowns) also get dark: styles
  // This one may need adaptation to work with any app
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const push = useCallback((text: string) => {
    setLog((prev) => [{ at: new Date().toLocaleTimeString(), text }, ...prev].slice(0, 8));
  }, []);

  // Host callbacks the panel expects to be wired. Logging them here is the
  // point: it is the only way to see that the panel actually calls them.
  const handleMessageFeedback = useCallback(
    (id: string, feedback: MessageFeedback | null) => {
      push(feedback ? `feedback ${feedback} on ${id}` : `feedback cleared on ${id}`);
    },
    [push],
  );
  const handleTaskComplete = useCallback((title: string, body: string) => push(`task complete — ${title}: ${body}`), [push]);
  const handleDownloadError = useCallback((_err: unknown, att: { filename: string }) => push(`download failed — ${att.filename}`), [push]);
  const handleRelativeLink = useCallback((href: string) => push(`internal link — ${href}`), [push]);

  const card = 'bg-white dark:bg-[#1e1e2e] rounded-xl p-6 border border-gray-200 dark:border-white/10';

  return (
    <div>
      <div className="min-h-screen bg-gray-100 dark:bg-[#0d0d1a] transition-colors">
        {/*
          The header stays full width on purpose. The panel is given
          `topOffset={HEADER_HEIGHT}`, so it starts *below* this bar and never
          covers it — padding the header too would only open a dead band above
          the panel, and would push the very button used to close it out of
          reach.

          Rule of thumb: what you push must be what the panel actually overlaps.
          A host that wants the whole shell to shrink should pass
          `topOffset={0}` and move `#app-content` up to wrap the header as well.
        */}
        {/*
          Sticky, like the real integration's header. The panel is pinned at
          `topOffset={HEADER_HEIGHT}` and never scrolls, so a header that
          scrolled away would leave the panel starting below a gap — and would
          take the button that closes it out of reach.
        */}
        <header
          style={{ height: HEADER_HEIGHT }}
          className="sticky top-0 z-30 flex items-center justify-between px-6 bg-white dark:bg-[#1a1a2e] border-b border-gray-200 dark:border-white/10"
        >
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Filigran Chat Playground</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
            <ChatToggleButton isOpen={isOpen} onToggle={() => setIsOpen((o) => !o)} label="Ask Assistant" accentColor="#7b5cff" />
          </div>
        </header>

        {/*
          `#app-content` is what `pushContentSelector` targets: in sidebar mode
          the package sets an inline `padding-right` here so the content shrinks
          beside the panel instead of sitting under it. Providing this element is
          the host's job — a panel with nowhere to push just overlays the page.

          The package also publishes the same measurement as a
          `--chatbot-sidebar-width` custom property on `:root`, which a host can
          consume instead if it would rather own the transition.
        */}
        <main id="app-content">
          <div className="p-8 max-w-3xl mx-auto space-y-6">
            <div className={card}>
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
              <div>
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

            {/* Scenarios understood by the built-in mock backend */}
            <div className={card}>
              <h2 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Scenarios</h2>
              <p className="text-sm text-gray-600 dark:text-white/50 mb-4">
                The dev server answers these itself — no backend needed. Type the prompt into the panel to trigger one.
              </p>
              <ul className="space-y-2 text-sm">
                {SCENARIOS.map((s) => (
                  <li key={s.prompt} className="flex flex-wrap items-baseline gap-2">
                    <code className="rounded bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 font-mono text-xs text-gray-900 dark:text-white">{s.prompt}</code>
                    <span className="font-medium text-gray-900 dark:text-white">{s.label}</span>
                    <span className="text-gray-500 dark:text-white/40">— {s.covers}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-gray-500 dark:text-white/40">
                Point at a real backend instead with <code className="font-mono">CHAT_API_PROXY=http://localhost:8000 yarn dev</code>.
              </p>
            </div>

            {/* Host callbacks — proof the panel actually calls them */}
            <div className={card}>
              <h2 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Host callbacks</h2>
              <p className="text-sm text-gray-600 dark:text-white/50 mb-4">
                Rate an answer, click an internal link, or let a long turn finish with the panel closed.
              </p>
              {log.length === 0 ? (
                <p className="text-sm italic text-gray-400 dark:text-white/30">Nothing yet.</p>
              ) : (
                <ul className="space-y-1 font-mono text-xs">
                  {log.map((entry, i) => (
                    <li key={i} className="text-gray-700 dark:text-white/70">
                      <span className="text-gray-400 dark:text-white/30">{entry.at}</span> {entry.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Verification checklist */}
            <div className={card}>
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Verification Checklist</h2>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-white/70">
                {[
                  'Sidebar mode pushes the page aside (it must not overlay it) and the drag handle resizes it',
                  'Leaving sidebar mode — or closing the panel — removes the push completely',
                  'Fullscreen shows the conversation sidebar: select switches thread, delete removes a row, the collapse toggle works, and the header history menu is gone',
                'All 3 modes render with correct positioning/dimensions',
                  'Agent dropdown opens/closes, click-outside dismisses',
                  'Mode switcher transitions between modes',
                  'Send a message and verify SSE streaming renders progressively',
                  'Markdown: tables (incl. the mis-delimited one), fenced code with and without a language, lists show bullets/numbers, soft line breaks',
                  'Images: inline chart and image attachment both preview; click opens the lightbox; Escape closes it',
                  'The javascript: link is inert, the https: one opens in a new tab',
                  'Hover an answer: copy button and 👍/👎 appear; ratings show up under "Host callbacks"',
                  'Reasoning details ("i") opens the tool trace',
                  'Long thread: "Load earlier messages" appears and walks the window back',
                  'Slow turn: elapsed counter ticks every second, then the waiting game appears',
                  'Draft: type, close the panel, reopen — the text is restored; sending clears it',
                  'File attachment via button click and paste',
                  'New chat clears state; conversation history lists and restores past chats',
                  'Dark/light mode toggle works correctly in both themes',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-0.5 accent-[#7b5cff]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>

        {/* Chat panel */}
        {isOpen && (
          <ChatPanel
            mode={mode}
            onClose={() => setIsOpen(false)}
            onModeChange={setMode}
            topOffset={HEADER_HEIGHT}
            apiBaseUrl="/api/xtmone"
            agentDashboardUrl="https://xtm.example.com"
            user={{ firstName: 'Tester' }}
            accentColor="#7b5cff"
            promptSuggestions={SCENARIOS.map((s) => s.prompt)}
            // Sidebar mode is only half-implemented without these two: the
            // panel must push the page aside, and be draggable to resize.
            pushContentSelector="#app-content"
            resizable
            composerToolbar={<HostToolbarSlot active={hostToolActive} onClick={() => setHostToolActive((v) => !v)} />}
            onMessageFeedback={handleMessageFeedback}
            onTaskComplete={handleTaskComplete}
            onDownloadError={handleDownloadError}
            onRelativeLinkClick={handleRelativeLink}
          />
        )}
      </div>
    </div>
  );
};

export default App;
