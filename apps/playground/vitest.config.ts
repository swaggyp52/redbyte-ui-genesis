import { mergeConfig } from 'vitest/config';
import baseConfig from '../../tools/config/vitest.base.config.ts';

export default mergeConfig(baseConfig, {
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
