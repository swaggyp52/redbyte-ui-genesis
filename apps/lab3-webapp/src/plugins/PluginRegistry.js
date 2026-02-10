/**
 * PluginRegistry: Minimal registry for Lab 3 plugins
 * Manages registration and lookup of plugin views
 */
export class PluginRegistry {
    constructor() {
        Object.defineProperty(this, "plugins", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    /**
     * Register a plugin with its views
     */
    registerPlugin(pluginId, views) {
        this.plugins.set(pluginId, views);
    }
    /**
     * Get all views for a plugin
     */
    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }
    /**
     * Get views for a specific plugin
     */
    getViews(pluginId) {
        return this.plugins.get(pluginId) || [];
    }
    /**
     * Get a specific view by pluginId and viewId
     */
    getView(pluginId, viewId) {
        const views = this.plugins.get(pluginId);
        return views?.find(v => v.viewId === viewId);
    }
    /**
     * Get list of all registered plugins
     */
    getAllPlugins() {
        return Array.from(this.plugins.keys());
    }
}
export const registry = new PluginRegistry();
