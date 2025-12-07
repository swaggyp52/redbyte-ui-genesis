import React, { useEffect, useMemo, useRef, useState } from "react";
import { World3DApp, type World3DControls } from "../../apps/World3DApp";
import { useProject } from "../context/ProjectContext";
import { WORLD_SIZE } from "../../world3d/VoxelWorld";
import { buildProjectIntoWorld, type ProjectWorldMapping } from "./logicWorldBridge";
import LearningOverlay from "../ui/LearningOverlay";
import { useLearning } from "../context/LearningContext";

const clampLayer = (layer: number) =>
  Math.max(0, Math.min(WORLD_SIZE - 1, Math.floor(layer)));

const World3DOSApp: React.FC = () => {
  const { project } = useProject();
  const { completeStep } = useLearning();
  const controlsRef = useRef<World3DControls | null>(null);

  const [layer, setLayer] = useState(Math.floor(WORLD_SIZE / 2));
  const [running, setRunning] = useState(false);
  const [mapping, setMapping] = useState<ProjectWorldMapping | null>(null);

  useEffect(() => {
    const mapped = buildProjectIntoWorld(project, layer);
    setMapping(mapped);
    controlsRef.current?.pause();
    controlsRef.current?.setLayer(layer);
    controlsRef.current?.reset();
    setRunning(false);
  }, [project, layer]);

  const summary = useMemo(() => {
    if (!mapping) return `${project.meta.name} · awaiting layout`;
    return `${project.meta.name} · ${project.logic.template.nodes.length} nodes · ${mapping.blocks} voxels on Y=${mapping.layer}`;
  }, [mapping, project.logic.template.nodes.length, project.meta.name]);

  const rebuild = () => {
    const mapped = buildProjectIntoWorld(project, layer);
    setMapping(mapped);
    controlsRef.current?.pause();
    controlsRef.current?.setLayer(layer);
    controlsRef.current?.reset();
    setRunning(false);
  };

  return (
    <div className="h-full flex flex-col gap-3 text-xs">
      <header className="border-b border-slate-800/80 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-sm text-slate-100 font-semibold">3D Simulator</h1>
          <p className="text-[0.7rem] text-slate-400">
            Active project mapped into the voxel world via logic→redstone layout.
          </p>
        </div>

        <div className="text-right">
          <div className="text-[0.65rem] text-emerald-300 font-mono">
            PROJECT://{project.meta.id}
          </div>
          <div className="text-[0.65rem] text-slate-500">{summary}</div>
        </div>
      </header>

      <section className="rb-glass rounded-2xl border border-slate-800/80 p-3 flex flex-col gap-3">
        <LearningOverlay
          stepId="view-in-3d"
          title="Map logic → redstone"
          description="Rebuild to regenerate voxels from the active project, then scrub layers to see how gates and wires become dust patterns."
          bullets={[
            "Run/pause/step controls drive the redstone simulation clock.",
            "Layer slider slices the voxel world to reveal buried wiring runs.",
            "Rebuild resets the mapping, useful after editing gates or wires in Logic Designer.",
          ]}
          ctaLabel="I toured the 3D view"
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                running
                  ? controlsRef.current?.pause()
                  : controlsRef.current?.run()
              }
              className={`px-2 py-1 rounded-xl border text-[0.7rem] ${
                running
                  ? "border-rose-500/70 text-rose-300"
                  : "border-emerald-500/70 text-emerald-300"
              }`}
            >
              {running ? "Pause" : "Run"}
            </button>

            <button
              onClick={() => controlsRef.current?.step()}
              className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-sky-500/70"
            >
              Step
            </button>

            <button
              onClick={() => controlsRef.current?.reset()}
              className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-amber-500/70"
            >
              Reset
            </button>
            <button
              onClick={rebuild}
              className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-emerald-500/70"
            >
              Rebuild mapping
            </button>
          </div>

          <div className="flex items-center gap-2 text-[0.7rem]">
            <span className="text-slate-400">Layer</span>
            <input
              type="range"
              min={0}
              max={WORLD_SIZE - 1}
              value={layer}
              onChange={(e) => {
                const next = clampLayer(Number(e.target.value));
                setLayer(next);
                controlsRef.current?.setLayer(next);
              }}
            />
            <span className="font-mono text-slate-200">Y={layer}</span>
          </div>

          <div className="ml-auto text-[0.7rem] text-slate-400">
            {mapping
              ? `${mapping.blocks} voxels · nets ${mapping.nets} · IO ${mapping.ioPins} · clocks ${mapping.clocks}`
              : "No mapping yet"}
          </div>
        </div>

        <div className="flex-1 min-h-0 border border-slate-800/80 rounded-2xl overflow-hidden">
          <World3DApp
            ref={controlsRef}
            initialLayerY={layer}
            onLayerChange={(y) => setLayer(clampLayer(y))}
            onRunningChange={(flag) => setRunning(flag)}
            onReady={() => completeStep("view-in-3d")}
          />
        </div>
      </section>
    </div>
  );
};

export default World3DOSApp;
