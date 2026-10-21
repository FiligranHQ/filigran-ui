import type { Translate } from '../types';
import es from './es';
import fr from './fr';
import ja from './ja';

/** The panel's own translations of its keys, which are its English text. */
export type Catalog = Readonly<Record<string, string>>;

// The languages XTM One speaks; a host in another one translates through `t`.
const CATALOGS: Readonly<Record<string, Catalog>> = { es, fr, ja };

/** The languages the panel speaks besides English. */
export const PANEL_LANGUAGES = Object.keys(CATALOGS);

/** The catalog for *locale* (`fr-FR` reads `fr`), or none for English and languages the panel lacks. */
export function catalogFor(locale: string | undefined): Catalog | undefined {
  const tag = locale ?? (typeof navigator !== 'undefined' ? navigator.language : undefined);
  const language = tag?.toLowerCase().split(/[-_]/)[0];
  return language ? CATALOGS[language] : undefined;
}

/**
 * The panel's translator: the host's `t` where it translates a key (returns
 * something other than the key), the panel's own catalog otherwise. A host
 * that translates but names no `locale` keeps its English, not the browser's language.
 */
export function createTranslate(hostT: Translate | undefined, locale: string | undefined): Translate {
  const catalog = locale || !hostT ? catalogFor(locale) : undefined;
  return (key) => {
    const hosted = hostT?.(key);
    if (hosted && hosted !== key) return hosted;
    return catalog?.[key] ?? key;
  };
}
