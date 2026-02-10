import React from 'react';

/**
 * PluginViewSpec: Schema for a plugin view
 */
export type PluginViewSpec = {
  pluginId: string;
  viewId: string;
  title: string;
  icon?: string;
  Component: React.FC;
};

/**
 * PluginRegistry: Minimal registry for Lab 3 plugins
 * Manages registration and lookup of plugin views
 */
export class PluginRegistry {
  plugins: Map<string, PluginViewSpec[]> = new Map();

  /**
   * Register a plugin with its views
   */
  registerPlugin(pluginId: string, views: PluginViewSpec[]) {
    this.plugins.set(pluginId, views);
  }

  /**
   * Get all views for a plugin
   */
  getPlugin(pluginId: string) {
    return this.plugins.get(pluginId);
  }

  /**
   * Get views for a specific plugin
   */
  getViews(pluginId: string): PluginViewSpec[] {
    return this.plugins.get(pluginId) || [];
  }

  /**
   * Get list of all registered plugins
   */
  getAllPlugins() {
    return Array.from(this.plugins.keys());
  }
}

export const registry = new PluginRegistry();
