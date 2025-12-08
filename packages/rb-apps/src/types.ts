// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export interface AppManifest {
  id: string;
  name: string;
  iconId: string;
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  singleton?: boolean;
  category?: 'system' | 'tools' | 'logic' | 'examples';
}

export interface RedByteApp {
  manifest: AppManifest;
  component: React.ComponentType<any>;
}
