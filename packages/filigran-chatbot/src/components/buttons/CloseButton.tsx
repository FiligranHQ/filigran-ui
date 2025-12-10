import { CloseIcon } from '@/components/icons/CloseIcon';
import { JSX } from 'solid-js/jsx-runtime';

export const CloseButton = (props: { disableIcon?: boolean } & JSX.ButtonHTMLAttributes<HTMLButtonElement>) => {
  // Check if <filigran-fullchatbot> is present in the DOM
  const isFullChatbot = document.querySelector('filigran-fullchatbot') !== null;
  const paddingClass = isFullChatbot ? 'px-4' : 'px-0';

  return (
    <button
      {...props}
      class={
        `py-2 ${paddingClass} justify-center font-semibold text-white focus:outline-none flex items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:brightness-100 transition-all filter hover:brightness-90 active:brightness-75 chatbot-button ` +
        props.class
      }
      style={{ background: 'transparent', border: 'none' }}
      title="Close Chat"
    >
      <CloseIcon color={props.color} class={'send-icon flex ' + (props.disableIcon ? 'hidden' : '')} />
    </button>
  );
};
