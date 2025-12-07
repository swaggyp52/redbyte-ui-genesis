import { describe, expect, it } from "vitest";
import { createWindowingStore } from "./index";

describe("windowing store", () => {
  it("opens and focuses new windows", () => {
    const store = createWindowingStore();
    const id = store.getState().openWindow({ appId: "app", title: "App" });
    const state = store.getState();
    expect(state.focusedWindowId).toBe(id);
    expect(state.windows[0].focused).toBe(true);
  });

  it("updates focus and z-order", () => {
    const store = createWindowingStore();
    const first = store.getState().openWindow({ appId: "app1", title: "One" });
    const second = store.getState().openWindow({ appId: "app2", title: "Two" });
    store.getState().focusWindow(first);
    const ordered = store.getState().getZOrderedWindows();
    expect(ordered[ordered.length - 1].id).toBe(first);
    expect(store.getState().focusedWindowId).toBe(first);
  });

  it("moves and resizes windows with snapping", () => {
    const store = createWindowingStore({ snapToGrid: 10 });
    const id = store.getState().openWindow({ appId: "app", title: "App" });
    store.getState().moveWindow(id, { x: 23, y: 27 });
    store.getState().resizeWindow(id, { width: 333 });
    const win = store.getState().windows.find((w) => w.id === id);
    expect(win?.bounds.x).toBe(20);
    expect(win?.bounds.width).toBe(330);
  });

  it("toggles minimize and maximize", () => {
    const store = createWindowingStore();
    const id = store.getState().openWindow({ appId: "app", title: "App" });
    store.getState().toggleMinimize(id);
    expect(store.getState().windows.find((w) => w.id === id)?.minimized).toBe(true);
    store.getState().toggleMaximize(id);
    expect(store.getState().windows.find((w) => w.id === id)?.maximized).toBe(true);
  });

  it("closes windows and updates focus", () => {
    const store = createWindowingStore();
    const first = store.getState().openWindow({ appId: "app1", title: "One" });
    const second = store.getState().openWindow({ appId: "app2", title: "Two" });
    store.getState().closeWindow(second);
    expect(store.getState().windows.some((w) => w.id === second)).toBe(false);
    expect(store.getState().focusedWindowId).toBe(first);
  });
});
