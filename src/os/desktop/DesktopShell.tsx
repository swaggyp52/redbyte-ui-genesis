import React, { useMemo, useState, useRef, useEffect } from "react";
import TerminalApp from "../apps/Terminal";
import NotesApp from "../apps/Notes";
import FileExplorer from "../apps/FileExplorer";
import SystemMonitor from "../apps/SystemMonitor";
import SettingsApp from "../apps/Settings";

type AppId =
  | "file"
  | "logic"
  | "cpu"
  | "terminal"
  | "notes"
  | "monitor"
  | "settings";

interface DesktopShellProps {
  user: string;
}

interface AppDef {
  id: AppId;
  label: string;
  hint: string;
}

interface WindowState {
  id: number;
  appId: AppId;
  title: string;
  z: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  id: number | null;
  mode: "move" | "resize" | null;
  lastX: number;
  lastY: number;
  vx: number;
  vy: number;
  lastTime: number;
}

const APPS: AppDef[] = [
  { id: "file", label: "File Explorer", hint: "browse project tree" },
  { id: "logic", label: "Logic Designer", hint: "gates & circuits (preview)" },
  { id: "cpu", label: "CPU Designer", hint: "tiny CPUs (preview)" },
  { id: "terminal", label: "Terminal", hint: "shell & tools" },
  { id: "notes", label: "Notes", hint: "scratchpad & ideas" },
  { id: "monitor", label: "System Monitor", hint: "stats & signals" },
  { id: "settings", label: "Settings", hint: "theme & prefs" }
];

const LogicPreview: React.FC = () => (
  <div className="h-full w-full flex flex-col items-center justify-center bg-black/80 text-slate-100 text-[11px]">
    <div className="text-[10px] uppercase tracking-[0.25em] text-red-300/80 mb-2">
      logic designer
    </div>
    <div>preview only – full gate editor will live here.</div>
  </div>
);

const CpuPreview: React.FC = () => (
  <div className="h-full w-full flex flex-col items-center justify-center bg-black/80 text-slate-100 text-[11px]">
    <div className="text-[10px] uppercase tracking-[0.25em] text-red-300/80 mb-2">
      cpu designer
    </div>
    <div>preview only – CPU diagrams and sims will live here.</div>
  </div>
);

function renderApp(appId: AppId): JSX.Element {
  switch (appId) {
    case "file":
      return <FileExplorer />;
    case "terminal":
      return <TerminalApp />;
    case "notes":
      return <NotesApp />;
    case "monitor":
      return <SystemMonitor />;
    case "settings":
      return <SettingsApp />;
    case "logic":
      return <LogicPreview />;
    case "cpu":
      return <CpuPreview />;
    default:
      return <div />;
  }
}

