import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SignalSample, SignalSource } from './types';

interface ScopePanelProps {
  signalSource: SignalSource | null;
  currentTick: number;
  selectedSignalId: string | null;
}

const getWindowStart = (currentTick: number, windowTicks: number) =>
  Math.max(0, currentTick - windowTicks);

const normalizeSamples = (
  samples: SignalSample[],
  tickFrom: number,
  tickTo: number,
  fallbackValue: number
): SignalSample[] => {
  const normalized: SignalSample[] = [];
  let lastValue = fallbackValue;
  for (const sample of samples) {
    if (sample.tick < tickFrom) {
      lastValue = sample.value;
      continue;
    }
    break;
  }
  normalized.push({ tick: tickFrom, value: lastValue });
  samples.forEach((sample) => {
    if (sample.tick < tickFrom || sample.tick > tickTo) return;
    if (normalized.length === 0 || sample.tick !== normalized[normalized.length - 1].tick) {
      normalized.push(sample);
    }
  });
  if (normalized.length === 1) {
    normalized.push({ tick: tickTo, value: normalized[0].value });
  }
  return normalized;
};

export const ScopePanel: React.FC<ScopePanelProps> = ({
  signalSource,
  currentTick,
  selectedSignalId,
}) => {
  const [windowTicks, setWindowTicks] = useState(300);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const signal = useMemo(() => {
    if (!signalSource || !selectedSignalId) return null;
    return signalSource.resolveSignal(selectedSignalId);
  }, [signalSource, selectedSignalId]);

  const samples = useMemo(() => {
    if (!signalSource || !signal) return [] as SignalSample[];
    const tickFrom = getWindowStart(currentTick, windowTicks);
    const stride = Math.max(1, Math.floor(windowTicks / 200));
    return signalSource.getHistory(signal, tickFrom, currentTick, stride);
  }, [signalSource, signal, currentTick, windowTicks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#0b0f17';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i += 1) {
      const x = (i / 10) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let i = 0; i <= 4; i += 1) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (!signal) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px monospace';
      ctx.fillText('Select a signal to view', 12, height / 2);
      return;
    }

    const tickFrom = getWindowStart(currentTick, windowTicks);
    const baseline = signalSource?.sample(signal, tickFrom) ?? 0;
    const normalized = normalizeSamples(samples, tickFrom, currentTick, baseline);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const toX = (tick: number) => {
      if (currentTick === tickFrom) return 0;
      return ((tick - tickFrom) / (currentTick - tickFrom)) * width;
    };

    const toY = (value: number) => {
      const clamped = Math.max(0, Math.min(1, value));
      return height - (clamped * (height * 0.7) + height * 0.15);
    };

    let last = normalized[0];
    ctx.moveTo(toX(last.tick), toY(last.value));
    for (let i = 1; i < normalized.length; i += 1) {
      const sample = normalized[i];
      ctx.lineTo(toX(sample.tick), toY(last.value));
      ctx.lineTo(toX(sample.tick), toY(sample.value));
      last = sample;
    }
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`t=${tickFrom}-${currentTick}`, 12, height - 8);
  }, [signal, signalSource, currentTick, samples, windowTicks]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-200">{signal?.label ?? 'Scope'}</div>
        <label className="text-[10px] text-gray-500 flex items-center gap-2">
          Window
          <input
            value={windowTicks}
            onChange={(e) => setWindowTicks(Math.max(10, Number(e.target.value) || 300))}
            className="w-16 bg-transparent text-gray-200 font-mono text-[10px]"
          />
        </label>
      </div>
      <div className="h-40 w-full border border-gray-800 rounded bg-black/50">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
};
