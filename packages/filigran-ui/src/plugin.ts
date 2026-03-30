import plugin from 'tailwindcss/plugin'

const FiligranUIPlugin = (): any => {
  // Tailwind v4 CSS-first migration: @theme and @utility now live in src/theme.css.
  // Keep this export as a no-op plugin for backward compatibility.
  return plugin(() => {})
}
export default FiligranUIPlugin
