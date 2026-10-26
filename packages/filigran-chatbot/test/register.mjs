import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

// Lets `node --test` load the components: `.tsx` through esbuild, CSS as
// nothing, and the extension-less imports the bundler resolves.
const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
const RESOLVED = /\.[cm]?[jt]sx?$|\.json$|\.css$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !RESOLVED.test(specifier)) {
      for (const suffix of CANDIDATES) {
        try {
          return nextResolve(specifier + suffix, context);
        } catch {
          // Try the next candidate.
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
    if (url.endsWith('.tsx')) {
      const source = readFileSync(fileURLToPath(url), 'utf8');
      const { code } = transformSync(source, { loader: 'tsx', jsx: 'automatic', format: 'esm', sourcefile: url, sourcemap: 'inline' });
      return { format: 'module', source: code, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
