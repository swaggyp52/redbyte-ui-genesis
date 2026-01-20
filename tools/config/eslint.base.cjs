module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "jsx-a11y"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jsx-a11y/recommended",
    "prettier",
  ],
  rules: {
    // Suppress false positives for ARIA attribute proptypes in JSX
    'jsx-a11y/aria-proptypes': 'off',
  },
};
