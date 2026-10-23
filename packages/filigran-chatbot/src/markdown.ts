/**
 * `@filigran/chatbot/markdown` — the panel's markdown normalisation helpers,
 * with none of the panel.
 *
 * A host that renders assistant prose through its OWN markdown component (its
 * design tokens, its icon set) still wants identical text handling. The
 * package root does not export these: it is the whole ~90 kB panel bundle, and
 * a host that renders chat prose on an eagerly-loaded route would risk pulling
 * the panel into its entry chunk. This subpath carries only pure functions of
 * strings — no React, no DOM, no CSS.
 *
 * `prepareMarkdown` applies them as the panel does, in this order — alt-text
 * is flattened before anything reads line structure, and the JSON wrap must
 * see the raw payload before fences are hardened:
 *
 * ```ts
 * hardenNestedCodeFences(
 *   normalizeMarkdownTables(wrapBareJson(normalizeImageMarkdown(content))),
 * )
 * ```
 *
 * A host rewriting the text first (its own URLs) hands the result to it.
 *
 * `markdownUrlTransform` goes to react-markdown's `urlTransform` prop.
 *
 * The answer-marker helpers read the `[[KIND:args]]` markers an agent embeds
 * in its answer (`FILE`, `PRESENTATION`, `REPORT`, `VIDEO`, and the host's own
 * kinds) exactly as the panel does: `splitAnswerMarkers` cuts an answer into
 * prose and marker parts in source order, `stripAnswerMarkers` removes them
 * (for copy, a preview, a notification), and `markerKinds` normalises the
 * host's kind names into the form both take. Both drop a marker cut off at
 * the end of a streaming answer, so it never flickers as raw text.
 */
export {
  hardenNestedCodeFences,
  markdownUrlTransform,
  markerKinds,
  normalizeImageMarkdown,
  normalizeMarkdownTables,
  prepareMarkdown,
  splitAnswerMarkers,
  stripAnswerMarkers,
  wrapBareJson,
} from './utils';
export type { AnswerPart } from './utils';
export type { ChatArtifactKind } from './types';
