import { TextStyle as TextStyleBase } from '@tiptap/extension-text-style';
import type { TagParseRule } from '@tiptap/pm/model';

/**
 * Legacy editor font-size class → pixel value mapping.
 * Shared with FontSize.ts to keep the two extensions in sync.
 */
export const LEGACY_FONT_SIZE_MAP: Record<string, string> = {
  'text-tiny': '0.7em',
  'text-small': '0.85em',
  'text-big': '1.4em',
  'text-huge': '1.8em',
};

// Style properties read by the attributes registered on textStyle (Color, BackgroundColor, FontFamily, FontSize),
// shorthands included: `font` sets the family and size, `background` the color.
const KEPT_STYLE_PATTERN = /(?:^|;)\s*(?:color|background(?:-color)?|font(?:-family|-size)?)\s*:/i;

/**
 * Extends TipTap's TextStyle mark to also accept legacy editor font-size class
 * spans (e.g. <span class="text-big">). Without this, TextStyle rejects any
 * span that has no style attribute, so FontSize's addGlobalAttributes is
 * never reached for legacy editor class-only spans.
 */

export const TextStyle = TextStyleBase.extend({
  parseHTML() {
    const [spanRule, ...otherRules] = this.parent?.() ?? [];
    // A span whose style holds nothing the editor keeps (a pasted mso- property, for example) would be saved as a
    // bare <span>, which the next load drops: the saved HTML would change on reload. It is not made a text style.
    const keptSpanRule: TagParseRule[] = spanRule && 'tag' in spanRule && spanRule.tag
      ? [{
        ...spanRule,
        getAttrs: (node: HTMLElement) => (KEPT_STYLE_PATTERN.test(node.getAttribute('style') ?? '')
          ? (spanRule.getAttrs?.(node) ?? {})
          : false),
      }]
      : [];
    return [
      ...keptSpanRule,
      ...otherRules,
      // Accept legacy editor font-size class spans (no inline style)
      ...Object.keys(LEGACY_FONT_SIZE_MAP).map((cls) => ({
        tag: `span.${cls}`,
        consuming: false,
        getAttrs: () => ({}),
      })),
    ];
  },
});
