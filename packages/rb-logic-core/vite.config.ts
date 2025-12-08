import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'rb-logic-core',
      fileName: 'rb-logic-core',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [],
    },
  },
});
