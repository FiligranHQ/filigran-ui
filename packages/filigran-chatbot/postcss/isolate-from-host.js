/**
 * Keeps the page that embeds the panel from restyling it.
 *
 * Tailwind puts the panel's utilities in `@layer utilities` and its theme
 * variables in `@layer theme`, and a layered declaration loses to every
 * unlayered one whatever their specificity. A host shipping its own Tailwind
 * build without layers (the Filigran design system does) therefore wins every
 * collision: its `.opacity-0` beats the panel's `group-hover/msg:opacity-100`,
 * so the message actions never show, and its `:root { --radius-lg: 20px }`
 * turns every `rounded-lg` button of the panel round.
 *
 * Run after Tailwind, this takes the utilities out of their layer, each
 * selector scoped to the panel, and declares the theme variables on the panel
 * root, where no host `:root` rule reaches.
 */

export const PANEL_ROOT = '.filigran-chatbot';

/** One class of specificity, added to every utility alike: their order among themselves is unchanged. */
const PANEL_SCOPE = `:is(${PANEL_ROOT}, ${PANEL_ROOT} *)`;

const LEGACY_PSEUDO_ELEMENTS = new Set([':before', ':after', ':first-line', ':first-letter']);

/** Where a selector's trailing pseudo-element starts, which nothing may follow; its length when it has none. */
function pseudoElementStart(selector) {
  let depth = 0;
  for (let i = 0; i < selector.length; i += 1) {
    const char = selector[i];
    if (char === '\\') {
      i += 1;
    } else if (char === '"' || char === "'") {
      const close = selector.indexOf(char, i + 1);
      i = close === -1 ? selector.length : close;
    } else if (char === '(' || char === '[') {
      depth += 1;
    } else if (char === ')' || char === ']') {
      depth -= 1;
    } else if (depth === 0 && char === ':') {
      if (selector[i + 1] === ':') return i;
      const name = selector
        .slice(i)
        .match(/^:[a-z-]+/i)?.[0]
        .toLowerCase();
      if (name && LEGACY_PSEUDO_ELEMENTS.has(name)) return i;
    }
  }
  return selector.length;
}

/** `.opacity-0` -> `.opacity-0:is(.filigran-chatbot, .filigran-chatbot *)`, before any pseudo-element. */
export function scopeToPanel(selector) {
  const at = pseudoElementStart(selector);
  return `${selector.slice(0, at)}${PANEL_SCOPE}${selector.slice(at)}`;
}

/** A rule nested in another (unflattened output) is scoped through its parent. */
function isNested(rule) {
  for (let node = rule.parent; node; node = node.parent) {
    if (node.type === 'rule') return true;
    if (node.type === 'atrule' && /keyframes$/i.test(node.name)) return true;
  }
  return false;
}

function isolateFromHost() {
  return {
    postcssPlugin: 'filigran-chatbot-isolate-from-host',
    OnceExit(root) {
      const layers = [];
      root.walkAtRules('layer', (layer) => {
        if (layer.nodes && (layer.params === 'theme' || layer.params === 'utilities')) layers.push(layer);
      });
      for (const layer of layers) {
        if (layer.params === 'theme') {
          layer.walkRules((rule) => {
            if (rule.selectors.includes(':root') && !rule.selectors.includes(PANEL_ROOT)) rule.selectors = [...rule.selectors, PANEL_ROOT];
          });
          continue;
        }
        layer.walkRules((rule) => {
          if (!isNested(rule)) rule.selectors = rule.selectors.map(scopeToPanel);
        });
        layer.replaceWith(...layer.nodes);
      }
    },
  };
}
isolateFromHost.postcss = true;

export default isolateFromHost;
