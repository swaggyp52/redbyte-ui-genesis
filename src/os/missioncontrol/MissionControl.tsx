import React from "react";
import { apps } from "../registry/apps";

interface MCProps {
  open: boolean;
  list: {
    id: string;
    appId: string;
    title: string;
  }[];
  onSelect: (id: string) => void;
}

export const MissionControl: React.FC<MCProps> = ({
  open,
  list,
  onSelect,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xl p-10 overflow-hidden grid grid-cols-4 gap-6">
      {list.map((w) => {
        const appDef = apps.find((a) => a.id === w.appId);
        return (
          <button
            key={w.id}
            onClick={() => onSelect(w.id)}
            className="rb-glass border border-slate-800/60 rounded-2xl p-4 shadow-xl hover:border-pink-500/80 hover:shadow-pink-500/30 transition flex flex-col gap-3"
          >
            <div className="h-32 bg-slate-800/50 rounded-xl border border-slate-700/60" />
            <div className="text-left text-xs">
              <p className="font-semibold text-slate-100">{w.title}</p>
              <p className="text-slate-500">{appDef?.name ?? w.appId}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};























