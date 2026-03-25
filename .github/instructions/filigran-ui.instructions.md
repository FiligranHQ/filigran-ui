---
applyTo: "packages/filigran-ui/**"
---

# @filigran/ui — Component Library Instructions

## Component Architecture

Components are split into two categories:

- **`components/servers/`** — Presentational, RSC-safe (no `'use client'` directive)
- **`components/clients/`** — Interactive, stateful (must start with `'use client'`)
- **`components/auto-form/`** — Auto-generated form system

## Component Structure Pattern

Every component must follow this structure:

```tsx
'use client' // Only for client components

import * as React from 'react'
import {cn} from '../../lib/utils'
import {cva, type VariantProps} from 'class-variance-authority'

const myComponentVariants = cva('base-classes', {
  variants: {
    variant: {
      default: 'default-classes',
    },
    size: {
      default: 'size-classes',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

export interface MyComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof myComponentVariants> {}

const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  ({className, variant, size, ...props}, ref) => (
    <div
      ref={ref}
      className={cn(myComponentVariants({variant, size}), className)}
      {...props}
    />
  )
)
MyComponent.displayName = 'MyComponent'

export {MyComponent, myComponentVariants}
```

## Rules

- Always use `React.forwardRef` and set `.displayName`
- Always use `cn()` for className merging (never raw `clsx` or string concat)
- Use `cva()` from `class-variance-authority` for variant-driven styling
- Use Radix UI primitives (`@radix-ui/*`) for interactive behaviors (dialog, popover, dropdown, etc.)
- Use `Slot` from `@radix-ui/react-slot` for `asChild` polymorphic pattern
- Import icons from `@filigran/icon` (peer dependency)
- Cross-import between `clients/` and `servers/` is allowed (e.g., `Button` from servers used in client components)

## Exports

- Each component file exports multiple named items (component + variants + sub-components)
- Barrel files (`clients/index.ts`, `servers/index.ts`) use `export * from './component-name'`
- After creating a new component, add it to the appropriate barrel file

## Build

- Build tool: **tsup** (ESM + CJS, target ES2022, terser minification)
- `"use client"` is auto-injected into client output files during build
- CSS files: `globals.css` (Tailwind base) + `theme.css` (HSL CSS variables for light/dark mode)
- Tailwind plugin: `FiligranUIPlugin` from `src/plugin.ts`

## Tailwind Config

- `darkMode: ['class']`
- Plugins: `tailwindcss-animate`, `FiligranUIPlugin`, `tailwindcss-scoped-preflight`
- Preflight scoped to `.twp` class (with `.no-twp` exclusion)

## Formatting (this package)

```
semi: false
singleQuote: true
printWidth: 80
tabWidth: 2
bracketSpacing: false
trailingComma: "es5"
bracketSameLine: true
singleAttributePerLine: true
```
