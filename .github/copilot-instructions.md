# Filigran-UI — Copilot Instructions

## Project Overview

Yarn 4 workspaces monorepo for Filigran's design system and component libraries.

**Published packages (NPM):**
- `@filigran/ui` — React component library (Radix UI + Tailwind CSS + CVA)
- `@filigran/icon` — Icon library (auto-generated from Figma SVGs via SVGR)
- `@filigran/chatbot` — Standalone chatbot panel component
- `@filigran/email` — HTML email templates (Maizzle framework)

**Internal projects:**
- `@filigran/website` — Next.js 15 documentation site (static export, GitHub Pages)
- `@filigran/chat-playground` — Vite dev playground for chatbot testing

## Tech Stack

- **Language**: TypeScript (strict mode)
- **UI**: React 18/19, Radix UI primitives, Tailwind CSS 3.4
- **Styling patterns**: `class-variance-authority` (CVA) for variants, `cn()` utility (clsx + tailwind-merge)
- **Package manager**: Yarn 4.12.0 with Corepack, `nodeLinker: node-modules`
- **Node**: >= 20.0.0
- **Module system**: ESM (`"type": "module"`)

## Naming Conventions

- **Files**: `kebab-case.tsx` (e.g., `alert-dialog.tsx`, `data-table.tsx`)
- **Components**: `PascalCase` (e.g., `AlertDialog`, `DataTable`)
- **Icons**: file `PascalCase.tsx`, export `{Name}Icon` (e.g., `Add.tsx` → `AddIcon`)
- **Exports**: Always named exports, never default exports
- **Barrel files**: Use `export * from './component-name'` pattern

## Code Style (Default — see package-specific overrides)

- Prettier: `semi: false`, `singleQuote: true`, `printWidth: 80`, `tabWidth: 2`
- `bracketSpacing: false`, `trailingComma: "es5"`, `bracketSameLine: true`
- `singleAttributePerLine: true`
- Plugins: `prettier-plugin-tailwindcss`, `prettier-plugin-organize-imports`
- ⚠️ `@filigran/chatbot` uses **different** Prettier rules — see its specific instructions

## Commit Messages

Format: `[project] Message (#issue-number)`

Projects: `@filigran/chatbot`, `@filigran/icon`, `@filigran/ui`, `@filigran/website`

## Key Commands

```bash
yarn install              # Install all dependencies
yarn build                # Build all packages (topological order)
yarn build:filigran-ui    # Build @filigran/ui only
yarn build:filigran-icon  # Build @filigran/icon only
yarn dev                  # Start website dev server
```

## Important Constraints

- Do NOT manually edit files in `packages/filigran-icon/src/` — they are auto-generated
- Do NOT add default exports — the project uses named exports exclusively
- Do NOT use `npm` or `pnpm` — this project uses Yarn 4 exclusively
- No testing framework exists yet — do not assume tests can be run
- The website is statically exported — no SSR, no API routes
