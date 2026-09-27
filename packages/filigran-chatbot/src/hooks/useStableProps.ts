import { useCallback, useInsertionEffect, useRef } from 'react';

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (key) => Object.prototype.hasOwnProperty.call(b, key) && Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/**
 * `value`, keeping the previous object while its keys and values are the same.
 *
 * For plain-data props a host builds inline (headers, endpoint paths, page
 * context): a new but equal object on every host render would otherwise break
 * the memoized message rows and re-run every effect keyed on it — refetching
 * agents, prompts, quota and suggestions, and every image fetched with the
 * headers.
 */
export function useShallowStable<T>(value: T): T {
  const ref = useRef(value);
  if (!shallowEqual(ref.current, value)) ref.current = value;
  return ref.current;
}

/**
 * A function with a stable identity that always calls the latest `callback`,
 * or `undefined` while there is none (callers test for presence to decide what
 * to render).
 */
export function useLatestCallback<Args extends unknown[], Result>(
  callback: ((...args: Args) => Result) | undefined,
): ((...args: Args) => Result) | undefined {
  const ref = useRef(callback);
  // Updated before any layout or passive effect runs, so an effect of this
  // render never calls the previous callback.
  useInsertionEffect(() => {
    ref.current = callback;
  });
  const stable = useCallback((...args: Args) => ref.current?.(...args) as Result, []);
  return callback ? stable : undefined;
}
