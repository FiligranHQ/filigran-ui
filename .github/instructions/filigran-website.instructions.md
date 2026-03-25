---
applyTo: "projects/filigran-website/**"
---

# @filigran/website — Documentation Site Instructions

## Framework

**Next.js 15** with App Router, configured for **static export** (`output: 'export'`).

Deployed to GitHub Pages at `/filigran-ui` (configurable `basePath`).

## Key Constraints

- **No SSR, no API routes, no server actions** — static export only
- All pages must be statically renderable
- Dynamic routes require `generateStaticParams()`

## Documentation Content

MDX files in `content/docs/`:
- Component docs: `content/docs/components/{component-name}.mdx`
- Design docs: colors, typography, spacing (root of `content/docs/`)
- Learning content: `content/learning/`

Rendered via `next-mdx-remote` with `rehype-slug` and `remark-gfm`.

## Interactive Code Examples

- **`react-live`** — Inline editable code playgrounds
- **`@codesandbox/sandpack-react`** — Embedded CodeSandbox editors

## Theming

Dark mode via `next-themes` (`ThemeProvider` in root layout). Uses `@filigran/ui` theme CSS variables.

## Component Usage

Imports components directly from `@filigran/ui`:
```tsx
import {Button} from '@filigran/ui/servers'
import {Dialog, DialogContent} from '@filigran/ui/clients'
```

## Tailwind Config

- Uses `FiligranUIPlugin` from `@filigran/ui/plugin`
- Content paths include `../../packages/filigran-ui/src/components/**` for JIT
- Plugins: `tailwindcss-animate`, `@tailwindcss/typography`

## ESLint

Next.js flat config with `@next/eslint-plugin-next` (core web vitals rules).

## Adding a New Doc Page

1. Create `content/docs/components/{name}.mdx`
2. Add frontmatter and component demos
3. Add navigation entry if needed
4. The MDX content is automatically picked up by the routing system
