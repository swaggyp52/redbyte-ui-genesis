import React from "react";
import { useSystem } from "../core/SystemProvider";
import { useNotifications } from "../../kernel/KernelProvider";

export function Taskbar() {
  const {
    windows,
    activeWindowId,
    focusWindow,
    openApp,
    apps,
    minimizeWindow,
  } = useSystem();
  const { unreadCount, clearNotifications } = useNotifications();

  const handleWindowClick = (id: string) => {
    const w = windows.find((win) => win.id === id);
    if (!w) return;
    if (w.id === activeWindowId && !w.isMinimized) {
      minimizeWindow(w.id);
    } else {
      focusWindow(w.id);
    }
  };

  return (
    <div className="absolute bottom-0 inset-x-0 pb-3">
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-3xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-2xl px-3 py-1.5">
        {/* Quick launch */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-800/80">
          {apps.map((app) => (
            <button
              key={app.id}
              onClick={() => openApp(app.id)}
              className="h-7 w-7 flex items-center justify-center rounded-2xl text-lg hover:bg-slate-800/80"
              title={app.name}
            >
              {app.icon ?? "⬜"}
            </button>
          ))}
        </div>

        {/* Running windows */}
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
          {windows.map((w) => (
            <button
              key={w.id}
              onClick={() => handleWindowClick(w.id)}
              className={`px-3 py-1 rounded-2xl text-xs truncate max-w-[10rem] border ${
                w.id === activeWindowId && !w.isMinimized
                  ? "border-pink-500/70 bg-slate-900"
                  : "border-slate-700/80 bg-slate-900/60 hover:border-slate-500"
              } ${w.isMinimized ? "opacity-60" : ""}`}
            >
              {w.title}
            </button>
          ))}

          {windows.length === 0 && (
            <span className="text-[0.65rem] text-slate-500 px-1">
              No windows yet. Open an app.
            </span>
          )}
        </div>

        {/* System area */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800/80 text-[0.65rem] text-slate-400">
          <button
            className="relative flex items-center gap-1 px-2 py-1 rounded-2xl hover:bg-slate-800/80"
            onClick={clearNotifications}
            title={
              unreadCount > 0
                ? `Clear ${unreadCount} notifications`
                : "No notifications"
            }
          >
            <span>🔔</span>
            {unreadCount > 0 && (
              <span className="min-w-[1rem] h-4 px-1 rounded-full bg-rose-500 text-[0.6rem] text-slate-50 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          <span className="hidden sm:inline">RedByte OS</span>
        </div>
      </div>
    </div>
  );
}

























