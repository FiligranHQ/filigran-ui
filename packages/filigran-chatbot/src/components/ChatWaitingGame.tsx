import { useEffect, useMemo, useRef, useState } from 'react';
import { GamepadIcon } from './icons';

/**
 * Playful, rotating "still working on it" messages shown below the status
 * bubble during longer waits. They double as the Space Invader's targets:
 * the little invader ship erases them letter by letter, then the next one
 * fades in. Kept short and upbeat so they fit on one line in the narrow
 * floating panel and read as a sense of progress rather than noise.
 */
const DEFAULT_MESSAGES = [
  'Crunching the data',
  'Connecting the dots',
  'Consulting the sources',
  'Thinking it through',
  'Reticulating splines',
  'Analyzing the details',
  'Almost there',
  'Putting it together',
  'Polishing the answer',
  'Wrapping things up',
];

/** localStorage key for the per-browser mini-game preference (on by default). */
const PREF_KEY = 'filigranChatMiniGame';

/** Plain (no-game) message rotation cadence. */
const PLAIN_ROTATE_MS = 2600;

/** Canvas height in CSS px — room for the target row + the gliding ship. */
const GAME_HEIGHT = 70;

/** Chunky monospace for the retro arcade feel + even letter spacing. */
const arcadeFont = (px: number): string => `700 ${px}px 'Courier New', ui-monospace, monospace`;

/**
 * Classic 11x8 "crab" invader, two leg frames toggled while it glides — the
 * silhouette reads instantly as a Space Invader. `1` = filled pixel.
 */
const INVADER_FRAMES: string[][] = [
  ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'],
  ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '00111111100', '00100000100', '01000000010'],
];

