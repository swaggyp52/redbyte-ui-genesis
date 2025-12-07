const baseConfig = require("../../tools/config/tailwind.base.cjs");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...(baseConfig.theme?.extend ?? {}),
    },
  },
};
