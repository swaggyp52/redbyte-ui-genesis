import type { FC } from 'react';

/**
 * PluginView: A single view provided by a lab plugin
 * Component must be a React FC, NOT a render closure
 */
export interface PluginView {
  id: string;
  title: string;
  icon?: string; // Lucide icon name (optional)
  Component: FC; // React Functional Component
}

/**
 * LabPlugin: Contract for registrable lab plugins
 */
export interface LabPlugin {
  id: string;
  title: string;
  icon?: string; // Lucide icon name (optional)
  views: PluginView[];
}
