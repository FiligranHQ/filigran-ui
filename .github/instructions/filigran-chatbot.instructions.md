---
applyTo: "packages/filigran-chatbot/**"
---

# @filigran/chatbot — Chatbot Component Instructions

## Overview

Standalone React + Tailwind chatbot panel. Self-contained with its own build, styling, and config.

Main exports: `ChatPanel`, `ChatToggleButton`, and related types.

## ⚠️ Different Code Style

This package has its **own Prettier config** (`.prettierrc`), different from the rest of the monorepo:

```
semi: true          (rest of project: false)
singleQuote: true
printWidth: 150     (rest of project: 80)
trailingComma: "all" (rest of project: "es5")
tabWidth: 2
endOfLine: "lf"
```

Always follow **this** package's style when editing files here.

## ESLint

Flat config (`eslint.config.ts`):
- `@eslint/js` recommended + `typescript-eslint` recommended
- `eslint-config-prettier` to disable conflicting rules
- `@typescript-eslint/no-explicit-any` is **disabled**

## Source Structure

```
src/
├── index.ts         # Barrel export
├── types.ts         # TypeScript interfaces/types
├── assets/          # CSS (index.css)
├── hooks/           # Custom hooks (useChat)
├── utils/           # Utility functions
└── components/      # All UI components
    ├── ChatPanel.tsx
    ├── ChatHeader.tsx
    ├── ChatInput.tsx
    ├── ChatMessages.tsx
    ├── ChatToggleButton.tsx
    ├── ChatWelcome.tsx
    ├── MarkdownMessage.tsx
    └── icons/       # Inline SVG icons (not from @filigran/icon)
```

## Build

- Build tool: **Rollup** (not tsup like other packages)
- Output: ESM bundle + separate CSS (`dist/styles.css`) + dts bundle
- PostCSS with Tailwind processes styles
- Dev mode: `rollup --watch` with dev server on port 5679 and livereload

## Tailwind Specifics

- `darkMode: 'class'`
- rem-to-px conversion via custom `rem2px()` function
- **No preflight** (`corePlugins: { preflight: false }`)
- Plugin: `@tailwindcss/typography`
- Custom animations: `fade-in` (opacity), `chat-dot` (bounce)
- CSS custom properties for layout: `--chatbot-sidebar-width`, `--chatbot-transition`
