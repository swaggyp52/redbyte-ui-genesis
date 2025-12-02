import React, { useEffect, useState } from "react";
import StatusBar from "../statusbar/StatusBar";
import { ExplainBar } from "../window/ExplainBar";
import { CommandPalette } from "../palette/CommandPalette";
import { registerCommand } from "../palette/CommandRegistry";
import { LoginOverlay } from "../auth/LoginOverlay";
import type { UserProfile } from "../auth/UserStore";

import { RedstoneLabApp } from "../../apps/RedstoneLabApp";
import { LogicWorkspaceApp } from "../../apps/LogicWorkspaceApp";
import { CpuDesignerApp } from "../../apps/CpuDesignerApp";
import { TerminalApp } from "../../apps/TerminalApp";
import { NotesApp } from "../../apps/NotesApp";
import { SystemMonitorApp } from "../../apps/SystemMonitorApp";
import { FileExplorerApp } from "../../apps/FileExplorerApp";
import { SettingsApp } from "../../apps/SettingsApp";

type DesktopAppId =
  | "file-explorer"
  | "redstone-lab"
  | "logic-workspace"
  | "cpu-designer"
  | "terminal"
  | "notes"
  | "system-monitor"
  | "settings";

interface DesktopAppDef {
  id: DesktopAppId;
  title: string;
  description: string;
  icon: string;
  component: React.ComponentType;
}

