import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@rb/rb-tokens': new URL('../../packages/rb-tokens/src/index.ts', import.meta.url).pathname,
      '@rb/rb-icons': new URL('../../packages/rb-icons/src/index.ts', import.meta.url).pathname,
      '@rb/rb-shell': new URL('../../packages/rb-shell/src/index.ts', import.meta.url).pathname,
      '@rb/rb-windowing': new URL('../../packages/rb-windowing/src/index.ts', import.meta.url).pathname,
      '@rb/rb-apps': new URL('../../packages/rb-apps/src/index.ts', import.meta.url).pathname,
      '@rb/rb-theme': new URL('../../packages/rb-theme/src/index.ts', import.meta.url).pathname
    }
  },

  build: {
    rollupOptions: {
      external: [
        // REDBYTE pkg names
        '@redbyte/rb-windowing',
        '@redbyte/rb-apps',
        '@redbyte/rb-shell',
        '@redbyte/rb-theme',
        '@redbyte/rb-icons',
        '@redbyte/rb-primitives',
        '@redbyte/rb-tokens',
        '@redbyte/rb-logic-core',
        '@redbyte/rb-logic-view',
        '@redbyte/rb-logic-3d',

        // RB alias package names your code ACTUALLY imports
        '@rb/rb-windowing',
        '@rb/rb-apps',
        '@rb/rb-shell',
        '@rb/rb-theme',
        '@rb/rb-icons',
        '@rb/rb-primitives',
        '@rb/rb-tokens',
        '@rb/rb-logic-core',
        '@rb/rb-logic-view',
        '@rb/rb-logic-3d'
      ]
    }
  }
});
