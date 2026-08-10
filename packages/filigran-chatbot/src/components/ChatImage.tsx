import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon, ImageIcon, MaximizeIcon } from './icons';
import { findChatbotRoot } from '../utils';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
  t: (key: string) => string;
}

/**
 * Full-panel image viewer. Portalled into the chatbot root (not `document.body`)
 * so it inherits the panel's stacking context and can never be painted under —
 * or over — unrelated host chrome, matching the reasoning-details dialog.
 */
const ImageLightbox = ({ src, alt, onClose, t }: ImageLightboxProps) => {
  const hostRef = useRef<HTMLSpanElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(findChatbotRoot(hostRef.current));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
            className="absolute inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={t('Image preview')}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={t('Close')}
              className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            >
              <CloseIcon size={20} />
            </button>
            <img src={src} alt={alt} className="max-h-[90%] max-w-[90%] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
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
  t: (key: string) => string;
}

/**
 * An image inside a chat message: click (or the hover affordance) opens a
 * full-panel lightbox. Handles the three shapes an agent produces — inline
 * `data:image/*` charts from a code interpreter, host-relative API-served
 * images needing auth headers, and ordinary absolute URLs.
 */
export const ChatImage = ({ src, alt, requestHeaders, maxHeightClass = 'max-h-[400px]', t }: ChatImageProps) => {
  const needsAuth = !!requestHeaders && Object.keys(requestHeaders).length > 0 && isRelativeUrl(src);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!needsAuth) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    fetch(src, { credentials: 'include', headers: { ...requestHeaders } })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });

    return () => {
      cancelled = true;
      // Revoking on teardown (rather than on unmount only) keeps a src change
      // from leaking the previous blob.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [needsAuth, src, requestHeaders]);

  const displaySrc = needsAuth ? blobUrl : src;

  if (errored) {
    return <p className="my-2 text-[0.75rem] italic text-gray-400 dark:text-white/40">{t('Image could not be loaded')}</p>;
  }

  if (!displaySrc) {
    return (
      <span className="my-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10">
        <ImageIcon size={14} className="shrink-0 animate-pulse text-[var(--chat-accent)]" />
        <span className="text-[0.7rem] text-gray-500 dark:text-white/40">{t('Loading image…')}</span>
      </span>
    );
  }

  return (
    <>
      <span className="group/img relative my-3 inline-block max-w-full rounded-lg border border-gray-200 p-1 transition-colors hover:border-[var(--chat-accent)]/40 dark:border-white/10">
        <img
          src={displaySrc}
          alt={alt}
          loading="lazy"
          onClick={() => setExpanded(true)}
          onError={() => setErrored(true)}
          className={`max-w-full cursor-zoom-in rounded-md object-contain ${maxHeightClass}`}
        />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={t('Expand image')}
          className="absolute top-2 right-2 rounded-md bg-black/50 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover/img:opacity-100"
        >
          <MaximizeIcon size={14} />
        </button>
      </span>
      {expanded && <ImageLightbox src={displaySrc} alt={alt} onClose={() => setExpanded(false)} t={t} />}
    </>
  );
};
