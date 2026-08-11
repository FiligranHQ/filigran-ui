import { useRef, type KeyboardEvent } from 'react';
import type { ChatFile, ChatMode, ChatPromptTemplate, ChatQuotaStatus } from '../types';
import { AttachFileIcon, FileIcon, MicIcon, MicOffIcon, SendIcon, StopCircleIcon } from './icons';
import { useDictation } from '../hooks/useDictation';
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
  /** Host-supplied controls appended to the toolbar (see `composerToolbar`). */
  composerToolbar?: React.ReactNode;
}

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
  composerToolbar,
}: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Leaving the mic live after a send would splice the next words into a
      // composer the user believes they just emptied.
      dictation.stop();
      onSend();
    }
    if (e.key === 'Escape' && isLoading) {
      e.preventDefault();
      onStop();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  // Append rather than replace: a user who has already started typing must not
  // lose it to a template pick. The blank line keeps the two blocks distinct.
  const handlePromptPick = (content: string) => {
    onInputChange(inputValue.trim() ? `${inputValue.trimEnd()}\n\n${content}` : content);
    textareaRef.current?.focus();
  };

  // Dictation appends each finalised phrase, so speaking continues a draft
  // rather than replacing it — same contract as picking a template.
  const dictation = useDictation((finalText) => {
    onInputChange(inputValue.trim() ? `${inputValue.trimEnd()} ${finalText}` : finalText);
  });

  // The toolbar row costs vertical space, so it only exists when something
  // actually occupies it.
  const hasToolbar = Boolean((prompts && prompts.length > 0) || quota || composerToolbar || dictation.supported);

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

      <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1 transition-colors focus-within:border-[var(--chat-accent)]">
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
          placeholder={t('Ask a question...')}
          value={inputValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          rows={1}
          className="flex-1 bg-transparent border-none outline-hidden resize-none text-[0.8125rem] py-1.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 filigran-chat-scrollable"
          style={{ maxHeight: 120 }}
        />
        {showSteerSend && (
          <Tooltip title={t('Send now')}>
            <button
              type="button"
              onClick={onSend}
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
            onClick={isLoading ? onStop : onSend}
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
          {dictation.supported && (
            <Tooltip title={dictation.listening ? t('Stop dictation') : t('Dictate a message')}>
              <button
                type="button"
                onClick={dictation.toggle}
                aria-label={dictation.listening ? t('Stop dictation') : t('Dictate a message')}
                aria-pressed={dictation.listening}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                  dictation.listening
                    ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
                    : 'text-gray-400 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/10'
                }`}
              >
                {dictation.listening ? <MicOffIcon size={15} /> : <MicIcon size={15} />}
              </button>
            </Tooltip>
          )}
          {dictation.interim && (
            <span className="text-[0.7rem] italic text-gray-400 dark:text-white/30 truncate max-w-[45%]">{dictation.interim}</span>
          )}
          {composerToolbar}
          {/* Quota sits last and pushed right: it is a status readout, not a
              control, so it should never sit between two clickable things. */}
          {quota && <span className="ml-auto">{<QuotaIndicator quota={quota} t={t} />}</span>}
        </div>
      )}

      <p className="text-center text-[0.65rem] text-gray-400 dark:text-white/30 mt-1.5 opacity-70">{footerText}</p>
    </div>
  );
};
