---
applyTo: "packages/filigran-icon/**"
---

# @filigran/icon — Icon Library Instructions

## ⚠️ Auto-Generated Files

All files in `src/` are **auto-generated** by the SVGR pipeline. **Do NOT manually edit them.**

Auto-generated files:
- `src/*.tsx` — Individual icon components
- `src/index.ts` — Barrel file exporting all icons

## Icon Pipeline

```
Figma API → assets/*.svg → @svgr/cli → src/*.tsx → tsup → dist/
```

1. `yarn extract-icons` — Fetches SVGs from Figma via API (`script/fetchFromFigma.js`)
2. `yarn svgr` — Converts SVGs in `assets/` to React TSX components
3. `yarn build` — Bundles with tsup (ESM + CJS)

## Naming Convention

- SVG file: `PascalCase.svg` in `assets/` (e.g., `Dashboard.svg`)
- Generated component file: `PascalCase.tsx` in `src/` (e.g., `Dashboard.tsx`)
- Export name: `{Name}Icon` (e.g., `export { default as DashboardIcon } from "./Dashboard"`)

## To Add a New Icon Manually

1. Add the SVG file to `assets/` with a PascalCase name
2. Run `yarn svgr` to regenerate components
3. Run `yarn build` to rebuild

## Component Shape

Each icon is a stateless functional component:
```tsx
const SvgMyIcon = ({title, titleId, ...props}: SVGProps<SVGSVGElement> & SVGRProps) => (
  <svg aria-labelledby={titleId} {...props}>
    {title ? <title id={titleId}>{title}</title> : null}
    <path ... />
  </svg>
)
```

Props: `SVGProps<SVGSVGElement> & { title?: string; titleId?: string }` for accessibility.
