export class WindowManager {
    windows = [];
    zCounter = 1;
    getWindows() {
        return this.windows;
    }
    createWindow(opts) {
        const id = crypto.randomUUID();
        const state = {
            id,
            title: opts.title ?? "Untitled",
            bounds: {
                x: opts.x ?? 100,
                y: opts.y ?? 100,
                width: opts.width ?? 400,
                height: opts.height ?? 300,
            },
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
    closeWindow(id) {
        this.windows = this.windows.filter(w => w.id !== id);
    }
    focusWindow(id) {
        const w = this.windows.find(w => w.id === id);
        if (!w)
            return;
        this.windows.forEach(x => (x.focused = false));
        w.focused = true;
        w.zIndex = this.zCounter++;
    }
    moveWindow(id, x, y) {
        const w = this.windows.find(w => w.id === id);
        if (!w || w.mode !== "normal")
            return;
        w.bounds.x = x;
        w.bounds.y = y;
    }
    resizeWindow(id, width, height) {
        const w = this.windows.find(w => w.id === id);
        if (!w || !w.resizable || w.mode !== "normal")
            return;
        w.bounds.width = width;
        w.bounds.height = height;
    }
    minimizeWindow(id) {
        const w = this.windows.find(w => w.id === id);
        if (!w || !w.minimizable)
            return;
        w.mode = "minimized";
    }
    maximizeWindow(id) {
        const w = this.windows.find(w => w.id === id);
        if (!w || !w.maximizable)
            return;
        w.mode = "maximized";
    }
    restoreWindow(id) {
        const w = this.windows.find(w => w.id === id);
        if (!w)
            return;
        w.mode = "normal";
    }
}
