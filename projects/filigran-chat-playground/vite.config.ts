import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { mockChatApi } from './mock-api';
import { readRealApiConfig, realChatApi } from './real-api';

const PORT = 3020;

// A real XTM One is the default: the playground registers itself as a platform
// and you sign in with a real account (see real-api.ts). `CHAT_API_MOCK=1`
// swaps in the built-in mock instead — worth having for renderer work and for
// working offline, but it proves nothing about the real contract, so it is not
// what you get by default.
const realApi = process.env.CHAT_API_MOCK === '1' ? null : readRealApiConfig(process.env, PORT);

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
    port: PORT,
    // Fail rather than fall back to the next free port. The port is baked into
    // the issuer URL registered with XTM One, which then fetches the JWKS from
    // it — a silent shift to 3021 would leave every request rejected with
    // nothing on screen to explain why.
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '../../packages')],
    },
  },
});
