import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    tsconfigPaths({
      loose: true
    })
  ],

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
    lib: {
      entry: 'src/index.ts',
      formats: ['es']
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',

        '@redbyte/rb-windowing',
        '@redbyte/rb-tokens',
        '@redbyte/rb-theme',
        '@redbyte/rb-icons',
        '@redbyte/rb-primitives',
        '@redbyte/rb-shell',
        '@redbyte/rb-logic-core',
        '@redbyte/rb-logic-view',
        '@redbyte/rb-logic-3d',
        '@redbyte/rb-apps',

        '@rb/rb-tokens',
        '@rb/rb-icons',
        '@rb/rb-shell',
        '@rb/rb-windowing',
        '@rb/rb-apps',
        '@rb/rb-theme'
      ]
    }
  }
});
