import { fileURLToPath, URL } from 'node:url';
import baseConfig from '../../tools/config/vitest.base.config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...baseConfig,
  resolve: {
    alias: {
      '@rb/rb-tokens': fileURLToPath(new URL('../rb-tokens/src', import.meta.url)),
    },
  },
});
