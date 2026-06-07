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
- **Every new `@filigran/ui` component must be documented** in the website (`projects/filigran-website/content/docs/components/`)


<!-- filigran-conventions:start -->
## Commit, PR & issue conventions

All commits, pull requests and issues in this repository follow the
[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
specification with a GitHub issue reference:

```
type(scope?)!?: description (#issue)
```

- Types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`,
  `build`, `ci`, `revert`.
- The description starts with a lowercase letter and has no trailing period;
  preserve acronyms and proper nouns.
- The old `[backend]` / `[frontend]` bracket prefixes are discontinued — use a
  Conventional Commits scope instead.
- Pull request titles **must** end with the related issue reference, e.g.
  `(#1234)`, and every pull request must be linked to an issue.
- Sign your commits.

When generating commit messages, PR titles or issue titles, always follow this
convention. See [`.github/LABELS.md`](.github/LABELS.md) for the full title and
label taxonomy.
<!-- filigran-conventions:end -->


<!-- filigran-model-policy:start -->
## GitHub Copilot model usage

To keep token consumption under control, pick the model that matches the task:

- **Opus 4.6** — reserve for complex work: deep reasoning, large refactors,
  architecture design, tricky debugging. It is significantly more
  token-expensive, so it is not the daily driver.
- **Sonnet / Gemini / GPT** — default for everyday tasks: autocomplete, small
  fixes, quick questions, code explanations.

We have a limited token budget — being mindful of the model you pick makes a
real difference at scale. Think of Opus as a specialist you call in when you
really need it.
<!-- filigran-model-policy:end -->
