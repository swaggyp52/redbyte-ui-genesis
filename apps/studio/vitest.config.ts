// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../tools/config/vitest.base.config';

export default mergeConfig(baseConfig, {
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
