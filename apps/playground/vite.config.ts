// Copyright Â© 2025 Connor Angiel â€” RedByte OS Genesis
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

// Plugin to remove ALL modulepreload from HTML (for debugging)
function removeAllModulePreload() {
  return {
    name: 'remove-all-modulepreload',
    transformIndexHtml(html: string) {
      // Remove all modulepreload links to isolate loading issues
      return html.replace(/<link rel="modulepreload"[^>]*>/g, '');
    },
  };
}

export default defineConfig({
  base: "/os/",
  plugins: [react(), tsconfigPaths({ loose: true }), removeAllModulePreload()],
  envPrefix: ['VITE_', 'RB_'],
  publicDir: path.resolve(__dirname, '../../public'),
  define: {
    __GIT_SHA__: JSON.stringify(process.env.GIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? 'dev'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: {
    // Sourcemaps disabled for production optimization
    sourcemap: true,
    // Increase chunk size warning threshold to 750kB to accommodate vendor-3d (Three.js)
    // This chunk is only loaded when user opens Logic Playground, not on cold load
    chunkSizeWarningLimit: 750,
    // Disable Vite's production preload helper.
    // In this repo it can get hoisted into a heavy shared chunk (e.g. app-logic),
    // which forces `main` to statically import that chunk and triggers TDZ crashes
    // in headless/preview boot gates.
    modulePreload: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        lab: path.resolve(__dirname, 'lab.html'),
      },
    },
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

