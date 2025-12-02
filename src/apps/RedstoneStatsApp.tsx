import React, { useEffect, useRef, useState } from "react";
import {
  getSimHistory,
  subscribeSimHistory,
  type RedstoneSimSample,
} from "../world3d/SimMetrics";

interface SparklineProps {
  samples: RedstoneSimSample[];
  metric: keyof RedstoneSimSample;
  label: string;
  unit?: string;
}

function Sparkline({ samples, metric, label, unit }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!samples.length) {
      ctx.fillStyle = "#64748b";
      ctx.font = "10px system-ui";
      ctx.fillText("no data", 4, height / 2);
      return;
    }

    const values = samples.map((s) => {
      const v = s[metric];
      return typeof v === "number" ? v : 0;
    });

    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);

    const range = max - min || 1;

    const stepX = width / Math.max(samples.length - 1, 1);

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#38bdf8"; // sky
    ctx.beginPath();

    values.forEach((v, i) => {
      const x = i * stepX;
      const norm = (v - min) / range;
      const y = height - norm * (height - 4) - 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Baseline
    ctx.strokeStyle = "#1e293b";
    ctx.beginPath();
    ctx.moveTo(0, height - 1);
    ctx.lineTo(width, height - 1);
    ctx.stroke();
  }, [samples, metric]);

  const last = samples[samples.length - 1];
  const lastVal =
    last && typeof last[metric] === "number" ? last[metric] : 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[0.7rem] text-slate-300">{label}</span>
        <span className="text-[0.7rem] font-mono text-slate-100">
          {lastVal.toFixed
            ? lastVal.toFixed(metric === "evalMs" ? 2 : 0)
            : lastVal}
          {unit ? <span className="text-slate-500 ml-1">{unit}</span> : null}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={220}
        height={40}
        className="rounded-lg bg-slate-950 border border-slate-800"
      />
    </div>
  );
}

export function RedstoneStatsApp() {
  const [samples, setSamples] = useState<RedstoneSimSample[]>(() =>
    getSimHistory()
  );

  useEffect(() => {
    const unsub = subscribeSimHistory((items) => setSamples(items));
    return () => unsub();
  }, []);

  const last = samples[samples.length - 1] ?? null;

  return (
    <div className="h-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            Redstone Stats
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Live analytics for the 3D Redstone simulation engine.
          </p>
        </div>
        <span className="text-[0.65rem] text-slate-500 uppercase">
          RSIM://METRICS
        </span>
      </header>

      <section className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[0.7rem] text-slate-400">
            Samples tracked:{" "}
            <span className="font-mono text-slate-100">
              {samples.length}
            </span>
          </div>
          {last ? (
            <div className="flex flex-wrap items-center gap-3 text-[0.7rem] text-slate-400">
              <span>
                Tick:{" "}
                <span className="font-mono text-slate-100">
                  {last.tick}
                </span>
              </span>
              <span>
                Powered:{" "}
                <span className="font-mono text-emerald-300">
                  {last.poweredCount}
                </span>
              </span>
              <span>
                Blocks:{" "}
                <span className="font-mono text-slate-100">
                  {last.totalBlocks}
                </span>
              </span>
              <span>
                Clusters:{" "}
                <span className="font-mono text-sky-300">
                  {last.clusterCount}
                </span>
              </span>
            </div>
          ) : (
            <div className="text-[0.7rem] text-slate-500">
              No samples yet. Run the 3D Redstone World simulation.
            </div>
          )}
          <div className="ml-auto text-[0.7rem] text-slate-500">
            Open side-by-side with{" "}
            <span className="font-mono">3D World</span> and{" "}
            <span className="font-mono">World Map 2D</span>.
          </div>
        </div>
      </section>

      <section className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-slate-100">
            Load & Activity
          </h2>
          <Sparkline
            samples={samples}
            metric="poweredCount"
            label="Powered voxels"
          />
          <Sparkline
            samples={samples}
            metric="changedCount"
            label="Cells toggled this tick"
          />
          <Sparkline
            samples={samples}
            metric="evalMs"
            label="Tick eval time"
            unit="ms"
          />
        </div>

        <div className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-slate-100">
            Structure & Topology
          </h2>
          <Sparkline
            samples={samples}
            metric="wireCount"
            label="Wire blocks"
          />
          <Sparkline
            samples={samples}
            metric="gateCount"
            label="Gate blocks"
          />
          <Sparkline
            samples={samples}
            metric="maxClusterSize"
            label="Largest powered cluster"
          />

          {last && (
            <div className="mt-1 grid grid-cols-2 gap-1 text-[0.7rem]">
              <span className="text-slate-400">Outputs</span>
              <span className="font-mono text-fuchsia-300">
                {last.outputCount}
              </span>
              <span className="text-slate-400">Clusters</span>
              <span className="font-mono text-sky-300">
                {last.clusterCount}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}


