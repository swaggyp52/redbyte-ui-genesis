import React, { useEffect, useState } from "react";

export interface StatusBarProps {
  currentUserName?: string;
  currentUserTag?: string; // ADMIN/USER/GUEST
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

  const role =
    currentUserTag === "ADMIN"
      ? "Admin"
      : currentUserTag === "GUEST"
      ? "Guest"
      : "User";

  const isAdmin = currentUserTag === "ADMIN";

  return (
    <div className="w-full h-7 bg-slate-950/95 border-b border-slate-800/80 flex items-center justify-between px-3 text-[0.7rem] text-slate-300">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-slate-100">RedByte OS</span>
        <span className="text-slate-500 hidden sm:inline">
          Development Shell
        </span>
        {currentUserName && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/90 border border-slate-700/80">
            <span className="text-slate-100">{currentUserName}</span>
            <span
              className={
                "text-[0.65rem] font-mono px-1 rounded " +
                (isAdmin
                  ? "bg-sky-500/20 text-sky-200 border border-sky-500/40"
                  : "bg-slate-700/40 text-slate-200 border border-slate-500/40")
              }
            >
              {role}
            </span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 font-mono">
        <span className="text-slate-500 hidden sm:inline">
          {isAdmin ? "Admin session" : "Standard session"}
        </span>
        <span className="text-slate-100">
          {hh}:{mm}
        </span>
      </div>
    </div>
  );
};

export default StatusBar;







