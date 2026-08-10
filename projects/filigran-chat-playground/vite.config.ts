import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { mockChatApi } from './mock-api';
import { readRealApiConfig, realChatApi } from './real-api';

// With CHAT_API_PROXY set the playground talks to a real XTM One (see
// real-api.ts); otherwise the dev server answers the chat API itself.
const realApi = readRealApiConfig(process.env);

export default defineConfig({
  plugins: [react(), realApi ? realChatApi(realApi) : mockChatApi()],
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
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '../../packages')],
    },
  },
});
