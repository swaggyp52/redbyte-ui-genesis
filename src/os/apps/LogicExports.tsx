import React, { useMemo, useState } from "react";
import { useProject } from "../context/ProjectContext";
import {
  exportLogicAsJson,
  exportLogicAsVerilogModule,
} from "../../logic/LogicExport";
import { mapLogicToRedstone } from "../../logic/LogicToRedstone";

type ExportMode = "json" | "verilog" | "redstone";

const LogicExportsApp: React.FC = () => {
  const { project } = useProject();
  const [mode, setMode] = useState<ExportMode>("json");

  const mapping = useMemo(
    () => mapLogicToRedstone(project.logic),
    [project.logic]
  );

  const body = useMemo(() => {
    if (mode === "json") return exportLogicAsJson(project.logic);
    if (mode === "verilog")
      return exportLogicAsVerilogModule(project.logic, project.meta.name);
    return mapping.blocks
      .map((b) =>
        `${b.logicNodeId ? `${b.logicNodeId}: ` : ""}${b.type} @ (${b.x},${b.y},${b.z})`
      )
      .join("\n");
  }, [mapping.blocks, mode, project.logic, project.meta.name]);

  return (
    <div className="h-full flex flex-col gap-3 text-xs">
      <header className="border-b border-slate-800/80 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">Logic Export &amp; Code</h1>
          <p className="text-[0.7rem] text-slate-400">Share the active project as JSON, Verilog-style HDL, or a redstone block listing.</p>
        </div>
        <div className="text-right text-[0.65rem] text-slate-500">
          <div className="font-mono text-emerald-300">PROJECT://{project.meta.id}</div>
          <div>
            {project.logic.nodes.length} nodes, {project.logic.wires.length} wires
          </div>
        </div>
      </header>

      <section className="rb-glass rounded-2xl border border-slate-800/80 p-3 flex flex-col gap-2 flex-1 min-h-0">
        <div className="flex items-center gap-2 text-[0.7rem]">
          <span className="text-slate-400">Mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ExportMode)}
            className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 text-slate-100"
          >
            <option value="json">JSON</option>
            <option value="verilog">Verilog-style</option>
            <option value="redstone">Redstone mapping</option>
          </select>
          <span className="ml-auto text-slate-400">{mode === "redstone" ? `${mapping.blocks.length} blocks` : "Text export"}</span>
        </div>

        <textarea
          readOnly
          value={body}
          className="flex-1 min-h-[12rem] w-full bg-slate-950/80 border border-slate-800/80 rounded-xl text-[0.7rem] font-mono text-slate-100 p-3"
        />

        <div className="text-[0.65rem] text-slate-500">
          Generated from the current ProjectContext — refreshes when gates, wires, or metadata change.
        </div>
      </section>
    </div>
  );
};

export default LogicExportsApp;
