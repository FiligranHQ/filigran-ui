import {copyFile, mkdir} from 'fs/promises'
import {defineConfig} from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/icons-material',
    '@mui/styles',
    '@tiptap/core',
    '@tiptap/react',
    '@tiptap/starter-kit',
    '@tiptap/extension-color',
    '@tiptap/extension-highlight',
    '@tiptap/extension-image',
    '@tiptap/extension-mention',
    '@tiptap/extension-paragraph',
    '@tiptap/extension-placeholder',
    '@tiptap/extension-subscript',
    '@tiptap/extension-superscript',
    '@tiptap/extension-table',
    '@tiptap/extension-task-item',
    '@tiptap/extension-task-list',
    '@tiptap/extension-text-align',
    '@tiptap/extension-text-style',
    '@tiptap/extension-typography',
    '@tiptap/pm',
    'react-color',
  ],
  async onSuccess() {
    await mkdir('dist', {recursive: true})
    await copyFile('src/styles/TiptapEditor.css', 'dist/styles.css')
  },
})
