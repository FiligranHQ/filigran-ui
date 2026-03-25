---
mode: "agent"
description: "Create a new UI component in @filigran/ui"
---

# Create a New Component

Create a new component for `@filigran/ui` following the established patterns.

## Steps

1. **Determine the component type**:
   - **Server component** (`components/servers/`) — Presentational, no interactivity, no hooks, no event handlers
   - **Client component** (`components/clients/`) — Interactive, uses hooks, event handlers, or Radix UI primitives

2. **Create the component file** in the appropriate directory:
   - File name: `kebab-case.tsx` (e.g., `my-component.tsx`)
   - Use `React.forwardRef` with `.displayName`
   - Use `cn()` from `../../lib/utils` for all className merging
   - Use `cva()` from `class-variance-authority` if the component has variants
   - Add `'use client'` directive at top if it's a client component

3. **Export the component** from the appropriate barrel file:
   - Add `export * from './my-component'` to `clients/index.ts` or `servers/index.ts`

4. **If wrapping a Radix primitive**:
   - Install the Radix package: `yarn workspace @filigran/ui add @radix-ui/react-{name}`
   - Import and re-export Radix sub-components with custom styling
   - Each sub-component gets its own `forwardRef` wrapper

5. **Create documentation** (optional):
   - Add `projects/filigran-website/content/docs/components/{name}.mdx`
   - Include usage examples with `react-live` for interactive demos

## Template — Server Component

```tsx
import * as React from 'react'
import {cn} from '../../lib/utils'
import {cva, type VariantProps} from 'class-variance-authority'

const {{componentName}}Variants = cva('base-classes', {
  variants: {
    variant: {default: 'default-classes'},
    size: {default: 'size-classes'},
  },
  defaultVariants: {variant: 'default', size: 'default'},
})

export interface {{ComponentName}}Props
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof {{componentName}}Variants> {}

const {{ComponentName}} = React.forwardRef<HTMLDivElement, {{ComponentName}}Props>(
  ({className, variant, size, ...props}, ref) => (
    <div
      ref={ref}
      className={cn({{componentName}}Variants({variant, size}), className)}
      {...props}
    />
  )
)
{{ComponentName}}.displayName = '{{ComponentName}}'

export {{{ComponentName}}, {{componentName}}Variants}
```

## Template — Client Component (Radix-based)

```tsx
'use client'

import * as React from 'react'
import * as {{RadixName}}Primitive from '@radix-ui/react-{{radix-name}}'
import {cn} from '../../lib/utils'

const {{ComponentName}} = React.forwardRef<
  React.ComponentRef<typeof {{RadixName}}Primitive.Root>,
  React.ComponentPropsWithoutRef<typeof {{RadixName}}Primitive.Root>
>(({className, ...props}, ref) => (
  <{{RadixName}}Primitive.Root
    ref={ref}
    className={cn('base-classes', className)}
    {...props}
  />
))
{{ComponentName}}.displayName = {{RadixName}}Primitive.Root.displayName

export {{{ComponentName}}}
```
