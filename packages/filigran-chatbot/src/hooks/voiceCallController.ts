import type { SpeechRecognitionLike } from './dictationController';
import {
  answerTranscriptLines,
  classifyVoiceFrame,
  isBargeIn,
  newPendingAnswer,
  type PendingVoiceAnswer,
  type TurnProbe,
  type VoiceAgentReply,
  type VoiceFrame,
  type VoiceTranscriptLine,
} from './voiceTurn';

/**
 * - `listening`: the microphone is open; one second of silence after a phrase sends it.
 * - `processing`: the question is out, its answer awaited.
 * - `speaking`: the answer is read out; speech over it (barge-in) takes the turn back.
 * - `error`: the question got no answer; listening resumes shortly.
 * - `unsupported`: the browser has no speech recognition.
 * - `ended`: the call is over.
 */
export type VoiceCallPhase = 'listening' | 'processing' | 'speaking' | 'error' | 'unsupported' | 'ended';

/** One line of the call's transcript: what the user said, or an answer. */
export interface VoiceCallLine extends VoiceTranscriptLine {
  role: 'user' | 'assistant';
}

export interface VoiceCallSnapshot {
  phase: VoiceCallPhase;
  muted: boolean;
  /** What is being said, not sent yet. */
  heard: string;
  lines: VoiceCallLine[];
}

/** What became of a question sent (see `ChatSendOutcome`). */
export type VoiceSendOutcome = 'sent' | 'steered' | 'held' | 'dropped' | 'failed';

