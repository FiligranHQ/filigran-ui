import { customElement } from 'solid-element';
import { defaultBotProps } from './constants';
import { Bubble } from './features/bubble';
import { createEffect } from 'solid-js';

export const registerWebComponents = () => {
  if (typeof window === 'undefined') return;

  customElement('filigran-chatbot', {
    ...defaultBotProps,
    open: false,
    onClose: undefined,
  }, (props, { element }) => {
    createEffect(() => {
      if (props.open) {
        element.dispatchEvent(new CustomEvent('open'));
      }
    });

    return <Bubble {...props} />;
  });
};
