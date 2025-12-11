import FiligranUIPlugin from 'filigran-ui/plugin'
import type {Config} from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate';
import tailwindcssTypography from '@tailwindcss/typography';

const config: Config = {
  darkMode: ['class'],
  content: [
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './content/**/*.{ts,tsx,mdx}',
    '../../packages/filigran-ui/src/components/**/*.{ts,tsx}',
  ],
  plugins: [
    tailwindcssAnimate,
    FiligranUIPlugin(),
    tailwindcssTypography,
  ],
  prefix: '',
};

export default config
