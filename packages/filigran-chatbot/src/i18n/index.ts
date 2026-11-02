import type { Translate } from '../types';
import de from './de';
import es from './es';
import fr from './fr';
import it from './it';
import ja from './ja';
import ko from './ko';
import ru from './ru';
import zh from './zh';

/** The panel's own translations of its keys, which are its English text. */
export type Catalog = Readonly<Record<string, string>>;

// Languages with a catalog; any other is translated through `t`.
const CATALOGS: Readonly<Record<string, Catalog>> = { de, es, fr, it, ja, ko, ru, zh };

/** The catalog for *locale* (`fr-FR` and `zh-cn` read `fr` and `zh`), or none for English and languages the panel lacks. */
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
