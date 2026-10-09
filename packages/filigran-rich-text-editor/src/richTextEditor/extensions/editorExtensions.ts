import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-text-style/font-family';
import { BackgroundColor } from '@tiptap/extension-text-style/background-color';
import Typography from '@tiptap/extension-typography';
import Mention from '@tiptap/extension-mention';
import { TableRow } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import { ImageWithOptions } from './ImageWithOptions.ts';
import { Highlight } from './Highlight.ts';
import { TextStyle } from './TextStyle.ts';
import { Table } from './Table.ts';
import { NestedTableCell } from './TableCell.ts';
import { NestedTableHeader } from './TableHeader.ts';
import { PageBreak } from './PageBreak.ts';
import { TableCellSplit } from './TableCellSplit.ts';
import { FontSize } from './FontSize.ts';
import { Paragraph } from './Paragraph.ts';
import { TaskList } from './TaskList.ts';
import { TaskItem } from './TaskListItem.ts';
import { Div } from './Div.ts';
import { WordPaste } from './WordPaste.ts';

export interface EditorExtensionOptions {
  placeholder: string;
}

export const createEditorExtensions = ({ placeholder }: EditorExtensionOptions): Extensions => [
  StarterKit.configure({
    paragraph: false,
    link: {
      autolink: true,
      linkOnPaste: true,
      openOnClick: false,
      // The link color comes from the theme CSS: a style here would be saved in the HTML.
      HTMLAttributes: {
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    },
  }),
  ImageWithOptions.configure({
    inline: false,
    allowBase64: true,
    resize: {
      enabled: true,
      directions: ['bottom-right', 'bottom-left', 'top-right', 'top-left'],
      minWidth: 8,
      minHeight: 8,
      alwaysPreserveAspectRatio: true,
    },
  }),
  Subscript,
  Superscript,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Paragraph,
  Highlight,
  TextStyle,
  Color,
  BackgroundColor,
  FontFamily,
  FontSize,
  Typography,
  Mention.configure({
    HTMLAttributes: {
      class: 'mention',
    },
    suggestion: {
      char: '@',
      allowSpaces: false,
      items: async () => [],
    },
  }),
  TaskList,
  TaskItem.configure({
    nested: true,
    HTMLAttributes: { class: 'tiptap-task-item' },
  }),
  Table.configure({ resizable: true }),
  TableRow,
  NestedTableHeader,
  NestedTableCell,
  Placeholder.configure({ placeholder }),
  PageBreak,
  TableCellSplit,
  Div,
  WordPaste,
];
