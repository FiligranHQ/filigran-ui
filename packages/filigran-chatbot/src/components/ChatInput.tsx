import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import type { ChatContextUsage, ChatConversationRef, ChatFile, ChatMode, ChatPromptTemplate, ChatQuotaStatus } from '../types';
import { AttachFileIcon, FileIcon, MicIcon, MicOffIcon, SendIcon, StopCircleIcon } from './icons';
import { useConversationReferenceMenu } from '../hooks/useConversationReferenceMenu';
import { useDictation } from '../hooks/useDictation';
import { referencedConversations } from '../utils/conversationRefs';
import { ContextUsageIndicator } from './ContextUsageIndicator';
import { ConversationReferenceMenu } from './ConversationReferenceMenu';
import { PromptPicker } from './PromptPicker';
import { QuotaIndicator } from './QuotaIndicator';
import { Tooltip } from './Tooltip';

interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
  /**
   * Mid-run steering availability: while the agent is generating, the typed
   * text can be dispatched immediately (Enter / accent Send button) and is
   * injected into the running run instead of waiting for it to finish.
   * Attachments keep the legacy wait behavior.
   */
  canSteer?: boolean;
  attachedFiles?: ChatFile[];
  onFileAdd?: (files: FileList | null) => void;
  onFileRemove?: (index: number) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  t: (key: string) => string;
  mode?: ChatMode;
  separatorColor?: string;
  /** Saved prompt templates; omitted entirely when the host serves none. */
  prompts?: ChatPromptTemplate[] | null;
  /** Agentic quota headroom; omitted entirely when the host serves none. */
  quota?: ChatQuotaStatus | null;
  /** Context-window occupancy; omitted until the backend reports it. */
  contextUsage?: ChatContextUsage | null;
  /** Host-supplied controls appended to the toolbar (see `composerToolbar`). */
  composerToolbar?: React.ReactNode;
  /**
   * The `@` conversation menu (`apiEndpoints.conversationReferences`), absent
   * while the feature is off: `@` is then plain text.
   */
  conversationReferences?: {
    /** `conversationReferencesUrl(...)`. */
    url: string;
    requestHeaders?: Record<string, string>;
    /** The conversation written in: never offered. */
    conversationId?: string | null;
    /** The picks the composer holds (see `useChat`). */
    refs: ChatConversationRef[];
    onPick: (ref: ChatConversationRef) => void;
  };
}

const MAX_TEXTAREA_HEIGHT = 120;
const NO_REFS: ChatConversationRef[] = [];

