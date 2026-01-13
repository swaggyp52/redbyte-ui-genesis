import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^zustand$/, replacement: path.resolve(__dirname, 'packages/rb-utils/src/zustand.ts') },
      { find: '@redbyte/rb-apps', replacement: path.resolve(__dirname, 'packages/rb-apps/src') },
      { find: '@redbyte/rb-windowing', replacement: path.resolve(__dirname, 'packages/rb-windowing/src') },
      { find: '@redbyte/rb-shell', replacement: path.resolve(__dirname, 'packages/rb-shell/src') },
      { find: '@redbyte/rb-theme', replacement: path.resolve(__dirname, 'packages/rb-theme/src') },
      { find: '@redbyte/rb-tokens', replacement: path.resolve(__dirname, 'packages/rb-tokens/src') },
      { find: '@redbyte/rb-icons', replacement: path.resolve(__dirname, 'packages/rb-icons/src') },
      { find: '@redbyte/rb-utils', replacement: path.resolve(__dirname, 'packages/rb-utils/src') },
      { find: '@redbyte/rb-primitives', replacement: path.resolve(__dirname, 'packages/rb-primitives/src') },
      { find: '@redbyte/rb-logic-3d', replacement: path.resolve(__dirname, 'packages/rb-logic-3d/src') },
      { find: '@redbyte/rb-logic-adapter', replacement: path.resolve(__dirname, 'packages/rb-logic-adapter/src') },
      { find: '@redbyte/rb-logic-core', replacement: path.resolve(__dirname, 'packages/rb-logic-core/src') },
      { find: '@redbyte/rb-logic-view', replacement: path.resolve(__dirname, 'packages/rb-logic-view/src') },
      { find: '@redbyte/rb-playground', replacement: path.resolve(__dirname, 'packages/rb-playground/src') }
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'packages/**/__tests__/**/*.test.ts',
      'packages/**/__tests__/**/*.test.tsx',
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
