import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@rb\/(.+)$/,
        replacement: path.resolve(process.cwd(), '../$1/src'),
      },
    ],
  },
  build: {
    lib: {
      entry: path.resolve(process.cwd(), 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    sourcemap: true,
    rollupOptions: {
      external: [/^react/, /^@?\w/],
    },
  },
});
