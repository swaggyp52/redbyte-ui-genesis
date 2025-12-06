import React from "react";
import { useProject } from "../context/ProjectContext";

const SystemMonitor: React.FC = () => {
  const { project } = useProject();
  const { history } = project;

  const last =
    history[history.length - 1] ?? {
      gates: 0,
      units: 0,
      ts: Date.now(),
    };

  const maxGates = Math.max(1, ...history.map((h) => h.gates));
  const maxUnits = Math.max(1, ...history.map((h) => h.units));

  const makePath = (key: "gates" | "units", max: number): string => {
    if (history.length === 0) return "";
    const n = history.length;
    return history
      .map((h, idx) => {
        const x = n === 1 ? 0 : (idx / (n - 1)) * 100;
        const value = key === "gates" ? h.gates : h.units;
        const y = 100 - (value / max) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  };

  const gatesPath = makePath("gates", maxGates);
  const unitsPath = makePath("units", maxUnits);

  return (
    <div className="h-full w-full bg-black/80 text-[11px] text-slate-100 flex flex-col p-3 gap-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-red-300/80">
            project monitor
          </div>
          <div className="text-[11px] text-slate-400">
            {project.logicGates.length} gates • {project.cpuUnits.length} units
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-red-900/70 bg-black/70 p-3 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
            gates over time
          </div>
          <div className="text-[18px] font-semibold text-red-200">
            {last.gates}
            <span className="text-[10px] text-slate-400 ml-1">gates</span>
          </div>
          <svg viewBox="0 0 100 100" className="w-full h-20">
            <polyline
              points={gatesPath}
              fill="none"
              stroke="rgb(248 113 113)"
              strokeWidth={1}
            />
          </svg>
        </div>

        <div className="rounded-lg border border-red-900/70 bg-black/70 p-3 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
            cpu units over time
          </div>
          <div className="text-[18px] font-semibold text-red-200">
            {last.units}
            <span className="text-[10px] text-slate-400 ml-1">units</span>
          </div>
          <svg viewBox="0 0 100 100" className="w-full h-20">
            <polyline
              points={unitsPath}
              fill="none"
              stroke="rgb(248 113 113)"
              strokeWidth={1}
            />
          </svg>
        </div>
      </div>

      <div className="rounded-lg border border-red-900/70 bg-black/70 p-3 text-[10px] text-slate-400">
        this monitor is watching your redstone computer grow. later it will show real
        timing, tick rate and signal fanout; for now it mirrors project size.
      </div>
    </div>
  );
};

export default SystemMonitor;
