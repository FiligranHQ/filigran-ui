import { useEffect, useState } from 'react';
import type { ChatArtifact, ChatArtifactKind, Translate } from '../types';
import { artifactDownloadLabel, artifactFacts, artifactKindLabel, artifactLink, isRenderInProgress, translate, videoRenderLabel } from '../utils';
import { pollInTurn } from '../utils/polling';
import { ClapperboardIcon, DownloadIcon, ExternalLinkIcon, FileTextIcon, PresentationIcon } from './icons';
import { Spinner } from './Spinner';

/** How often a card asks again about a video that is still rendering, and for how long. */
const REFRESH_INTERVAL_MS = 10_000;
const REFRESH_FOR_MS = 15 * 60_000;

const KIND_ICONS: Record<ChatArtifactKind, typeof PresentationIcon> = {
  presentation: PresentationIcon,
  report: FileTextIcon,
  video: ClapperboardIcon,
};

const ACTION =
  'inline-flex items-center gap-1 rounded-md border chat-border px-2 py-1 text-[0.7rem] chat-text-secondary-700-70 transition-colors hover:border-[var(--chat-accent)] hover:text-[var(--chat-accent)] disabled:opacity-50 disabled:cursor-default outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent-50)]';

interface ArtifactCardProps {
  artifact: ChatArtifact;
  t: Translate;
  /** Downloads it in a format through the host's proxy; no download buttons without it. */
  onDownload?: (artifact: ChatArtifact, format: string) => Promise<void>;
  /** Describes it again; a video still rendering is followed with it. */
  onRefresh?: (kind: ChatArtifactKind, id: string) => Promise<ChatArtifact | undefined>;
  /** Opens it in the host itself, in place of the link to XTM One. */
  onOpen?: (artifact: ChatArtifact) => void;
}

/**
 * A deck, report or video an answer made: what it is, `Open in XTM One`, and
 * its downloads when the host proxies them. The panel cannot draw the deck or
 * play the film itself; XTM One's page does.
 */
export const ArtifactCard = ({ artifact, t, onDownload, onRefresh, onOpen }: ArtifactCardProps) => {
  const [current, setCurrent] = useState(artifact);
  const [busyFormat, setBusyFormat] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => setCurrent(artifact), [artifact]);

  const following = !!onRefresh && !gaveUp && isRenderInProgress(current);
  useEffect(() => {
    if (!following || !onRefresh) return undefined;
    let cancelled = false;
    const stop = pollInTurn(
      () =>
        onRefresh(current.kind, current.id).then((fresh) => {
          if (!cancelled && fresh) setCurrent(fresh);
        }),
      { intervalMs: REFRESH_INTERVAL_MS, forMs: REFRESH_FOR_MS, onGiveUp: () => setGaveUp(true) },
    );
    return () => {
      cancelled = true;
      stop();
    };
  }, [following, onRefresh, current.kind, current.id]);

  const Icon = KIND_ICONS[current.kind];
  const kindLabel = artifactKindLabel(current.kind, t);
  const title = current.title || kindLabel;
  const facts = artifactFacts(current, t);
  const renderLabel = videoRenderLabel(current, t);
  const link = onOpen ? null : artifactLink(current);
  const downloads = onDownload ? current.downloads : [];

  const download = async (format: string) => {
    if (!onDownload) return;
    setBusyFormat(format);
    try {
      await onDownload(current, format);
    } finally {
      setBusyFormat(null);
    }
  };

  return (
    <div
      role="group"
      aria-label={`${kindLabel}: ${title}`}
      className="flex flex-col gap-2 w-full max-w-[90%] rounded-lg border chat-border chat-surface-subtle px-3 py-2.5"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="shrink-0 mt-0.5 text-[var(--chat-accent)]">
          <Icon size={18} />
        </span>
        <span className="flex flex-col min-w-0 flex-1 gap-0.5">
          <span className="truncate text-[0.8125rem] font-medium chat-text">{title}</span>
          {facts && <span className="text-[0.7rem] chat-text-secondary">{facts}</span>}
          {renderLabel && (
            <span className="flex items-center gap-1.5 text-[0.7rem] chat-text-secondary" aria-live="polite">
              {following && <Spinner size={10} />}
              {renderLabel}
            </span>
          )}
        </span>
      </div>
      {(link || onOpen || downloads.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 pl-[28px]">
          {onOpen && (
            <button type="button" className={ACTION} onClick={() => onOpen(current)}>
              {t('Open')}
            </button>
          )}
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className={ACTION}>
              {t('Open in XTM One')}
              <ExternalLinkIcon size={12} />
            </a>
          )}
          {downloads.map((format) => {
            const label = artifactDownloadLabel(format, t);
            return (
              <button
                key={format}
                type="button"
                className={ACTION}
                disabled={busyFormat !== null}
                aria-label={translate(t, 'Download {format}', { format: label })}
                onClick={() => void download(format)}
              >
                {busyFormat === format ? <Spinner size={11} /> : <DownloadIcon size={12} />}
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
