import path from 'node:path';
import { defineConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

/**
 * The kernel's pure suite in a plain node environment: no jsdom and no root setup file (which
 * imports the whole app). Passing here is the proof that the kernel and the scene model run
 * without a DOM. Recording-backed kernel tests run under the root config with the runtime.
 */
export default defineConfig({
  root: path.resolve(__dirname, '../..'),
  resolve: rootConfig.resolve,
  test: {
    environment: 'node',
    globals: true,
    include: [
      'packages/rb-studio-kernel/src/**/*.pure.test.ts',
      'packages/rb-studio/src/**/*.pure.test.ts',
      'packages/rb-logic-view/src/__tests__/circuitScene.test.ts',
    ],
  },
});
