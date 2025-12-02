import React from "react";
import { apps } from "../registry/apps";

interface DockProps {
  onLaunch: (appId: string) => void;
  runningAppIds: string[];
}

export const Dock: React.FC<DockProps> = ({ onLaunch, runningAppIds }) => {
  return (
    <div className="rb-glass px-4 py-2 rounded-2xl flex gap-3 border border-slate-800/70 backdrop-blur-xl shadow-2xl">
      {apps.map((app) => {
        const isRunning = runningAppIds.includes(app.id);
        return (
          <button
            key={app.id}
            onClick={() => onLaunch(app.id)}
            className={`
              relative h-10 w-10 flex items-center justify-center rounded-xl
              hover:scale-110 active:scale-95 transition
              bg-slate-900/60 hover:bg-slate-800/70 border border-slate-700/60
              text-[11px] text-slate-200
            `}
          >
            <span className="text-base">
              {app.icon ?? app.name[0]}
            </span>
            {isRunning && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-5 rounded-full bg-pink-500/80 shadow-md shadow-pink-500/50" />
            )}
          </button>
        );
      })}
    </div>
  );
};








