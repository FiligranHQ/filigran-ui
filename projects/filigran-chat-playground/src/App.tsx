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
 * Whether the playground is talking to a real XTM One, and to whom.
 *
 * `mock` is not a failure: with `CHAT_API_MOCK=1` the dev server answers the
 * chat API itself and there is nobody to sign in as. Detected rather than
 * configured — the mock has no `/api/playground/session` route, so Vite's SPA
 * fallback answers with HTML and the JSON parse fails.
 */
type Session =
  | { state: 'loading' }
  | { state: 'mock' }
  | { state: 'anonymous'; target: string }
  | { state: 'signed-in'; email: string };

const useSession = () => {
  const [session, setSession] = useState<Session>({ state: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/playground/session', { headers: { Accept: 'application/json' } });
      const body = (await res.json()) as { connected?: boolean; email?: string; target?: string };
      setSession(
        body.connected && body.email
          ? { state: 'signed-in', email: body.email }
          : { state: 'anonymous', target: body.target ?? 'XTM One' },
      );
    } catch {
      setSession({ state: 'mock' });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { session, refresh };
};

/**
 * The sign-in gate.
 *
 * Deliberately blocking: until someone signs in there is no identity to make
 * requests as, and rendering the panel anyway would show an empty agent list
 * that looks like data. The password is spent once against XTM One to prove
 * the account exists — see `playground-session.ts`.
 */
const SignIn = ({ target, onSignedIn }: { target: string; onSignedIn: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/playground/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) setError(body.error ?? `Sign-in failed (${res.status}).`);
      else onSignedIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-md border border-gray-300 dark:border-white/20 bg-white dark:bg-[#0d0d1a] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30';

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Sign in to XTM One</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-white/50">
          The playground registers itself as a platform and calls <code className="font-mono text-xs">{target}</code> on your behalf, over the
          same trusted-JWT path OpenCTI and OpenAEV use. Your account must already exist there.
        </p>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm text-gray-600 dark:text-white/50">Email</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="admin@filigran.io" autoComplete="username" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-gray-600 dark:text-white/50">Password</span>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field} autoComplete="current-password" />
      </label>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-[#7b5cff] px-4 py-2 text-sm text-white transition-colors hover:bg-[#6a4de0] disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-xs text-gray-500 dark:text-white/40">
        Start XTM One with <code className="font-mono">./dev-podman.sh</code>, or run the playground offline with{' '}
        <code className="font-mono">CHAT_API_MOCK=1 yarn dev</code>.
      </p>
    </form>
  );
};

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
  const { session, refresh } = useSession();

  // The panel may only mount once there is an identity behind it: against a
  // real backend an unauthenticated panel renders an empty agent list that is
  // indistinguishable from a real one.
  const canChat = session.state === 'signed-in' || session.state === 'mock';

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
            {session.state === 'signed-in' && (
              <>
                <span className="text-sm text-gray-500 dark:text-white/40">{session.email}</span>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch('/api/playground/logout');
                    setIsOpen(false);
                    void refresh();
                  }}
                  className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                  Sign out
                </button>
              </>
            )}
            {canChat && <ChatToggleButton isOpen={isOpen} onToggle={() => setIsOpen((o) => !o)} label="Ask Assistant" accentColor="#7b5cff" />}
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
            {/*
              Signing in is the whole page until it is done. The controls below
              drive a panel that cannot mount yet, and the checklist describes
              behaviour nobody can reach — showing them greyed out only invites
              clicking at something inert. `loading` renders nothing rather than
              flashing the sign-in card at someone who turns out to be signed in
              already.
            */}
            {session.state === 'loading' ? null : session.state === 'anonymous' ? (
              <div className={card}>
                <SignIn target={session.target} onSignedIn={refresh} />
              </div>
            ) : (
              <>
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
                      disabled={!canChat}
                      title={canChat ? undefined : 'Sign in first'}
                      className="px-4 py-2 text-sm rounded-md bg-[#7b5cff] text-white hover:bg-[#6a4de0] transition-colors disabled:opacity-40 disabled:hover:bg-[#7b5cff]"
                    >
                      {isOpen ? 'Close chat' : 'Open chat'}
                    </button>
                  </div>
                </div>

                {/* Scenarios understood by the built-in mock backend */}
                {session.state === 'mock' && (
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
                      These are mock answers. Drop <code className="font-mono">CHAT_API_MOCK=1</code> to talk to a real XTM One instead.
                    </p>
                  </div>
                )}

                {session.state === 'signed-in' && (
                  <div className={card}>
                    <h2 className="text-xl font-semibold mb-1 text-gray-900 dark:text-white">Connected to XTM One</h2>
                    <p className="text-sm text-gray-600 dark:text-white/50">
                      Agents, conversations and answers below are real, and scoped to <strong className="text-gray-900 dark:text-white">{session.email}</strong> — the
                      playground signs its own EdDSA tokens as a registered platform, exactly as an embedded product does. Nothing here is mocked, so what
                      another user sees may legitimately differ.
                    </p>
                    <p className="mt-3 text-xs text-gray-500 dark:text-white/40">
                      Add <code className="font-mono">CHAT_PLAYGROUND_AGENT=1</code> for a “Rendering Playground” agent whose persona emits the markdown
                      shapes that have broken the renderer before.
                    </p>
                  </div>
                )}

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
                      'Context gauge: absent before the first turn, then 21/42/63/84/100% over five turns (mock) — amber at 84%, red at 100%; reload restores it, "New conversation" clears it',
                  'Context gauge detail: click it — stacked bar + legend, rows sum to the headline, "Summarized conversation" only appears past 80%',
                      'Dark/light mode toggle works correctly in both themes',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <input type="checkbox" className="mt-0.5 accent-[#7b5cff]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </main>

        {/* Chat panel */}
        {isOpen && canChat && (
          <ChatPanel
            mode={mode}
            onClose={() => setIsOpen(false)}
            onModeChange={setMode}
            topOffset={HEADER_HEIGHT}
            apiBaseUrl="/api/xtmone"
            agentDashboardUrl="https://xtm.example.com"
            user={{ firstName: session.state === 'signed-in' ? session.email.split('@')[0] : 'Tester' }}
            accentColor="#7b5cff"
            // Only the mock understands these; against a real backend the
            // agent's own suggestions are the ones worth exercising.
            promptSuggestions={session.state === 'mock' ? SCENARIOS.map((s) => s.prompt) : undefined}
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
