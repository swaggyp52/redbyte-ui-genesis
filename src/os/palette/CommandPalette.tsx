import React, { useMemo, useState } from "react";
import { apps } from "../registry/apps";
import { getActions } from "../actions/actions";
import { loadWorkspaces } from "../workspaces/workspaces";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onRun: (action: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onRun,
}) => {
  const [query, setQuery] = useState("");

  const workspaces = loadWorkspaces();
  const actions = getActions();

  const items = useMemo(() => {
    const sys = [
      { id: "sys:launchpad", label: "Open Launchpad", hint: "System" },
      { id: "sys:root", label: "Open /root console", hint: "System" },
      { id: "sys:agents", label: "Open Agents panel", hint: "System" },
    ];

    const workspaceItems = workspaces.map((w) => ({
      id: `ws:${w.id}`,
      label: `Switch to workspace: ${w.name}`,
      hint: "Workspace",
    }));

    const appItems = apps.map((app) => ({
      id: `app:${app.id}`,
      label: app.name,
      hint: app.group ?? "App",
    }));

    const actionItems = actions.map((a) => ({
      id: `action:${a.id}`,
      label: a.label,
      hint: "Action",
    }));

    return [...sys, ...workspaceItems, ...appItems, ...actionItems];
  }, []);

  const filtered = items.filter((i) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      i.label.toLowerCase().includes(q) || (i.hint ?? "").toLowerCase().includes(q)
    );
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-slate-950/60 backdrop-blur-sm">
      <div className="w-full max-w-md rb-glass rounded-2xl border border-slate-800/80 shadow-2xl">
        <div className="border-b border-slate-800/70 px-3 py-2">
          <input
            autoFocus
            className="w-full bg-transparent text-sm text-slate-50 placeholder:text-slate-500 outline-none"
            placeholder="Search commands, workspaces, apps..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
          />
        </div>

        <div className="max-h-80 overflow-auto py-2">
          {filtered.map((item) => (
            <button
              key={item.id}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800/70 flex items-center justify-between"
              onClick={() => onRun(item.id)}
            >
              <span className="text-slate-100">{item.label}</span>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                {item.hint}
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-slate-800/70 px-3 py-1.5 flex justify-between text-[10px] text-slate-500">
          <span>Enter to run · Esc to close</span>
          <span>RedByte OS</span>
        </div>
      </div>
    </div>
  );
};
