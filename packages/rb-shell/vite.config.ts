import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths({ loose: true })],

  resolve: {
    alias: {
      '@rb/rb-windowing': new URL('../../packages/rb-windowing/src/index.ts', import.meta.url).pathname,
      '@rb/rb-apps': new URL('../../packages/rb-apps/src/index.ts', import.meta.url).pathname,
      '@rb/rb-icons': new URL('../../packages/rb-icons/src/index.ts', import.meta.url).pathname,
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

        '@rb/rb-windowing',
        '@rb/rb-apps',
        '@rb/rb-icons',
        '@rb/rb-theme',

        '@rb/rb-windowing',
        '@rb/rb-apps',
        '@rb/rb-icons',
        '@rb/rb-theme'
      ]
    }
  }
});
