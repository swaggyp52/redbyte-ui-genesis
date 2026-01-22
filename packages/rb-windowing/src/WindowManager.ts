// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { CreateWindowOptions, WindowBounds, WindowId, WindowMode, WindowState } from "./types";

export class WindowManager {
  private windows: WindowState[] = [];
  private zCounter = 1;

  getWindows() {
    return this.windows;
  }

  createWindow(opts: CreateWindowOptions): WindowState {
    const id = crypto.randomUUID();

    // Clamp window position to viewport (assume 0,0 is top-left, 1280x800 default viewport)
    const viewportWidth = window?.innerWidth || 1280;
    const viewportHeight = window?.innerHeight || 800;
    const width = Math.min(opts.width ?? 400, viewportWidth);
    const height = Math.min(opts.height ?? 300, viewportHeight);
    let x = opts.x ?? 100;
    let y = opts.y ?? 100;
    if (x + width > viewportWidth) x = viewportWidth - width;
    if (y + height > viewportHeight) y = viewportHeight - height;
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    const state: WindowState = {
      id,
      title: opts.title ?? "Untitled",
      bounds: {
        x,
        y,
        width,
        height,
      },
      mode: "normal",
      zIndex: this.zCounter++,
      focused: true,
      resizable: opts.resizable ?? true,
      minimizable: opts.minimizable ?? true,
      maximizable: opts.maximizable ?? true,
      contentId: opts.contentId,
      // UI can use this for active window highlighting
      lastFocusedAt: Date.now(),
    };

    this.windows.forEach(w => (w.focused = false));
    this.windows.push(state);

    return state;
  }
  mode: "normal",
  zIndex: this.zCounter++,
    focused: true,
      resizable: opts.resizable ?? true,
        minimizable: opts.minimizable ?? true,
          maximizable: opts.maximizable ?? true,
            contentId: opts.contentId,
    };

this.windows.forEach(w => (w.focused = false));
this.windows.push(state);

return state;
  }

closeWindow(id: WindowId) {
  this.windows = this.windows.filter(w => w.id !== id);
}

  focusWindow(id: WindowId) {
    const w = this.windows.find(w => w.id === id);
    if (!w) return;

    this.windows.forEach(x => (x.focused = false));
    w.focused = true;
    w.zIndex = this.zCounter++;
    w.lastFocusedAt = Date.now();
  }

moveWindow(id: WindowId, x: number, y: number) {
  const w = this.windows.find(w => w.id === id);
  if (!w || w.mode !== "normal") return;

  w.bounds.x = x;
  w.bounds.y = y;
}

resizeWindow(id: WindowId, width: number, height: number) {
  const w = this.windows.find(w => w.id === id);
  if (!w || !w.resizable || w.mode !== "normal") return;

  w.bounds.width = width;
  w.bounds.height = height;
}

minimizeWindow(id: WindowId) {
  const w = this.windows.find(w => w.id === id);
  if (!w || !w.minimizable) return;
  w.mode = "minimized";
}

maximizeWindow(id: WindowId) {
  const w = this.windows.find(w => w.id === id);
  if (!w || !w.maximizable) return;
  w.mode = "maximized";
}

restoreWindow(id: WindowId) {
  const w = this.windows.find(w => w.id === id);
  if (!w) return;
  w.mode = "normal";
}
}
