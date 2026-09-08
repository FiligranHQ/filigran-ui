/**
 * `@filigran/chatbot/markdown` — the panel's markdown normalisation helpers,
 * with none of the panel.
 *
 * A host that renders assistant prose through its OWN markdown component (its
 * design tokens, its icon set) still wants identical text handling. Importing
 * these from the package root would work, but the root entry is the whole
 * ~90 kB panel bundle: a host that renders chat prose on an eagerly-loaded
 * route would risk pulling the panel into its entry chunk. This subpath carries
 * only pure `string → string` functions — no React, no DOM, no CSS.
 *
 * Apply them in this order — alt-text is flattened before anything reads line
 * structure, and the JSON wrap must see the raw payload before fences are
 * hardened:
 *
 * ```ts
 * hardenNestedCodeFences(
 *   normalizeMarkdownTables(wrapBareJson(normalizeImageMarkdown(content))),
 * )
 * ```
 *
 * `markdownUrlTransform` goes to react-markdown's `urlTransform` prop.
 */
export { hardenNestedCodeFences, markdownUrlTransform, normalizeImageMarkdown, normalizeMarkdownTables, wrapBareJson } from './utils';
