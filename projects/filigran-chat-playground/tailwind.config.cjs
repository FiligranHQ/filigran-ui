/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/filigran-chatbotv2/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'chat-dot': {
          '0%, 80%, 100%': { opacity: '0.25', transform: 'scale(0.85)' },
          '40%': { opacity: '1', transform: 'scale(1.15)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'chat-dot': 'chat-dot 1s ease-in-out infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
