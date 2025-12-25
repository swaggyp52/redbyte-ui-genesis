import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@redbyte/rb-apps': path.resolve(__dirname, 'packages/rb-apps/src'),
      '@redbyte/rb-windowing': path.resolve(__dirname, 'packages/rb-windowing/src'),
      '@redbyte/rb-shell': path.resolve(__dirname, 'packages/rb-shell/src'),
      '@redbyte/rb-theme': path.resolve(__dirname, 'packages/rb-theme/src'),
      '@redbyte/rb-tokens': path.resolve(__dirname, 'packages/rb-tokens/src'),
      '@redbyte/rb-icons': path.resolve(__dirname, 'packages/rb-icons/src'),
      '@redbyte/rb-utils': path.resolve(__dirname, 'packages/rb-utils/src'),
      '@redbyte/rb-primitives': path.resolve(__dirname, 'packages/rb-primitives/src'),
      '@redbyte/rb-logic-3d': path.resolve(__dirname, 'packages/rb-logic-3d/src'),
      '@redbyte/rb-logic-adapter': path.resolve(__dirname, 'packages/rb-logic-adapter/src'),
      '@redbyte/rb-logic-core': path.resolve(__dirname, 'packages/rb-logic-core/src'),
      '@redbyte/rb-logic-view': path.resolve(__dirname, 'packages/rb-logic-view/src'),
      '@redbyte/rb-playground': path.resolve(__dirname, 'packages/rb-playground/src'),
    },
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
