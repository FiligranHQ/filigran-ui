import type { ParsedAction, ProtocolContext } from './types';

/**
 * AG-UI protocol event types.
 * @see https://github.com/ag-ui-protocol/ag-ui
 */

/**
 * Parse an AG-UI protocol SSE event into a normalized action.
 *
 * AG-UI uses a Start/Content/End lifecycle for messages and tool calls.
 * We map these to the same internal actions used by the other protocols.
 */
export function parseAgUiEvent(evt: Record<string, unknown>, ctx: ProtocolContext): ParsedAction {
  const type = evt.type as string | undefined;

  // --- Run lifecycle ---

  if (type === 'RUN_STARTED') {
    return { action: 'status', status: 'thinking' };
  }

  if (type === 'RUN_FINISHED') {
    return { action: 'done', content: '' };
  }

  if (type === 'RUN_ERROR') {
    return { action: 'error', content: (evt.message as string) || 'Unknown error' };
  }

  // --- Step lifecycle ---

  if (type === 'STEP_STARTED') {
    const stepName = evt.stepName as string | undefined;
    return { action: 'status', status: stepName || 'thinking' };
  }

  if (type === 'STEP_FINISHED') {
    return { action: 'noop' };
  }

  // --- Text message streaming ---

  if (type === 'TEXT_MESSAGE_START') {
    return { action: 'status', status: 'streaming' };
  }

  if (type === 'TEXT_MESSAGE_CONTENT') {
    const delta = evt.delta as string;
    if (delta) {
      return { action: 'stream', content: delta };
    }
    return { action: 'noop' };
  }

  if (type === 'TEXT_MESSAGE_END') {
    return { action: 'noop' };
  }

  // TEXT_MESSAGE_CHUNK is a convenience event that combines Start+Content+End
  if (type === 'TEXT_MESSAGE_CHUNK') {
    const delta = evt.delta as string | undefined;
    if (delta) {
      return { action: 'stream', content: delta };
    }
    return { action: 'noop' };
  }

  // --- Tool call lifecycle ---

  if (type === 'TOOL_CALL_START') {
    ctx.hasUsedTools = true;
    const toolName = evt.toolCallName as string | undefined;
    return { action: 'status', status: 'tool_start', tools: toolName ? [toolName] : [] };
  }

  if (type === 'TOOL_CALL_ARGS') {
    // Tool arguments streaming — no UI equivalent, skip
    return { action: 'noop' };
  }

  if (type === 'TOOL_CALL_END') {
    return { action: 'status', status: 'analyzing' };
  }

  if (type === 'TOOL_CALL_RESULT') {
    // Tool result — no direct UI mapping, skip
    return { action: 'noop' };
  }

  if (type === 'TOOL_CALL_CHUNK') {
    // Convenience form — treat like TOOL_CALL_START if it has a name
    const toolName = evt.toolCallName as string | undefined;
    if (toolName) {
      ctx.hasUsedTools = true;
      return { action: 'status', status: 'tool_start', tools: [toolName] };
    }
    return { action: 'noop' };
  }

  // --- Reasoning / thinking ---

  if (type === 'REASONING_START' || type === 'REASONING_MESSAGE_START') {
    return { action: 'status', status: 'thinking' };
  }

  if (type === 'REASONING_MESSAGE_CONTENT' || type === 'REASONING_MESSAGE_CHUNK') {
    // Reasoning text — show as thinking status (content not surfaced to chat)
    return { action: 'status', status: 'thinking' };
  }

  if (type === 'REASONING_MESSAGE_END' || type === 'REASONING_END' || type === 'REASONING_ENCRYPTED_VALUE') {
    return { action: 'noop' };
  }

  // --- State management ---

  if (type === 'STATE_SNAPSHOT' || type === 'STATE_DELTA' || type === 'MESSAGES_SNAPSHOT') {
    // State sync — not mapped to chat UI currently
    return { action: 'noop' };
  }

  // --- Activity events ---

  if (type === 'ACTIVITY_SNAPSHOT' || type === 'ACTIVITY_DELTA') {
    return { action: 'noop' };
  }

  // --- Pass-through / custom ---

  if (type === 'RAW' || type === 'CUSTOM') {
    return { action: 'noop' };
  }

  return { action: 'noop' };
}
