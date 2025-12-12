import { TypingBubble } from '@/components';

const defaultBackgroundColor = '#f7f8ff';
const defaultTextColor = '#303235';
const defaultFontSize = 16;

export const LoadingBubble = (props: { backgroundColor?: string; textColor?: string; fontSize?: number }) => (
  <div
    class="flex justify-start mb-2 items-start animate-fade-in host-container"
    style={{
      'background-color': props.backgroundColor ?? defaultBackgroundColor,
      color: props.textColor ?? defaultTextColor,
      'font-size': props.fontSize ? `${props.fontSize}px` : `${defaultFontSize}px`,
    }}
  >
    <span
      class="px-4 py-4 ml-2 whitespace-pre-wrap max-w-full chatbot-host-bubble"
      data-testid="host-bubble"
      style={{
        'background-color': props.backgroundColor ?? defaultBackgroundColor,
        color: props.textColor ?? defaultTextColor,
        'font-size': props.fontSize ? `${props.fontSize}px` : `${defaultFontSize}px`,
      }}
    >
      <TypingBubble textColor={props.textColor ?? defaultTextColor} />
    </span>
  </div>
);
