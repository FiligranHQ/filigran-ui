import { createContext, memo, useCallback, useContext, useMemo, useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { CheckIcon, CopyIcon } from './icons';
import { ChatImage } from './ChatImage';
import { HostRenderBoundary, HostRenderFallback } from './HostRenderBoundary';
import type { ChatCodeBlockRenderer } from '../types';
import { identity, markdownUrlTransform, prepareMarkdown } from '../utils';
import { MarkdownBlockSplitter } from '../utils/markdownBlocks';
import { isRelativeHref, toInternalHref } from '../utils/pageActions';

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
  /** The host's renderers for fenced code blocks, by lower-cased language. */
  codeBlockRenderers?: Record<string, ChatCodeBlockRenderer>;
  t?: (key: string) => string;
}

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
  codeBlockRenderers?: Record<string, ChatCodeBlockRenderer>;
  streaming: boolean;
  t: (key: string) => string;
}

const MarkdownRenderContext = createContext<MarkdownRenderContextValue>({
  copiedBlock: null,
  onCopyCode: () => undefined,
  streaming: false,
  t: identity,
});

/** A host's code block, called inside its boundary; nothing drawn keeps the block as code. */
function HostCodeBlock({ draw, block }: { draw: () => React.ReactNode; block: React.ReactNode }) {
  const node = draw();
  return node === null || node === undefined || node === false ? <>{block}</> : <div className="my-3">{node}</div>;
}

const MarkdownCode = ({ className, children }: { className?: string; children?: React.ReactNode }) => {
  const { copiedBlock, onCopyCode, codeBlockRenderers, streaming, t } = useContext(MarkdownRenderContext);
  // The whole info string's first word: `vega-lite`, `c++`, `objective-c`.
  const match = /(?:^|\s)language-(\S+)/.exec(className || '');
  const codeStr = String(children).replace(/\n$/, '');
  const hostRenderer = match ? codeBlockRenderers?.[match[1].toLowerCase()] : undefined;
  // A fence with no info string (```\n…\n```) carries no `language-*`
  // class. Falling back to the multi-line test keeps it a block instead
  // of collapsing it into a single run of inline code.
  if (match || codeStr.includes('\n')) {
    const block = (
      <div className="my-3 rounded-lg border chat-border-200/10 overflow-hidden chat-code-block">
        <div className="flex items-center justify-between px-3 py-1.5 border-b chat-border-200/10 chat-surface-subtle-100/3">
          <span className="text-[0.7rem] chat-text-muted-500/40 font-mono">{match?.[1] ?? 'plaintext'}</span>
          <button
            type="button"
            onClick={() => onCopyCode(codeStr)}
            aria-label={copiedBlock === codeStr ? t('Copied') : t('Copy code')}
            className="p-0.5 rounded-sm hover:chat-surface-hover-200/10 transition-colors"
          >
            {copiedBlock === codeStr ? <CheckIcon size={14} className="text-green-500" /> : <CopyIcon size={14} className="chat-text-muted-400/40" />}
          </button>
        </div>
        <pre className="m-0 px-3 py-2 overflow-x-auto">
          <code className="chat-code leading-[1.7] chat-text-800/90 whitespace-pre">{codeStr}</code>
        </pre>
      </div>
    );
    if (!hostRenderer) return block;
    return (
      <HostRenderBoundary label="A chat code block renderer" resetKey={`${codeStr}\u0000${streaming}`} fallback={<HostRenderFallback t={t} />}>
        <HostCodeBlock draw={() => hostRenderer(codeStr, { streaming })} block={block} />
      </HostRenderBoundary>
    );
  }
  return <code className="chat-code-inline chat-code px-1.5 py-0.5 rounded-sm text-[var(--chat-accent)]">{children}</code>;
};

const MarkdownLink = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
  const { onRelativeLinkClick } = useContext(MarkdownRenderContext);
  const internalHref = toInternalHref(href);
  const routeInternally = internalHref !== null && !!onRelativeLinkClick;
  // A new tab unless the link was authored relative AND stays on this origin:
  // the second half keeps `/\host` (which resolves off-site) out of this tab.
  const openInNewTab = !routeInternally && !(isRelativeHref(href) && internalHref !== null);
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
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-7 break-words chat-answer-text">{children}</p>,
  // A fenced block renders as `<pre><code>`; the `code` override below
  // returns a `<div>` wrapper, which is not valid inside `<pre>`. Passing
  // the children straight through keeps the markup well-formed.
  pre: ({ children }) => <>{children}</>,
  code: MarkdownCode,
  // `list-disc` / `list-decimal` are required, not decorative: the
  // package's scoped preflight resets `list-style` inside the panel, so
  // without them every list renders as unmarked, indented prose.
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 chat-answer-text [&_li]:mb-1 marker:text-[var(--chat-accent)]/50">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 chat-answer-text [&_li]:mb-1 marker:text-[var(--chat-accent)]/50">{children}</ol>,
  li: ({ children }) => <li className="leading-7 break-words">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold chat-text-900/100">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-4 chat-border-200/10" />,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-[var(--chat-accent)]/30 bg-[var(--chat-accent)]/[0.03] pl-4 pr-3 py-2 rounded-r-md italic chat-text-secondary-500/60">
      {children}
    </blockquote>
  ),
  a: MarkdownLink,
  img: MarkdownImage,
  h1: ({ children }) => <h1 className="mt-4 first:mt-0 mb-2 font-bold chat-answer-heading-1 chat-text-900/100">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-3 first:mt-0 mb-2 font-bold chat-answer-heading-2 chat-text-900/100">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-3 first:mt-0 mb-1.5 font-semibold chat-answer-heading-3 chat-text-900/100">{children}</h3>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border chat-border-200/10">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  tr: ({ children }) => <tr className="transition-colors hover:chat-surface-hover-50/2">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold chat-surface-subtle-50/4 border-b chat-border-200/10 chat-text-900/100">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 border-b chat-border-200/10 chat-text-secondary-700/80">{children}</td>,
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
export const MarkdownMessage = memo(({ codeBlockRenderers, ...props }: MarkdownMessageProps) => {
  const { content, streaming = false, onRelativeLinkClick, requestHeaders, t = identity } = props;
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
    () => ({ copiedBlock, onCopyCode, onRelativeLinkClick, requestHeaders, codeBlockRenderers, streaming, t }),
    [copiedBlock, onCopyCode, onRelativeLinkClick, requestHeaders, codeBlockRenderers, streaming, t],
  );

  return (
    <MarkdownRenderContext.Provider value={renderContext}>
      {byBlocks ? <StreamedMarkdownBody source={processedContent} /> : <MarkdownBody source={processedContent} />}
    </MarkdownRenderContext.Provider>
  );
});

MarkdownMessage.displayName = 'MarkdownMessage';
