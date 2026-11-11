import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon, DownloadIcon, ImageIcon, MaximizeIcon } from './icons';
import { findChatbotRoot } from '../utils';
import { usePanelFetch } from '../hooks/usePanelRequests';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
  /** Offered beside Close when the picture is a file the host can download. */
  onDownload?: () => void;
  t: (key: string) => string;
}

/**
 * Full-panel image viewer. Portalled into the chatbot root (not `document.body`)
 * so it inherits the panel's stacking context and can never be painted under —
 * or over — unrelated host chrome, matching the reasoning-details dialog.
 */
const ImageLightbox = ({ src, alt, onClose, onDownload, t }: ImageLightboxProps) => {
  const hostRef = useRef<HTMLSpanElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(findChatbotRoot(hostRef.current));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      // The overlay is modal: Tab and Shift+Tab cycle its own controls, never the page under the scrim.
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button') ?? [])];
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      const inside = !!active && controls.includes(active as HTMLElement);
      if (!inside || (e.shiftKey && active === first) || (!e.shiftKey && active === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // The overlay is the only interactive surface while open, so focus moves to
  // its close button and returns to the thumbnail on dismiss.
  useEffect(() => {
    if (!root) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus({ preventScroll: true });
    return () => previouslyFocused?.focus({ preventScroll: true });
  }, [root]);

  return (
    <span ref={hostRef} className="hidden">
      {root &&
        createPortal(
          <div
            ref={dialogRef}
            className="absolute inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={alt.trim() || t('Image preview')}
          >
            <div className="absolute top-4 right-4 flex gap-2">
              {onDownload && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload();
                  }}
                  aria-label={t('Download')}
                  className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                >
                  <DownloadIcon size={20} />
                </button>
              )}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label={t('Close')}
                className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              >
                <CloseIcon size={20} />
              </button>
            </div>
            <img src={src} alt={alt} className="max-h-[90%] max-w-[90%] chat-radius-md object-contain" onClick={(e) => e.stopPropagation()} />
          </div>,
          root,
        )}
    </span>
  );
};

/**
 * True for a URL with no scheme — a host-relative path such as
 * `/api/v1/platform/chat/files/<id>/download`. Protocol-relative URLs (`//host`)
 * are excluded: they resolve to a different origin, so the host's auth headers
 * must not be attached to them.
 */
const isRelativeUrl = (src: string): boolean => !src.startsWith('//') && !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(src);

/**
 * What an `<img>` can show of *src*: the URL itself, or, for a host-relative
 * one fetched with *requestHeaders*, an object URL of its bytes (a browser
 * never sends custom headers on an `<img>` request). `null` *src* fetches
 * nothing.
 */
export function useImageSrc(
  src: string | null,
  requestHeaders: Record<string, string> | undefined,
): { src: string | null; status: 'loading' | 'ready' | 'failed' } {
  const needsAuth = !!src && !!requestHeaders && Object.keys(requestHeaders).length > 0 && isRelativeUrl(src);
  // The bytes fetched last and the URL they are of: new headers (a refreshed
  // token) fetch again with the picture still shown, a new URL starts over.
  const [fetched, setFetched] = useState<{ src: string; url: string } | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const panelFetch = usePanelFetch();

  useEffect(() => {
    if (!needsAuth || !src) return;
    let cancelled = false;
    panelFetch(src, { credentials: 'include', headers: { ...requestHeaders } })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) setFetched({ src, url: URL.createObjectURL(blob) });
      })
      .catch(() => {
        if (!cancelled) setFailedSrc(src);
      });
    return () => {
      cancelled = true;
    };
  }, [needsAuth, src, requestHeaders]);
  // Revoked once the next one is on screen, or on unmount: never under an <img> still showing it.
  useEffect(() => {
    if (!fetched) return;
    const { url } = fetched;
    return () => URL.revokeObjectURL(url);
  }, [fetched]);

  if (!src) return { src: null, status: 'failed' };
  if (!needsAuth) return { src, status: 'ready' };
  if (fetched?.src === src) return { src: fetched.url, status: 'ready' };
  if (failedSrc === src) return { src: null, status: 'failed' };
  return { src: null, status: 'loading' };
}

interface ChatImageProps {
  src: string;
  alt: string;
  /**
   * Auth headers the host attaches to chatbot API calls. When present and the
   * image is host-relative, the image is fetched as a blob with these headers
   * instead of being handed to `<img src>` — a browser never sends custom
   * headers on an `<img>` request, so a bearer-authenticated image endpoint
   * would otherwise return 401 and render as a broken image.
   */
  requestHeaders?: Record<string, string>;
  /** Cap the inline thumbnail height. Full size is always available via the lightbox. */
  maxHeightClass?: string;
  /** Downloads the file the picture is, from its lightbox. */
  onDownload?: () => void;
  t: (key: string) => string;
}

/**
 * An image inside a chat message: click (or the hover affordance) opens a
 * full-panel lightbox. Handles the three shapes an agent produces — inline
 * `data:image/*` charts from a code interpreter, host-relative API-served
 * images needing auth headers, and ordinary absolute URLs.
 */
export const ChatImage = ({ src, alt, requestHeaders, maxHeightClass = 'max-h-[400px]', onDownload, t }: ChatImageProps) => {
  const fetched = useImageSrc(src, requestHeaders);
  // The URL whose bytes did not decode; a new one (bytes fetched again) gets its own try.
  const [undecodable, setUndecodable] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const displaySrc = fetched.src;

  if (fetched.status === 'failed' || (displaySrc !== null && undecodable === displaySrc)) {
    return <p className="my-2 text-[0.75rem] italic chat-text-muted-400/40">{t('Image could not be loaded')}</p>;
  }

  if (!displaySrc) {
    return (
      <span className="my-3 inline-flex items-center gap-2 chat-radius-md border chat-border-200/10 px-3 py-2">
        <ImageIcon size={14} className="shrink-0 animate-pulse text-[var(--chat-accent)]" />
        <span className="text-[0.7rem] chat-text-muted-500/40">{t('Loading image…')}</span>
      </span>
    );
  }

  return (
    <>
      <span className="group/img relative my-3 inline-block max-w-full chat-radius-md border chat-border-200/10 p-1 transition-colors hover:border-[var(--chat-accent)]/40">
        <img
          src={displaySrc}
          alt={alt}
          loading="lazy"
          onClick={() => setExpanded(true)}
          onError={() => setUndecodable(displaySrc)}
          className={`max-w-full cursor-zoom-in chat-radius-sm object-contain ${maxHeightClass}`}
        />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={t('Expand image')}
          className="absolute top-2 right-2 chat-radius-sm bg-black/50 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover/img:opacity-100 focus-visible:opacity-100"
        >
          <MaximizeIcon size={14} />
        </button>
      </span>
      {expanded && <ImageLightbox src={displaySrc} alt={alt} onClose={() => setExpanded(false)} onDownload={onDownload} t={t} />}
    </>
  );
};
