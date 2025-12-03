import React, { useEffect, useState } from "react";
import {
  getProbes,
  addProbe,
  removeProbe,
  toggleProbeVisibility,
  subscribeProbeSamples,
  type ProbeSample,
  type ProbeDef,
} from "../scope/ProbeBus";
import { WaveformCanvas } from "../scope/WaveformCanvas";

export function SignalScopeApp() {
  const [probes, setProbes] = useState<ProbeDef[]>(getProbes());
  const [samples, setSamples] = useState<ProbeSample[]>([]);
  const [label, setLabel] = useState("");
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [z, setZ] = useState(0);

  useEffect(() => {
    const unsub = subscribeProbeSamples((s) => setSamples(s));
    return () => unsub();
  }, []);

  const refresh = () => setProbes(getProbes());

  const handleAdd = () => {
    if (!label.trim()) return;
    addProbe({
      id: crypto.randomUUID(),
      label,
      mode: "voxel",
      x,
      y,
      z,
      visible: true,
    });
    setLabel("");
    refresh();
  };

  return (
    <div className="h-full flex flex-col gap-3 text-xs">
      <header className="border-b border-slate-800/80 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            Signal Scope (3D)
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Live voxel probes from the Redstone simulation.
          </p>
        </div>
        <span className="text-[0.65rem] text-slate-500 uppercase">
          SCOPE://VOXEL-PROBES
        </span>
      </header>

      <section className="rb-glass p-3 rounded-2xl border border-slate-800/80 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 text-[0.7rem] text-slate-100 w-24"
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            type="number"
            className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 w-16"
            value={x}
            onChange={(e) => setX(Number(e.target.value))}
          />
          <input
            type="number"
            className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 w-16"
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
          />
          <input
            type="number"
            className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 w-16"
            value={z}
            onChange={(e) => setZ(Number(e.target.value))}
          />
          <button
            onClick={handleAdd}
            className="px-2 py-1 rounded-xl border border-sky-500/70 text-sky-300 hover:bg-sky-500/10 text-[0.7rem]"
          >
            Add Probe
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {probes.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-[0.7rem] p-1 border-b border-slate-800/70"
            >
              <span className="text-slate-300">
                {p.label} → ({p.x},{p.y},{p.z})
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    toggleProbeVisibility(p.id);
                    refresh();
                  }}
                  className="px-2 py-1 rounded-xl border border-slate-700/80 hover:border-emerald-500/70 text-slate-400"
                >
                  {p.visible ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => {
                    removeProbe(p.id);
                    refresh();
                  }}
                  className="px-2 py-1 rounded-xl border border-rose-500/70 text-rose-300 hover:bg-rose-500/10"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex-1 rb-glass p-3 rounded-2xl border border-slate-800/80 overflow-auto">
        <WaveformCanvas samples={samples} probes={probes} />
      </section>
    </div>
  );
}


































