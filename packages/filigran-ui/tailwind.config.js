import {
  isolateInsideOfContainer,
  scopedPreflightStyles,
} from 'tailwindcss-scoped-preflight'
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
    require('tailwindcss-animate'),
    FiligranUIPlugin(),
    scopedPreflightStyles({
      isolationStrategy: isolateInsideOfContainer('.twp', {
        except: '.no-twp', // optional, to exclude some elements under .twp from being preflighted, like external markup
      }),
    }),
  ],
}

export default config
