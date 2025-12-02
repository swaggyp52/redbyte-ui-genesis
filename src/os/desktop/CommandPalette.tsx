import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useSystem } from "../core/SystemProvider";
import { useKernel, useNotifications } from "../../kernel/KernelProvider";

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const {
    apps,
    windows,
    openApp,
    focusWindow,
    closeWindow,
    minimizeWindow,
  } = useSystem();
  const { settings } = useKernel();
  const { clearNotifications } = useNotifications();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Global keyboard shortcut: Ctrl+Space / Cmd+Space
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isToggle =
        (e.ctrlKey || e.metaKey) && (e.code === "Space" || e.key === " ");
      if (isToggle) {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      setActiveIndex(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];

    // App commands
    for (const app of apps) {
      list.push({
        id: `open-app-${app.id}`,
        label: `Open app: ${app.name}`,
        hint: "App",
        run: () => openApp(app.id),
      });
    }

    // Window commands
    for (const w of windows) {
      list.push({
        id: `focus-window-${w.id}`,
        label: `Focus window: ${w.title}`,
        hint: "Window",
        run: () => focusWindow(w.id),
      });
      list.push({
        id: `close-window-${w.id}`,
        label: `Close window: ${w.title}`,
        hint: "Window / Close",
        run: () => closeWindow(w.id),
      });
    }

    // System window operations
    list.push({
      id: "minimize-all",
      label: "Minimize all windows",
      hint: "System",
      run: () => {
        windows.forEach((w) => minimizeWindow(w.id));
      },
    });

    list.push({
      id: "close-all",
      label: "Close all windows",
      hint: "System / Dangerous",
      run: () => {
        const ids = windows.map((w) => w.id);
        ids.forEach((id) => closeWindow(id));
      },
    });

    // Settings / kernel
    list.push({
      id: "toggle-theme",
      label: `Toggle theme (${settings.theme === "dark" ? "light" : "dark"})`,
      hint: "Settings",
      run: () => {
        // We do not call toggleTheme directly here to avoid tight coupling.
        // Instead, apps can expose theme toggling commands in a future Settings app.
        // Placeholder informational no-op for now.
        console.info("Theme toggle command is wired via Kernel, UI coming soon.");
      },
    });

    // Notifications
    list.push({
      id: "clear-notifications",
      label: "Clear notifications",
      hint: "Notifications",
      run: () => clearNotifications(),
    });

    return list;
  }, [apps, windows, openApp, focusWindow, closeWindow, minimizeWindow, settings.theme, clearNotifications]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = commands;
    if (q) {
      base = commands.filter((cmd) => {
        const label = cmd.label.toLowerCase();
        const hint = cmd.hint?.toLowerCase() ?? "";
        return label.includes(q) || hint.includes(q);
      });
    }
    return base.slice(0, 10);
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, commands.length]);

  const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((idx) =>
        filtered.length === 0 ? 0 : (idx + 1) % filtered.length
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((idx) =>
        filtered.length === 0
          ? 0
          : (idx - 1 + filtered.length) % filtered.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd) {
        cmd.run();
        setOpen(false);
        setQuery("");
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative z-10 w-full max-w-xl px-4">
        <div className="rb-glass rounded-3xl border border-slate-800/80 bg-slate-950/95 shadow-2xl overflow-hidden">
          <div className="border-b border-slate-800/80 px-4 py-3 flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase tracking-[0.15em]">
              Command Palette
            </span>
            <span className="ml-auto text-[0.65rem] text-slate-500">
              Ctrl / Cmd + Space
            </span>
          </div>

          <div className="px-4 py-3">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Type a command or app name..."
              className="w-full bg-slate-900/80 border border-slate-700/80 rounded-2xl px-3 py-2 text-sm text-slate-100 outline-none focus:border-pink-500/70"
            />
          </div>

          <div className="max-h-72 overflow-auto px-2 pb-3">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">
                No commands match.
              </div>
            ) : (
              <ul className="flex flex-col gap-1 pb-1">
                {filtered.map((cmd, index) => {
                  const active = index === activeIndex;
                  return (
                    <li key={cmd.id}>
                      <button
                        type="button"
                        className={`w-full flex items-center justify-between rounded-2xl px-3 py-2 text-xs ${
                          active
                            ? "bg-slate-800/90 text-slate-50"
                            : "text-slate-300 hover:bg-slate-900/80"
                        }`}
                        onClick={() => {
                          cmd.run();
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <span className="truncate">{cmd.label}</span>
                        {cmd.hint && (
                          <span className="ml-3 text-[0.6rem] text-slate-500">
                            {cmd.hint}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}












