import { useEffect, useRef, useState } from 'react';
import type { Translate } from '../types';
import type { VoiceCallSnapshot } from '../hooks/voiceCallController';
import { MicIcon, MicOffIcon, PhoneOffIcon, VolumeOffIcon } from './icons';

/** A transcript line longer than this is cut: the thread under the call holds it whole. */
const LINE_MAX_LENGTH = 200;

interface ChatVoiceCallProps {
  call: VoiceCallSnapshot;
  agentName: string;
  logoIcon: React.ReactNode;
  /** The status line of the turn the question waits on. */
  processingLabel: string;
  onInterrupt: () => void;
  onToggleMute: () => void;
  onEnd: () => void;
  t: Translate;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * The voice call, over the panel: who is on the call, what it is doing, what
 * was said, and the mute, end and skip controls. Tapping the call stops the
 * answer being said, or cancels the question awaited.
 */
export const ChatVoiceCall = ({ call, agentName, logoIcon, processingLabel, onInterrupt, onToggleMute, onEnd, t }: ChatVoiceCallProps) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [call.lines.length, call.heard]);

  const { phase, muted } = call;
  const label =
    phase === 'listening'
      ? muted
        ? t('Muted')
        : t('Listening...')
      : phase === 'processing'
        ? processingLabel
        : phase === 'speaking'
          ? t('Speaking…')
          : phase === 'error'
            ? t('Failed to get a response. Resuming…')
            : '';
  const tappable = phase === 'speaking' || phase === 'processing';
  const live = phase === 'speaking' || (phase === 'listening' && !muted);
  const roundButton = 'w-12 h-12 rounded-full flex items-center justify-center border transition-colors disabled:opacity-40';

  return (
    <div
      role="dialog"
      aria-label={t('Voice call')}
      data-testid="filigran-chat-voice-call"
      className="absolute inset-0 z-40 flex flex-col rounded-[inherit] bg-white dark:bg-[#1e1e2e]"
    >
      <div className="flex items-center justify-between px-4 py-3 text-[0.7rem] uppercase tracking-[1px] text-gray-500 dark:text-white/50">
        <span>{t('Voice call')}</span>
        <span className="font-mono normal-case tracking-normal">{formatDuration(seconds)}</span>
      </div>

      <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-1 px-4">
        <button
          type="button"
          onClick={tappable ? onInterrupt : undefined}
          disabled={!tappable}
          aria-label={phase === 'speaking' ? t('Skip response') : phase === 'processing' ? t('Cancel question') : agentName}
          className={`relative mb-4 flex h-28 w-28 items-center justify-center rounded-full border-2 transition-colors ${
            phase === 'error' ? 'border-amber-400/50' : live ? 'border-[var(--chat-accent)]' : 'border-[var(--chat-accent-40)]'
          } ${tappable ? 'cursor-pointer' : 'cursor-default'}`}
        >
          {live && <span className="absolute inset-0 rounded-full border border-[var(--chat-accent-40)] animate-ping" aria-hidden="true" />}
          {phase === 'processing' && (
            <span className="absolute inset-3 rounded-full border-2 border-dashed border-[var(--chat-accent-40)] animate-spin" aria-hidden="true" />
          )}
          <span className="text-[var(--chat-accent)] [&>svg]:w-10 [&>svg]:h-10">{logoIcon}</span>
        </button>
        <h2 className="max-w-full truncate text-base font-semibold text-gray-900 dark:text-white">{agentName}</h2>
        <p aria-live="polite" className="text-center text-[0.8125rem] text-gray-500 dark:text-white/60">
          {label}
        </p>
        {phase === 'speaking' && <p className="text-[0.7rem] text-gray-400 dark:text-white/40">{t('Speak or tap to interrupt')}</p>}
        {phase === 'processing' && <p className="text-[0.7rem] text-gray-400 dark:text-white/40">{t('Tap to cancel')}</p>}
        {phase === 'listening' && call.heard && (
          <p className="mt-3 max-w-md text-center text-[0.8125rem] italic text-gray-500 dark:text-white/50">“{call.heard}”</p>
        )}
      </div>

      {call.lines.length > 0 && (
        <div className="max-h-[35%] overflow-y-auto filigran-chat-scrollable px-4 pb-2">
          <div className="flex flex-col gap-2">
            {call.lines.map((line, i) => (
              <div key={i} className={`flex ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-1.5 text-[0.75rem] leading-5 ${
                    line.role === 'user'
                      ? 'bg-[var(--chat-accent)]/10 text-gray-800 dark:text-white/80'
                      : 'bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-white/70'
                  }`}
                >
                  {line.agent && (
                    <div className="mb-0.5 text-[0.7rem] font-medium text-[var(--chat-accent)]">
                      {line.agent.name}
                      {line.agent.failed && <span className="font-normal text-gray-500 dark:text-white/50"> · {t('Did not answer')}</span>}
                    </div>
                  )}
                  {line.content.length > LINE_MAX_LENGTH ? `${line.content.slice(0, LINE_MAX_LENGTH)}…` : line.content}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-5 px-4 pb-5 pt-3">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? t('Unmute microphone') : t('Mute microphone')}
          aria-pressed={muted}
          className={`${roundButton} ${
            muted
              ? 'border-red-400/40 bg-red-500/10 text-red-500'
              : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
          }`}
        >
          {muted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
        </button>
        <button
          type="button"
          onClick={onEnd}
          aria-label={t('End voice call')}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors"
        >
          <PhoneOffIcon size={22} />
        </button>
        <button
          type="button"
          onClick={onInterrupt}
          disabled={phase !== 'speaking'}
          aria-label={t('Skip response')}
          className={`${roundButton} border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.06]`}
        >
          <VolumeOffIcon size={20} />
        </button>
      </div>
    </div>
  );
};
