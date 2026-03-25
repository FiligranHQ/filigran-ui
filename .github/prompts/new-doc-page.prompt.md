---
mode: "agent"
description: "Create a new MDX documentation page for the filigran-website"
---

# Create a New Documentation Page

Create a new MDX documentation page for a component in the filigran-website.

## Steps

1. **Create the MDX file** at `projects/filigran-website/content/docs/components/{component-name}.mdx`

2. **Structure the page** with these sections:
   - Title and description
   - Import examples
   - Interactive demo (react-live)
   - Props/API reference
   - Variant examples

3. **Add navigation entry** if required by the site's nav configuration

## MDX Template

```mdx
# {{ComponentName}}

Brief description of what this component does and when to use it.

## Installation

Already included in `@filigran/ui`. Import from the appropriate subpath:

\`\`\`tsx
// For server components
import { {{ComponentName}} } from '@filigran/ui/servers'

// For client components
import { {{ComponentName}} } from '@filigran/ui/clients'
\`\`\`

## Usage

<ReactLiveDisplay>
{`<{{ComponentName}} variant="default">
  Hello World
</{{ComponentName}}>`}
</ReactLiveDisplay>

## Variants

### Default
<ReactLiveDisplay>
{`<{{ComponentName}} variant="default">Default</{{ComponentName}}>`}
</ReactLiveDisplay>

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `string` | `"default"` | Visual style variant |
| `size` | `string` | `"default"` | Size variant |
| `className` | `string` | — | Additional CSS classes |
| `asChild` | `boolean` | `false` | Render as child element (Radix Slot) |
```

## Guidelines

- Use `<ReactLiveDisplay>` for interactive editable examples (powered by react-live)
- Use `<Sandpack>` for more complex multi-file examples
- Import `@faker-js/faker` for realistic demo data in tables/lists
- Test dark mode rendering — use theme CSS variables, not hardcoded colors
- The page is statically rendered — no dynamic data fetching
