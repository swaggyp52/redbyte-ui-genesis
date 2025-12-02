import React, { useEffect, useState } from "react";

const VERSION = "RedByte OS v23 · Dust Physics Engine";
const BOOT_CHANNEL =
  typeof import.meta !== "undefined" && import.meta.env?.MODE === "development"
    ? "DEV"
    : "PROD";

function formatTime(date: Date) {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function StatusBar() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const host =
    typeof window !== "undefined" ? window.location.hostname : "localhost";

  return (
    <div className="h-7 flex items-center justify-between px-3 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur">
      <div className="flex items-center gap-2 text-[0.7rem] text-slate-400">
        <span className="font-mono text-emerald-300 text-[0.65rem] px-1.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40">
          {BOOT_CHANNEL}
        </span>
        <span className="hidden sm:inline text-slate-300">{VERSION}</span>
        <span className="hidden md:inline text-slate-500">
          host:
          <span className="font-mono text-slate-300 ml-1">{host}</span>
        </span>
      </div>

      <div className="flex items-center gap-3 text-[0.7rem] text-slate-400">
        <span className="hidden sm:inline text-slate-500">
          tick-mode: <span className="font-mono text-slate-200">SIM</span>
        </span>
        <span className="font-mono text-slate-100">
          {formatTime(now)}
        </span>
      </div>
    </div>
  );
}

export default StatusBar;