function readPref(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writePref(on: boolean): void {
  try {
    window.localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* private mode / disabled storage — fall back to in-memory state only */
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

interface Letter {
  char: string;
  x: number;
  w: number;
  alive: boolean;
}

interface Bullet {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/**
 * Self-contained canvas mini-game. Owns its own rAF loop, resize handling and
 * lifecycle; the only thing it reports back is the index of the message it is
 * currently destroying, so the host can keep an accessible text mirror in sync.
 * Returns a teardown function.
 */
function createInvaderGame(canvas: HTMLCanvasElement, messages: string[], onMessage: (index: number) => void): () => void {
  const maybeCtx = canvas.getContext('2d');
  if (!maybeCtx) return () => {};
  const ctx: CanvasRenderingContext2D = maybeCtx;

  let raf = 0;
  let cssW = 0;
  const cssH = GAME_HEIGHT;
  let fontPx = 13;
  let accent = '#7b5cff';

  let msgIndex = 0;
  let letters: Letter[] = [];
  let targetIndex = -1;
  let bullets: Bullet[] = [];
  let particles: Particle[] = [];
  let shipX = 0;
  let cooldown = 0;
  let clearedAt = 0;
  let legFrame = 0;
  let legTimer = 0;
  let last = performance.now();

  const PX = 2;
  const SPRITE_W = 11 * PX;
  const SPRITE_H = 8 * PX;
  const shipTop = cssH - SPRITE_H - 4;
  const letterY = Math.round(cssH * 0.42);

  function resolveAccent(): void {
    const v = getComputedStyle(canvas).getPropertyValue('--chat-accent').trim();
    if (v) accent = v;
  }

  function firstAlive(from: number): number {
    for (let i = from; i < letters.length; i++) {
      if (letters[i].alive) return i;
    }
    return -1;
  }

  function layout(): void {
    if (cssW <= 0) return;
    const text = messages[msgIndex % messages.length] || '';
    onMessage(msgIndex % messages.length);

    // Shrink the font until the message fits the available width.
    fontPx = 13;
    for (; fontPx >= 8; fontPx--) {
      ctx.font = arcadeFont(fontPx);
      if (ctx.measureText(text).width <= cssW - 16) break;
    }
    ctx.font = arcadeFont(fontPx);

    const widths = Array.from(text).map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = (cssW - total) / 2;
    letters = Array.from(text).map((ch, i) => {
      const lx = x;
      x += widths[i];
      return { char: ch, x: lx, w: widths[i], alive: ch.trim().length > 0 };
    });
    targetIndex = firstAlive(0);
    bullets = [];
    particles = [];
    cooldown = 0;
    clearedAt = 0;
    if (shipX <= 0) shipX = cssW / 2;
  }

  function letterCenter(i: number): number {
    return letters[i].x + letters[i].w / 2;
  }

  function update(dt: number): void {
    const dtf = Math.min(dt / 16.6667, 3);

    legTimer += dt;
    if (legTimer > 320) {
      legTimer = 0;
      legFrame ^= 1;
    }

    if (targetIndex === -1) {
      // Message fully cleared — brief pause, then load the next one.
      if (clearedAt === 0) clearedAt = performance.now();
      else if (performance.now() - clearedAt > 650) {
        msgIndex++;
        layout();
      }
    } else {
      const targetX = letterCenter(targetIndex);
      shipX += (targetX - shipX) * Math.min(0.16 * dtf, 1);
      cooldown -= dt;
      if (bullets.length === 0 && cooldown <= 0 && Math.abs(shipX - targetX) < 4) {
        bullets.push({ x: shipX, y: shipTop });
        cooldown = 130;
      }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y -= 2.6 * dtf;
      if (bullets[i].y <= letterY) {
        // Hit: detonate the current target letter and advance.
        if (targetIndex !== -1) {
          const cx = letterCenter(targetIndex);
          letters[targetIndex].alive = false;
          for (let p = 0; p < 7; p++) {
            const ang = (Math.PI * 2 * p) / 7 + Math.random();
            const spd = 0.6 + Math.random() * 1.4;
            particles.push({ x: cx, y: letterY, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1 });
          }
          targetIndex = firstAlive(targetIndex + 1);
        }
        bullets.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dtf;
      p.y += p.vy * dtf;
      p.life -= 0.045 * dtf;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function withAlpha(a: number): string {
    return `color-mix(in srgb, ${accent} ${Math.round(a * 100)}%, transparent)`;
  }

  function draw(): void {
    ctx.clearRect(0, 0, cssW, cssH);

    ctx.font = arcadeFont(fontPx);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = withAlpha(0.85);
    for (const l of letters) {
      if (l.alive) ctx.fillText(l.char, l.x, letterY);
    }

    ctx.fillStyle = accent;
    for (const b of bullets) {
      ctx.fillRect(b.x - 1, b.y, 2, 7);
    }

    for (const p of particles) {
      ctx.fillStyle = withAlpha(Math.max(p.life, 0) * 0.9);
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }

    const frame = INVADER_FRAMES[legFrame];
    const ox = Math.round(shipX - SPRITE_W / 2);
    ctx.fillStyle = accent;
    for (let r = 0; r < frame.length; r++) {
      const row = frame[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '1') ctx.fillRect(ox + c * PX, shipTop + r * PX, PX, PX);
      }
    }
  }

  function loop(now: number): void {
    const dt = now - last;
    last = now;
    if (!document.hidden && cssW > 0) {
      update(dt);
      draw();
    }
    raf = requestAnimationFrame(loop);
  }

  function applySize(): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cssW = rect.width;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resolveAccent();
    layout();
  }

  const ro = new ResizeObserver(applySize);
  ro.observe(canvas);
  applySize();
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

interface ChatWaitingGameProps {
  t: (key: string) => string;
  /** Host-level override; when false the feature is hidden entirely. */
  enabled?: boolean;
}

/**
 * Waiting experience shown below the status bubble during longer waits:
 * dynamic rotating messages with an optional Space Invader mini-game that
 * shoots the message letters away one by one. The game can be toggled off
 * per browser (preference persisted in localStorage); when off — or when the
 * OS requests reduced motion — the messages simply rotate as plain dimmed
 * text, so the "dynamic loading messages" feedback always stands on its own.
 */
export const ChatWaitingGame = ({ t, enabled = true }: ChatWaitingGameProps) => {
  const messages = useMemo(() => DEFAULT_MESSAGES.map((m) => t(m)), [t]);
  const reducedMotion = usePrefersReducedMotion();
  const [minigameOn, setMinigameOn] = useState(readPref);
  const [msgIndex, setMsgIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const playMode = enabled && minigameOn && !reducedMotion;

  // Plain-text rotation when the game is off / reduced motion.
  useEffect(() => {
    if (playMode) return;
    const id = window.setInterval(() => setMsgIndex((i) => (i + 1) % messages.length), PLAIN_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [playMode, messages.length]);

  // Canvas engine when the game is on.
  useEffect(() => {
    if (!playMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    return createInvaderGame(canvas, messages, setMsgIndex);
  }, [playMode, messages]);

  if (!enabled) return null;

  const current = messages[msgIndex % messages.length];

  return (
    <div className="ml-11 mt-2.5 max-w-[78%]" role="status" aria-live="polite">
      <span className="sr-only">{current}</span>
      <div className="relative overflow-hidden rounded-md bg-[var(--chat-accent)]/[0.03]" style={{ animation: 'chat-fade-in 0.5s ease-out' }}>
        {playMode ? (
          <canvas ref={canvasRef} aria-hidden className="block w-full" style={{ height: GAME_HEIGHT }} />
        ) : (
          <div className="flex items-center" style={{ height: GAME_HEIGHT }}>
            <span key={current} className="px-3 text-xs text-gray-500 dark:text-white/45" style={{ animation: 'chat-fade-in 0.4s ease-out' }}>
              {current}
              <span className="ml-0.5 inline-block w-1 h-3 align-middle bg-[var(--chat-accent)]/60 animate-pulse" />
            </span>
          </div>
        )}
        {!reducedMotion && (
          <button
            type="button"
            onClick={() => {
              const next = !minigameOn;
              setMinigameOn(next);
              writePref(next);
            }}
            aria-label={minigameOn ? t('Turn off the waiting mini-game') : t('Turn on the waiting mini-game')}
            title={minigameOn ? t('Turn off the waiting mini-game') : t('Turn on the waiting mini-game')}
            className={`absolute top-1 right-1 rounded p-1 transition-opacity ${
              minigameOn ? 'text-[var(--chat-accent)] opacity-50 hover:opacity-100' : 'text-gray-400 dark:text-white/40 opacity-40 hover:opacity-90'
            }`}
          >
            <GamepadIcon size={13} />
          </button>
        )}
      </div>
    </div>
  );
};
