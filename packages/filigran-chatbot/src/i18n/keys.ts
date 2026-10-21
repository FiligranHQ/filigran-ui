/**
 * The keys the panel translates, read from its own source: what every catalog
 * must hold. Test and tooling only - never bundled.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PATTERNS = [
  /\bt\('((?:[^'\\]|\\.)+)'\)/g,
  /\btranslate(?:Around)?\(t, '((?:[^'\\]|\\.)+)'/g,
  // A refusal's own wording, translated where it is said.
  /\bsay\([^,]+, '((?:[^'\\]|\\.)+)'\)/g,
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'i18n' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

export function panelKeys(srcDir: string): string[] {
  const keys = new Set<string>();
  for (const file of sourceFiles(srcDir)) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of PATTERNS) {
      for (const match of text.matchAll(pattern)) keys.add(match[1].replace(/\\'/g, "'"));
    }
  }
  return [...keys].sort();
}
