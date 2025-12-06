import React from "react";
import { useProject } from "../context/ProjectContext";

const FileExplorer: React.FC = () => {
  const { project } = useProject();

  return (
    <div className="h-full w-full bg-black/80 text-[11px] text-slate-100 flex">
      <div className="w-52 border-r border-red-900/60 p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-red-300/80 mb-1">
          project
        </div>
        <div className="space-y-1 text-slate-200">
          <div className="font-semibold">{project.name}</div>
          <div className="text-[10px] text-slate-400">
            {project.logicGates.length} gates • {project.cpuUnits.length} units
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
            structure
          </div>
          <ul className="space-y-1">
            <li className="flex items-center gap-1">
              <span className="text-red-300">?</span>
              <span>logic/</span>
              <span className="text-[10px] text-slate-500">
                ({project.logicGates.length} gates)
              </span>
            </li>
            <li className="flex items-center gap-1">
              <span className="text-red-300">?</span>
              <span>cpu/</span>
              <span className="text-[10px] text-slate-500">
                ({project.cpuUnits.length} units)
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex-1 p-3 flex flex-col gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-red-300/80">
            overview
          </div>
          <div className="text-[11px] text-slate-400">
            this is a stub explorer – later you&apos;ll see full folders for gates, buses,
            microcode and programs.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-red-900/70 bg-black/70 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400 mb-2">
              logic/
            </div>
            <ul className="space-y-1">
              {project.logicGates.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between rounded border border-red-900/40 bg-black/60 px-2 py-1"
                >
                  <span>{g.label}</span>
                  <span className="text-[10px] text-slate-400">{g.kind}</span>
                </li>
              ))}
              {project.logicGates.length === 0 && (
                <li className="text-[11px] text-slate-500">
                  empty – add gates in Logic Designer
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-red-900/70 bg-black/70 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400 mb-2">
              cpu/
            </div>
            <ul className="space-y-1">
              {project.cpuUnits.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between rounded border border-red-900/40 bg-black/60 px-2 py-1"
                >
                  <span>{u.label}</span>
                  <span className="text-[10px] text-slate-400">{u.kind}</span>
                </li>
              ))}
              {project.cpuUnits.length === 0 && (
                <li className="text-[11px] text-slate-500">
                  empty – add units in CPU Designer
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileExplorer;
