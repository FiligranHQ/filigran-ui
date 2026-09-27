import { createContext, memo, useCallback, useContext, useMemo, useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { CheckIcon, CopyIcon } from './icons';
import { ChatImage } from './ChatImage';
import { identity, markdownUrlTransform, prepareMarkdown } from '../utils';
import { MarkdownBlockSplitter } from '../utils/markdownBlocks';

interface MarkdownMessageProps {
  content: string;
  /**
   * True while the message is still streaming: it is then rendered one
   * top-level block at a time, so a new chunk only re-parses the blocks it can
   * still change, and stays so once the stream ends. The markup is the one a
   * single parse of the finished message renders.
   */
  streaming?: boolean;
  onRelativeLinkClick?: (href: string) => void;
  /** Auth headers used to fetch host-relative images (see `ChatImage`). */
  requestHeaders?: Record<string, string>;
  t?: (key: string) => string;
}

const isRelativeHref = (href?: string) => {
  if (!href) return false;
  if (href.startsWith('//')) return false;
  const hasAbsoluteScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href);
  return !hasAbsoluteScheme;
};

/**
 * Resolve an href to its host-app-internal form, or null when it points
 * elsewhere.
 *
 * Internal links must route through the host application's router
 * (`onRelativeLinkClick`) instead of a full page load / new tab. Two shapes
 * qualify:
 *
 * 1. Relative hrefs (`/dashboard/...`) — kept as-is.
 * 2. Absolute http(s) hrefs on the SAME origin as the embedding page
 *    (e.g. `https://octi.example.com/dashboard/id/<uuid>`) — reduced to
 *    `pathname + search + hash`. Backends intentionally emit absolute links
 *    (so links work from any chat surface); when the chatbot is embedded in
 *    that very platform the link must still navigate in-app.
 *
 * Anything else (other origins, non-http schemes, malformed URLs) returns
 * null and falls back to a regular new-tab anchor.
 */
