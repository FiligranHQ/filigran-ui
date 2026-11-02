import type { ChatFile } from '../types';

/**
 * Whether *files* hold one that failed to upload. Such a message is not sent,
 * whether a turn runs or not, until the user removes that file: sent without
 * it, the agent would answer as if it had read it.
 */
export const hasFailedUpload = (files: readonly ChatFile[]): boolean => files.some((f) => f.uploadStatus === 'error');
