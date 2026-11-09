import { createContext, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { ChatAttachment, Translate } from '../types';
import { translate } from '../utils';
import { useImageSrc } from './ChatImage';
import { ChevronDownIcon, ImageIcon } from './icons';

/** One file of the collapsed list: its card, and for a picture where its thumbnail comes from. */
export interface WorkingFile {
  key: string;
  card: ReactNode;
  isImage: boolean;
  /** The picture's URL; none shows the picture icon. */
  imageUrl?: string;
  /** The reply wrote the file again after it ({@link supersededInReply}). */
  superseded?: boolean;
}

/** What makes two files versions of one another: the same name and kind (MIME type without its parameters, else the type label). */
const versionKey = (file: ChatAttachment) =>
  `${file.filename.trim()}\n${(file.contentType || file.type || '').split(';')[0].trim().toLowerCase()}`;

/**
 * The files of a reply that it wrote again afterwards, by id: drafts. A file
 * is superseded when the last file of its name and kind is another file; the
 * same file listed twice (re-sent on a resume, say) is never its own draft.
 */
export function supersededInReply(files: readonly ChatAttachment[]): Set<string> {
  const last = new Map<string, string>();
  for (const file of files) last.set(versionKey(file), file.fileId);
  return new Set(files.filter((file) => last.get(versionKey(file)) !== file.fileId).map((file) => file.fileId));
}

/** Called once the list has opened: the thread keeps the view where it is if the list pushed its end out of view. */
export const KeepViewContext = createContext<() => void>(() => undefined);

/** From this many files, the opened list repeats its toggle at its end. */
const FOOTER_TOGGLE_AT = 8;

const TOGGLE =
  'inline-flex items-center gap-1 rounded-md text-[0.7rem] chat-text-muted-400/40 transition-colors hover:text-[var(--chat-accent)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent-50)]';

/**
 * A picture's thumbnail, in one fixed box whatever the picture's shape or
 * state, so every card after it starts at the same place. Decorative: the
 * card beside it names the file. The picture icon stands in when there is
 * nothing to show: no URL, a failed fetch, or bytes the browser cannot decode
 * (never its broken-image glyph).
 */
function WorkingFileThumbnail({ url, requestHeaders }: { url?: string; requestHeaders?: Record<string, string> }) {
  const { src, status } = useImageSrc(url ?? null, requestHeaders);
  // The URL whose bytes did not decode; a new one gets its own try.
  const [undecodable, setUndecodable] = useState<string | null>(null);
  const showPicture = status === 'ready' && src !== null && undecodable !== src;
  return (
    <span className="flex h-12 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border chat-border-200/10">
      {showPicture ? (
        <img src={src} alt="" loading="lazy" onError={() => setUndecodable(src)} className="h-full w-full object-contain" />
      ) : status === 'loading' ? (
        <span className="h-full w-full animate-pulse chat-surface-subtle-50/4" />
      ) : (
        <ImageIcon size={16} className="chat-text-muted-400/40" />
      )}
    </span>
  );
}

/**
 * Files a reply carries but does not name, behind one collapsed line: opened,
 * each is listed with its card, after its thumbnail for a picture.
 */
export function WorkingFiles({ files, requestHeaders, t }: { files: WorkingFile[]; requestHeaders?: Record<string, string>; t: Translate }) {
  const [open, setOpen] = useState(false);
  // Thumbnails are fetched on the first opening and kept mounted after it, so
  // closing and reopening the list neither refetches nor reflows them.
  const [opened, setOpened] = useState(false);
  const listId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const keepView = useContext(KeepViewContext);
  // Before the thread hears the list grew, which would take it to its end.
  useLayoutEffect(() => {
    if (open) keepView();
  }, [open, keepView]);

  return (
    <div className="pl-1">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen(!open);
          setOpened(true);
        }}
        className={TOGGLE}
      >
        <ChevronDownIcon size={13} className={`transition-transform${open ? ' rotate-180' : ''}`} />
        {translate(t, 'Working files ({count})', { count: files.length })}
      </button>
      <ul id={listId} hidden={!open} className="mt-1.5 flex flex-col gap-1.5">
        {files.map((file) => (
          <li key={file.key} className="flex items-center gap-1.5">
            {opened && file.isImage && <WorkingFileThumbnail url={file.imageUrl} requestHeaders={requestHeaders} />}
            {file.card}
            {file.superseded && <span className="shrink-0 text-[0.7rem] chat-text-muted-400/40">{t('Superseded')}</span>}
          </li>
        ))}
      </ul>
      {open && files.length >= FOOTER_TOGGLE_AT && (
        <button
          type="button"
          aria-controls={listId}
          onClick={() => {
            setOpen(false);
            toggleRef.current?.focus({ preventScroll: true });
            toggleRef.current?.scrollIntoView({ block: 'nearest' });
          }}
          className={`mt-1.5 ${TOGGLE}`}
        >
          <ChevronDownIcon size={13} className="rotate-180" />
          {t('Show less')}
        </button>
      )}
    </div>
  );
}
