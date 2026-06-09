# @filigran/rich-text-editor

TipTap-based rich text editor component with MUI toolbar for Filigran products.

## Releasing a new version

Releases are automated via a GitHub Actions workflow.  
See **[deployment-package.md](./deployment-package.md)** for the full guide (how to trigger the workflow, when to use `patch` / `minor` / `major`, and what happens under the hood).

## Installation

```bash
yarn add @filigran/rich-text-editor
```

### Peer dependencies

```bash
yarn add react react-dom \
  @mui/material @mui/icons-material @mui/styles \
  @tiptap/core @tiptap/react @tiptap/starter-kit \
  @tiptap/extension-color @tiptap/extension-highlight @tiptap/extension-image \
  @tiptap/extension-mention @tiptap/extension-paragraph @tiptap/extension-placeholder \
  @tiptap/extension-subscript @tiptap/extension-superscript @tiptap/extension-table \
  @tiptap/extension-task-item @tiptap/extension-task-list @tiptap/extension-text-align \
  @tiptap/extension-text-style @tiptap/extension-typography @tiptap/pm \
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
