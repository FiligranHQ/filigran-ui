import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { mockChatApi } from './mock-api';

// Point at a real chat backend instead of the built-in mock:
//   CHAT_API_PROXY=http://localhost:8000 yarn dev
const proxyTarget = process.env.CHAT_API_PROXY;

export default defineConfig({
  plugins: [react(), ...(proxyTarget ? [] : [mockChatApi()])],
  resolve: {
    // Order matters: string aliases match by prefix, so the subpath must come
    // before the bare package name or it would resolve to `…/index.ts/markdown`.
    alias: [
      { find: '@filigran/chatbot/markdown', replacement: path.resolve(__dirname, '../../packages/filigran-chatbot/src/markdown.ts') },
      { find: '@filigran/chatbot', replacement: path.resolve(__dirname, '../../packages/filigran-chatbot/src/index.ts') },
    ],
  },
  server: {
    port: 3020,
    ...(proxyTarget
      ? {
          proxy: {
            '/api/xtmone': { target: proxyTarget, changeOrigin: true },
          },
        }
      : {}),
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '../../packages')],
    },
  },
});
