import React, { useEffect, useState } from "react";
import {
  subscribeAnalysis,
  type AnalysisResult,
} from "../analyzer/AnalyzerEngine";

export function AnalyzerApp() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const unsub = subscribeAnalysis((r) => setAnalysis(r));
    return () => unsub();
  }, []);

  if (!analysis) {
    return (
      <div className="text-xs text-slate-400 p-4">
        Waiting for simulation…
      </div>
    );
  }

  const { loops, oscillators, fanout, depth } = analysis;

  return (
    <div className="h-full flex flex-col gap-3 text-xs">
      <header className="border-b border-slate-800/80 pb-2 flex justify-between items-center">
        <div>
          <h1 className="text-sm text-slate-100 font-semibold">
            Circuit Analyzer
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Structural intelligence for the 3D Redstone world.
          </p>
        </div>
        <span className="text-[0.7rem] text-slate-500 uppercase">
          ANALYZER://STRUCTURE
        </span>
      </header>

      <section className="rb-glass p-3 rounded-2xl border border-slate-800/80 overflow-auto flex-1 flex flex-col gap-4">
        <div>
          <h2 className="text-slate-100 text-xs font-semibold mb-1">
            Loops Detected ({loops.length})
          </h2>
          <div className="max-h-24 overflow-auto flex flex-col gap-1">
            {loops.map((l, i) => (
              <div
                key={i}
                className="border border-slate-700/70 rounded-xl p-1 text-slate-300"
              >
                Length {l.length} → {l.cycle.join(" → ")}
              </div>
            ))}
            {!loops.length && (
              <div className="text-slate-500">No loops found.</div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-slate-100 text-xs font-semibold mb-1">
            Oscillators ({oscillators.length})
          </h2>
          <div className="max-h-24 overflow-auto flex flex-col gap-1">
            {oscillators.map((o, i) => (
              <div
                key={i}
                className="border border-slate-700/70 rounded-xl p-1 text-slate-300"
              >
                {o.key} → period {o.period}, freq {o.frequency.toFixed(2)}
              </div>
            ))}
            {!oscillators.length && (
              <div className="text-slate-500">No oscillators found.</div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-slate-100 text-xs font-semibold mb-1">
            Fanout Hotspots
          </h2>
          <div className="max-h-24 overflow-auto flex flex-col gap-1">
            {fanout.slice(0, 10).map((f, i) => (
              <div
                key={i}
                className="border border-slate-700/70 rounded-xl p-1 text-slate-300"
              >
                {f.key} → fanout {f.fanout}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-slate-100 text-xs font-semibold mb-1">
            Propagation Depth
          </h2>
          <div className="border border-slate-700/70 rounded-xl p-2 text-slate-300">
            Max depth: {depth.maxDepth}
            <br />
            From node: {depth.deepestNode}
          </div>
        </div>
      </section>
    </div>
  );
}





