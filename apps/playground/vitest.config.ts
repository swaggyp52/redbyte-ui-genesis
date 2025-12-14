// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { mergeConfig } from 'vitest/config';
import baseConfig from '../../tools/config/vitest.base.config.ts';

export default mergeConfig(baseConfig, {
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
