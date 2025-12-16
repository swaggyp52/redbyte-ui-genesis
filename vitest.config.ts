import { defineConfig } from 'vitest/config';

export default defineConfig({
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
