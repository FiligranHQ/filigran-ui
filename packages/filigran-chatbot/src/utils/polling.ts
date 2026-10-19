/**
 * Calls *ask* every *intervalMs*, one call at a time: the next one waits for
 * the last to settle, so a slow answer can never land after a newer one. A
 * call that fails is followed by the next as usual. After *forMs* it stops for
 * good and calls *onGiveUp*, even with a call still unanswered; the returned
 * function stops it earlier.
 */
export function pollInTurn(
  ask: () => Promise<unknown>,
  { intervalMs, forMs, onGiveUp }: { intervalMs: number; forMs: number; onGiveUp?: () => void },
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const next = () => {
    timer = setTimeout(() => {
      ask()
        .catch(() => undefined)
        .finally(() => {
          if (!stopped) next();
        });
    }, intervalMs);
  };
  const deadline = setTimeout(() => {
    stopped = true;
    clearTimeout(timer);
    onGiveUp?.();
  }, forMs);
  next();
  return () => {
    stopped = true;
    clearTimeout(timer);
    clearTimeout(deadline);
  };
}
