/**
 * The keys the panel translates, read from its own source: what every catalog
 * must hold. Test and tooling only - never bundled.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

// The translating calls, and which argument holds the key. Read from the syntax
// tree, so no layout or quoting of the call hides a key.
const KEY_ARGUMENT: Readonly<Record<string, number>> = { t: 0, translate: 1, translateAround: 1, say: 1 };

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
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text in KEY_ARGUMENT) {
        const arg = node.arguments[KEY_ARGUMENT[node.expression.text]];
        if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) keys.add(arg.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...keys].sort();
}
