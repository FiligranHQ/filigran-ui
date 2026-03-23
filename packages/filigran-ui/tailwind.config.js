import tailwindcssAnimate from 'tailwindcss-animate';
import FiligranUIPlugin from './src/plugin'

const config = {
    darkMode: 'class',
    content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  plugins: [tailwindcssAnimate, FiligranUIPlugin()],
}

export default config
