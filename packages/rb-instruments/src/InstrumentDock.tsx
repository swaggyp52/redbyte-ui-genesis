import React from 'react';
import type { InstrumentId, SignalSource } from './types';
import { useInstrumentState } from './useInstrumentState';
import { NetInspectorPanel } from './NetInspectorPanel';
import { ProbePanel } from './ProbePanel';
import { ScopePanel } from './ScopePanel';
import { SerialPanel } from './SerialPanel';

interface InstrumentDockProps {
  signalSource: SignalSource | null;
  currentTick: number;
  selectedSignalId?: string | null;
  onSelectSignalId?: (id: string | null) => void;
  defaultInstrumentId?: InstrumentId;
}

const instruments: Array<{ id: InstrumentId; label: string }> = [
  { id: 'net-inspector', label: 'Net Inspector' },
  { id: 'scope', label: 'Scope' },
  { id: 'probe', label: 'Probe' },
  { id: 'serial', label: 'Serial' },
];

export const InstrumentDock: React.FC<InstrumentDockProps> = ({
  signalSource,
  currentTick,
  selectedSignalId,
  onSelectSignalId,
  defaultInstrumentId,
}) => {
  const activeInstrumentId = useInstrumentState((state) => state.activeInstrumentId);
  const setActiveInstrumentId = useInstrumentState((state) => state.setActiveInstrumentId);
  const internalSelectedSignalId = useInstrumentState((state) => state.selectedSignalId);
  const setInternalSelectedSignalId = useInstrumentState((state) => state.setSelectedSignalId);

  const resolvedSelectedSignalId = selectedSignalId ?? internalSelectedSignalId;
  const handleSelectSignalId = onSelectSignalId ?? setInternalSelectedSignalId;

  const currentInstrument = activeInstrumentId ?? defaultInstrumentId ?? 'net-inspector';

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center gap-1 border-b border-gray-700 px-2 py-1">
        {instruments.map((instrument) => (
          <button
            key={instrument.id}
            onClick={() => setActiveInstrumentId(instrument.id)}
            className={`px-2 py-1 text-[10px] rounded border ${
              currentInstrument === instrument.id
                ? 'border-blue-400 text-blue-200 bg-blue-900/30'
                : 'border-gray-800 text-gray-400 hover:text-blue-200'
            }`}
          >
            {instrument.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3">
        {currentInstrument === 'net-inspector' && (
          <NetInspectorPanel
            signalSource={signalSource}
            currentTick={currentTick}
            selectedSignalId={resolvedSelectedSignalId}
            onSelectSignalId={handleSelectSignalId}
          />
        )}
        {currentInstrument === 'scope' && (
          <ScopePanel
            signalSource={signalSource}
            currentTick={currentTick}
            selectedSignalId={resolvedSelectedSignalId}
          />
        )}
        {currentInstrument === 'probe' && (
          <ProbePanel
            signalSource={signalSource}
            currentTick={currentTick}
            selectedSignalId={resolvedSelectedSignalId}
          />
        )}
        {currentInstrument === 'serial' && (
          <SerialPanel signalSource={signalSource} />
        )}
      </div>
    </div>
  );
};
