import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'RbFpgaProofCore',
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [],
      output: [
        { format: 'es', entryFileNames: '[name].js' },
        { format: 'cjs', entryFileNames: '[name].cjs' },
      ],
    },
  },
});
