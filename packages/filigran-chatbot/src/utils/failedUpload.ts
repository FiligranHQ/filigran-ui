import type { ChatFile } from '../types';

/**
 * Whether *files* hold one that failed to upload. Such a message can neither
 * steer a turn nor wait for one: while a turn holds the conversation (running,
 * winding down, let go of while the page was hidden) it cannot be sent, and
 * once none does it goes without that file.
 */
export const hasFailedUpload = (files: readonly ChatFile[]): boolean => files.some((f) => f.uploadStatus === 'error');
