/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("tailwindcss-preset-email")],
  theme: {
    extend: {
      colors: {
        background: "#F1F5F9",
        foreground: "#00020c",
      },
    },
  },
};
