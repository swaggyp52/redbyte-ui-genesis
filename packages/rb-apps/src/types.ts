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
