import React from "react";
import { useProject } from "../context/ProjectContext";

const SystemMonitor: React.FC = () => {
  const { project } = useProject();
  const { history } = project;

  const last =
    history[history.length - 1] ?? {
      logicNodes: 0,
      cpuUnits: 0,
      logicWires: 0,
      buses: 0,
      logicNets: 0,
      ioPins: 0,
      clocks: 0,
      ts: Date.now(),
    };

  const maxNodes = Math.max(1, ...history.map((h) => h.logicNodes));
  const maxModules = Math.max(1, ...history.map((h) => h.cpuUnits));

  const makePath = (
    key: "logicNodes" | "cpuUnits",
    max: number
  ): string => {
    if (history.length === 0) return "";
    const n = history.length;
    return history
      .map((h, idx) => {
        const x = n === 1 ? 0 : (idx / (n - 1)) * 100;
        const value = key === "logicNodes" ? h.logicNodes : h.cpuUnits;
        const y = 100 - (value / max) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  };

  const nodesPath = makePath("logicNodes", maxNodes);
  const modulesPath = makePath("cpuUnits", maxModules);

  return (
    <div className="h-full w-full bg-black/80 text-[11px] text-slate-100 flex flex-col p-3 gap-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-red-300/80">
            project monitor
          </div>
          <div className="text-[11px] text-slate-400">
            {project.logic.template.nodes.length} nodes · {project.cpu.units.length} modules
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-red-900/70 bg-black/70 p-3 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
            nodes over time
          </div>
          <div className="text-[18px] font-semibold text-red-200">
            {last.logicNodes}
            <span className="text-[10px] text-slate-400 ml-1">nodes</span>
          </div>
          <svg viewBox="0 0 100 100" className="w-full h-20">
            <polyline
              points={nodesPath}
              fill="none"
              stroke="rgb(248 113 113)"
              strokeWidth={1}
            />
          </svg>
        </div>

        <div className="rounded-lg border border-red-900/70 bg-black/70 p-3 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
            cpu modules over time
          </div>
          <div className="text-[18px] font-semibold text-red-200">
            {last.cpuUnits}
            <span className="text-[10px] text-slate-400 ml-1">modules</span>
          </div>
          <svg viewBox="0 0 100 100" className="w-full h-20">
            <polyline
              points={modulesPath}
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
