import React, { useEffect, useState } from "react";

export function StatusBar() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = time.getHours().toString().padStart(2, "0");
  const mm = time.getMinutes().toString().padStart(2, "0");

  return (
    <div className="w-full h-7 bg-slate-950/95 border-b border-slate-800/80 flex items-center justify-between px-3 text-[0.7rem] text-slate-300">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-100">RedByte OS</span>
        <span className="text-slate-500">Desktop v31</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-slate-500 hidden sm:inline">
          SYSTEM: OK
        </span>
        <span className="font-mono text-slate-100">
          {hh}:{mm}
        </span>
      </div>
    </div>
  );
}

export default StatusBar;
