import FiligranUIPlugin from './src/plugin'

const config = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  important: '.filigran-ui',
  plugins: [require('tailwindcss-animate'), FiligranUIPlugin()],
}

export default config
