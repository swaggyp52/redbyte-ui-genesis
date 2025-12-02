import React, { useEffect, useState } from "react";

interface Metric {
  label: string;
  value: number;
  unit: string;
}

function randomBetween(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

export const SystemMonitorApp: React.FC = () => {
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: "CPU", value: 12, unit: "%" },
    { label: "Memory", value: 38, unit: "%" },
    { label: "Disk I/O", value: 4, unit: "%" },
    { label: "Agents active", value: 1, unit: "" },
  ]);

  useEffect(() => {
    const id = setInterval(() => {
      setMetrics([
        { label: "CPU", value: randomBetween(5, 72), unit: "%" },
        { label: "Memory", value: randomBetween(20, 72), unit: "%" },
        { label: "Disk I/O", value: randomBetween(1, 40), unit: "%" },
        { label: "Agents active", value: randomBetween(0, 3), unit: "" },
      ]);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-xs text-slate-200 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-50">System Monitor</p>
        <p className="text-slate-400">
          Synthetic health view of the RedByte OS environment.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rb-glass rounded-xl px-3 py-2 border border-slate-800/80 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-300">{m.label}</span>
              <span className="text-[11px] font-semibold text-slate-50">
                {m.value}
                {m.unit}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-900/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-sky-500"
                style={{ width: `${Math.min(100, Math.max(0, m.value))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-slate-500">
        Values are simulated to provide a feeling of a live system.
      </div>
    </div>
  );
};