export interface VoiceCallDeps {
  /** The browser's recogniser; `null` without one. */
  recognition: SpeechRecognitionLike | null;
  lang?: string;
  /**
   * Send a question as the user. `onAccepted` once the backend takes it as a
   * new turn (or the held message goes out); `onSteered` with the turn it
   * joined (`null`: none, it waits for the next one).
   */
  send: (text: string, hooks: { onAccepted: () => void; onSteered: (turnId: string | null) => void }) => Promise<VoiceSendOutcome>;
  /** Say *text* aloud; resolves once said, or as soon as *signal* aborts. */
  speak: (text: string, signal: AbortSignal) => Promise<void>;
  /** The words to say of an answer's markdown. */
  speakable: (text: string) => string;
  /** The text of an answer as the panel shows it (the host's transform). */
  present: (text: string) => string;
  /** Whether the turn the question waits on still runs. */
  probe: () => Promise<TurnProbe>;
  /** Stop the running turn: the user cancelled the question. */
  stopTurn: () => void;
  /** The agent a question addresses, read as it is sent. */
  addressedAgentId: () => string | null;
  onChange: (snapshot: VoiceCallSnapshot) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

/** Silence after a phrase that sends it. */
export const VOICE_SILENCE_MS = 1000;
/** How long the answering turn may send nothing before the call asks whether it still runs. */
export const VOICE_ANSWER_IDLE_MS = 120_000;
/** How long a question that got no answer says so before listening resumes. */
export const VOICE_RETRY_MS = 2000;
/** Pause before reopening a recogniser that failed, and how many failures in a row mute it. */
const RECOGNITION_RETRY_MS = 300;
const RECOGNITION_MAX_FAILURES = 5;

export interface VoiceCallController {
  start: () => void;
  end: () => void;
  /** A frame of the message stream (`relayed: false`) or the event stream (`relayed: true`). */
  frame: (frame: Record<string, unknown>, relayed: boolean) => void;
  /** Tap on the call: stops the answer being said, or cancels the question awaited (stopping its turn). */
  interrupt: () => void;
  /** The turn was stopped from outside the call: drop the question, stop speaking, listen. */
  cancel: () => void;
  toggleMute: () => void;
  readonly snapshot: VoiceCallSnapshot;
}

/**
 * One voice call: listen, send after a second of silence, wait for the answer
 * of the turn that answers the question (`classifyVoiceFrame`), say it, listen
 * again. The panel sends and streams; the call only reads the frames it is
 * handed.
 */
export function createVoiceCall(deps: VoiceCallDeps): VoiceCallController {
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => window.setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((id: unknown) => window.clearTimeout(id as number));
  const recognition = deps.recognition;

  let phase: VoiceCallPhase = 'listening';
  let muted = false;
  let heard = '';
  let lines: VoiceCallLine[] = [];
  // Final phrases of the question being said.
  let said = '';
  // The question awaited: its answer, whether its frames count yet, its number.
  let pending: PendingVoiceAnswer | null = null;
  let armed = false;
  let question = 0;
  let speech: AbortController | null = null;
  let speaking = '';
  let silenceTimer: unknown = null;
  let idleTimer: unknown = null;
  let retryTimer: unknown = null;
  let restartTimer: unknown = null;
  let recognitionRunning = false;
  let recognitionFailures = 0;

  const snapshot = (): VoiceCallSnapshot => ({ phase, muted, heard, lines });
  const emit = () => deps.onChange(snapshot());
  const clear = (id: unknown) => {
    if (id !== null) clearTimer(id);
    return null;
  };

  const wantsRecognition = () => !!recognition && !muted && (phase === 'listening' || phase === 'speaking');

  const syncRecognition = () => {
    if (!recognition) return;
    if (wantsRecognition()) {
      if (recognitionRunning || restartTimer !== null) return;
      try {
        recognition.start();
        recognitionRunning = true;
      } catch {
        // Still ending its previous session: `onend` starts it again.
      }
    } else if (recognitionRunning) {
      try {
        recognition.stop();
      } catch {
        // Already ending.
      }
    }
  };

  const setPhase = (next: VoiceCallPhase) => {
    phase = next;
    syncRecognition();
    emit();
  };

  const stopSpeaking = () => {
    speech?.abort();
    speech = null;
    speaking = '';
  };

  const listen = () => {
    silenceTimer = clear(silenceTimer);
    retryTimer = clear(retryTimer);
    said = '';
    heard = '';
    setPhase('listening');
  };

  const settle = () => {
    idleTimer = clear(idleTimer);
    pending = null;
    armed = false;
  };

  const fail = () => {
    settle();
    setPhase('error');
    retryTimer = setTimer(() => {
      retryTimer = null;
      if (phase === 'error') listen();
    }, VOICE_RETRY_MS);
  };

  const armIdleCheck = () => {
    idleTimer = clear(idleTimer);
    const awaited = pending;
    idleTimer = setTimer(() => {
      idleTimer = null;
      // Silent for a long while: a turn still running (a long tool call) keeps
      // the wait, and so does a check that could not read it; one that is over
      // without an answer frame ends it.
      void deps.probe().then((probe) => {
        if (pending !== awaited || !awaited) return;
        if (probe === 'over') fail();
        else armIdleCheck();
      });
    }, VOICE_ANSWER_IDLE_MS);
  };

  const answer = (text: string, others: VoiceAgentReply[]) => {
    settle();
    const shown = deps.present(text);
    const answered = answerTranscriptLines({ text: shown, others: others.map((o) => ({ ...o, text: deps.present(o.text) })) });
    lines = [...lines, ...answered.map((line) => ({ role: 'assistant' as const, ...line }))];
    const words = shown.trim() ? deps.speakable(shown) : '';
    if (!words.trim()) {
      // The addressed agent said nothing to read out.
      listen();
      return;
    }
    const current = new AbortController();
    speech = current;
    speaking = words;
    heard = '';
    said = '';
    setPhase('speaking');
    void deps
      .speak(words, current.signal)
      .catch(() => undefined)
      .then(() => {
        if (speech !== current) return;
        speech = null;
        speaking = '';
        if (phase === 'speaking') listen();
      });
  };

  const handleFrame = (frame: VoiceFrame) => {
    if (!pending || !armed) return;
    const verdict = classifyVoiceFrame(pending, frame);
    if (verdict.kind === 'ignore') return;
    if (verdict.kind === 'answer') answer(verdict.text, verdict.others);
    else if (verdict.kind === 'failed') fail();
    else armIdleCheck();
  };

  const ask = (text: string) => {
    const asked = ++question;
    silenceTimer = clear(silenceTimer);
    said = '';
    heard = '';
    lines = [...lines, { role: 'user', content: text }];
    pending = newPendingAnswer(deps.addressedAgentId());
    // The frames of a turn running before this question went out are not its answer.
    armed = false;
    setPhase('processing');
    armIdleCheck();
    const current = () => asked === question && pending !== null;
    deps
      .send(text, {
        onAccepted: () => {
          if (current()) armed = true;
        },
        onSteered: (turnId) => {
          if (!current()) return;
          armed = true;
          handleFrame(
            turnId ? { type: 'folded_into_active_turn', folded: true, turn_id: turnId } : { type: 'folded_into_active_turn', folded: false },
          );
        },
      })
      .then(
        (outcome) => {
          if (current() && (outcome === 'dropped' || outcome === 'failed')) fail();
        },
        () => {
          if (current()) fail();
        },
      );
  };

  const cancelQuestion = () => {
    question += 1;
    settle();
  };

  if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = true;
    if (deps.lang) recognition.lang = deps.lang;
    recognition.onresult = (event) => {
      recognitionFailures = 0;
      if (muted || (phase !== 'listening' && phase !== 'speaking')) return;
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (phase === 'speaking') {
        // The call's own voice comes back through the microphone; the user
        // talking over it takes the turn back.
        if (!isBargeIn(`${finalText} ${interim}`, speaking)) return;
        stopSpeaking();
        said = '';
        phase = 'listening';
      }
      if (finalText.trim()) said = [said, finalText.trim()].filter(Boolean).join(' ');
      heard = [said, interim.trim()].filter(Boolean).join(' ');
      silenceTimer = clear(silenceTimer);
      if (said) {
        silenceTimer = setTimer(() => {
          silenceTimer = null;
          if (phase === 'listening' && !muted && said.trim()) ask(said.trim());
        }, VOICE_SILENCE_MS);
      }
      emit();
    };
    recognition.onerror = () => {
      recognitionFailures += 1;
    };
    recognition.onend = () => {
      recognitionRunning = false;
      if (!wantsRecognition()) return;
      if (recognitionFailures >= RECOGNITION_MAX_FAILURES) {
        // No microphone, or permission refused: muted rather than retried in a
        // loop; unmuting tries again.
        recognitionFailures = 0;
        muted = true;
        emit();
        return;
      }
      if (recognitionFailures === 0) {
        syncRecognition();
        return;
      }
      restartTimer = setTimer(() => {
        restartTimer = null;
        syncRecognition();
      }, RECOGNITION_RETRY_MS);
    };
  }

