// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'rb-logic-core',
      fileName: 'rb-logic-core',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [],
    },
  },
});
