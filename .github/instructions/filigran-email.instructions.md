---
applyTo: "packages/filigran-email/**"
---

# @filigran/email — Email Templates Instructions

## Overview

HTML email templates built with **Maizzle** framework. This package does NOT use React.

## Tech Stack

- **Framework**: Maizzle 5.x (email-specific HTML templating)
- **Styling**: Tailwind CSS via `tailwindcss-preset-email`
- **Output**: Inlined-CSS HTML emails

## Source Structure

```
src/
├── layouts/      # Email layout wrappers (HTML base structure)
├── templates/    # Individual email templates (one per email type)
├── components/   # Reusable HTML partials
├── css/          # Email-specific CSS
└── images/       # Email images/assets
```

## Templates

- `dropAlertOaev.html` — Drop alert notification
- `partnerVault.html` — Partner vault notification
- `welcome.html` — Welcome email

## Commands

```bash
yarn dev    # maizzle serve (live preview)
yarn build  # maizzle build production (outputs to build_production/)
```

## Build Configs

- `config.js` — Local/development settings
- `config.production.js` — Production settings (CSS inlining, minification)

## Key Rules

- This is **plain HTML**, not React — use Maizzle's templating syntax
- Use `tailwindcss-preset-email` classes (email-safe subset of Tailwind)
- Always test with email rendering tools — CSS support varies across email clients
- Keep HTML tables-based layout for maximum email client compatibility
