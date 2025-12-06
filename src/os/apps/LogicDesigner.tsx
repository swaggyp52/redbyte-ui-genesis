import React, { useMemo } from "react";
import { useProject } from "../context/ProjectContext";
import { LogicNodeType } from "../../logic/LogicTypes";

const LOGIC_KINDS: LogicNodeType[] = [
  "INPUT_TOGGLE",
  "CLOCK",
  "GATE_AND",
  "GATE_OR",
  "GATE_NOT",
  "GATE_XOR",
  "OUTPUT_LAMP",
];

const LogicDesigner: React.FC = () => {
  const { project, addLogicNode, removeLogicNode } = useProject();

  const gateNodes = useMemo(
    () =>
      project.logic.nodes.filter((n) =>
        ["GATE_AND", "GATE_OR", "GATE_NOT", "GATE_XOR"].includes(n.type)
      ),
    [project.logic.nodes]
  );

  return (
    <div className="h-full w-full bg-black/80 text-[11px] text-slate-100 flex">
      <div className="w-40 border-r border-red-900/60 p-2 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-red-300/80 mb-1">
          gates
        </div>
        <div className="space-y-1">
          {LOGIC_KINDS.map((kind) => (
            <button
              key={kind}
              onClick={() => addLogicNode(kind)}
              className="w-full rounded border border-red-900/70 bg-black/70 hover:border-red-400/80 px-2 py-1 text-left"
            >
              <div className="text-[11px] text-slate-100">
                {kind.replace("GATE_", "").replace("_", " ")}
              </div>
              <div className="text-[9px] text-slate-400">
                template-backed {kind.toLowerCase()}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-red-300/80">
              logic graph (proto)
            </div>
            <div className="text-[11px] text-slate-400">
              {gateNodes.length} gate
              {gateNodes.length === 1 ? "" : "s"} in project
            </div>
          </div>
        </div>

        <div className="flex-1 rounded-lg border border-red-900/70 bg-black/70 overflow-auto">
          <table className="min-w-full text-[11px]">
            <thead className="bg-black/60 text-slate-400 border-b border-red-900/60">
              <tr>
                <th className="px-3 py-2 text-left font-normal">Label</th>
                <th className="px-3 py-2 text-left font-normal">Kind</th>
                <th className="px-3 py-2 text-left font-normal">Inputs</th>
                <th className="px-3 py-2 text-left font-normal">Outputs</th>
                <th className="px-3 py-2 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {gateNodes.map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-red-900/40 last:border-0 hover:bg-red-950/40"
                >
                  <td className="px-3 py-1.5">{g.label}</td>
                  <td className="px-3 py-1.5 text-slate-300">{g.type}</td>
                  <td className="px-3 py-1.5 text-slate-300">{g.inputs}</td>
                  <td className="px-3 py-1.5 text-slate-300">{g.outputs}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      onClick={() => removeLogicNode(g.id)}
                      className="text-[10px] uppercase tracking-[0.16em] text-red-300/80 hover:text-red-200"
                    >
                      remove
                    </button>
                  </td>
                </tr>
              ))}
              {gateNodes.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-4 text-center text-slate-500 text-[11px]"
                  >
                    no gates yet  add from the left palette
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-[10px] text-slate-500">
          full wiring canvas &amp; timing diagrams will live here later  this is just the
          data backbone
        </div>
      </div>
    </div>
  );
};

export default LogicDesigner;
