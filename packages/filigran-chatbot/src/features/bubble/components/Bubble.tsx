import { createEffect, createSignal, onCleanup, Show, splitProps } from 'solid-js';
import styles from '../../../assets/index.css';
import { BubbleParams } from '../types';
import { Bot, BotProps } from '../../../components/Bot';
import Tooltip from './Tooltip';
import { getBubbleButtonSize } from '@/utils';

const defaultButtonColor = '#3B81F6';
const defaultIconColor = 'white';

export type BubbleProps = BotProps & BubbleParams & {
  open?: boolean;
  onClose?: () => void;
};

export const Bubble = (props: BubbleProps) => {
  const [bubbleProps] = splitProps(props, ['theme', 'open', 'onClose']);

  const [isBotOpened, setIsBotOpened] = createSignal(false);
  const [isBotStarted, setIsBotStarted] = createSignal(false);
  const [full, setFull] = createSignal(false);
  const [buttonPosition, setButtonPosition] = createSignal({
    left: bubbleProps.theme?.button?.left ?? 20,
  });

  createEffect(() => {
    setIsBotOpened(!!props.open);
    if (props.open && !isBotStarted()) {
      setIsBotStarted(true);
    }
  });

  const openBot = () => {
    if (!isBotStarted()) setIsBotStarted(true);
    setIsBotOpened(true);
  };

  const closeBot = () => {
    if (typeof props.onClose === 'function') {
      props.onClose();
    }
    setIsBotOpened(false);
  };

  let ref;
  const toggleBot = () => {
    setButtonPosition({ left: props.left + 24 });
    isBotOpened() ? closeBot() : openBot();
  };

  onCleanup(() => {
    setIsBotStarted(false);
  });

  const buttonSize = getBubbleButtonSize(props.theme?.button?.size); // Default to 48px if size is not provided

  // Add viewport meta tag dynamically
  createEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, interactive-widget=resizes-content';
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  });

  const showTooltip = bubbleProps.theme?.tooltip?.showTooltip ?? false;

  return (
    <>
      <Show when={props.theme?.customCSS}>
        <style>{props.theme?.customCSS}</style>
      </Show>
      <style>{styles}</style>
      <Tooltip
        showTooltip={showTooltip && !isBotOpened()}
        position={buttonPosition()}
        buttonSize={buttonSize}
        tooltipMessage={bubbleProps.theme?.tooltip?.tooltipMessage}
        tooltipBackgroundColor={bubbleProps.theme?.tooltip?.tooltipBackgroundColor}
        tooltipTextColor={bubbleProps.theme?.tooltip?.tooltipTextColor}
        tooltipFontSize={bubbleProps.theme?.tooltip?.tooltipFontSize} // Set the tooltip font size
      />
      <div ref={ref} id="bot-button" class="inline-flex" onMouseDown={toggleBot}>
        {(() => props.text)()}
      </div>
      <div
        part="bot"
        style={{
          height: bubbleProps.theme?.chatWindow?.height ? `${bubbleProps.theme?.chatWindow?.height.toString()}px` : 'calc(100% - 150px)',
          width: bubbleProps.theme?.chatWindow?.width ? `${bubbleProps.theme?.chatWindow?.width.toString()}px` : undefined,
          transition: 'transform 200ms cubic-bezier(0, 1.2, 1, 1), opacity 150ms ease-out',
          'transform-origin': 'bottom left',
          transform: isBotOpened() ? 'scale3d(1, 1, 1)' : 'scale3d(0, 0, 1)',
          'box-shadow': bubbleProps.theme?.chatWindow?.boxShadow ?? 'rgb(0 0 0 / 16%) 0px 5px 40px',
          'background-color': bubbleProps.theme?.chatWindow?.backgroundColor || '#ffffff',
          'background-image': bubbleProps.theme?.chatWindow?.backgroundImage ? `url(${bubbleProps.theme?.chatWindow?.backgroundImage})` : 'none',
          'background-size': 'cover',
          'background-position': 'center',
          'background-repeat': 'no-repeat',
          'z-index': 42424242,
          bottom: '28px',
          left: `${props.left + 24}px`,
          'user-select': 'text',
          'pointer-events': isBotOpened() ? 'auto' : 'none',
          'cursor': 'default',
        }}
        class={
          `fixed sm:right-5 rounded-lg w-full ${!full() ? 'sm:w-[400px]' : 'sm:w-[80%]'} ${!full() ? 'max-h-[704px]' : 'max-h-[80%]'}` +
          (isBotOpened() ? ' opacity-1' : ' opacity-0')
        }
      >
        <Show when={isBotStarted()}>
          <div class="relative h-full">
            <Bot
              expanded={full()}
              onExpand={() => setFull(!full())}
              backgroundColor={bubbleProps.theme?.chatWindow?.backgroundColor}
              formBackgroundColor={bubbleProps.theme?.form?.backgroundColor}
              formTextColor={bubbleProps.theme?.form?.textColor}
              badgeBackgroundColor={bubbleProps.theme?.chatWindow?.backgroundColor}
              bubbleBackgroundColor={bubbleProps.theme?.button?.backgroundColor ?? defaultButtonColor}
              bubbleTextColor={bubbleProps.theme?.button?.iconColor ?? defaultIconColor}
              showTitle={bubbleProps.theme?.chatWindow?.showTitle}
              showAgentMessages={bubbleProps.theme?.chatWindow?.showAgentMessages}
              title={bubbleProps.theme?.chatWindow?.title}
              titleAvatarSrc={bubbleProps.theme?.chatWindow?.titleAvatarSrc}
              titleTextColor={bubbleProps.theme?.chatWindow?.titleTextColor}
              titleBackgroundColor={bubbleProps.theme?.chatWindow?.titleBackgroundColor}
              welcomeMessage={bubbleProps.theme?.chatWindow?.welcomeMessage}
              errorMessage={bubbleProps.theme?.chatWindow?.errorMessage}
              poweredByTextColor={bubbleProps.theme?.chatWindow?.poweredByTextColor}
              textInput={bubbleProps.theme?.chatWindow?.textInput}
              botMessage={bubbleProps.theme?.chatWindow?.botMessage}
              userMessage={bubbleProps.theme?.chatWindow?.userMessage}
              fontSize={bubbleProps.theme?.chatWindow?.fontSize}
              footer={bubbleProps.theme?.chatWindow?.footer}
              sourceDocsTitle={bubbleProps.theme?.chatWindow?.sourceDocsTitle}
              starterPrompts={bubbleProps.theme?.chatWindow?.starterPrompts}
              starterPromptFontSize={bubbleProps.theme?.chatWindow?.starterPromptFontSize}
              chatflowConfig={props.chatflowConfig}
              agenticUrl={props.agenticUrl}
              onRequest={props.onRequest}
              observersConfig={props.observersConfig}
              clearChatOnReload={bubbleProps.theme?.chatWindow?.clearChatOnReload}
              disclaimer={bubbleProps.theme?.disclaimer}
              dateTimeToggle={bubbleProps.theme?.chatWindow?.dateTimeToggle}
              renderHTML={props.theme?.chatWindow?.renderHTML}
              closeBot={closeBot}
            />
          </div>
        </Show>
      </div>
    </>
  );
};
