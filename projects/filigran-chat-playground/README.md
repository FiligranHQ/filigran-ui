# Filigran Chat Playground

Test playground for `@filigran/chatbot` component development.

## Getting Started

```bash
# From monorepo root
yarn install

# Start the playground dev server
yarn workspace @filigran/chat-playground dev
```

The playground runs at `http://localhost:5173` by default.

## Features

- Toggle between floating, sidebar, and fullscreen modes
- Dark/light mode switching
- Verification checklist for manual testing

## API Backend

The playground expects a chat API at `/api/xtmone`. For local development, you'll need to either:

1. Run a mock server that implements the [API contract](../../packages/filigran-chatbot/README.md#api-contract)
2. Configure Vite to proxy requests to a real backend

### Vite Proxy Example

Add to `vite.config.ts`:

```ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
});
```
