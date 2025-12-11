/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("tailwindcss-preset-email")],
  content: [
      './src/components/**/*.html',
      './src/templates/**/*.html',
      './src/layouts/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        background: "#F1F5F9",
        foreground: "#00020c",
      },
    },
  },
};
