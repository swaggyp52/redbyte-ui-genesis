import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../tools/config/vitest.base.config';

export default mergeConfig(baseConfig, {
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
