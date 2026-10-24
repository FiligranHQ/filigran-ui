/** A host callback's answer; one that throws is reported and answers nothing, never breaking the turn. */
export function askHost<A extends unknown[], R>(callback: ((...args: A) => R) | undefined, ...args: A): R | undefined {
  if (!callback) return undefined;
  try {
    return callback(...args);
  } catch (err) {
    console.error('A chat panel host callback threw', err);
    return undefined;
  }
}
