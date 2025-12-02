import React from "react";
import { useBoot } from "./useBoot";

export const BootScreen: React.FC = () => {
  const { isBooted, bootMessage } = useBoot();

  if (isBooted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
      <div className="rb-glass px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-pink-500 to-sky-500 animate-pulse" />
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
          RedByte OS
        </div>
        <div className="text-sm text-slate-300">
          {bootMessage}
        </div>
      </div>
    </div>
  );
};
