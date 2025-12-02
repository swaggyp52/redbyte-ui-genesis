import React from "react";
import { apps } from "../registry/apps";

interface AppSwitcherProps {
  open: boolean;
  activeAppId: string | null;
  onChoose: (appId: string) => void;
  cycleList: string[];
}

export const AppSwitcher: React.FC<AppSwitcherProps> = ({
  open,
  activeAppId,
  onChoose,
  cycleList
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
      <div className="rb-glass rounded-2xl px-4 py-4 border border-slate-800/80 shadow-2xl flex gap-3">
        {cycleList.map((id) => {
          const def = apps.find((a) => a.id === id);
          if (!def) return null;
          return (
            <button
              key={id}
              onClick={() => onChoose(id)}
              className={`px-4 py-3 rounded-xl border text-xs flex flex-col items-center justify-center gap-1 transition
                ${
                  id === activeAppId
                    ? "border-pink-500/80 bg-slate-800/40"
                    : "border-slate-700/60 opacity-70 hover:opacity-100"
                }
              `}
            >
              <div className="text-lg">{def.icon ?? "◼︎"}</div>
              <span className="text-[10px] text-slate-300">{def.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};




