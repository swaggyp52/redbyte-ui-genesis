// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { IoMapping, IoMappingEntry } from '@redbyte/rb-utils';

interface SignalItem {
  id: string;
  label: string;
  type: string;
}

interface BoardIOPanelProps {
  ioMapping: IoMapping;
  inputStates: Record<string, boolean>;
  outputStates: Record<string, boolean>;
  onToggleInput: (entry: IoMappingEntry) => void;
  availableSignals?: { inputs: SignalItem[]; outputs: SignalItem[] };
  onInitializeMapping?: () => void;
  onAssignPin?: (entry: IoMappingEntry, pin: string) => void;
  hardwareMode?: 'simulated' | 'board';
  onHardwareModeChange?: (mode: 'simulated' | 'board') => void;
  boardConnected?: boolean;
}

const getLabel = (entry: IoMappingEntry) => entry.label || entry.pin || `${entry.nodeId}.${entry.port}`;

export const BoardIOPanel: React.FC<BoardIOPanelProps> = ({
  ioMapping,
  inputStates,
  outputStates,
  onToggleInput,
  availableSignals,
  onInitializeMapping,
  onAssignPin,
  hardwareMode = 'simulated',
  onHardwareModeChange,
  boardConnected = false,
}) => {
  const showMappingEditor = Boolean(availableSignals && onAssignPin);
  const inputCount = availableSignals?.inputs.length ?? 0;
  const outputCount = availableSignals?.outputs.length ?? 0;
  const showHardwareToggle = Boolean(onHardwareModeChange);

  return (
    <div className="border-b border-slate-800 bg-slate-950/60">
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Board I/O</div>
        <div className="flex items-center gap-3">
          {showHardwareToggle && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onHardwareModeChange?.('simulated')}
                className={`px-2 py-0.5 text-[9px] font-semibold rounded border transition-colors ${
                  hardwareMode === 'simulated'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                    : 'border-slate-700 bg-slate-900/40 text-slate-500 hover:text-slate-400'
                }`}
                aria-label="Simulated mode"
              >
                SIM
              </button>
              <button
                type="button"
                onClick={() => onHardwareModeChange?.('board')}
                className={`px-2 py-0.5 text-[9px] font-semibold rounded border transition-colors ${
                  hardwareMode === 'board'
                    ? boardConnected
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-slate-700 bg-slate-900/40 text-slate-500 hover:text-slate-400'
                }`}
                aria-label="Hardware board mode"
                title={hardwareMode === 'board' && !boardConnected ? 'Board not connected' : ''}
              >
                HW {hardwareMode === 'board' && !boardConnected && '⚠'}
              </button>
            </div>
          )}
          <div className="text-[10px] text-slate-500">
            {hardwareMode === 'board' ? (boardConnected ? 'Live Board' : 'Board Offline') : 'Unified Project'}
          </div>
        </div>
      </div>
      {showMappingEditor && (
        <div className="border-t border-slate-800/80 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">IO Mapping</div>
            <div className="text-[9px] text-slate-600">{inputCount} inputs · {outputCount} outputs</div>
            {onInitializeMapping && ioMapping.inputs.length === 0 && ioMapping.outputs.length === 0 && (
              <button
                type="button"
                onClick={onInitializeMapping}
                className="text-[10px] font-semibold text-cyan-300 hover:text-cyan-200"
              >
                Generate from circuit
              </button>
            )}
          </div>
          {ioMapping.inputs.length === 0 && ioMapping.outputs.length === 0 ? (
            <div className="mt-2 text-[10px] text-slate-600 italic">No IO mapping entries yet.</div>
          ) : (
            <div className="mt-2 space-y-3">
              <div className="space-y-1">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Inputs → Switches/Buttons</div>
                {ioMapping.inputs.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-slate-300">{getLabel(entry)}</span>
                    <select
                      className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-slate-200"
                      value={entry.pin || ''}
                      onChange={(e) => onAssignPin?.(entry, e.target.value)}
                      aria-label={`Map input ${getLabel(entry)}`}
                    >
                      <option value="">(Unmapped)</option>
                      <optgroup label="Switches">
                        {Array.from({ length: 16 }).map((_, i) => (
                          <option key={`SW${i}`} value={`SW${i}`}>SW{i}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Buttons">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <option key={`BTN${i}`} value={`BTN${i}`}>BTN{i}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Outputs → LEDs</div>
                {ioMapping.outputs.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-slate-300">{getLabel(entry)}</span>
                    <select
                      className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-slate-200"
                      value={entry.pin || ''}
                      onChange={(e) => onAssignPin?.(entry, e.target.value)}
                      aria-label={`Map output ${getLabel(entry)}`}
                    >
                      <option value="">(Unmapped)</option>
                      <optgroup label="LEDs">
                        {Array.from({ length: 16 }).map((_, i) => (
                          <option key={`LD${i}`} value={`LD${i}`}>LD{i}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 px-4 pb-3">
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Inputs</div>
          {ioMapping.inputs.length === 0 ? (
            <div className="text-[10px] text-slate-600 italic">No inputs mapped.</div>
          ) : (
            ioMapping.inputs.map((entry) => {
              const isOn = inputStates[entry.id] ?? false;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onToggleInput(entry)}
                  className={`w-full flex items-center justify-between rounded border px-2 py-1 text-[11px] transition-colors ${isOn
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                    : 'border-slate-700/70 bg-slate-900/40 text-slate-300 hover:border-slate-600'
                    }`}
                >
                  <span className="truncate">{getLabel(entry)}</span>
                  <span className={`text-[10px] font-bold ${isOn ? 'text-emerald-300' : 'text-slate-500'}`}>{isOn ? 'ON' : 'OFF'}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Outputs</div>
          {ioMapping.outputs.length === 0 ? (
            <div className="text-[10px] text-slate-600 italic">No outputs mapped.</div>
          ) : (
            ioMapping.outputs.map((entry) => {
              const isOn = outputStates[entry.id] ?? false;
              return (
                <div
                  key={entry.id}
                  className="w-full flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-2 py-1 text-[11px]"
                >
                  <span className="truncate text-slate-200">{getLabel(entry)}</span>
                  <span className={`text-[10px] font-bold ${isOn ? 'text-amber-300' : 'text-slate-600'}`}>{isOn ? 'HIGH' : 'LOW'}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
