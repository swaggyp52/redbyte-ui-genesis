// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useState } from 'react';
import { getRenderCounts } from '@redbyte/rb-utils';

interface PerfHudProps {
  onClose?: () => void;
}

const COUNT_KEYS = ['LogicCanvas', 'SchematicView', 'OscilloscopeView', 'RightDock'];

export const PerfHud: React.FC<PerfHudProps> = ({ onClose }) => {
  const [fps, setFps] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [memory, setMemory] = useState<string>('n/a');

  useEffect(() => {
    let rafId = 0;
    let frames = 0;
    let last = performance.now();

    const loop = (now: number) => {
      frames += 1;
      if (now - last >= 1000) {
        const nextFps = Math.round((frames * 1000) / (now - last));
        setFps(nextFps);
        frames = 0;
        last = now;
      }
      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCounts(getRenderCounts());
      if ('memory' in performance) {
        const memoryInfo = performance.memory as {
          usedJSHeapSize: number;
          jsHeapSizeLimit: number;
        };
        const used = (memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(1);
        const total = (memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(0);
        setMemory(`${used} MB / ${total} MB`);
      } else {
        setMemory('n/a');
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const rows = useMemo(
    () =>
      COUNT_KEYS.map((key) => ({
        key,
        value: counts[key] ?? 0,
      })),
    [counts]
  );

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-slate-950/90 border border-cyan-500/40 rounded-lg p-3 text-xs text-slate-200 shadow-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold tracking-wide text-cyan-200">Perf HUD</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded px-1"
            aria-label="Close performance HUD"
          >
            ×
          </button>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400">FPS</span>
          <span className="text-cyan-200">{fps}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Memory</span>
          <span className="text-cyan-200">{memory}</span>
        </div>
      </div>
      <div className="mt-3 border-t border-slate-800 pt-2 space-y-1">
        {rows.map((row) => (
          <div key={row.key} className="flex justify-between">
            <span className="text-slate-400">{row.key}</span>
            <span className="text-slate-200">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
