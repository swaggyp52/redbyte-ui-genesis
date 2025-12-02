import React, { useEffect, useState } from "react";

export const ClockWidget: React.FC = () => {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      );
      setDate(
        now.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rb-glass border border-slate-800/70 rounded-2xl px-4 py-3 text-center shadow-xl">
      <div className="text-2xl font-bold text-slate-100">{time}</div>
      <div className="text-xs text-slate-400">{date}</div>
    </div>
  );
};







