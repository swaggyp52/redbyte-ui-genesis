import React, { useMemo, useState } from 'react';
import type { SignalSource } from './types';

interface ProbePanelProps {
  signalSource: SignalSource | null;
  currentTick: number;
  selectedSignalId: string | null;
}

const getWindowStart = (currentTick: number, windowTicks: number) =>
  Math.max(0, currentTick - windowTicks);

export const ProbePanel: React.FC<ProbePanelProps> = ({
  signalSource,
  currentTick,
  selectedSignalId,
}) => {
  const [windowTicks, setWindowTicks] = useState(200);

  const signal = useMemo(() => {
    if (!signalSource || !selectedSignalId) return null;
    return signalSource.resolveSignal(selectedSignalId);
  }, [signalSource, selectedSignalId]);

  const history = useMemo(() => {
    if (!signalSource || !signal) return [];
    const tickFrom = getWindowStart(currentTick, windowTicks);
    return signalSource.getHistory(signal, tickFrom, currentTick, 1);
  }, [signalSource, signal, currentTick, windowTicks]);

  const currentValue = useMemo(() => {
    if (!signalSource || !signal) return null;
    return signalSource.sample(signal, currentTick);
  }, [signalSource, signal, currentTick]);

  const lastChangeTick = history.length > 0 ? history[history.length - 1].tick : null;

  if (!signalSource) {
    return <div className="text-xs text-gray-500">No signal source available.</div>;
  }

  if (!signal) {
    return <div className="text-xs text-gray-500">Select a net or pin to inspect.</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-gray-200">{signal.label}</div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-[#111] border border-gray-800 rounded px-2 py-1">
          <div className="text-gray-500 uppercase">Value</div>
          <div className="text-white font-mono">{currentValue ?? 0}</div>
        </div>
        <div className="bg-[#111] border border-gray-800 rounded px-2 py-1">
          <div className="text-gray-500 uppercase">Last Change</div>
          <div className="text-white font-mono">{lastChangeTick ?? '-'}</div>
        </div>
        <div className="bg-[#111] border border-gray-800 rounded px-2 py-1">
          <div className="text-gray-500 uppercase">Toggles</div>
          <div className="text-white font-mono">{history.length}</div>
        </div>
        <div className="bg-[#111] border border-gray-800 rounded px-2 py-1">
          <div className="text-gray-500 uppercase">Window</div>
          <input
            value={windowTicks}
            onChange={(e) => setWindowTicks(Math.max(10, Number(e.target.value) || 200))}
            className="w-full bg-transparent text-white font-mono text-[10px]"
          />
        </div>
      </div>
      <div className="text-[10px] text-gray-500">Recent changes</div>
      <div className="max-h-32 overflow-auto space-y-1">
        {history.length === 0 ? (
          <div className="text-[10px] text-gray-500">No transitions recorded.</div>
        ) : (
          history.slice(-12).map((entry) => (
            <div
              key={`${entry.tick}-${entry.value}`}
              className="text-[10px] text-gray-300"
            >
              Tick {entry.tick}: {entry.value}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
