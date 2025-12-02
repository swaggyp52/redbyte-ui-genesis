import React, { useEffect, useRef } from "react";
import { ProbeSample, ProbeDef } from "./ProbeBus";

interface Props {
  samples: ProbeSample[];
  probes: ProbeDef[];
}

export function WaveformCanvas({ samples, probes }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    // draw each probe on its own row
    const rowH = h / Math.max(probes.length, 1);

    probes.forEach((p, i) => {
      if (!p.visible) return;

      const rowY = i * rowH;
      ctx.strokeStyle = "#1e293b";
      ctx.strokeRect(0, rowY, w, rowH);

      const ps = samples.filter((s) => s.probeId === p.id);
      if (!ps.length) return;

      const ticks = ps.map((s) => s.tick);
      const minT = Math.min(...ticks);
      const maxT = Math.max(...ticks);
      const range = Math.max(1, maxT - minT);

      ctx.strokeStyle = "#38bdf8";
      ctx.beginPath();

      ps.forEach((s, k) => {
        const x = ((s.tick - minT) / range) * w;
        const y = s.high ? rowY + 6 : rowY + rowH - 6;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui";
      ctx.fillText(p.label, 4, rowY + 12);
    });
  }, [samples, probes]);

  return (
    <canvas
      ref={ref}
      width={560}
      height={240}
      className="rounded-xl border border-slate-800 bg-slate-950"
    />
  );
}






















