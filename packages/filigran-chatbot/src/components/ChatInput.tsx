import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import type { ChatContextUsage, ChatFile, ChatMode, ChatPromptTemplate, ChatQuotaStatus } from '../types';
import { AttachFileIcon, FileIcon, MicIcon, MicOffIcon, SendIcon, StopCircleIcon } from './icons';
import { useDictation } from '../hooks/useDictation';
import { ContextUsageIndicator } from './ContextUsageIndicator';
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
}

const MAX_TEXTAREA_HEIGHT = 120;

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
}: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Dictation appends each finalised phrase, so speaking continues a draft
  // rather than replacing it — same contract as picking a template.
  const dictation = useDictation((finalText) => {
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
  }, [inputValue]);

  // Every way of sending goes through here: leaving the mic live after a send
  // would splice the next words into a composer the user believes they just
  // emptied.
  const send = () => {
    dictation.stop();
    onSend();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === 'Escape' && isLoading) {
      e.preventDefault();
      onStop();
    }
  };

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
  // Show the accent Send button NEXT to Stop while generating: text-only
  // sends can steer the running agent. With attachments selected the send
  // must wait for the current response, so only Stop is shown.
  const showSteerSend = isLoading && canSteer && Boolean(inputValue.trim()) && !hasAttachments;

  const footerText =
    isLoading && canSteer && !hasAttachments
      ? t('Enter to send now · Esc to stop')
      : isLoading && hasAttachments
        ? t('Attachments wait for the current response')
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

      {/* items-end keeps the buttons on the last line once the field grows. */}
      <div
        className={`flex items-end border rounded-xl px-2 py-1 transition-colors ${
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
          onPaste={onPaste}
          rows={1}
          className="flex-1 bg-transparent border-none outline-hidden resize-none text-[0.8125rem] py-1.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 filigran-chat-scrollable"
          style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
        />
        {dictation.supported && (
          <Tooltip title={dictation.listening ? t('Stop dictation') : t('Dictate a message')}>
            <button
              type="button"
              onClick={dictation.toggle}
              aria-label={dictation.listening ? t('Stop dictation') : t('Dictate a message')}
              aria-pressed={dictation.listening}
              className={`relative w-8 h-8 flex items-center justify-center shrink-0 rounded-lg transition-colors ${
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
