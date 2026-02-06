// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { RedByteApp } from '../types';
import { HelpApp } from './HelpApp';

export const HelpAppManifest: RedByteApp = {
  manifest: {
    id: 'help',
    name: 'Help & Troubleshooting',
    iconId: 'help-circle',
    category: 'system',
    singleton: true,
    defaultSize: { width: 1000, height: 700 },
    minSize: { width: 800, height: 600 },
  },
  component: HelpApp,
};
