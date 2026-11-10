/**
 * A small syntax highlighter for the panel's fenced code blocks.
 *
 * It cuts a code string into tokens for the languages agents write most
 * (Python, TypeScript / JavaScript, JSON, shell, SQL, YAML) with one sticky
 * regular expression per language, so it needs no dependency and adds a few
 * kilobytes to the bundle. Joined back, the tokens are exactly the input
 * string: a language it does not know, or text no rule matches, stays plain.
 * The renderer maps each token type to a CSS class themed in light and dark.
 */

export type HighlightTokenType = 'comment' | 'string' | 'number' | 'keyword' | 'literal' | 'builtin' | 'function' | 'property' | 'variable' | 'plain';

export interface HighlightToken {
  type: HighlightTokenType;
  text: string;
}

interface LanguageRules {
  /** Ordered alternatives, each one capture group named after its token type. */
  pattern: RegExp;
}

const words = (list: string) => list.trim().split(/\s+/).join('|');

const JS_KEYWORDS = words(`
  abstract as async await break case catch class const continue debugger declare default delete do else enum
  export extends finally for from function get if implements import in instanceof interface keyof let module
  namespace new of private protected public readonly return satisfies set static super switch this throw try
  type typeof var void while with yield
`);
const JS_LITERALS = words('true false null undefined NaN Infinity');
const JS_BUILTINS = words('any boolean never number object string symbol unknown bigint Array Date Error JSON Map Math Object Promise Record Set console window document');

const PY_KEYWORDS = words(`
  and as assert async await break class continue def del elif else except finally for from global if import in
  is lambda match case nonlocal not or pass raise return try while with yield
`);
const PY_LITERALS = words('True False None');
const PY_BUILTINS = words('print len range dict list set tuple str int float bool bytes isinstance enumerate zip map filter open self cls super type sorted any all min max sum');

const SQL_KEYWORDS = words(`
  select from where and or not in is null as join inner left right full outer cross on group by order having
  limit offset union all distinct insert into values update set delete create table view index drop alter add
  column primary key foreign references default case when then else end exists between like ilike asc desc
  with returning cascade constraint unique if begin commit rollback transaction grant revoke over partition
`);
const SQL_BUILTINS = words('count sum avg min max coalesce now cast lower upper length substring date_trunc extract round');

const SH_KEYWORDS = words('if then else elif fi for while until do done case esac in function return local export readonly unset select time');
const SH_BUILTINS = words(`
  echo printf cd ls cat grep sed awk find xargs curl wget git docker kubectl helm npm npx yarn pip python python3
  node make sudo chmod chown mkdir rm cp mv tar ssh source set test read exit kill ps tail head sort uniq wc tee
`);

