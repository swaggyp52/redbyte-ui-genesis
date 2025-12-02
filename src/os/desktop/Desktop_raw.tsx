import React, { useEffect, useState } from "react";
import StatusBar from "../statusbar/StatusBar";
import { ExplainBar } from "../window/ExplainBar";

// Import apps
import { RedstoneLabApp } from "../../apps/RedstoneLabApp";
import { LogicWorkspaceApp } from "../../apps/LogicWorkspaceApp";
import { CpuDesignerApp } from "../../apps/CpuDesignerApp";
import { TerminalApp } from "../../apps/TerminalApp";
import { NotesApp } from "../../apps/NotesApp";
import { SystemMonitorApp } from "../../apps/SystemMonitorApp";

type DesktopAppId =
  | "redstone-lab"
  | "logic-workspace"
  | "cpu-designer"
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
    icon: "?",
    component: RedstoneLabApp,
  },
  {
    id: "logic-workspace",
    title: "Logic Designer",
    description: "2D logic diagrams with explanations and exports.",
    icon: "??",
    component: LogicWorkspaceApp,
  },
  {
    id: "cpu-designer",
    title: "CPU Designer",
    description: "ALU, registers, PC, control — CPU architecture studio.",
    icon: "???",
    component: CpuDesignerApp,
  },
  {
    id: "terminal",
    title: "Terminal",
    description: "Command-line playground inside RedByte.",
    icon: "??",
    component: TerminalApp,
  },
  {
    id: "notes",
    title: "Notes",
    description: "Write ideas, circuit notes, CPU plans, diagrams.",
    icon: "??",
    component: NotesApp,
  },
  {
    id: "system-monitor",
    title: "System Monitor",
    description: "Virtual CPU load, memory, OS stats.",
    icon: "??",
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

const INITIAL_WIDTH = 680;
const INITIAL_HEIGHT = 460;

export function Desktop() {
  const [windows, setWindows] = useState<DesktopWindow[]>([]);
  const [activeId, setActiveId] = useState<WindowId | null>(null);
  const [drag, setDrag] = useState<DragState>({ winId: null, offsetX: 0, offsetY: 0 });
  const [missionControl, setMissionControl] = useState(false);

  // Global shortcut: Ctrl+E = Explain active window
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "KeyE") {
        e.preventDefault();
        const win = windows.find((w) => w.id === activeId);
        if (win) {
          // We don’t open anything directly here —
          // ExplainBar is part of each window itself.
          // Shortcut simply toggles a "trigger explain" event later.
          const evt = new CustomEvent("RB_EXPLAIN_TRIGGER", {
            detail: { winId: win.id },
          });
          window.dispatchEvent(evt);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeId, windows]);

  // Dragging logic
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!drag.winId) return;
      setWindows((prev) =>
        prev.map((w) =>
          w.id === drag.winId
            ? { ...w, x: e.clientX - drag.offsetX, y: e.clientY - drag.offsetY }
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

  const openApp = (appId: DesktopAppId) => {
    const def = APP_REGISTRY.find((a) => a.id === appId);
    if (!def) return;
    const id = `${appId}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

    const maxZ = windows.reduce((m, w) => Math.max(m, w.zIndex), 1);
    setWindows((prev) => [
      ...prev,
      {
        id,
        appId,
        title: def.title,
        x: 120,
        y: 120,
        width: INITIAL_WIDTH,
        height: INITIAL_HEIGHT,
        zIndex: maxZ + 1,
      },
    ]);
    setActiveId(id);
  };

  const bringToFront = (id: WindowId) => {
    const maxZ = windows.reduce((m, w) => Math.max(m, w.zIndex), 1);
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zIndex: maxZ + 1 } : w))
    );
    setActiveId(id);
  };

  const closeWindow = (id: WindowId) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const startDrag = (id: WindowId, e: React.MouseEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDrag({
      winId: id,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    });
    bringToFront(id);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100">
      <StatusBar />

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

        {/* Desktop icons */}
        <div className="absolute left-4 top-4 flex flex-col gap-3 z-10">
          {APP_REGISTRY.map((app) => (
            <button
              key={app.id}
              onDoubleClick={() => openApp(app.id)}
              className="flex flex-col items-center gap-1 text-[0.7rem] text-slate-200 hover:text-sky-300"
            >
              <div className="h-10 w-10 rb-glass rounded-2xl flex items-center justify-center border border-slate-700/80 hover:border-sky-500/80">
                <span className="text-lg">{app.icon}</span>
              </div>
              <span className="max-w-[6rem] text-center">{app.title}</span>
            </button>
          ))}
        </div>

        {/* Windows */}
        {windows.map((win) => {
          const def = APP_REGISTRY.find((a) => a.id === win.appId);
          if (!def) return null;
          const AppComponent = def.component;

          return (
            <div
              key={win.id}
              className={`absolute rb-glass rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col ${
                activeId === win.id ? "ring-2 ring-sky-500/70" : ""
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
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400/70" />
                  <span className="text-[0.75rem] font-medium text-slate-100">
                    {win.title}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeWindow(win.id);
                  }}
                  className="h-5 w-5 rounded-full bg-rose-500/70 hover:bg-rose-400 flex items-center justify-center text-[0.6rem] text-slate-950"
                >
                  ×
                </button>
              </div>

              {/* Explain bar */}
              <ExplainBar appId={win.appId} title={win.title} />

              {/* App content */}
              <div className="flex-1 min-h-0 bg-slate-950/95">
                <AppComponent />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// patched in v34












