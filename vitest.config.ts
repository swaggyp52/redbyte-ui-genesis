import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Prioritize .ts before .js so local TS source files are always preferred over
    // any stale compiled .js artefacts that may exist alongside them in src/.
    extensions: ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.js', '.jsx', '.cjs', '.json'],
    alias: [
      // Force single React instance for all packages
      // Zustand's React adapter needs React to be available, so ensure it resolves correctly
      { find: /^react$/, replacement: path.resolve(__dirname, 'packages/rb-apps/node_modules/react') },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, 'packages/rb-apps/node_modules/react-dom') },
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(__dirname, 'packages/rb-apps/node_modules/react/jsx-runtime') },
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(__dirname, 'packages/rb-apps/node_modules/react/jsx-dev-runtime') },
      // Package aliases
      { find: '@redbyte/rb-analog-sim', replacement: path.resolve(__dirname, 'packages/rb-analog-sim/src') },
      { find: '@redbyte/fpga-bridge', replacement: path.resolve(__dirname, 'packages/rb-fpga-bridge/src') },
      { find: '@redbyte/rb-apps', replacement: path.resolve(__dirname, 'packages/rb-apps/src') },
      { find: '@redbyte/rb-board-profiles', replacement: path.resolve(__dirname, 'packages/rb-board-profiles/src') },
      { find: '@redbyte/rb-fpga-proof-core', replacement: path.resolve(__dirname, 'packages/rb-fpga-proof-core/src') },
      { find: '@redbyte/rb-fpga-signing', replacement: path.resolve(__dirname, 'packages/rb-fpga-signing/src') },
      { find: '@redbyte/rb-fpga-toolchain', replacement: path.resolve(__dirname, 'packages/rb-fpga-toolchain/src') },
      { find: '@redbyte/rb-windowing', replacement: path.resolve(__dirname, 'packages/rb-windowing/src') },
      { find: '@redbyte/rb-shell', replacement: path.resolve(__dirname, 'packages/rb-shell/src') },
      { find: '@redbyte/rb-theme', replacement: path.resolve(__dirname, 'packages/rb-theme/src') },
      { find: '@redbyte/rb-tokens', replacement: path.resolve(__dirname, 'packages/rb-tokens/src') },
      { find: '@redbyte/rb-icons', replacement: path.resolve(__dirname, 'packages/rb-icons/src') },
      { find: '@redbyte/rb-instruments', replacement: path.resolve(__dirname, 'packages/rb-instruments/src') },
      { find: '@redbyte/rb-lab-engine', replacement: path.resolve(__dirname, 'packages/rb-lab-engine/src') },
      { find: '@redbyte/rb-utils', replacement: path.resolve(__dirname, 'packages/rb-utils/src') },
      { find: '@redbyte/rb-primitives', replacement: path.resolve(__dirname, 'packages/rb-primitives/src') },
      { find: '@redbyte/rb-logic-3d', replacement: path.resolve(__dirname, 'packages/rb-logic-3d/src') },
      { find: '@redbyte/rb-logic-adapter', replacement: path.resolve(__dirname, 'packages/rb-logic-adapter/src') },
      { find: '@redbyte/rb-logic-core', replacement: path.resolve(__dirname, 'packages/rb-logic-core/src') },
      { find: '@redbyte/rb-logic-view', replacement: path.resolve(__dirname, 'packages/rb-logic-view/src') },
      { find: '@redbyte/rb-playground', replacement: path.resolve(__dirname, 'packages/rb-playground/src') },
      { find: '@redbyte/rb-protocol', replacement: path.resolve(__dirname, 'packages/rb-protocol/src/bridge.ts') },
      { find: '@redbyte/rb-viewport', replacement: path.resolve(__dirname, 'packages/rb-viewport/src') },
      // Force single React instance by aliasing to root node_modules
      { find: 'react', replacement: path.resolve(__dirname, 'node_modules/react') },
      { find: 'react-dom', replacement: path.resolve(__dirname, 'node_modules/react-dom') },
      { find: 'react/jsx-runtime', replacement: path.resolve(__dirname, 'node_modules/react/jsx-runtime') },
      { find: 'react/jsx-dev-runtime', replacement: path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime') }
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    deps: {
      optimizer: {
        web: {
          enabled: true,
          exclude: ['@redbyte/rb-fpga-toolchain'],
        },
        ssr: {
          enabled: true,
          exclude: ['@redbyte/rb-fpga-toolchain'],
        },
      },
    },
    include: [
      'packages/**/__tests__/**/*.test.ts',
      'packages/**/__tests__/**/*.test.tsx',
      'packages/**/*.test.ts',
      'packages/**/*.test.tsx',
      'apps/**/*.test.ts',
      'apps/**/*.test.tsx',
    ],
    onConsoleLog(log: string, type: 'stdout' | 'stderr'): false | void {
      if (type === 'stderr') {
        // Allow act() warnings for now - they're cosmetic timing issues in LogicCanvas tests
        // TODO: Fix LogicCanvas async state updates to eliminate these warnings
        const isActWarning = log.includes('act(');
        if (isActWarning) {
          return; // Don't fail tests for act() warnings
        }

        // Still fail on other React warnings
        const isWarning = log.includes('Warning:');
        if (isWarning) {
          throw new Error(`Test failed: Console warning detected:\n${log}`);
        }
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'packages/rb-icons/**',
        'packages/rb-primitives/**',
        'packages/rb-shell/**',
        'packages/rb-theme/**',
        'packages/rb-windowing/**',
        'packages/rb-logic-3d/**',
        'packages/rb-playground/**',
        'tools/**',
        'src/**',
      ],
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