const LANGUAGES: Record<string, LanguageRules> = {
  javascript: {
    pattern: new RegExp(
      [
        String.raw`(?<comment>\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))`,
        String.raw`(?<string>"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|\x60(?:[^\x60\\]|\\[\s\S])*\x60?)`,
        String.raw`(?<number>\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?n?)\b)`,
        `(?<keyword>\\b(?:${JS_KEYWORDS})\\b)`,
        `(?<literal>\\b(?:${JS_LITERALS})\\b)`,
        `(?<builtin>\\b(?:${JS_BUILTINS})\\b)`,
        String.raw`(?<function>\b[A-Za-z_$][\w$]*(?=\s*\())`,
      ].join('|'),
      'y',
    ),
  },
  python: {
    pattern: new RegExp(
      [
        String.raw`(?<comment>#[^\n]*)`,
        String.raw`(?<string>(?:[rRbBuUfF]{1,2})?(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?))`,
        String.raw`(?<number>\b(?:0[xXoObB][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?j?)\b)`,
        `(?<keyword>\\b(?:${PY_KEYWORDS})\\b)`,
        `(?<literal>\\b(?:${PY_LITERALS})\\b)`,
        `(?<builtin>\\b(?:${PY_BUILTINS})\\b)`,
        String.raw`(?<function>(?<=@)[\w.]+|\b[A-Za-z_]\w*(?=\s*\())`,
      ].join('|'),
      'y',
    ),
  },
  json: {
    pattern: new RegExp(
      [
        String.raw`(?<comment>\/\/[^\n]*)`,
        String.raw`(?<property>"(?:[^"\\\n]|\\.)*"(?=\s*:))`,
        String.raw`(?<string>"(?:[^"\\\n]|\\.)*"?)`,
        String.raw`(?<number>-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)`,
        String.raw`(?<literal>\b(?:true|false|null)\b)`,
      ].join('|'),
      'y',
    ),
  },
  bash: {
    pattern: new RegExp(
      [
        String.raw`(?<comment>(?<![^\s;|&(])#[^\n]*)`,
        String.raw`(?<string>"(?:[^"\\]|\\[\s\S])*"?|'[^']*'?)`,
        String.raw`(?<variable>\$(?:\{[^}\n]*\}?|\w+|[@*#?$!0-9-]))`,
        `(?<keyword>(?<![\\w-])(?:${SH_KEYWORDS})(?![\\w-]))`,
        `(?<builtin>(?<![\\w./-])(?:${SH_BUILTINS})(?![\\w-]))`,
        String.raw`(?<property>(?<![\w-])--?[A-Za-z][\w-]*)`,
        String.raw`(?<number>\b\d+\b)`,
      ].join('|'),
      'y',
    ),
  },
  sql: {
    pattern: new RegExp(
      [
        String.raw`(?<comment>--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))`,
        String.raw`(?<string>'(?:[^']|'')*'?)`,
        String.raw`(?<property>"(?:[^"]|"")*"?|\x60[^\x60]*\x60?)`,
        String.raw`(?<number>\b\d+(?:\.\d+)?\b)`,
        `(?<keyword>\\b(?:${SQL_KEYWORDS})\\b)`,
        `(?<literal>\\b(?:true|false)\\b)`,
        `(?<builtin>\\b(?:${SQL_BUILTINS})\\b(?=\\s*\\())`,
      ].join('|'),
      'iy',
    ),
  },
  yaml: {
    pattern: new RegExp(
      [
        String.raw`(?<comment>(?<![^\s])#[^\n]*)`,
        String.raw`(?<property>(?<=^|\n)[ \t]*(?:- )?[\w.-]+(?=\s*:(?:\s|$)))`,
        String.raw`(?<string>"(?:[^"\\\n]|\\.)*"?|'(?:[^'\n]|'')*'?)`,
        String.raw`(?<literal>\b(?:true|false|null|yes|no|on|off)\b)`,
        String.raw`(?<number>(?<![\w.])-?\d+(?:\.\d+)?(?![\w.]))`,
      ].join('|'),
      'y',
    ),
  },
};

const ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'javascript',
  tsx: 'javascript',
  typescript: 'javascript',
  py: 'python',
  python3: 'python',
  jsonc: 'json',
  json5: 'json',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  postgres: 'sql',
  postgresql: 'sql',
  mysql: 'sql',
  sqlite: 'sql',
  yml: 'yaml',
};

/** The highlighter's own name for a fence language, or null when it has no rules for it. */
export function highlightLanguage(language: string | undefined | null): string | null {
  if (!language) return null;
  const key = language.toLowerCase();
  const name = ALIASES[key] ?? key;
  return Object.prototype.hasOwnProperty.call(LANGUAGES, name) ? name : null;
}

/** Above this size a block is shown plain: highlighting must never stall the panel. */
export const MAX_HIGHLIGHT_LENGTH = 100_000;

/**
 * `code` cut into tokens for `language`; one plain token when the language is
 * unknown or the code is too large. Joining every token's text gives `code` back.
 */
export function highlightCode(code: string, language: string | undefined | null): HighlightToken[] {
  const name = highlightLanguage(language);
  if (!name || code.length > MAX_HIGHLIGHT_LENGTH) return code ? [{ type: 'plain', text: code }] : [];
  const pattern = new RegExp(LANGUAGES[name].pattern.source, LANGUAGES[name].pattern.flags);
  const tokens: HighlightToken[] = [];
  let plainStart = 0;
  let index = 0;
  const pushPlain = (end: number) => {
    if (end > plainStart) tokens.push({ type: 'plain', text: code.slice(plainStart, end) });
  };
  while (index < code.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(code);
    if (!match || match[0].length === 0) {
      // Skip one identifier-like run at once, so a keyword is never matched
      // inside a longer word (`classify` is no `class`).
      const word = /^[\w$]+/.exec(code.slice(index, index + 256));
      index += word ? word[0].length : 1;
      continue;
    }
    const type = (Object.entries(match.groups ?? {}).find(([, value]) => value !== undefined)?.[0] ?? 'plain') as HighlightTokenType;
    pushPlain(index);
    tokens.push({ type, text: match[0] });
    index += match[0].length;
    plainStart = index;
  }
  pushPlain(code.length);
  return tokens;
}
