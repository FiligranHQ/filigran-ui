# @filigran/rich-text-editor

TipTap 3-based rich text editor component with a MUI toolbar, built for Filigran products.

## Installation

```bash
yarn add @filigran/rich-text-editor
```

### Peer dependencies

The following packages must be installed in your project:

```bash
yarn add react react-dom \
  @mui/material @mui/icons-material \
  react-color
```

| Peer dependency         | Required version |
| ----------------------- | ---------------- |
| `react`                 | `>= 18`         |
| `react-dom`             | `>= 18`         |
| `@mui/material`         | `>= 5`          |
| `@mui/icons-material`   | `>= 5`          |
| `react-color`           | `>= 2`          |

> **Note:** `@tiptap/core`, `@tiptap/react` and `@tiptap/pm` are bundled as direct dependencies — you do **not** need to install them yourself.

## Usage

```tsx
import { useState } from 'react'
import { RichTextEditor } from '@filigran/rich-text-editor'
import '@filigran/rich-text-editor/styles.css'

function MyEditor() {
  const [html, setHtml] = useState('<p>Hello world</p>')

  return (
    <RichTextEditor
      data={html}
      onChange={(_evt, adapter) => setHtml(adapter.getData())}
    />
  )
}
```

## Props

| Prop              | Type                                                  | Default      | Description                                                                 |
| ----------------- | ----------------------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| `id`              | `string`                                              | —            | Sets a `data-editor-id` attribute on the editing area.                      |
| `data`            | `string`                                              | `''`         | HTML content. Controlled: updating this prop replaces the editor content.   |
| `onChange`        | `(evt: unknown, adapter: RichTextEditorAdapter) => void` | —          | Called on every content change.                                             |
| `onReady`         | `(adapter: RichTextEditorAdapter) => void`            | —            | Called when the editor is mounted and ready. Provides an imperative handle. |
| `onTextSelection` | `(text: string) => void`                              | —            | Called when text is selected. Only fires when `disabled={true}` (read-only mode). |
| `onBlur`          | `(evt: unknown, adapter: RichTextEditorAdapter) => void` | —         | Called when the editor loses focus.                                         |
| `onFocus`         | `(evt: unknown) => void`                              | —            | Called when the editor gains focus.                                         |
| `disabled`        | `boolean`                                             | `false`      | Makes the editor read-only.                                                 |
| `disableWatchdog` | `boolean`                                             | —            | Disables the internal editor watchdog.                                      |
| `placeholder`     | `string`                                              | `''`         | Placeholder text shown when the editor is empty.                            |
| `variant`         | `'standard' \| 'outlined'`                            | `'standard'` | `standard` = borderless look. `outlined` = MUI-style border + focus ring.   |
| `className`       | `string`                                              | —            | Additional CSS class on the root wrapper div.                               |

## `RichTextEditorAdapter`

The adapter is an imperative handle provided via the `onChange`, `onBlur`, and `onReady` callbacks:

```ts
interface RichTextEditorAdapter {
  /** Returns the current HTML content */
  getData: () => string
  /** Replaces the entire editor content with the given HTML */
  setContent: (html: string) => void
  /** Scrolls the editor content area to the bottom */
  scrollToBottom: () => void
}
```

### Example: programmatic content update

```tsx
import { useRef } from 'react'
import { RichTextEditor } from '@filigran/rich-text-editor'
import type { RichTextEditorAdapter } from '@filigran/rich-text-editor'

function App() {
  const adapterRef = useRef<RichTextEditorAdapter | null>(null)

  return (
    <>
      <RichTextEditor
        onReady={(adapter) => { adapterRef.current = adapter }}
      />
      <button onClick={() => adapterRef.current?.setContent('<p>Reset</p>')}>
        Reset content
      </button>
    </>
  )
}
```

## Exports

```ts
import {
  RichTextEditor,          // Main component
  TIPTAP_EDITOR_SELECTOR,  // CSS selector for the editing area ('.tiptap-editor-content.ProseMirror')
} from '@filigran/rich-text-editor'

import type {
  RichTextEditorProps,
  RichTextEditorAdapter,
} from '@filigran/rich-text-editor'
```

## Features

The editor comes with a rich toolbar and the following built-in capabilities:

- **Text formatting** — bold, italic, underline, strikethrough, subscript, superscript, code
- **Headings** — H1, H2, H3, and paragraph
- **Lists** — bullet, ordered, and task lists (with nesting)
- **Text alignment** — left, center, right, justify
- **Font family** — Arial, Courier New, Georgia, Helvetica, Lucida Sans Unicode, Times New Roman, Trebuchet MS, Verdana
- **Font size** — Tiny (10px), Small (12px), Normal (14px), Big (18px), Huge (24px)
- **Colors** — text color and background color via a color picker
- **Highlights** — highlight text with custom colors
- **Links** — insert/edit links via a popover
- **Images** — insert from URL or paste/drop. Resizable, with alt/title/caption/link options
- **Tables** — insert via a grid picker, resizable columns, context menu for row/column operations, nested tables, cell split/merge
- **Block elements** — blockquote, code block, horizontal rule, page break
- **Indentation** — increase / decrease indent
- **Typography** — automatic smart quotes, dashes, ellipsis (TipTap Typography extension)
- **Mentions** — `@` mention support (items callback is currently a no-op placeholder)
- **Source mode** — toggle to view/edit raw HTML
- **Undo / Redo** — full history support
- **Dark mode** — automatic theme adaptation via MUI `useTheme`

## CSS selector

Use the exported `TIPTAP_EDITOR_SELECTOR` constant to target the editor content area in your CSS:

```css
.tiptap-editor-content.ProseMirror {
  min-height: 200px;
}
```
