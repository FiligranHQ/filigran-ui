const AUTOMATIC_COLOR_PATTERN = /windowtext/i;
const BLACK_VALUES = ['black', '#000', '#000000', 'rgb(0, 0, 0)', 'rgb(0,0,0)'];
const OFFICE_PROPERTY_PATTERN = /^mso-/;

const declarationParts = (declaration: string): [string, string] => {
  const separator = declaration.indexOf(':');
  return separator < 0 ? [declaration.trim().toLowerCase(), ''] : [declaration.slice(0, separator).trim().toLowerCase(), declaration.slice(separator + 1).trim()];
};

// Cleans the inline styles of Word desktop HTML, once the transforms that read Word's mso- properties have run:
// - the mso- declarations go: no browser applies them, and a style left with nothing else would be saved as an empty
//   style attribute that the next load drops, changing the saved HTML;
// - Word's "Automatic" text color goes too, so that the text follows the theme. Word writes it as `color:windowtext`,
//   or as `color:black` with `mso-color-alt:windowtext`; an explicit black, without that alternative, is kept.
export const cleanWordStyles = (html: string): string => {
  if (!/style=/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let changed = false;
  doc.body.querySelectorAll('[style]').forEach((element) => {
    const declarations = (element.getAttribute('style') ?? '').split(';').filter((declaration) => declaration.trim() !== '');
    const automaticColor = declarations.some((declaration) => {
      const [property, value] = declarationParts(declaration);
      return property === 'mso-color-alt' && AUTOMATIC_COLOR_PATTERN.test(value);
    });
    const kept = declarations.filter((declaration) => {
      const [property, value] = declarationParts(declaration);
      if (OFFICE_PROPERTY_PATTERN.test(property)) return false;
      if (property !== 'color') return true;
      return !(AUTOMATIC_COLOR_PATTERN.test(value) || (automaticColor && BLACK_VALUES.includes(value.toLowerCase())));
    });
    if (kept.length === declarations.length) return;
    if (kept.length > 0) element.setAttribute('style', kept.join(';'));
    else element.removeAttribute('style');
    changed = true;
  });
  return changed ? doc.documentElement.outerHTML : html;
};
