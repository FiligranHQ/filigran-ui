import { ExpandIcon, ReduceIcon } from '@/components/icons';
import { JSX } from 'solid-js/jsx-runtime';

const ExpandButton = (
  props: {
    color?: string;
    disableIcon?: boolean;
    isLoading?: boolean;
    expanded: boolean;
    isDisabled?: boolean;
  } & JSX.ButtonHTMLAttributes<HTMLButtonElement>,
) => {
  // Check if <filigran-fullchatbot> is present in the DOM
  const isFullChatbot = document.querySelector('filigran-fullchatbot') !== null;
  const paddingClass = isFullChatbot ? 'px-4' : 'px-0';

  return (
    <button
      type="submit"
      disabled={props.isDisabled || props.isLoading}
      {...props}
      class={
        `py-2 ${paddingClass} justify-center font-semibold text-white focus:outline-none flex items-center disabled:opacity-50 disabled:cursor-not-allowed disabled:brightness-100 transition-all filter hover:brightness-90 active:brightness-75 chatbot-button ` +
        props.class
      }
      style={{ background: 'transparent', border: 'none' }}
      title="Expand Chat"
    >
      {props.expanded ? <ReduceIcon color={props.color} /> : <ExpandIcon color={props.color} />}
    </button>
  );
};

export default ExpandButton;
