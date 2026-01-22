// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { RedByteApp } from '../types';
import { LogicPlaygroundComponent } from './LogicPlaygroundApp';

export const LogicPlaygroundApp: RedByteApp = {
    manifest: {
        id: 'logic-playground',
        name: 'Logic Playground',
        iconId: 'logic',
        category: 'logic',
        defaultSize: { width: 1200, height: 800 },
        minSize: { width: 800, height: 600 },
    },
    component: LogicPlaygroundComponent,
};
