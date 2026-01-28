import React, { useMemo } from 'react';
import type { SignalRef, SignalSource } from './types';

interface NetInspectorPanelProps {
  signalSource: SignalSource | null;
  currentTick: number;
  selectedSignalId: string | null;
  onSelectSignalId: (id: string | null) => void;
}

const formatMembers = (meta?: Record<string, unknown>): string => {
  const members = meta?.members;
  if (typeof members === 'number') return `${members} pins`;
  return 'Unknown';
};

export const NetInspectorPanel: React.FC<NetInspectorPanelProps> = ({
  signalSource,
  currentTick,
  selectedSignalId,
  onSelectSignalId,
}) => {
  const nets = useMemo(() => {
    if (!signalSource) return [] as SignalRef[];
    return signalSource.listSignals().filter((signal) => signal.kind === 'net');
  }, [signalSource]);

  if (!signalSource) {
    return (
      <div className="text-xs text-gray-500">No signal source available.</div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] text-gray-500">{nets.length} nets</div>
      <div className="max-h-52 overflow-auto space-y-1">
        {nets.length === 0 ? (
          <div className="text-[10px] text-gray-500">No nets yet.</div>
        ) : (
          nets.map((net) => {
            const meta = signalSource.getMetadata?.(net);
            const isSelected = selectedSignalId === net.id;
            return (
              <button
                key={net.id}
                onClick={() => onSelectSignalId(net.id)}
                className={`w-full text-left text-[10px] px-2 py-1 rounded border ${
                  isSelected
                    ? 'border-blue-400 text-blue-200 bg-blue-900/20'
                    : 'border-gray-800 text-gray-300 hover:text-blue-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{net.label}</span>
                  <span className="text-[10px] text-gray-500">{formatMembers(meta)}</span>
                </div>
                <div className="text-[9px] text-gray-500">t={currentTick}</div>
              </button>
            );
          })
        )}
      </div>
      {selectedSignalId && signalSource.locate && (
        <button
          onClick={() => {
            const signal = signalSource.resolveSignal(selectedSignalId);
            if (signal) signalSource.locate?.(signal);
          }}
          className="text-[10px] text-blue-300 hover:text-blue-200 text-left"
        >
          Locate selection
        </button>
      )}
    </div>
  );
};
