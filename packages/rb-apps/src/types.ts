// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export type PersistenceMode = 'none' | 'session' | 'project';

export interface AppManifest {
  id: string;
  name: string;
  iconId: string;
  description?: string;
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  singleton?: boolean;
  category?: 'system' | 'tools' | 'logic' | 'examples';
  /** How this app's state should persist. Default: 'none'. */
  persistence?: PersistenceMode;
  /** Hidden from launcher; still accessible via terminal or URL. */
  hidden?: boolean;
}

export interface RedByteApp {
  manifest: AppManifest;
  component: React.ComponentType<any>;
}
