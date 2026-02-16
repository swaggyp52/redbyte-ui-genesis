import { defineConfig } from 'vitest/config';

/**
 * Dedicated vitest config for rb-logic-core tests (including RC-P2)
 * Isolated from root config to avoid loading app setup and test discovery
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'packages/rb-logic-core/src/**/*.test.ts',
      'packages/rb-logic-core/src/**/*.test.tsx',
    ],
  },
});
