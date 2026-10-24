import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';
import { typescriptPaths } from 'rollup-plugin-typescript-paths';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';
import { stylesheetPlugins } from './postcss/pipeline.js';

const isDev = process.env.NODE_ENV === 'development';

const extensions = ['.ts', '.tsx'];

const external = ['react', 'react-dom', 'react/jsx-runtime', 'react-markdown', 'remark-breaks', 'remark-gfm', 'remark-parse', 'unified'];

// The unit tests import with `.ts` paths, as Node's type stripping requires,
// and TypeScript only allows those in a compilation that emits nothing: the
// bundle leaves the tests out and turns the option back off.
const typescriptOptions = {
  tsconfig: './tsconfig.json',
  declaration: false,
  declarationMap: false,
  allowImportingTsExtensions: false,
  exclude: ['**/*.test.ts', '**/*.test.tsx', 'test/**'],
};

const indexConfig = {
  external,
  plugins: [
    resolve({ extensions, browser: true }),
    commonjs(),
    json(),
    typescript(typescriptOptions),
    postcss({
      plugins: stylesheetPlugins(),
      extract: 'styles.css',
      modules: false,
      autoModules: false,
      minimize: true,
    }),
    typescriptPaths({ preserveExtensions: true }),
    terser({ output: { comments: false } }),
    ...(isDev
      ? [
          serve({
            open: true,
            verbose: true,
            contentBase: ['dist', 'public'],
            host: 'localhost',
            port: 5679,
          }),
          livereload({ watch: 'dist' }),
        ]
      : []),
  ],
};

const configs = [
  {
    ...indexConfig,
    input: './src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'es',
      sourcemap: true,
    },
  },
  {
    input: 'src/index.ts',
    external: [...external, /\.css$/],
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [
      {
        name: 'skip-css',
        resolveId(source) {
          if (source.endsWith('.css')) return { id: source, external: true };
          return null;
        },
      },
      dts(),
    ],
  },
  // `@filigran/chatbot/markdown` and `/workspaces` — pure helpers only.
  // Deliberately separate entries (no CSS pipeline, no React) so a host can
  // share the panel's rules without its bundler having to tree-shake the
  // whole panel out of an eagerly-loaded chunk.
  ...['markdown', 'workspaces'].flatMap((name) => [
    {
      external,
      input: `./src/${name}.ts`,
      output: {
        file: `dist/${name}.js`,
        format: 'es',
        sourcemap: true,
      },
      plugins: [
        resolve({ extensions, browser: true }),
        commonjs(),
        json(),
        typescript(typescriptOptions),
        typescriptPaths({ preserveExtensions: true }),
        terser({ output: { comments: false } }),
      ],
    },
    {
      input: `src/${name}.ts`,
      external,
      output: [{ file: `dist/${name}.d.ts`, format: 'es' }],
      plugins: [dts()],
    },
  ]),
];

export default configs;
