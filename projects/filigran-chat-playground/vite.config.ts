import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@filigran/chatbot': path.resolve(__dirname, '../../packages/filigran-chatbotv2/src/index.ts'),
    },
  },
  server: {
    port: 3020,
    proxy: {
      '/api/xtmone': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '../../packages')],
    },
  },
});