  return {
    start: () => {
      if (!recognition) {
        phase = 'unsupported';
        emit();
        return;
      }
      listen();
    },
    end: () => {
      if (phase === 'ended') return;
      cancelQuestion();
      stopSpeaking();
      silenceTimer = clear(silenceTimer);
      retryTimer = clear(retryTimer);
      restartTimer = clear(restartTimer);
      phase = 'ended';
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        if (recognitionRunning) {
          try {
            recognition.abort();
          } catch {
            // Already ended.
          }
        }
        recognitionRunning = false;
      }
      emit();
    },
    frame: (frame, relayed) => handleFrame({ ...frame, relayed: relayed || frame.relayed === true }),
    interrupt: () => {
      if (phase === 'speaking') {
        stopSpeaking();
        listen();
      } else if (phase === 'processing') {
        cancelQuestion();
        deps.stopTurn();
        listen();
      }
    },
    cancel: () => {
      if (phase !== 'processing' && phase !== 'speaking') return;
      cancelQuestion();
      stopSpeaking();
      listen();
    },
    toggleMute: () => {
      if (phase === 'ended' || phase === 'unsupported') return;
      muted = !muted;
      recognitionFailures = 0;
      if (muted) {
        silenceTimer = clear(silenceTimer);
        said = '';
        heard = '';
      } else if (phase === 'speaking') {
        // Unmuting is a way to take the turn back too.
        stopSpeaking();
        listen();
        return;
      }
      syncRecognition();
      emit();
    },
    get snapshot() {
      return snapshot();
    },
  };
}
