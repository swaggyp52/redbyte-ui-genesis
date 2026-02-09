/**
 * WindowState: Represents the state of a windowed view
 * Used by the window manager to track position, size, and state
 */
export interface WindowState {
  id: string; // Unique window instance ID
  pluginId: string; // ID of the plugin providing this window
  viewId: string; // ID of the view within the plugin
  
  // Position and size
  x: number;
  y: number;
  w: number;
  h: number;
  z: number; // Z-index for stacking order
  
  // Window state flags
  minimized: boolean;
  maximized: boolean;
}

/**
 * Event: Generic event type for undo/redo and time-travel
 */
export interface Event {
  id: string;
  ts: string; // ISO timestamp
  type: string; // Event type identifier
  payload: unknown; // Event-specific data
}
