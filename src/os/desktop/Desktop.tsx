import React, { useEffect, useState } from "react";
import StatusBar from "../statusbar/StatusBar";
import { ExplainBar } from "../window/ExplainBar";
import { CommandPalette } from "../palette/CommandPalette";
import { registerCommand, onCommand } from "../palette/CommandRegistry";

// Existing app imports
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

const APPS: DesktopAppDef[] = [
  {
    id: "redstone-lab",
    title: "Redstone Lab",
    description: "3D + 2D circuits.",
    icon: "⚡",
    component: RedstoneLabApp,
  },
  {
    id: "logic-workspace",
    title: "Logic Designer",
    description: "2D logic diagramming.",
    icon: "🧠",
    component: LogicWorkspaceApp,
  },
  {
    id: "cpu-designer",
    title: "CPU Designer",
    description: "CPU architecture designer.",
    icon: "🖥️",
    component: CpuDesignerApp,
  },
  {
    id: "terminal",
    title: "Terminal",
    description: "CLI inside RedByte.",
    icon: "⌨️",
    component: TerminalApp,
  },
  {
    id: "notes",
    title: "Notes",
    description: "Simple notes app.",
    icon: "📝",
    component: NotesApp,
  },
  {
    id: "system-monitor",
    title: "System Monitor",
    description: "Virtual CPU, mem, metrics.",
    icon: "📊",
    component: SystemMonitorApp,
  },
];

// -------------------------------
// Register apps as commands
// -------------------------------
APPS.forEach((app) =>
  registerCommand({
    id: `open-${app.id}`,
    label: `Open ${app.title}`,
    keywords: [app.title.toLowerCase(), app.id],
    action: () => window.dispatchEvent(new CustomEvent("RB_OPEN_APP", { detail: { id: app.id } })),
  })
);

// Register OS-level commands
registerCommand({
  id: "explain-active",
  label: "Explain Active Window",
  keywords: ["help", "explain", "ai"],
  action: () => window.dispatchEvent(new CustomEvent("RB_EXPLAIN_TRIGGER"))
});

registerCommand({
  id: "mission-control",
  label: "Open Mission Control",
  keywords: ["overview", "windows"],
  action: () => window.dispatchEvent(new CustomEvent("RB_MISSION_CONTROL"))
});

registerCommand({
  id: "new-note",
  label: "New Note",
  keywords: ["create note", "notes"],
  action: () =>
    window.dispatchEvent(new CustomEvent("RB_OPEN_APP", { detail: { id: "notes" } })),
});


// -------------------------------
// Desktop Implementation
// -------------------------------

export function Desktop() {
  const [windows, setWindows] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [missionControl, setMissionControl] = useState(false);

  // Global hotkeys:
  // Ctrl+K → command palette
  // Ctrl+Space → mission control
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "KeyK") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        setMissionControl((m) => !m);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Handle commands emitted globally
  useEffect(() => {
    const openApp = (e: any) => {
      const appId = e.detail.id;
      const def = APPS.find((x) => x.id === appId);
      if (!def) return;
      const id = `${appId}-${Date.now()}`;
      setWindows((prev) => [
        ...prev,
        {
          id,
          appId,
          title: def.title,
          x: 140,
          y: 120,
          width: 680,
          height: 460,
          z: prev.length + 2,
        },
      ]);
      setActive(id);
    };

    const mc = () => setMissionControl(true);

    window.addEventListener("RB_OPEN_APP", openApp as any);
    window.addEventListener("RB_MISSION_CONTROL", mc as any);

    return () => {
      window.removeEventListener("RB_OPEN_APP", openApp as any);
      window.removeEventListener("RB_MISSION_CONTROL", mc as any);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <StatusBar />

      {/* Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Desktop BG */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

        {/* Desktop icons */}
        <div className="absolute left-4 top-4 flex flex-col gap-3 z-10">
          {APPS.map((app) => (
            <button
              key={app.id}
              onDoubleClick={() =>
                window.dispatchEvent(new CustomEvent("RB_OPEN_APP", { detail: { id: app.id } }))
              }
              className="flex flex-col items-center gap-1 text-[0.75rem] text-slate-200 hover:text-sky-300"
            >
              <div className="h-10 w-10 rb-glass rounded-2xl flex items-center justify-center border border-slate-700/80 hover:border-sky-500/80">
                <span className="text-xl">{app.icon}</span>
              </div>
              {app.title}
            </button>
          ))}
        </div>

        {/* Windows */}
        {windows.map((win) => {
          const def = APPS.find((x) => x.id === win.appId);
          if (!def) return null;
          const AppComponent = def.component;

          return (
            <div
              key={win.id}
              style={{
                position: "absolute",
                left: win.x,
                top: win.y,
                width: win.width,
                height: win.height,
                zIndex: win.z,
              }}
              className={`rb-glass border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col ${
                active === win.id ? "ring-2 ring-sky-500/70" : ""
              }`}
              onMouseDown={() => setActive(win.id)}
            >
              {/* Top bar */}
              <div className="h-8 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between px-3">
                <div className="text-[0.75rem] text-slate-100 font-medium">{win.title}</div>
                <button
                  onClick={() =>
                    setWindows((prev) => prev.filter((x) => x.id !== win.id))
                  }
                  className="h-5 w-5 rounded-full bg-rose-500/70 text-slate-900 text-[0.7rem] flex items-center justify-center"
                >
                  ×
                </button>
              </div>

              {/* Explain bar */}
              <ExplainBar appId={win.appId} title={win.title} />

              {/* Content */}
              <div className="flex-1 min-h-0 bg-slate-950/95 p-1 overflow-hidden">
                <AppComponent />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Desktop;
