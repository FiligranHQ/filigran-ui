/**
 * What a user's bubble shows of their message, and what its Copy takes.
 *
 * The text without the blank lines around it, its first line's indent and the
 * breaks inside it kept. Trimmed in linear time: a regex `\s+$` backtracks
 * quadratically over padded text.
 *
 * Kept free of local imports so `node --test` runs it as is.
 */
export function userMessageText(content: string): string {
  return content.trimEnd().replace(/^(?:[ \t]*\r?\n)+/, '');
}
