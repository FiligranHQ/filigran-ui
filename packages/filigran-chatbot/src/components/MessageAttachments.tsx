import { useCallback, useRef, useState } from 'react';

import { formatFileSize } from '../utils';
import { ImageLightbox, useImageSrc } from './ChatImage';
import { FileIcon, FileTextIcon, ImageIcon } from './icons';
import { Tooltip } from './Tooltip';

/** What a user's message carries, as its bubble shows it. */
export interface MessageAttachmentItem {
  key: string;
  filename: string;
  /** Short label under the name (`PDF`). */
  type?: string;
  size?: number;
  /** The picture's URL when it is an image the host can serve; absent for any other file. */
  imageUrl?: string;
  /** Opens or downloads the file; absent while it uploads or when the host offers no download. */
  onOpen?: () => void;
}

interface MessageAttachmentsProps {
  items: MessageAttachmentItem[];
  requestHeaders?: Record<string, string>;
  t: (key: string) => string;
}

/** Tiles shown in the one row before the last becomes "+N". */
export const MAX_TILES = 4;

const TEXT_TYPES = new Set(['TXT', 'MD', 'CSV', 'JSON', 'LOG', 'PDF', 'DOC', 'DOCX', 'XML', 'YAML', 'YML', 'HTML']);

/**
 * The files of a user's message, inside its bubble above the text (one
 * message, one bubble, as on the former chat page): pictures as compact
 * thumbnails (one capped at 280 x 240 px with its aspect ratio, several as
 * equal square tiles in one row of four at most, the fourth reading "+N"),
 * other files as chips (type icon, name cut with a tooltip, size). A picture
 * opens the panel's lightbox, which walks the message's pictures with the
 * arrows; a file opens or downloads through the host.
 */
