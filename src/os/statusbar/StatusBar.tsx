import React, { useEffect, useState } from "react";

export interface StatusBarProps {
  currentUserName?: string;
  currentUserTag?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  currentUserName,
  currentUserTag,
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = time.getHours().toString().padStart(2, "0");
  const mm = time.getMinutes().toString().padStart(2, "0");

  const isRoot = currentUserTag === "ROOT";

  return (
    <div className="w-full h-7 bg-slate-950/95 border-b border-slate-800/80 flex items-center justify-between px-3 text-[0.7rem] text-slate-300">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-slate-100">RedByte OS</span>
        <span className="text-slate-500 hidden sm:inline">
          GENESIS SHELL v38
        </span>
        {currentUserName && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/90 border border-slate-700/80">
            <span className="text-slate-100">{currentUserName}</span>
            <span
              className={
                "text-[0.65rem] font-mono px-1 rounded " +
                (isRoot
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-sky-500/20 text-sky-300 border border-sky-500/40")
              }
            >
              {isRoot ? "ROOT" : currentUserTag || "USER"}
            </span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 font-mono">
        <span className="text-slate-500 hidden sm:inline">
          {isRoot ? "ACCESS: GODMODE" : "ACCESS: USERSPACE"}
        </span>
        <span className="font-mono text-slate-100">
          {hh}:{mm}
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
