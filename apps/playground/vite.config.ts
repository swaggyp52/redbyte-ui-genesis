// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import path from 'node:path';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// Get git SHA for version metadata (fallback to "dev" if not in git repo)
function getGitSha(): string {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  plugins: [react(), tsconfigPaths({ loose: true })],
  define: {
    __GIT_SHA__: JSON.stringify(getGitSha()),
  },
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
