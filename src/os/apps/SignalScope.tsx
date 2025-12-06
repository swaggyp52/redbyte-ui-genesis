import React, { useMemo, useState } from "react";
import { SignalScopeApp } from "../../apps/SignalScopeApp";
import { useProject } from "../context/ProjectContext";
import { addProbe } from "../../scope/ProbeBus";
import { projectNodePositions } from "./logicWorldBridge";

const SignalScopeShell: React.FC = () => {
  const { project } = useProject();
  const [layer, setLayer] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");

  const outputNodes = useMemo(
    () => project.logic.template.nodes.filter((n) => n.type === "OUTPUT_LAMP"),
    [project.logic.template.nodes]
  );

  const positions = useMemo(
    () => projectNodePositions(project.logic.template, layer),
    [layer, project.logic.template]
  );

  const handleAddProbe = () => {
    const nodeId = selectedNodeId || outputNodes[0]?.id;
    if (!nodeId) return;

    const pos = positions[nodeId] ?? { x: 0, y: layer, z: 0 };
    addProbe({
      id: crypto.randomUUID(),
      label: nodeId,
      mode: "voxel",
      x: pos.x,
      y: pos.y,
      z: pos.z,
      visible: true,
    });
  };

  return (
    <div className="h-full flex flex-col gap-3 text-xs">
      <header className="border-b border-slate-800/80 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-sm text-slate-100 font-semibold">Signal Scope</h1>
          <p className="text-[0.7rem] text-slate-400">Pick project outputs to probe and watch waveforms streamed from the 3D world.</p>
        </div>
        <div className="text-right text-[0.65rem] text-slate-500">
          <div className="text-emerald-300 font-mono">PROJECT://{project.meta.id}</div>
          <div>{outputNodes.length} outputs detected</div>
        </div>
      </header>

      <section className="rb-glass rounded-2xl border border-slate-800/80 p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[0.7rem]">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Signal</span>
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 text-slate-100"
            >
              <option value="">Auto-select first</option>
              {outputNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label ?? n.id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Layer</span>
            <input
              type="number"
              className="w-16 bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 text-slate-100"
              value={layer}
              onChange={(e) => setLayer(Number(e.target.value))}
            />
          </div>

          <button
            onClick={handleAddProbe}
            className="px-2 py-1 rounded-xl border border-emerald-500/70 text-emerald-300 hover:bg-emerald-500/10"
          >
            Add probe
          </button>
        </div>

        <div className="flex-1 min-h-0 border border-slate-800/80 rounded-2xl overflow-hidden">
          <SignalScopeApp />
        </div>
      </section>
    </div>
  );
};

export default SignalScopeShell;