export const MessageAttachments = ({ items, requestHeaders, t }: MessageAttachmentsProps) => {
  const images = items.filter((i) => i.imageUrl);
  const files = items.filter((i) => !i.imageUrl);
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);

  const single = images.length === 1;
  const shown = images.length > MAX_TILES ? images.slice(0, MAX_TILES) : images;
  const hidden = images.length - shown.length + (images.length > MAX_TILES ? 1 : 0);

  return (
    <div data-testid="filigran-chat-message-attachments" className="flex flex-col items-end gap-1.5">
      {images.length > 0 && (
        <div className={single ? 'flex' : 'grid gap-1'} style={single ? undefined : { gridTemplateColumns: `repeat(${shown.length}, 4.5rem)` }}>
          {shown.map((img, i) => (
            <ImageTile
              key={img.key}
              item={img}
              single={single}
              more={i === shown.length - 1 && hidden > 0 ? hidden : 0}
              requestHeaders={requestHeaders}
              onOpen={() => setOpen(i)}
              t={t}
            />
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex max-w-full flex-wrap justify-end gap-1">
          {files.map((f) => (
            <FileChip key={f.key} item={f} t={t} />
          ))}
        </div>
      )}
      {open !== null && images[open] && (
        <AttachmentLightbox
          item={images[open]}
          position={images.length > 1 ? `${open + 1} / ${images.length}` : undefined}
          onPrevious={images.length > 1 ? () => setOpen((open - 1 + images.length) % images.length) : undefined}
          onNext={images.length > 1 ? () => setOpen((open + 1) % images.length) : undefined}
          onClose={close}
          requestHeaders={requestHeaders}
          t={t}
        />
      )}
    </div>
  );
};

interface ImageTileProps {
  item: MessageAttachmentItem;
  single: boolean;
  /** Pictures past this tile: it reads "+N" over its picture. */
  more: number;
  requestHeaders?: Record<string, string>;
  onOpen: () => void;
  t: (key: string) => string;
}

const ImageTile = ({ item, single, more, requestHeaders, onOpen, t }: ImageTileProps) => {
  const fetched = useImageSrc(item.imageUrl ?? null, requestHeaders);
  const [undecodable, setUndecodable] = useState<string | null>(null);
  const failed = fetched.status === 'failed' || (fetched.src !== null && undecodable === fetched.src);
  // The frame holds its size before the bytes arrive: nothing below it moves.
  const frame = single ? 'h-[180px] w-[240px]' : 'size-[4.5rem]';
  const ground = 'chat-radius-sm border border-current/20 bg-current/10';

  if (failed || !fetched.src) {
    return (
      <span className={`${frame} ${ground} inline-flex items-center justify-center`} aria-busy={!failed || undefined}>
        <ImageIcon size={16} className={failed ? 'opacity-60' : 'animate-pulse opacity-60'} />
        <span className="sr-only">{failed ? t('Image could not be loaded') : t('Loading image…')}</span>
      </span>
    );
  }

  return (
    <Tooltip title={item.filename} className="inline-flex">
      <button
        data-ds-exempt="attachment-thumbnail"
        type="button"
        onClick={onOpen}
        className={`group/tile relative overflow-hidden ${ground} cursor-zoom-in outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--chat-accent-50)] ${
          single ? 'inline-flex max-h-[240px] max-w-[280px]' : 'size-[4.5rem]'
        }`}
      >
        <img
          src={fetched.src}
          alt={item.filename}
          loading="lazy"
          decoding="async"
          onError={() => setUndecodable(fetched.src)}
          className={single ? 'block max-h-[240px] max-w-[280px] object-contain' : 'size-full object-cover'}
        />
        {more > 0 && (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">
            +{more}
          </span>
        )}
      </button>
    </Tooltip>
  );
};

const FileChip = ({ item, t }: { item: MessageAttachmentItem; t: (key: string) => string }) => {
  const meta = [item.type, formatFileSize(item.size)].filter(Boolean).join(' · ');
  const icon = item.type && TEXT_TYPES.has(item.type) ? <FileTextIcon size={16} className="shrink-0" /> : <FileIcon size={16} className="shrink-0" />;
  const body = (
    <>
      {icon}
      <span className="flex min-w-0 flex-col text-left">
        <Tooltip title={item.filename} truncated className="inline-flex min-w-0">
          <span className="truncate text-content-compact font-medium">{item.filename}</span>
        </Tooltip>
        {meta && <span className="text-content-compact uppercase opacity-70">{meta}</span>}
      </span>
    </>
  );
  const chip = 'inline-flex max-w-[16rem] min-w-0 items-center gap-2 chat-radius-sm border border-current/20 bg-current/10 px-2 py-1';
  if (!item.onOpen) {
    return <span className={chip}>{body}</span>;
  }
  return (
    <button
      data-ds-exempt="attachment-file-chip"
      type="button"
      onClick={item.onOpen}
      aria-label={`${t('Download')} ${item.filename}`}
      className={`${chip} cursor-pointer outline-none transition-colors hover:bg-current/20 focus-visible:ring-2 focus-visible:ring-[var(--chat-accent-50)]`}
    >
      {body}
    </button>
  );
};

interface AttachmentLightboxProps {
  item: MessageAttachmentItem;
  position?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  requestHeaders?: Record<string, string>;
  t: (key: string) => string;
}

/** The lightbox of a message's pictures, on the picture the reader is on. */
const AttachmentLightbox = ({ item, position, onPrevious, onNext, onClose, requestHeaders, t }: AttachmentLightboxProps) => {
  const fetched = useImageSrc(item.imageUrl ?? null, requestHeaders);
  // Stepping to the next picture keeps the one before on screen until its bytes are in:
  // the dialog never closes and reopens (focus and the scrim stay put).
  const last = useRef<string | null>(null);
  if (fetched.src) last.current = fetched.src;
  const src = fetched.src ?? last.current;
  if (!src) return null;
  return (
    <ImageLightbox
      src={src}
      alt={item.filename}
      onClose={onClose}
      onDownload={item.onOpen}
      onPrevious={onPrevious}
      onNext={onNext}
      position={position}
      t={t}
    />
  );
};
