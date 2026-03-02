# @filigran/chatbot

Filigran chat panel — a standalone React + Tailwind chatbot component.

## Versioning Strategy

This monorepo contains two versions of the chatbot package:

| Version | Folder | Local Workspace Name | npm Package |
|---------|--------|---------------------|-------------|
| v1.x | `packages/filigran-chatbot` | `@filigran/chatbot-legacy` | `@filigran/chatbot@1.x` |
| v2.x | `packages/filigran-chatbotv2` | `@filigran/chatbot` | `@filigran/chatbot@2.x` |

### Why Different Local Names?

Yarn workspaces require unique package names within the monorepo. When you run:

```bash
yarn workspace @filigran/chatbot build
```

Yarn needs to know which folder to use. If two packages share the same `name` in their `package.json`, Yarn fails with:

```
Error: Duplicate workspace name @filigran/chatbot
```

**For npm publishing**, this isn't a problem — npm differentiates packages by version number, not by source location.

### Working with v2 (Active Development)

v2 is the active version. To develop locally:

```bash
cd packages/filigran-chatbotv2
yarn dev
```

To build:

```bash
yarn build
```

To publish:

```bash
yarn publish --access public
```

Or from the monorepo root:

```bash
yarn publish:filigran-chatbot
```

### Working with v1 (Legacy/Maintenance)

v1 uses the local name `@filigran/chatbot-legacy` to avoid conflicts. If you need to publish a patch to v1:

1. **Temporarily rename** the package in `packages/filigran-chatbot/package.json`:
   ```json
   "name": "@filigran/chatbot"
   ```

2. **Publish** the patch:
   ```bash
   cd packages/filigran-chatbot
   yarn build
   yarn publish --access public
   ```

3. **Revert** the name back to `@filigran/chatbot-legacy`:
   ```json
   "name": "@filigran/chatbot-legacy"
   ```

### Using in Other Packages

To depend on v2 within the monorepo:

```json
{
  "dependencies": {
    "@filigran/chatbot": "workspace:*"
  }
}
```

To depend on v1 (legacy):

```json
{
  "dependencies": {
    "@filigran/chatbot-legacy": "workspace:*"
  }
}
```

Note: External consumers install from npm and won't see the `-legacy` suffix — they just use `@filigran/chatbot@1` or `@filigran/chatbot@2`.

## Installation (External Users)

```bash
# Latest (v2)
npm install @filigran/chatbot

# Specific major version
npm install @filigran/chatbot@2
npm install @filigran/chatbot@1
```

## Usage

```tsx
import { ChatPanel, ChatToggleButton } from '@filigran/chatbot';
import '@filigran/chatbot/styles.css';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ChatToggleButton
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        label="Ask Assistant"
      />
      {isOpen && (
        <ChatPanel
          mode="floating"
          onClose={() => setIsOpen(false)}
          apiBaseUrl="/api/chat"
        />
      )}
    </>
  );
}
```

## Peer Dependencies

- `react` >= 18
- `react-dom` >= 18
- `react-markdown` >= 9
- `remark-gfm` >= 4
