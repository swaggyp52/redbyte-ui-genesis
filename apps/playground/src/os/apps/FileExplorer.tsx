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
          <div className="font-semibold">{project.meta.name}</div>
          <div className="text-[10px] text-slate-400">
            {project.logic.template.nodes.length} nodes · {project.logic.template.wires.length} wires · {project.cpu.units.length} modules
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
                ({project.logic.template.nodes.length} nodes)
              </span>
            </li>
            <li className="flex items-center gap-1">
              <span className="text-red-300">?</span>
              <span>cpu/</span>
              <span className="text-[10px] text-slate-500">
                ({project.cpu.units.length} modules)
              </span>
            </li>
            <li className="flex items-center gap-1">
              <span className="text-red-300">?</span>
              <span>io/</span>
              <span className="text-[10px] text-slate-500">
                ({project.cpu.buses.length} buses · {project.logic.ioPins.length} pins)
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
            this is a stub explorer  later you'll see full folders for gates, buses,
            microcode and programs.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-red-900/70 bg-black/70 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400 mb-2">
              logic/
            </div>
            <ul className="space-y-1">
              {project.logic.template.nodes.map((node) => (
                <li
                  key={node.id}
                  className="flex items-center justify-between rounded border border-red-900/40 bg-black/60 px-2 py-1"
                >
                  <span>{node.label}</span>
                  <span className="text-[10px] text-slate-400">{node.type}</span>
                </li>
              ))}
              {project.logic.template.nodes.length === 0 && (
                <li className="text-[11px] text-slate-500">
                  empty  add nodes in Logic Designer
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-red-900/70 bg-black/70 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400 mb-2">
              cpu/
            </div>
            <ul className="space-y-1">
              {project.cpu.units.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between rounded border border-red-900/40 bg-black/60 px-2 py-1"
                >
                  <span>{u.label}</span>
                  <span className="text-[10px] text-slate-400">{u.kind}</span>
                </li>
              ))}
              {project.cpu.units.length === 0 && (
                <li className="text-[11px] text-slate-500">
                  empty  add units in CPU Designer
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