export const ChatInput = ({
  inputValue,
  onInputChange,
  onSend,
  onStop,
  isLoading,
  canSteer = false,
  attachedFiles = [],
  onFileAdd,
  onFileRemove,
  onPaste,
  t,
  mode,
  separatorColor,
  prompts,
  quota,
  contextUsage,
  composerToolbar,
  conversationReferences,
}: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const referenceMenu = useConversationReferenceMenu({
    url: conversationReferences?.url ?? null,
    requestHeaders: conversationReferences?.requestHeaders,
    conversationId: conversationReferences?.conversationId,
    text: inputValue,
    onTextChange: onInputChange,
    textareaRef,
    refs: conversationReferences?.refs ?? NO_REFS,
    onPick: (ref) => conversationReferences?.onPick(ref),
  });

  // A dictated phrase lands at the end of the draft while the focus is on the
  // mic, so nothing scrolls the field to it once the text outgrows the cap.
  const revealEndRef = useRef(false);

  // Dictation appends each finalised phrase, so speaking continues a draft
  // rather than replacing it — same contract as picking a template.
  const dictation = useDictation((finalText) => {
    revealEndRef.current = true;
    onInputChange(inputValue.trim() ? `${inputValue.trimEnd()} ${finalText}` : finalText);
  });

  // Sized from the value rather than from the textarea's own change event:
  // dictation, template picks, draft restores and the clear after a send all
  // change the text without one.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    if (revealEndRef.current) {
      revealEndRef.current = false;
      el.scrollTop = el.scrollHeight;
    }
  }, [inputValue]);

  // Append rather than replace: a user who has already started typing must not
  // lose it to a template pick. The blank line keeps the two blocks distinct.
  const handlePromptPick = (content: string) => {
    onInputChange(inputValue.trim() ? `${inputValue.trimEnd()}\n\n${content}` : content);
    textareaRef.current?.focus();
  };

  // The toolbar row costs vertical space, so it only exists when something
  // actually occupies it. Dictation is not among them: it acts on the text
  // field, so it lives inside it, next to Send.
  const hasToolbar = Boolean((prompts && prompts.length > 0) || quota || contextUsage || composerToolbar);

  const isFileManagementEnabled = Boolean(onFileAdd && onFileRemove && onPaste);
  const hasContent = inputValue.trim() || (isFileManagementEnabled && attachedFiles.length > 0);
  const hasFilesUploading = isFileManagementEnabled && attachedFiles.some((f) => f.uploadStatus === 'pending');
  const canSend = hasContent && !hasFilesUploading;
  const hasAttachments = isFileManagementEnabled && attachedFiles.length > 0;
  // A steer reaches the running loop as text alone, so the agent would never
  // read a conversation it references: such a message waits, like a file.
  const hasReferences = Boolean(conversationReferences) && referencedConversations(conversationReferences?.refs ?? NO_REFS, inputValue).length > 0;
  // Show the accent Send button NEXT to Stop while generating: text-only
  // sends can steer the running agent. With attachments selected the send
  // must wait for the current response, so only Stop is shown.
  const showSteerSend = isLoading && canSteer && Boolean(inputValue.trim()) && !hasAttachments && !hasReferences;

  // Every way of sending goes through here, and only when the matching button
  // would be enabled: Enter must not send while files upload, nor end a
  // dictation that nothing was sent from. Dictation is cancelled, not stopped:
  // a phrase still being recognised would land in the composer just emptied.
  const send = () => {
    if (!(isLoading ? showSteerSend : canSend)) return;
    dictation.cancel();
    onSend();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // The menu's keys first (arrows, Enter / Tab, Escape) while it is open.
    if (referenceMenu.onKeyDown(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === 'Escape' && isLoading) {
      e.preventDefault();
      onStop();
    }
  };

  const footerText =
    isLoading && canSteer && !hasAttachments && !hasReferences
      ? t('Enter to send now · Esc to stop')
      : isLoading && hasAttachments
        ? t('Attachments wait for the current response')
        : isLoading && hasReferences
          ? t('Referenced conversations wait for the current response')
          : t('Uses AI. Verify results.');

  return (
    <div
      className={`px-4 py-3 border-t border-gray-200 dark:border-white/10 ${mode === 'floating' ? 'rounded-b-xl' : ''}`}
      style={separatorColor ? { borderTopColor: separatorColor, borderTopWidth: 1 } : undefined}
    >
      {isFileManagementEnabled && attachedFiles.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {attachedFiles.map((f, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[0.7rem] ${
                f.uploadStatus === 'error'
                  ? 'border-red-300 dark:border-red-500/30 text-red-500 dark:text-red-400'
                  : f.uploadStatus === 'pending'
                    ? 'border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/40'
                    : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60'
              }`}
            >
              {f.uploadStatus === 'pending' ? (
                <span className="w-3.5 h-3.5 border border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <FileIcon size={14} />
              )}
              {f.name}
              {f.uploadStatus === 'error' && <span className="text-red-400 text-[0.6rem]">✕</span>}
              <button
                type="button"
                onClick={() => onFileRemove?.(i)}
                className="ml-0.5 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* items-end keeps the buttons on the last line once the field grows.
          `relative` anchors the @ menu, which opens above the field. */}
      <div
        className={`relative flex items-end border rounded-xl px-2 py-1 transition-colors ${
          dictation.listening ? 'border-red-500/50' : 'border-gray-200 dark:border-white/10 focus-within:border-[var(--chat-accent)]'
        }`}
      >
        {isFileManagementEnabled && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                onFileAdd?.(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 flex items-center justify-center shrink-0 rounded-lg text-gray-400 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/10 mr-0.5 transition-colors"
            >
              <AttachFileIcon size={18} />
            </button>
          </>
        )}
        <textarea
          ref={textareaRef}
          placeholder={dictation.listening ? t('Listening...') : t('Ask a question...')}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          // The caret moved without the text changing: the @ menu follows it.
          onKeyUp={referenceMenu.sync}
          onClick={referenceMenu.sync}
          onFocus={referenceMenu.sync}
          onBlur={referenceMenu.close}
          {...referenceMenu.textareaAria}
          onPaste={onPaste}
          rows={1}
          className="flex-1 bg-transparent border-none outline-hidden resize-none text-[0.8125rem] py-1.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 filigran-chat-scrollable"
          style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
        />
        <ConversationReferenceMenu
          view={referenceMenu.view}
          activeIndex={referenceMenu.activeIndex}
          listboxId={referenceMenu.listboxId}
          optionId={referenceMenu.optionId}
          onHover={referenceMenu.setActiveIndex}
          onPick={referenceMenu.pick}
          t={t}
        />
        {dictation.supported && (
          <Tooltip title={dictation.listening ? t('Stop dictation') : t('Dictate a message')}>
            <button
              type="button"
              onClick={dictation.toggle}
              aria-label={t('Dictate a message')}
              aria-pressed={dictation.listening}
              className={`relative w-8 h-8 flex items-center justify-center shrink-0 rounded-lg mr-0.5 transition-colors ${
                dictation.listening
                  ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
                  : 'text-gray-400 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              {dictation.listening ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
              {dictation.listening && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 motion-safe:animate-pulse" />}
            </button>
          </Tooltip>
        )}
        {showSteerSend && (
          <Tooltip title={t('Send now')}>
            <button
              type="button"
              onClick={send}
              aria-label={t('Send now')}
              className="p-1.5 rounded-lg w-8 h-8 flex items-center justify-center transition-all duration-150 text-[var(--chat-accent)] bg-[var(--chat-accent)]/10 hover:bg-[var(--chat-accent)]/20"
            >
              <SendIcon size={18} />
            </button>
          </Tooltip>
        )}
        <Tooltip title={isLoading ? t('Stop generating') : hasFilesUploading ? t('Files uploading...') : ''}>
          <button
            type="button"
            onClick={isLoading ? onStop : send}
            disabled={!isLoading && !canSend}
            className={`p-1.5 rounded-lg w-8 h-8 flex items-center justify-center transition-all duration-150 ${
              isLoading
                ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20 ml-0.5'
                : canSend
                  ? 'text-[var(--chat-accent)] bg-[var(--chat-accent)]/10 hover:bg-[var(--chat-accent)]/20'
                  : 'text-gray-300 dark:text-white/20 cursor-not-allowed'
            }`}
          >
            {isLoading ? <StopCircleIcon size={18} /> : <SendIcon size={18} />}
          </button>
        </Tooltip>
      </div>

      {hasToolbar && (
        <div className="flex items-center gap-1.5 mt-1.5 px-0.5">
          {prompts && prompts.length > 0 && <PromptPicker prompts={prompts} onPick={handlePromptPick} t={t} />}
          {composerToolbar}
          {/* Status readouts sit last and pushed right, together: they are not
              controls, so neither should ever land between two clickable
              things. Context before quota — "how full is this chat" is the one
              the user can still act on by starting a new one. */}
          {(contextUsage || quota) && (
            <span className="ml-auto flex items-center gap-2.5">
              {contextUsage && <ContextUsageIndicator usage={contextUsage} t={t} />}
              {quota && <QuotaIndicator quota={quota} t={t} />}
            </span>
          )}
        </div>
      )}

      {/* Words heard but not yet final take the footer's place, so the preview
          never shifts the composer's height. */}
      {dictation.interim ? (
        <p className="flex items-center justify-center gap-1.5 text-[0.65rem] italic text-red-500 dark:text-red-400 mt-1.5">
          <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-red-500 motion-safe:animate-pulse" />
          <span className="truncate">{dictation.interim}</span>
        </p>
      ) : (
        <p className="text-center text-[0.65rem] text-gray-400 dark:text-white/30 mt-1.5 opacity-70">{footerText}</p>
      )}
    </div>
  );
};
