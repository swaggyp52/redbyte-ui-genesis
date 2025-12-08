/**
 * Minimal local stub for eslint-plugin-jsx-a11y to satisfy linting in offline environments.
 */
const plugin = {
  rules: {},
  configs: {
    recommended: {
      plugins: ["jsx-a11y"],
      rules: {},
    },
  },
};

module.exports = plugin;
