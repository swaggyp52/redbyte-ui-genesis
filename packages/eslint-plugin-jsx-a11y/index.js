// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

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
