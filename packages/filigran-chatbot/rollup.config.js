import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';
import { typescriptPaths } from 'rollup-plugin-typescript-paths';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';

const isDev = process.env.NODE_ENV === 'development';

const extensions = ['.ts', '.tsx'];

const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react-markdown',
  'remark-gfm',
];

const indexConfig = {
  external,
  plugins: [
    resolve({ extensions, browser: true }),
    commonjs(),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationMap: false,
    }),
    postcss({
      plugins: [autoprefixer(), tailwindcss()],
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
];

export default configs;
