const baseConfig = require('../../tools/config/tailwind.base.cjs');
const path = require('node:path');

module.exports = {
  ...baseConfig,
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx}')
  ],
};
