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

export default defineConfig({
  plugins: [react(), tsconfigPaths({ loose: true })],
  define: {
    __GIT_SHA__: JSON.stringify(process.env.GIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? 'dev'),
  },
  build: {
    // Increase chunk size warning threshold to 750kB to accommodate vendor-3d (Three.js)
    // This chunk is only loaded when user opens Logic Playground, not on cold load
    chunkSizeWarningLimit: 750,
    modulePreload: {
      // Ensure vendor-react loads before any chunk that depends on it
      resolveDependencies: (filename, deps, { hostId, hostType }) => {
        // If loading vendor-3d, ensure vendor-react is preloaded first
        if (filename.includes('vendor-3d')) {
          const reactChunk = deps.find(dep => dep.includes('vendor-react'));
          if (reactChunk) {
            return [reactChunk, ...deps.filter(d => d !== reactChunk)];
          }
        }
        return deps;
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
  // Ensure Zustand + use-sync-external-store load with React to avoid prod init-order crash
  if (id.includes('zustand') || id.includes('use-sync-external-store')) return 'vendor-react';

          // Vendor chunk: React ecosystem
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }

          // State management: Zustand
          if (id.includes('node_modules/zustand')) {
            return 'vendor-react';
          }

          // React Three Fiber MUST bundle with React to access createContext
          if (id.includes('node_modules/@react-three')) {
            return 'vendor-react';
          }

          // 3D graphics: Three.js only (React Three Fiber moved to vendor-react)
          if (id.includes('node_modules/three')) {
            return 'vendor-3d';
          }

          // Split heavy apps from rb-apps into separate chunks
          // Files app + file system (largest)
          if (id.includes('packages/rb-apps/src/apps/files') ||
              id.includes('packages/rb-apps/src/apps/FilesApp')) {
            return 'app-files';
          }

          // Settings app + panels (second largest)
          if (id.includes('packages/rb-apps/src/apps/settings') ||
              id.includes('packages/rb-apps/src/apps/SettingsApp')) {
            return 'app-settings';
          }

          // Logic Playground (contains 3D logic)
          if (id.includes('packages/rb-apps/src/apps/LogicPlaygroundApp') ||
              id.includes('packages/rb-logic-3d/src')) {
            return 'app-logic';
          }

          // Other rb-apps (Launcher, Welcome, Terminal, TextViewer, AppStore)
          if (id.includes('packages/rb-apps/src')) {
            return 'rb-apps';
          }

          // RedByte shell (Shell, modals, search)
          if (id.includes('packages/rb-shell/src')) {
            return 'rb-shell';
          }

          // RedByte windowing
          if (id.includes('packages/rb-windowing/src')) {
            return 'rb-windowing';
          }

          // Other RedByte packages (theme, icons, utils) stay in main chunk
          // They're small and needed early
        },
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

