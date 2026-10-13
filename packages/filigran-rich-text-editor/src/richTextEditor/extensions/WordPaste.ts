import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { transformWordHtml } from '../paste/wordPaste.ts';

export interface WordPasteOptions {
  // Called after every HTML paste with the number of pictures it could not keep because the clipboard did not hold them
  // (Word for Mac); 0 when none were lost.
  onPicturesLost: ((count: number) => void) | null;
}

export const WordPaste = Extension.create<WordPasteOptions>({
  name: 'wordPaste',

  addOptions() {
    return { onPicturesLost: null };
  },

  addProseMirrorPlugins() {
    let pendingRtf = '';
    const { onPicturesLost } = this.options;
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
            const report = { lostPictures: 0 };
            const transformed = transformWordHtml(html, rtf, report);
            onPicturesLost?.(report.lostPictures);
            return transformed;
          },
        },
      }),
    ];
  },
});
