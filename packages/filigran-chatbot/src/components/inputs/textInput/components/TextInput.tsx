import { ShortTextInput } from './ShortTextInput';
import { isMobile } from '@/utils/isMobileSignal';
import { createEffect, createSignal, onMount, Show } from 'solid-js';
import { SendButton } from '@/components/buttons/SendButton';
import { UploadsConfig } from '@/components/Bot';
import { RecordAudioButton } from '@/components/buttons/RecordAudioButton';
import { ChatInputHistory } from '@/utils/chatInputHistory';

type TextInputProps = {
  placeholder?: string;
  backgroundColor?: string;
  textColor?: string;
  sendButtonColor?: string;
  inputValue: string;
  fontSize?: number;
  disabled?: boolean;
  onSubmit: (value: string) => void;
  onInputChange: (value: string) => void;
  uploadsConfig?: Partial<UploadsConfig>;
  onMicrophoneClicked: () => void;
  maxChars?: number;
  maxCharsWarningMessage?: string;
  autoFocus?: boolean;
  sendMessageSound?: boolean;
  sendSoundLocation?: string;
  fullFileUploadAllowedTypes?: string;
  enableInputHistory?: boolean;
  maxHistorySize?: number;
};

const defaultBackgroundColor = '#ffffff';
const defaultTextColor = '#303235';

export const TextInput = (props: TextInputProps) => {
  const [isSendButtonDisabled, setIsSendButtonDisabled] = createSignal(false);
  const [warningMessage, setWarningMessage] = createSignal('');
  const [inputHistory] = createSignal(new ChatInputHistory(() => props.maxHistorySize || 10));
  let inputRef: HTMLInputElement | HTMLTextAreaElement | undefined;
  let audioRef: HTMLAudioElement | undefined;

  const handleInput = (inputValue: string) => {
    const wordCount = inputValue.length;

    if (props.maxChars && wordCount > props.maxChars) {
      setWarningMessage(props.maxCharsWarningMessage ?? `You exceeded the characters limit. Please input less than ${props.maxChars} characters.`);
      setIsSendButtonDisabled(true);
      return;
    }

    props.onInputChange(inputValue);
    setWarningMessage('');
    setIsSendButtonDisabled(false);
  };

  const checkIfInputIsValid = () => warningMessage() === '' && inputRef?.reportValidity();

  const submit = () => {
    if (checkIfInputIsValid()) {
      if (props.enableInputHistory) {
        inputHistory().addToHistory(props.inputValue);
      }
      props.onSubmit(props.inputValue);
      if (props.sendMessageSound && audioRef) {
        audioRef.play();
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const isIMEComposition = e.isComposing || e.keyCode === 229;
      if (!isIMEComposition) {
        e.preventDefault();
        submit();
      }
    } else if (props.enableInputHistory) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const previousInput = inputHistory().getPreviousInput(props.inputValue);
        props.onInputChange(previousInput);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextInput = inputHistory().getNextInput();
        props.onInputChange(nextInput);
      }
    }
  };

  createEffect(() => {
    const shouldAutoFocus = props.autoFocus !== undefined ? props.autoFocus : !isMobile() && window.innerWidth > 640;

    if (!props.disabled && shouldAutoFocus && inputRef) inputRef.focus();
  });

  onMount(() => {
    const shouldAutoFocus = props.autoFocus !== undefined ? props.autoFocus : !isMobile() && window.innerWidth > 640;

    if (!props.disabled && shouldAutoFocus && inputRef) inputRef.focus();

    if (props.sendMessageSound && props.sendSoundLocation) {
      audioRef = new Audio(props.sendSoundLocation);
    }
  });

  return (
    <div
      class="w-full h-auto max-h-[192px] min-h-[56px] flex flex-col items-end justify-between chatbot-input border border-[#eeeeee]"
      data-testid="input"
      style={{
        margin: 'auto',
        'background-color': props.backgroundColor ?? defaultBackgroundColor,
        color: props.textColor ?? defaultTextColor,
      }}
      onKeyDown={handleKeyDown}
    >
      <Show when={warningMessage() !== ''}>
        <div class="w-full px-4 pt-4 pb-1 text-red-500 text-sm whitespace-break-spaces" data-testid="warning-message">
          {warningMessage()}
        </div>
      </Show>
      <div class="w-full flex items-end justify-between">
        <ShortTextInput
          ref={inputRef as HTMLTextAreaElement}
          onInput={handleInput}
          value={props.inputValue}
          fontSize={props.fontSize}
          disabled={props.disabled}
          placeholder={props.placeholder ?? 'Type your question'}
        />
        {props.uploadsConfig?.isSpeechToTextEnabled ? (
          <RecordAudioButton
            buttonColor={props.sendButtonColor}
            type="button"
            class="m-0 start-recording-button h-14 flex items-center justify-center"
            isDisabled={props.disabled || isSendButtonDisabled()}
            on:click={props.onMicrophoneClicked}
          >
            <span style={{ 'font-family': 'Poppins, sans-serif' }}>Record Audio</span>
          </RecordAudioButton>
        ) : null}
        <SendButton
          sendButtonColor={props.sendButtonColor}
          type="button"
          isDisabled={props.disabled || isSendButtonDisabled()}
          class="m-0 h-14 flex items-center justify-center"
          on:click={submit}
        >
          <span style={{ 'font-family': 'Poppins, sans-serif' }}>Send</span>
        </SendButton>
      </div>
    </div>
  );
};
