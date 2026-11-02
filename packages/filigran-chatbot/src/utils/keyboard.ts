import type { KeyboardEvent } from 'react';

/**
 * Whether an input method (Chinese, Japanese, Korean) is composing a word:
 * Enter then confirms the word and Escape cancels it, so neither is the
 * field's. Some browsers report only keyCode 229 meanwhile.
 */
export const isComposing = (e: KeyboardEvent): boolean => e.nativeEvent.isComposing || e.keyCode === 229;
