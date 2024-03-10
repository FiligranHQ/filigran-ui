import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'
import path from "path"
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ['lib/**/!(*.spec|*.test).{ts,tsx}']
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./lib"),
    },
  },
  build: {
    lib: {
        entry: resolve(__dirname, 'lib/main.ts'),
        formats: ['es']
      },
      copyPublicDir: false,
      rollupOptions: {
        external: ['react', 'react/jsx-runtime']
      }
    },

})
