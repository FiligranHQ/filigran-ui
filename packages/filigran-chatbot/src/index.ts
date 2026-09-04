import './assets/index.css';

export { ChatPanel, ChatToggleButton } from './components';
export type {
  ChatMode,
  BackendType,
  ChatPanelProps,
  ChatToggleButtonProps,
  ChatMessage,
  ChatAttachment,
  ChatContextBreakdown,
  ChatContextUsage,
  ChatConversationSummary,
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

// The markdown normalisation helpers are NOT re-exported here on purpose: they
// live at `@filigran/chatbot/markdown`, a React-free entry point, so a host can
// share them without risking the whole panel landing in an eager chunk.
