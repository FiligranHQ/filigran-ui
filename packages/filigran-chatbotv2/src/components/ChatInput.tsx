import { useRef, type KeyboardEvent } from 'react';
import type { ChatFile, ChatMode } from '../types';
import { AttachFileIcon, FileIcon, SendIcon, StopCircleIcon } from './icons';
import { Tooltip } from './Tooltip';

interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
  attachedFiles: ChatFile[];
  onFileAdd: (files: FileList | null) => void;
  onFileRemove: (index: number) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  t: (key: string) => string;
  mode?: ChatMode;
}

export const ChatInput = ({ inputValue, onInputChange, onSend, onStop, isLoading, attachedFiles, onFileAdd, onFileRemove, onPaste, t, mode }: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const hasContent = inputValue.trim() || attachedFiles.length > 0;

  return (
    <div className={`px-4 py-3 border-t border-gray-200 dark:border-white/10 ${mode === 'floating' ? 'rounded-b-xl' : ''}`}>
      {attachedFiles.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {attachedFiles.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 text-[0.7rem] text-gray-600 dark:text-white/60"
            >
              <FileIcon size={14} />
              {f.name}
              <button
                type="button"
                onClick={() => onFileRemove(i)}
                className="ml-0.5 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1 transition-colors focus-within:border-[var(--chat-accent)]">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            onFileAdd(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1 rounded-lg text-gray-400 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/10 mr-1 transition-colors"
        >
          <AttachFileIcon size={18} />
        </button>
        <textarea
          ref={textareaRef}
          placeholder={t('Ask a question...')}
          value={inputValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none text-[0.8125rem] py-1.5 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30"
          style={{ maxHeight: 120 }}
        />
        <Tooltip title={isLoading ? t('Stop generating') : ''}>
          <button
            type="button"
            onClick={isLoading ? onStop : onSend}
            disabled={!isLoading && !hasContent}
            className={`p-1.5 rounded-lg w-8 h-8 flex items-center justify-center transition-all duration-150 ${
              isLoading
                ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
                : hasContent
                  ? 'text-[var(--chat-accent)] bg-[var(--chat-accent)]/10 hover:bg-[var(--chat-accent)]/20'
                  : 'text-gray-300 dark:text-white/20 cursor-not-allowed'
            }`}
          >
            {isLoading ? <StopCircleIcon size={18} /> : <SendIcon size={18} />}
          </button>
        </Tooltip>
      </div>

      <p className="text-center text-[0.65rem] text-gray-400 dark:text-white/30 mt-1.5 opacity-70">{t('Uses AI. Verify results.')}</p>
    </div>
  );
};
