import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { transformWordHtml } from '../paste/wordPaste.ts';

export interface WordPasteOptions {
  // Called with the number of pictures a paste could not keep because the clipboard did not hold them (Word for Mac).
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
            if (report.lostPictures > 0) onPicturesLost?.(report.lostPictures);
            return transformed;
          },
        },
      }),
    ];
  },
});