const toInternalHref = (href?: string): string | null => {
  if (!href) return null;
  if (isRelativeHref(href)) return href;
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(href, window.location.href);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}` || '/';
    }
  } catch {
    /* malformed URL — treat as external */
  }
  return null;
};

/**
 * What the element renderers need from the message they render.
 *
 * react-markdown uses each renderer as an element TYPE, so a renderer must keep
 * its identity across renders: a new function is a new type, and React remounts
 * everything rendered with it. The renderers are therefore module-level and
 * read what varies per message from here — with renderers recreated on every
 * render, the streaming answer's DOM was rebuilt on every chunk, a selection in
 * it was lost, and each image in it was fetched again.
 */
interface MarkdownRenderContextValue {
  copiedBlock: string | null;
  onCopyCode: (code: string) => void;
  onRelativeLinkClick?: (href: string) => void;
  requestHeaders?: Record<string, string>;
  t: (key: string) => string;
}

const MarkdownRenderContext = createContext<MarkdownRenderContextValue>({ copiedBlock: null, onCopyCode: () => undefined, t: identity });

const MarkdownCode = ({ className, children }: { className?: string; children?: React.ReactNode }) => {
  const { copiedBlock, onCopyCode, t } = useContext(MarkdownRenderContext);
  const match = /language-(\w+)/.exec(className || '');
  const codeStr = String(children).replace(/\n$/, '');
  // A fence with no info string (```\n…\n```) carries no `language-*`
  // class. Falling back to the multi-line test keeps it a block instead
  // of collapsing it into a single run of inline code.
  if (match || codeStr.includes('\n')) {
    return (
      <div className="my-3 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden bg-gray-50 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/[0.03]">
          <span className="text-[0.7rem] text-gray-500 dark:text-white/40 font-mono">{match?.[1] ?? 'plaintext'}</span>
          <button
            type="button"
            onClick={() => onCopyCode(codeStr)}
            aria-label={copiedBlock === codeStr ? t('Copied') : t('Copy code')}
            className="p-0.5 rounded-sm hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            {copiedBlock === codeStr ? (
              <CheckIcon size={14} className="text-green-500" />
            ) : (
              <CopyIcon size={14} className="text-gray-400 dark:text-white/40" />
            )}
          </button>
        </div>
        <pre className="m-0 px-3 py-2 overflow-x-auto">
          <code className="font-mono text-xs leading-[1.7] text-gray-800 dark:text-white/90 whitespace-pre">{codeStr}</code>
        </pre>
      </div>
    );
  }
  return <code className="bg-gray-100 dark:bg-white/[0.08] px-1.5 py-0.5 rounded-sm font-mono text-xs text-[var(--chat-accent)]">{children}</code>;
};

const MarkdownLink = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
  const { onRelativeLinkClick } = useContext(MarkdownRenderContext);
  const internalHref = toInternalHref(href);
  const routeInternally = internalHref !== null && !!onRelativeLinkClick;
  const openInNewTab = !routeInternally && !isRelativeHref(href);
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!routeInternally) return;
    event.preventDefault();
    onRelativeLinkClick!(internalHref!);
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      className="text-[var(--chat-accent)] underline underline-offset-2 hover:brightness-125"
    >
      {children}
    </a>
  );
};

const MarkdownImage = ({ src, alt }: { src?: unknown; alt?: string }) => {
  const { requestHeaders, t } = useContext(MarkdownRenderContext);
  if (typeof src !== 'string' || !src) return null;
  // Keyed by its source: the image at a given place can change while the
  // message streams (a reference-style image resolves to each partial URL of
  // its definition as that line arrives), and a new source must not inherit the
  // previous one's fetched blob or its load error.
  return <ChatImage key={src} src={src} alt={alt || ''} requestHeaders={requestHeaders} t={t} />;
};

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-7 break-words text-[0.8125rem] text-gray-900 dark:text-white/90">{children}</p>,
  // A fenced block renders as `<pre><code>`; the `code` override below
  // returns a `<div>` wrapper, which is not valid inside `<pre>`. Passing
  // the children straight through keeps the markup well-formed.
  pre: ({ children }) => <>{children}</>,
  code: MarkdownCode,
  // `list-disc` / `list-decimal` are required, not decorative: the
  // package's scoped preflight resets `list-style` inside the panel, so
  // without them every list renders as unmarked, indented prose.
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-3 text-[0.8125rem] text-gray-900 dark:text-white/90 [&_li]:mb-1 marker:text-[var(--chat-accent)]/50">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-3 text-[0.8125rem] text-gray-900 dark:text-white/90 [&_li]:mb-1 marker:text-[var(--chat-accent)]/50">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-7 break-words">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-4 border-gray-200 dark:border-white/10" />,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-[var(--chat-accent)]/30 bg-[var(--chat-accent)]/[0.03] pl-4 pr-3 py-2 rounded-r-md italic text-gray-500 dark:text-white/60">
      {children}
    </blockquote>
  ),
  a: MarkdownLink,
  img: MarkdownImage,
  h1: ({ children }) => <h1 className="mt-4 first:mt-0 mb-2 font-bold text-base text-gray-900 dark:text-white">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-3 first:mt-0 mb-2 font-bold text-[0.9rem] text-gray-900 dark:text-white">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-3 first:mt-0 mb-1.5 font-semibold text-[0.85rem] text-gray-900 dark:text-white">{children}</h3>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  tr: ({ children }) => <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2 border-b border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/80">{children}</td>,
};

const REMARK_PLUGINS = [remarkGfm, remarkBreaks];

/** One parse of `source`, run again only when the text itself changes. */
const MarkdownBody = memo(({ source }: { source: string }) => (
  <Markdown remarkPlugins={REMARK_PLUGINS} urlTransform={markdownUrlTransform} components={MARKDOWN_COMPONENTS}>
    {source}
  </Markdown>
));

MarkdownBody.displayName = 'MarkdownBody';

/**
 * A streamed message, one top-level block per parse: a settled block keeps its
 * rendering, and a new chunk re-parses only the blocks it can still change.
 * The blocks render as siblings, which is the markup one parse of the whole
 * text produces.
 */
const StreamedMarkdownBody = ({ source }: { source: string }) => {
  const [splitter] = useState(() => new MarkdownBlockSplitter());
  const blocks = useMemo(() => splitter.split(source), [splitter, source]);
  return (
    <>
      {blocks.map((block, index) => (
        <MarkdownBody key={index} source={block} />
      ))}
    </>
  );
};

/**
 * Assistant prose renderer.
 *
 * Memoized because the message list re-renders on every streamed frame: without
 * it, each settled message in the thread would re-run the full remark parse on
 * every frame, which is the dominant source of streaming jank in long threads.
 * With it, only the live bubble re-parses — and only the blocks of it that can
 * still change.
 */
export const MarkdownMessage = memo(({ content, streaming = false, onRelativeLinkClick, requestHeaders, t = identity }: MarkdownMessageProps) => {
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);

  // Rendered by blocks once it has streamed: switching to one parse when the
  // stream ends would rebuild the whole message to produce the same markup,
  // fetching its images again behind their placeholders and dropping a
  // selection in it. A message first rendered finished (a restored thread, the
  // panel reopened) takes one parse.
  const [byBlocks, setByBlocks] = useState(streaming);
  if (streaming && !byBlocks) setByBlocks(true);

  // Preprocess once per `content`: every pass scans the whole message, so
  // memoizing keeps that work off the hot path for large messages.
  const processedContent = useMemo(() => prepareMarkdown(content), [content]);

  const onCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedBlock(code);
    setTimeout(() => setCopiedBlock(null), 2000);
  }, []);

  const renderContext = useMemo(
    () => ({ copiedBlock, onCopyCode, onRelativeLinkClick, requestHeaders, t }),
    [copiedBlock, onCopyCode, onRelativeLinkClick, requestHeaders, t],
  );

  return (
    <MarkdownRenderContext.Provider value={renderContext}>
      {byBlocks ? <StreamedMarkdownBody source={processedContent} /> : <MarkdownBody source={processedContent} />}
    </MarkdownRenderContext.Provider>
  );
});

MarkdownMessage.displayName = 'MarkdownMessage';
