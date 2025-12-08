// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths({ loose: true })],

  resolve: {
    alias: {
      '@redbyte/rb-windowing': new URL('../../packages/rb-windowing/src/index.ts', import.meta.url).pathname,
      '@redbyte/rb-apps': new URL('../../packages/rb-apps/src/index.ts', import.meta.url).pathname,
      '@redbyte/rb-icons': new URL('../../packages/rb-icons/src/index.ts', import.meta.url).pathname,
      '@redbyte/rb-theme': new URL('../../packages/rb-theme/src/index.ts', import.meta.url).pathname
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
        '@redbyte/rb-apps',
        '@redbyte/rb-icons',
        '@redbyte/rb-theme'
      ]
    }
  }
});
