import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'rb-logic-adapter',
      fileName: 'rb-logic-adapter',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['@rb/rb-logic-core'],
    },
  },
});