const APPS: DesktopAppDef[] = [
  {
    id: "file-explorer",
    title: "File Explorer",
    description: "Browse RedByte virtual files, quick access and recent files.",
    icon: "🗂️",
    component: FileExplorerApp,
  },
  {
    id: "redstone-lab",
    title: "Redstone Lab",
    description: "3D + 2D circuits and dust simulation.",
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
    id: "cpu-designer",
    title: "CPU Designer",
    description: "CPU architecture studio: ALU, registers, PC, control.",
    icon: "🖥️",
    component: CpuDesignerApp,
  },
  {
    id: "terminal",
    title: "Terminal",
    description: "CLI playground inside RedByte.",
    icon: "⌨️",
    component: TerminalApp,
  },
  {
    id: "notes",
    title: "Notes",
    description: "Simple notes and documentation.",
    icon: "📝",
    component: NotesApp,
  },
  {
    id: "system-monitor",
    title: "System Monitor",
    description: "OS and simulation stats.",
    icon: "📊",
    component: SystemMonitorApp,
  },
  {
    id: "settings",
    title: "Settings",
    description: "Control boot mode, themes and user preferences.",
    icon: "⚙️",
    component: SettingsApp,
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

const INITIAL_WIDTH = 720;
const INITIAL_HEIGHT = 480;
const CURRENT_USER_KEY = "redbyte_current_user_v1";

// Register commands at module load
APPS.forEach((app) => {
  registerCommand({
    id: `open-${app.id}`,
    label: `Open ${app.title}`,
    keywords: [app.title.toLowerCase(), app.id, "app"],
    action: () =>
      window.dispatchEvent(
        new CustomEvent("RB_OPEN_APP", { detail: { id: app.id } })
      ),
  });
});

registerCommand({
  id: "explain-active",
  label: "Explain active window",
  keywords: ["help", "explain", "ai"],
  action: () => window.dispatchEvent(new CustomEvent("RB_EXPLAIN_TRIGGER")),
});

registerCommand({
  id: "mission-control",
  label: "Open Mission Control",
  keywords: ["overview", "windows"],
  action: () => window.dispatchEvent(new CustomEvent("RB_MISSION_CONTROL")),
});

registerCommand({
  id: "open-file-explorer",
  label: "Open File Explorer",
  keywords: ["files", "explorer", "documents"],
  action: () =>
    window.dispatchEvent(
      new CustomEvent("RB_OPEN_APP", { detail: { id: "file-explorer" } })
    ),
});

registerCommand({
  id: "open-settings",
  label: "Open Settings",
  keywords: ["settings", "preferences", "boot", "theme"],
  action: () =>
    window.dispatchEvent(
      new CustomEvent("RB_OPEN_APP", { detail: { id: "settings" } })
    ),
});

export function Desktop() {
  const [windows, setWindows] = useState<DesktopWindow[]>([]);
  const [activeId, setActiveId] = useState<WindowId | null>(null);
  const [drag, setDrag] = useState<DragState>({
    winId: null,
    offsetX: 0,
    offsetY: 0,
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [missionControl, setMissionControl] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Persist current user to localStorage for SettingsApp
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentUser) {
      try {
        window.localStorage.setItem(
          CURRENT_USER_KEY,
          JSON.stringify({
            id: currentUser.id,
            name: currentUser.name,
            tag: currentUser.tag,
          })
        );
      } catch {
        // ignore
      }
    } else {
      try {
        window.localStorage.removeItem(CURRENT_USER_KEY);
      } catch {
        // ignore
      }
    }
  }, [currentUser]);

  // Global hotkeys
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
      if (e.ctrlKey && e.code === "KeyE") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("RB_EXPLAIN_TRIGGER"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Window dragging
  useEffect(() => {
    const move = (e: MouseEvent) => {
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
    const up = () => {
      if (!drag.winId) return;
      setDrag({ winId: null, offsetX: 0, offsetY: 0 });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag]);

  // Open app + mission control events
  useEffect(() => {
    const openHandler = (e: any) => {
      const appId: DesktopAppId = e.detail.id;
      const def = APPS.find((a) => a.id === appId);
      if (!def) return;

      const maxZ = windows.reduce((m, w) => Math.max(m, w.zIndex), 1);
      const id: WindowId = `${appId}-${Date.now()}-${Math.floor(
        Math.random() * 9999
      )}`;

      setWindows((prev) => [
        ...prev,
        {
          id,
          appId,
          title: def.title,
          x: 140 + (prev.length * 32) % 200,
          y: 120 + (prev.length * 24) % 160,
          width: INITIAL_WIDTH,
          height: INITIAL_HEIGHT,
          zIndex: maxZ + 1,
        },
      ]);
      setActiveId(id);
    };

    const mcHandler = () => setMissionControl(true);

    window.addEventListener("RB_OPEN_APP", openHandler as any);
    window.addEventListener("RB_MISSION_CONTROL", mcHandler as any);
    return () => {
      window.removeEventListener("RB_OPEN_APP", openHandler as any);
      window.removeEventListener("RB_MISSION_CONTROL", mcHandler as any);
    };
  }, [windows]);

  const bringToFront = (id: WindowId) => {
    const maxZ = windows.reduce((m, w) => Math.max(m, w.zIndex), 1);
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zIndex: maxZ + 1 } : w))
    );
    setActiveId(id);
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

  const closeWindow = (id: WindowId) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    if (activeId === id) setActiveId(null);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100">
      <StatusBar
        currentUserName={currentUser?.name}
        currentUserTag={currentUser?.tag}
      />

      <div className="relative flex-1">
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

        <div className="absolute left-4 top-4 flex flex-col gap-3 z-10">
          {APPS.map((app) => (
            <button
              key={app.id}
              onDoubleClick={() =>
                window.dispatchEvent(
                  new CustomEvent("RB_OPEN_APP", { detail: { id: app.id } })
                )
              }
              className="flex flex-col items-center gap-1 text-[0.75rem] text-slate-200 hover:text-sky-300"
            >
              <div className="h-10 w-10 rb-glass rounded-2xl flex items-center justify-center border border-slate-700/80 hover:border-sky-500/80">
                <span className="text-xl">{app.icon}</span>
              </div>
              <span className="max-w-[6rem] text-center">{app.title}</span>
            </button>
          ))}
        </div>

        {windows.map((win) => {
          const def = APPS.find((a) => a.id === win.appId);
          if (!def) return null;
          const AppComponent = def.component;
          const isActive = activeId === win.id;

          return (
            <div
              key={win.id}
              className={`absolute rb-glass rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col ${
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
              <div
                className="h-8 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between px-3 cursor-move"
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

              <ExplainBar appId={win.appId} title={win.title} />

              <div className="flex-1 min-h-0 bg-slate-950/95">
                <AppComponent />
              </div>
            </div>
          );
        })}

        {missionControl && (
          <div className="absolute inset-0 z-[60] bg-slate-950/90 backdrop-blur-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Mission Control
                </h2>
                <p className="text-[0.7rem] text-slate-400">
                  All open windows. Click a tile to focus it.
                </p>
              </div>
              <button
                onClick={() => setMissionControl(false)}
                className="px-3 py-1 rounded-full border border-slate-600/80 text-[0.7rem] text-slate-200 hover:bg-slate-800/80"
              >
                Close
              </button>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {windows.length === 0 && (
                <div className="flex items-center justify-center text-[0.75rem] text-slate-500 border border-dashed border-slate-700/80 rounded-2xl">
                  No open windows. Double-click an icon to launch an app.
                </div>
              )}
              {windows.map((win) => {
                const def = APPS.find((a) => a.id === win.appId);
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
                        <span className="text-xl">
                          {def.icon}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-[0.8rem] text-slate-100">
                            {def.title}
                          </span>
                          <span className="text-[0.65rem] text-slate-500">
                            ID: {win.id.slice(-6)}
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

        <LoginOverlay currentUser={currentUser} onLogin={setCurrentUser} />
      </div>
    </div>
  );
}

export default Desktop;






