const DesktopShell: React.FC<DesktopShellProps> = ({ user }) => {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [zCounter, setZCounter] = useState(1);

  const dragRef = useRef<DragState>({
    id: null,
    mode: null,
    lastX: 0,
    lastY: 0,
    vx: 0,
    vy: 0,
    lastTime: 0
  });

  const openApp = (id: AppId) => {
    const def = APPS.find((a) => a.id === id);
    if (!def) return;

    setWindows((prev) => {
      const nextZ = zCounter + 1;
      setZCounter(nextZ);

      const baseX = 160 + prev.length * 28;
      const baseY = 80 + prev.length * 22;

      const newWin: WindowState = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        appId: id,
        title: def.label,
        z: nextZ,
        x: baseX,
        y: baseY,
        width: 560,
        height: 360
      };

      return [...prev, newWin];
    });
  };

  const closeWindow = (id: number) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  };

  const focusWindow = (id: number) => {
    setWindows((prev) => {
      const nextZ = zCounter + 1;
      setZCounter(nextZ);
      return prev.map((w) => (w.id === id ? { ...w, z: nextZ } : w));
    });
  };

  const ordered = useMemo(
    () => [...windows].sort((a, b) => a.z - b.z),
    [windows]
  );

  const startMove = (e: React.MouseEvent<HTMLDivElement>, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    focusWindow(id);

    dragRef.current.id = id;
    dragRef.current.mode = "move";
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    dragRef.current.vx = 0;
    dragRef.current.vy = 0;
    dragRef.current.lastTime = performance.now();
  };

  const startResize = (e: React.MouseEvent<HTMLDivElement>, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    focusWindow(id);

    dragRef.current.id = id;
    dragRef.current.mode = "resize";
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    dragRef.current.vx = 0;
    dragRef.current.vy = 0;
    dragRef.current.lastTime = performance.now();
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d.id || !d.mode) return;

      const now = performance.now();
      const dt = Math.max(1, now - d.lastTime || 16);
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;

      d.vx = dx / dt;
      d.vy = dy / dt;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.lastTime = now;

      if (d.mode === "move") {
        setWindows((prev) =>
          prev.map((w) =>
            w.id === d.id
              ? {
                  ...w,
                  x: w.x + dx,
                  y: w.y + dy
                }
              : w
          )
        );
      } else if (d.mode === "resize") {
        setWindows((prev) =>
          prev.map((w) =>
            w.id === d.id
              ? {
                  ...w,
                  width: Math.max(320, w.width + dx),
                  height: Math.max(220, w.height + dy)
                }
              : w
          )
        );
      }
    };

    const handleUp = () => {
      const d = dragRef.current;
      if (!d.id || !d.mode) {
        d.id = null;
        d.mode = null;
        return;
      }

      const id = d.id;
      const grid = 24;

      // only inertia for move
      if (d.mode !== "move") {
        setWindows((prev) =>
          prev.map((w) =>
            w.id === id
              ? {
                  ...w,
                  x: Math.round(w.x / grid) * grid,
                  y: Math.round(w.y / grid) * grid
                }
              : w
          )
        );
        d.id = null;
        d.mode = null;
        return;
      }

      const vx0 = d.vx * 16;
      const vy0 = d.vy * 16;

      d.id = null;
      d.mode = null;

      const speed0 = Math.hypot(vx0, vy0);
      const friction = 0.88;

      if (speed0 < 0.1) {
        // just snap
        setWindows((prev) =>
          prev.map((w) =>
            w.id === id
              ? {
                  ...w,
                  x: Math.round(w.x / grid) * grid,
                  y: Math.round(w.y / grid) * grid
                }
              : w
          )
        );
        return;
      }

      let vx = vx0;
      let vy = vy0;

      const step = () => {
        vx *= friction;
        vy *= friction;

        const done = Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1;

        setWindows((prev) =>
          prev.map((w) => {
            if (w.id !== id) return w;
            const nextX = w.x + vx;
            const nextY = w.y + vy;
            return { ...w, x: nextX, y: nextY };
          })
        );

        if (!done) {
          requestAnimationFrame(step);
        } else {
          setWindows((prev) =>
            prev.map((w) =>
              w.id === id
                ? {
                    ...w,
                    x: Math.round(w.x / grid) * grid,
                    y: Math.round(w.y / grid) * grid
                  }
                : w
            )
          );
        }
      };

      requestAnimationFrame(step);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-black via-[#05010a] to-black text-slate-100 flex flex-col relative overflow-hidden">
      {/* background grid + glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(248,113,113,0.25),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(127,29,29,0.5),transparent_60%)] blur-3xl opacity-80" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(127,29,29,0.45)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.9)_1px,transparent_1px)] bg-[size:40px_40px] opacity-80" />
      </div>

      {/* top bar */}
      <header className="relative z-10 h-10 px-4 flex items-center justify-between border-b border-red-900/70 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
          <span className="tracking-[0.28em] uppercase text-red-200/90">
            redbyte os
          </span>
        </div>
        <div className="text-[11px] text-slate-300 flex items-center gap-3">
          <span>session: dev-local</span>
          <span>user: {user || "operator"}</span>
        </div>
      </header>

      {/* main */}
      <main className="relative z-10 flex-1 flex">
        {/* launcher */}
        <aside className="w-64 border-r border-red-900/70 bg-black/80 backdrop-blur-sm p-4 flex flex-col gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-red-300/80 mb-1">
              workspace
            </div>
            <div className="text-xs text-slate-300">
              Pick a module to open its window.
            </div>
          </div>

          <div className="space-y-2">
            {APPS.map((app) => (
              <button
                key={app.id}
                onClick={() => openApp(app.id)}
                className="w-full rounded-xl border border-red-900/70 bg-black/70 hover:border-red-400/80 hover:bg-red-950/70 transition-colors px-3 py-2 text-left"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-100">{app.label}</span>
                  <span className="text-[9px] uppercase tracking-[0.2em] text-red-300/80">
                    open
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  {app.hint}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* desktop space */}
        <section className="flex-1 relative overflow-hidden">
          {windows.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="px-4 py-2 rounded-full border border-red-900/70 bg-black/80 text-[11px] text-slate-300">
                open a module on the left to start a session
              </div>
            </div>
          )}

          <div className="absolute inset-0">
            {ordered.map((w) => (
              <div
                key={w.id}
                style={{
                  transform: `translate3d(${w.x}px, ${w.y}px, 0)`,
                  width: w.width,
                  height: w.height,
                  zIndex: w.z
                }}
                className="absolute rounded-2xl border border-red-900/80 bg-black/85 shadow-[0_0_60px_rgba(127,29,29,0.8)] overflow-hidden backdrop-blur-sm will-change-transform"
              >
                {/* title bar */}
                <div
                  className="h-8 px-3 flex items-center justify-between border-b border-red-900/70 bg-gradient-to-r from-black via-[#1b0206] to-black cursor-move select-none"
                  onMouseDown={(e) => startMove(e, w.id)}
                >
                  <div className="flex items-center gap-2 text-[11px] text-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="h-2 w-2 rounded-full bg-orange-400/80" />
                      <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                    </div>
                    <span className="ml-2">{w.title}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeWindow(w.id);
                    }}
                    className="text-[10px] uppercase tracking-[0.18em] text-red-300/80 hover:text-red-200"
                  >
                    close
                  </button>
                </div>

                {/* content */}
                <div className="w-full h-[calc(100%-2rem)] overflow-hidden">
                  {renderApp(w.appId)}
                </div>

                {/* resize handle */}
                <div
                  className="absolute bottom-1 right-1 w-3 h-3 cursor-se-resize bg-red-900/60 rounded-sm"
                  onMouseDown={(e) => startResize(e, w.id)}
                />
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* footer */}
      <footer className="relative z-10 h-8 border-t border-red-900/70 bg-black/80 px-4 flex items-center justify-between text-[10px] text-slate-400">
        <span>© {new Date().getFullYear()} redbyte os • web prototype</span>
        <span>goal: full redstone-native desktop, shipped as .exe</span>
      </footer>
    </div>
  );
};

export default DesktopShell;
