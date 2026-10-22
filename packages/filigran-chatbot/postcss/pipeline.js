/**
 * The PostCSS plugins that turn `src/assets/index.css` into `dist/styles.css`:
 * Tailwind, then the isolation from the host page. One list, so the stylesheet
 * test compiles exactly what the build ships.
 */
import tailwindcssPostcss from '@tailwindcss/postcss';
import isolateFromHost from './isolate-from-host.js';

/** *tailwindOptions* go to `@tailwindcss/postcss` (the build leaves them at their defaults). */
export function stylesheetPlugins(tailwindOptions) {
  return [tailwindcssPostcss(tailwindOptions), isolateFromHost()];
}
