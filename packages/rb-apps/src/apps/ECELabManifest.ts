// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { RedByteApp } from '../types';
import { ECELabAppComponent } from './ECELabApp';

export const ECELabApp: RedByteApp = {
    manifest: {
        id: 'ece-lab',
        name: 'Lab Assignment',
        iconId: 'cpu',
        category: 'logic',
        defaultSize: { width: 1400, height: 900 },
        minSize: { width: 1024, height: 768 }, // Enough for split view
    },
    component: ECELabAppComponent,
};
