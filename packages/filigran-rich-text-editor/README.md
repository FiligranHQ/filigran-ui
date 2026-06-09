# @filigran/rich-text-editor

TipTap-based rich text editor component with MUI toolbar for Filigran products.

## Installation

```bash
yarn add @filigran/rich-text-editor
```

### Peer dependencies

```bash
yarn add react react-dom \
  @mui/material @mui/icons-material \
  @tiptap/core @tiptap/react @tiptap/pm \
  react-color
```

## Usage

```tsx
import { RichTextEditor } from '@filigran/rich-text-editor'
import '@filigran/rich-text-editor/styles.css'

<RichTextEditor
  value={content}
  onChange={setContent}
/>
```
