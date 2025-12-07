import type { ComponentType, ReactNode } from 'react';
import type { WindowBounds } from '@rb/rb-windowing';

export interface AppManifest {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  defaultBounds?: WindowBounds;
}

export interface RedByteApp {
  manifest: AppManifest;
  component: ComponentType;
}
