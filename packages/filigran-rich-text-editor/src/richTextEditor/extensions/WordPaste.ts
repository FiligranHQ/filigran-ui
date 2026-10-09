import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { transformWordHtml } from '../paste/wordPaste.ts';

export const WordPaste = Extension.create({
  name: 'wordPaste',

  addProseMirrorPlugins() {
    let pendingRtf = '';
    return [
      new Plugin({
        key: new PluginKey('wordPaste'),
        props: {
          handleDOMEvents: {
            paste: (_view, event) => {
              pendingRtf = event.clipboardData?.getData('text/rtf') ?? '';
              return false;
            },
            drop: (_view, event) => {
              pendingRtf = event.dataTransfer?.getData('text/rtf') ?? '';
              return false;
            },
          },
          transformPastedHTML: (html) => {
            const rtf = pendingRtf;
            pendingRtf = '';
            return transformWordHtml(html, rtf);
          },
        },
      }),
    ];
  },
});
