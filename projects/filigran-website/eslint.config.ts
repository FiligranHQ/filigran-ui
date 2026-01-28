import type { Config } from 'eslint/config';
import { defineConfig } from 'eslint/config';
import { flatConfig } from '@next/eslint-plugin-next'

export default defineConfig([
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**'],
  },
  flatConfig.coreWebVitals as Config,
]);
