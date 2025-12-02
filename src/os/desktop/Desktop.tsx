import React, { useEffect, useState } from "react";
import StatusBar from "../statusbar/StatusBar";

// Import a few core apps that already exist in your project
import { RedstoneLabApp } from "../../apps/RedstoneLabApp";
import { LogicWorkspaceApp } from "../../apps/LogicWorkspaceApp";
import { TerminalApp } from "../../apps/TerminalApp";
import { NotesApp } from "../../apps/NotesApp";
import { SystemMonitorApp } from "../../apps/SystemMonitorApp";

type DesktopAppId =
  | "redstone-lab"
  | "logic-workspace"
  | "terminal"
  | "notes"
  | "system-monitor";

interface DesktopAppDef {
  id: DesktopAppId;
  title: string;
  description: string;
  icon: string;
  component: React.ComponentType;
}

const APP_REGISTRY: DesktopAppDef[] = [
  {
    id: "redstone-lab",
    title: "Redstone Lab",
    description: "3D + 2D circuits, dust, repeaters, comparators.",
    icon: "⚡",
    component: RedstoneLabApp,
  },
  {
    id: "logic-workspace",
    title: "Logic Designer",
    description: "2D logic diagrams with explanations and exports.",
    icon: "🧠",
    component: LogicWorkspaceApp,
  },
  {
    id: "terminal",
    title: "Terminal",
    description: "Command-line playground inside RedByte.",
    icon: "⌨️",
    component: TerminalApp,
  },
  {
    id: "notes",
    title: "Notes",
    description: "Simple notes for ideas, circuits, todos.",
    icon: "📝",
    component: NotesApp,
  },
  {
    id: "system-monitor",
    title: "System Monitor",
    description: "CPU, memory, and OS-like stats.",
    icon: "📊",
    component: SystemMonitorApp,
  },
];

type WindowId = string;

