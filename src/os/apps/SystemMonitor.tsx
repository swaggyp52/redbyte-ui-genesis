import React, { useEffect, useState } from "react";

interface SystemMonitorProps {
  windowCount: number;
}

interface Sample {
  cpu: number;
  mem: number;
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const SystemMonitor: React.FC<SystemMonitorProps> = ({ windowCount }) => {
  const [cpu, setCpu] = useState(18);
  const [mem, setMem] = useState(32);
  const [fps, setFps] = useState(60);
  const [samples, setSamples] = useState<Sample[]>([]);

  // fps
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let id = requestAnimationFrame(function loop(now) {
      frames++;
      const delta = now - last;
      if (delta >= 1000) {
        const f = Math.round((frames * 1000) / delta);
        setFps(f);
        frames = 0;
        last = now;
      }
      id = requestAnimationFrame(loop);
    });

    return () => cancelAnimationFrame(id);
  }, []);

  // cpu/mem + samples
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCpu((prev) => {
        let next = prev + (Math.random() * 12 - 6);
        next += windowCount * 1.5;
        next = clamp(next, 2, 98);
        return Math.round(next);
      });
      setMem((prev) => {
        let next = prev + (Math.random() * 8 - 4);
        next = clamp(next, 10, 95);
        return Math.round(next);
      });
      setSamples((prev) => {
        const next = [...prev, { cpu, mem }];
        if (next.length > 40) next.shift();
        return next;
      });
    }, 900);

    return () => window.clearInterval(timer);
  }, [windowCount, cpu, mem]);

  return (
    <div className="h-full w-full bg-black/80 text-[11px] text-slate-100 flex flex-col p-3 gap-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-red-300/80">
        system monitor
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* cpu */}
        <div className="rounded-lg border border-red-900/70 bg-black/60 p-3 space-y-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-[0.16em] mb-1">
            cpu
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-800/70 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-red-400 to-amber-300"
                style={{ width: `${cpu}%` }}
              />
            </div>
            <div className="text-[11px] text-red-200 font-mono w-10 text-right">
              {cpu}%
            </div>
          </div>
          <div className="text-[10px] text-slate-500">
            estimated browser load
          </div>
        </div>

        {/* memory */}
        <div className="rounded-lg border border-red-900/70 bg-black/60 p-3 space-y-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-[0.16em] mb-1">
            memory
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-800/70 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-300"
                style={{ width: `${mem}%` }}
              />
            </div>
            <div className="text-[11px] text-emerald-200 font-mono w-10 text-right">
              {mem}%
            </div>
          </div>
          <div className="text-[10px] text-slate-500">
            simulated working set
          </div>
        </div>

        {/* session */}
        <div className="rounded-lg border border-red-900/70 bg-black/60 p-3 space-y-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-[0.16em] mb-1">
            session
          </div>
          <div className="space-y-1 text-[10px] text-slate-300">
            <div>fps: {fps}</div>
            <div>windows: {windowCount}</div>
            <div>env: browser / vite</div>
          </div>
        </div>
      </div>

      {/* sparkline */}
      <div className="flex-1 rounded-lg border border-red-900/70 bg-black/60 p-3 flex flex-col gap-2">
        <div className="text-[10px] text-slate-400 uppercase tracking-[0.16em]">
          cpu trace
        </div>
        <div className="flex-1 flex items-end gap-[2px]">
          {samples.map((s, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-red-500/70 via-red-400/50 to-transparent"
              style={{ height: `${20 + s.cpu * 0.7}%` }}
            />
          ))}
        </div>
        <div className="text-[10px] text-slate-500">
          rolling view of recent synthetic cpu load
        </div>
      </div>
    </div>
  );
};

export default SystemMonitor;
