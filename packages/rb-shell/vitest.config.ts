import { fileURLToPath, URL } from 'node:url';
import baseConfig from '../../tools/config/vitest.base.config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...baseConfig,
  resolve: {
    alias: {
      '@rb/rb-windowing': fileURLToPath(new URL('../rb-windowing/src', import.meta.url)),
      '@rb/rb-icons': fileURLToPath(new URL('../rb-icons/src', import.meta.url)),
      '@rb/rb-apps': fileURLToPath(new URL('../rb-apps/src', import.meta.url)),
      '@rb/rb-theme': fileURLToPath(new URL('../rb-theme/src', import.meta.url)),
      '@rb/rb-shell': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
