import React, { useMemo } from "react";
import { useProject } from "../context/ProjectContext";
import { LogicNodeType } from "../../logic/LogicTypes";
import LearningOverlay from "../ui/LearningOverlay";
import { useLearning } from "../context/LearningContext";

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
  const { completeStep } = useLearning();

  const gateNodes = useMemo(
    () =>
      project.logic.template.nodes.filter((n) =>
        ["GATE_AND", "GATE_OR", "GATE_NOT", "GATE_XOR"].includes(n.type)
      ),
    [project.logic.template.nodes]
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
              {gateNodes.length === 1 ? "" : "s"} in project · {project.logic.template.wires.length} wires · {project.logic.nets.length} nets
            </div>
          </div>

          <LearningOverlay
            stepId="build-and-gate"
            title="Design a 2-input AND gate"
            description="Use two input toggles, an AND gate, and a lamp to show how the truth table flows through the graph."
            bullets={[
              "Inputs drive nets; nets bundle wires that feed your gate ports.",
              "Propagation delay is captured in the timing profile for downstream viewers.",
              "Clocks can be attached as nets to drive periodic changes.",
            ]}
            ctaLabel="I built the gate"
          />
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

        <div className="text-[10px] text-slate-500 flex items-center justify-between">
          <span>
            full wiring canvas &amp; timing diagrams will live here later  this is just the
            data backbone
          </span>
          <button
            onClick={() => completeStep("build-and-gate")}
            className="text-[10px] uppercase tracking-[0.14em] text-sky-300 hover:text-sky-200"
          >
            mark tutorial step done
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogicDesigner;
