import './assets/index.css';

export { ChatPanel, ChatToggleButton } from './components';
export type {
  ChatMode,
  ChatPanelMode,
  ChatPanelHandle,
  ChatSendOptions,
  ChatSendDraft,
  ChatSendDecision,
  ChatSendOutcome,
  ChatHeldOutcome,
  ChatStreamEventInfo,
  ChatMarkerContext,
  ChatMarkerRenderer,
  ChatCodeBlockContext,
  ChatCodeBlockRenderer,
  AgentStatusState,
  BackendType,
  ChatPanelProps,
  ChatToggleButtonProps,
  ChatMessage,
  ChatMessagePersistedFeedback,
  ChatAnsweredBy,
  ChatAttachment,
  ChatArtifact,
  ChatArtifactKind,
  ChatContextBreakdown,
  ChatContextUsage,
  ChatConversationRef,
  ChatConversationReferenceCandidate,
  ChatConversationSummary,
  ChatWorkspace,
  ChatFile,
  ChatPromptTemplate,
  ChatQuotaStatus,
  MessageFeedback,
  ToolApprovalDecision,
  ToolApprovalProposal,
  ToolApprovalVerdict,
  Translate,
  XtmAgent,
  ApiEndpoints,
} from './types';
export type { TransferredAgent } from './hooks/useChat';
export { voiceCallSupported } from './hooks/useVoiceCall';

// The markdown normalisation helpers are NOT re-exported here on purpose: they
// live at `@filigran/chatbot/markdown`, a React-free entry point, so a host can
// share them without risking the whole panel landing in an eager chunk.
