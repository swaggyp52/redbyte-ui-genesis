import React from "react";
import { loadWorkspaces } from "../workspaces/workspaces";

interface StatusBarProps {
  onOpenPalette: () => void;
  onOpenLaunchpad: () => void;
  onSwitchWorkspace: (id: string) => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  onOpenPalette,
  onOpenLaunchpad,
  onSwitchWorkspace,
}) => {
  const time = new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const workspaces = loadWorkspaces();

  return (
    <div className="absolute top-0 inset-x-0 h-9 flex items-center justify-between px-4 text-[11px] text-slate-300 bg-gradient-to-b from-slate-950/90 to-slate-950/40 border-b border-slate-800/80 backdrop-blur-sm z-40">
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-xl bg-gradient-to-br from-pink-500 to-sky-500" />
        <span className="font-semibold text-slate-100">RedByte OS</span>

        <div className="flex ml-3 gap-1">
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => onSwitchWorkspace(w.id)}
              className="px-2 py-0.5 text-[10px] rounded-md border border-slate-700/70 hover:border-pink-500/70 hover:text-pink-300 transition"
            >
              {w.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="px-2 py-0.5 rounded-md rb-glass text-[10px] border border-slate-800/80 hover:border-sky-500/70 hover:text-sky-200 transition"
          onClick={onOpenPalette}
        >
          ⌘K
        </button>
        <button
          className="px-2 py-0.5 rounded-md rb-glass text-[10px] border border-slate-800/80 hover:border-pink-500/70 hover:text-pink-200 transition"
          onClick={onOpenLaunchpad}
        >
          Launchpad
        </button>

        <span className="text-slate-400 ml-2">{time}</span>
      </div>
    </div>
  );
};
