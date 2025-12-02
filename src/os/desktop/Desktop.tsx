import React from "react";
import { useSystem } from "../core/SystemProvider";
import { Window } from "./Window";
import { Taskbar } from "./Taskbar";
import { NotificationCenter } from "./NotificationCenter";
import { CommandPalette } from "./CommandPalette";

export function Desktop() {
  const { apps, windows, openApp } = useSystem();

  const visibleWindows = windows.filter((w) => !w.isMinimized);

  return (
    <div className="relative h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 overflow-hidden">
      {/* Wallpaper overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(244,63,94,0.18),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.2),transparent_55%)]" />

      {/* App launcher area */}
      <div className="relative z-10 p-6 flex flex-wrap gap-4">
        {apps.map((app) => (
          <button
            key={app.id}
            onClick={() => openApp(app.id)}
            className="flex flex-col items-center gap-1 w-20 group"
          >
            <div className="rb-glass flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-lg group-hover:border-pink-500/70 group-hover:shadow-pink-500/30 transition">
              {app.icon ?? "⬜"}
            </div>
            <span className="text-xs text-slate-300 group-hover:text-slate-50">
              {app.name}
            </span>
          </button>
        ))}
      </div>

      {/* Windows */}
      <div className="absolute inset-0">
        {visibleWindows.map((w) => (
          <Window key={w.id} window={w} />
        ))}
      </div>

      {/* Notifications overlay */}
      <NotificationCenter />

      {/* Command palette overlay (Ctrl/Cmd + Space) */}
      <CommandPalette />

      {/* Taskbar */}
      <Taskbar />
    </div>
  );
}
