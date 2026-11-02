import type { ChatFile, ChatFileRefusal, Translate } from '../types';
import { formatSizeLimit, translate } from './index';

/** The composer's limits on what it attaches to one message. */
export interface AttachmentLimits {
  maxFileCount: number;
  maxTotalSize: number;
  /** `Infinity`: no limit of its own, only the total. */
  maxFileSize: number;
  /** In the file input's `accept` form; empty takes any type. */
  accept?: string;
}

/**
 * The MIME types of extensions some browsers leave untyped (Chrome on Windows
 * for `.md`, `.yaml`), so a MIME token can still judge such a file.
 */
// A Map: an extension such as `constructor` must find nothing, not an inherited property.
const UNTYPED_EXTENSION_TYPES: ReadonlyMap<string, readonly string[]> = new Map([
  ['md', ['text/markdown']],
  ['markdown', ['text/markdown']],
  ['yaml', ['application/yaml', 'application/x-yaml', 'text/yaml']],
  ['yml', ['application/yaml', 'application/x-yaml', 'text/yaml']],
  ['csv', ['text/csv']],
  ['tsv', ['text/tab-separated-values']],
  ['txt', ['text/plain']],
  ['log', ['text/plain']],
  ['json', ['application/json']],
]);

/**
 * Whether *file* is of a type *accept* names, read as the file input reads it:
 * `.ext` by the name, `type/*` and `type/subtype` by the MIME type. A file the
 * browser left untyped is judged by the type its extension stands for (see
 * `UNTYPED_EXTENSION_TYPES`), and refused when it stands for none.
 */
export function acceptsFile(accept: string | undefined, file: { name: string; type: string }): boolean {
  const tokens = (accept ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  if (tokens.some((token) => token.startsWith('.') && name.endsWith(token))) return true;
  const dot = name.lastIndexOf('.');
  const types = file.type ? [file.type.toLowerCase()] : dot >= 0 ? (UNTYPED_EXTENSION_TYPES.get(name.slice(dot + 1)) ?? []) : [];
  return tokens.some(
    (token) => !token.startsWith('.') && types.some((type) => (token.endsWith('/*') ? type.startsWith(token.slice(0, -1)) : type === token)),
  );
}

/**
 * Which of *incoming* join *attached* within *limits*, in order, and why each
 * other one does not. A file too large for the room left does not keep a
 * smaller one after it out.
 */
export function admitFiles<F extends { name: string; type: string; size: number }>(
  attached: readonly ChatFile[],
  incoming: readonly F[],
  limits: AttachmentLimits,
): { accepted: F[]; refused: { file: F; reason: ChatFileRefusal }[] } {
  const accepted: F[] = [];
  const refused: { file: F; reason: ChatFileRefusal }[] = [];
  let count = attached.length;
  let sizeLeft = limits.maxTotalSize - attached.reduce((sum, f) => sum + f.size, 0);
  for (const file of incoming) {
    const reason: ChatFileRefusal | null = !acceptsFile(limits.accept, file)
      ? 'file-type'
      : file.size > limits.maxFileSize
        ? 'file-size'
        : count >= limits.maxFileCount
          ? 'file-count'
          : file.size > sizeLeft
            ? 'total-size'
            : null;
    if (reason) {
      refused.push({ file, reason });
      continue;
    }
    accepted.push(file);
    count += 1;
    sizeLeft -= file.size;
  }
  return { accepted, refused };
}

/** What the composer tells the user of a file it refused, naming it. */
export function refusalMessage(t: Translate, name: string, reason: ChatFileRefusal, limits: AttachmentLimits): string {
  switch (reason) {
    case 'file-type':
      return translate(t, '{name} was not attached: this type of file is not accepted.', { name });
    case 'file-size':
      return translate(t, '{name} was not attached: a file may be at most {size}.', { name, size: formatSizeLimit(limits.maxFileSize) });
    case 'file-count':
      return translate(t, '{name} was not attached: a message holds at most {count} files.', { name, count: limits.maxFileCount });
    case 'total-size':
      return translate(t, '{name} was not attached: the files of a message may add up to at most {size}.', {
        name,
        size: formatSizeLimit(limits.maxTotalSize),
      });
  }
}
