const FiligranUIPlugin =  require('filigran-ui/plugin')

const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/filigran-ui/src/components/**/*.{ts,tsx}'
  ],
  prefix: '',
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography'), FiligranUIPlugin()],
}

export default config
