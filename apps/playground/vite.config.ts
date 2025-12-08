import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths({ loose: true })],
  resolve: {
    alias: {
      '@redbyte/rb-shell': path.resolve(__dirname, '../../packages/rb-shell/src'),
      '@redbyte/rb-apps': path.resolve(__dirname, '../../packages/rb-apps/src'),
      '@redbyte/rb-windowing': path.resolve(__dirname, '../../packages/rb-windowing/src'),
      '@redbyte/rb-theme': path.resolve(__dirname, '../../packages/rb-theme/src'),
      '@redbyte/rb-icons': path.resolve(__dirname, '../../packages/rb-icons/src'),
      '@redbyte/rb-utils': path.resolve(__dirname, '../../packages/rb-utils/src'),
      react: path.resolve(__dirname, './node_modules/react'),
      'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime.js'),
    },
  },
  server: {
    port: 5173,
  },
});
