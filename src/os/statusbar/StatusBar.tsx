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
    <div className="w-full h-7 bg-slate-900/80 border-b border-slate-700/50 flex items-center justify-between px-3 text-[0.7rem] text-slate-300">
      <span>RedByte OS</span>
      <span>{hh}:{mm}</span>
    </div>
  );
}

export default StatusBar;