interface DesktopWindow {
  id: WindowId;
  appId: DesktopAppId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

interface DragState {
  winId: WindowId | null;
  offsetX: number;
  offsetY: number;
}

const INITIAL_WIDTH = 640;
const INITIAL_HEIGHT = 420;

export function Desktop() {
  const [windows, setWindows] = useState<DesktopWindow[]>([]);
  const [activeId, setActiveId] = useState<WindowId | null>(null);
  const [drag, setDrag] = useState<DragState>({ winId: null, offsetX: 0, offsetY: 0 });
  const [missionControl, setMissionControl] = useState(false);

  // Handle global mouse move / up for dragging
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!drag.winId) return;
      setWindows((prev) =>
        prev.map((w) =>
          w.id === drag.winId
            ? {
                ...w,
                x: e.clientX - drag.offsetX,
                y: e.clientY - drag.offsetY,
              }
            : w
        )
      );
    };

    const handleUp = () => {
      if (!drag.winId) return;
      setDrag({ winId: null, offsetX: 0, offsetY: 0 });
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [drag]);

  // Simple keyboard toggle for Mission Control (Ctrl+Space)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.ctrlKey) {
        e.preventDefault();
        setMissionControl((m) => !m);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const bringToFront = (id: WindowId) => {
    setWindows((prev) => {
      const maxZ = prev.reduce((m, w) => Math.max(m, w.zIndex), 1);
      return prev.map((w) =>
        w.id === id ? { ...w, zIndex: maxZ + 1 } : w
      );
    });
    setActiveId(id);
  };

  const openApp = (appId: DesktopAppId) => {
    const def = APP_REGISTRY.find((a) => a.id === appId);
    if (!def) return;
    setWindows((prev) => {
      const maxZ = prev.reduce((m, w) => Math.max(m, w.zIndex), 1);
      const id = `${appId}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
      const x = 80 + (prev.length * 32) % 200;
      const y = 80 + (prev.length * 24) % 160;

      const win: DesktopWindow = {
        id,
        appId,
        title: def.title,
        x,
        y,
        width: INITIAL_WIDTH,
        height: INITIAL_HEIGHT,
        zIndex: maxZ + 1,
      };
      return [...prev, win];
    });
  };

  const closeWindow = (id: WindowId) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  };

  const startDrag = (id: WindowId, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDrag({
      winId: id,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });
    bringToFront(id);
  };

  const toggleMissionControl = () => {
    setMissionControl((m) => !m);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100">
      <StatusBar />

      {/* Desktop body */}
      <div className="flex-1 relative overflow-hidden">
        {/* Wallpaper */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

        {/* App icons on desktop (left side) */}
        <div className="absolute left-4 top-4 flex flex-col gap-3 z-10">
          {APP_REGISTRY.map((app) => (
            <button
              key={app.id}
              onDoubleClick={() => openApp(app.id)}
              className="flex flex-col items-center gap-1 text-[0.7rem] text-slate-200 hover:text-sky-300 focus:outline-none"
            >
              <div className="h-10 w-10 rounded-2xl rb-glass flex items-center justify-center border border-slate-700/80 hover:border-sky-500/80">
                <span className="text-lg">{app.icon}</span>
              </div>
              <span className="max-w-[6rem] text-center leading-tight">
                {app.title}
              </span>
            </button>
          ))}
        </div>

        {/* Mission Control toggle (top-right) */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <button
            onClick={toggleMissionControl}
            className="px-3 py-1 rounded-full border border-sky-500/70 bg-slate-950/80 text-[0.7rem] text-sky-200 hover:bg-sky-500/10"
          >
            Mission Control
          </button>
          <span className="text-[0.65rem] text-slate-500 hidden sm:inline">
            (Ctrl + Space)
          </span>
        </div>

        {/* Windows */}
        {windows.map((win) => {
          const def = APP_REGISTRY.find((a) => a.id === win.appId);
          if (!def) return null;
          const AppComponent = def.component;
          const isActive = activeId === win.id;

          return (
            <div
              key={win.id}
              className={`absolute rb-glass rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl flex flex-col ${
                isActive ? "ring-2 ring-sky-500/70" : ""
              }`}
              style={{
                left: win.x,
                top: win.y,
                width: win.width,
                height: win.height,
                zIndex: win.zIndex,
              }}
              onMouseDown={() => bringToFront(win.id)}
            >
              {/* Title bar */}
              <div
                className="h-8 flex items-center justify-between px-3 cursor-move bg-slate-950/90 border-b border-slate-800/80"
                onMouseDown={(e) => startDrag(win.id, e)}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                  <span className="text-[0.75rem] font-medium text-slate-100">
                    {win.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeWindow(win.id);
                    }}
                    className="h-5 w-5 rounded-full bg-rose-500/70 hover:bg-rose-400 flex items-center justify-center text-[0.6rem] text-slate-950"
                    title="Close window"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-h-0 bg-slate-950/95">
                <AppComponent />
              </div>
            </div>
          );
        })}

        {/* Mission Control overlay */}
        {missionControl && (
          <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Mission Control
                </h2>
                <p className="text-[0.7rem] text-slate-400">
                  All open windows in one place. Click a tile to focus it.
                </p>
              </div>
              <button
                onClick={toggleMissionControl}
                className="px-3 py-1 rounded-full border border-slate-600/80 text-[0.7rem] text-slate-200 hover:bg-slate-800/80"
              >
                Close
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {windows.length === 0 && (
                <div className="flex items-center justify-center text-[0.75rem] text-slate-500 border border-dashed border-slate-700/80 rounded-2xl">
                  No open windows. Double-click an icon on the desktop to launch an app.
                </div>
              )}

              {windows.map((win) => {
                const def = APP_REGISTRY.find((a) => a.id === win.appId);
                if (!def) return null;
                return (
                  <button
                    key={win.id}
                    onClick={() => {
                      bringToFront(win.id);
                      setMissionControl(false);
                    }}
                    className={`rb-glass rounded-2xl border border-slate-800/80 p-3 text-left flex flex-col gap-2 hover:border-sky-500/80 ${
                      activeId === win.id ? "ring-2 ring-sky-500/70" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{def.icon}</span>
                        <div className="flex flex-col">
                          <span className="text-[0.8rem] text-slate-100">
                            {def.title}
                          </span>
                          <span className="text-[0.65rem] text-slate-500">
                            Window ID: {win.id.slice(-6)}
                          </span>
                        </div>
                      </div>
                      <span className="text-[0.65rem] text-slate-500">
                        z:{win.zIndex}
                      </span>
                    </div>
                    <p className="text-[0.7rem] text-slate-400">
                      {def.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Desktop;
