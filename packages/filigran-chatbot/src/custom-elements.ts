import { BubbleProps } from './features/bubble';
import type { Ref } from 'react';

// @ts-expect-error needed for React
declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      "filigran-chatbot": Omit<BubbleProps, 'ref'> & {
        ref: Ref<unknown>;
      };
    }
  }
}

export {};
