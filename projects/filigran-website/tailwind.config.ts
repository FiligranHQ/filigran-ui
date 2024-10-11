const FiligranUIPlugin = require('filigran-ui/plugin')
import type {Config} from 'tailwindcss'
const config = {
  darkMode: ['class'],
  content: [
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './content/**/*.{ts,tsx,mdx}',
    '../../packages/filigran-ui/src/components/**/*.{ts,tsx}',
  ],
  plugins: [
    require('tailwindcss-animate'),
    FiligranUIPlugin(),
    require('@tailwindcss/typography'),
  ],
  prefix: '',
} satisfies Config

export default config
