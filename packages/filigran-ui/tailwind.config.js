import {
  isolateInsideOfContainer,
  scopedPreflightStyles,
} from 'tailwindcss-scoped-preflight'
import tailwindcssAnimate from 'tailwindcss-animate';
import FiligranUIPlugin from './src/plugin'

const config = {
    darkMode: ['class'],
    content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  plugins: [
    tailwindcssAnimate,
    FiligranUIPlugin(),
    scopedPreflightStyles({
      isolationStrategy: isolateInsideOfContainer('.twp', {
        except: '.no-twp', // optional, to exclude some elements under .twp from being preflighted, like external markup
      }),
    }),
  ],
}

export default config
