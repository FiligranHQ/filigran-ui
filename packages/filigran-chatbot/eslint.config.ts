import type { Config } from 'eslint/config';
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import solid from 'eslint-plugin-solid/configs/typescript';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  {
    ignores: ['**/*.md'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  solid as unknown as Config,
  {
    rules: {
      // Custom overrides
      'solid/no-innerhtml': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  prettier,
]);
