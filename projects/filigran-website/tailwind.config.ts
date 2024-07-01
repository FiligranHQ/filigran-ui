const FiligranUIPlugin = require('filigran-ui/plugin')

const config = {
  darkMode: ['class'],
  content: [
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './content/**/*.{ts,tsx,mdx}',
    '../../packages/filigran-ui/src/components/**/*.{ts,tsx}',
  ],
  prefix: '',
  plugins: [require('tailwindcss-animate'), FiligranUIPlugin()],
}

export default config
