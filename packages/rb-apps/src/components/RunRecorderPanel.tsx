// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { useRunRecorderStore } from '../stores/runRecorderStore';
import { decodeRunRecord } from '../recording/runRecord';

interface RunRecorderPanelProps {
  isRunning: boolean;
  currentTick: number;
  tickRate: number;
  onArm: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onStartReplay: () => void;
  onStopReplay: () => void;
  onVerify: () => void;
  onExport: () => void;
}

export const RunRecorderPanel: React.FC<RunRecorderPanelProps> = ({
  isRunning,
  currentTick,
  tickRate,
  onArm,
  onStartRecording,
  onStopRecording,
  onStartReplay,
  onStopReplay,
  onVerify,
  onExport,
}) => {
  const {
    mode,
    stimulus,
    record,
    verificationStatus,
    setRecord,
    removeEventAt,
    moveEvent,
  } = useRunRecorderStore();
  const [importError, setImportError] = React.useState<string | null>(null);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const parsed = decodeRunRecord(text);
        setRecord(parsed);
        setImportError(null);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : 'Import failed');
      }
    };
    reader.readAsText(file);
  };

  const statusLabel =
    mode === 'recording'
      ? 'Recording'
      : mode === 'replaying'
      ? 'Replaying'
      : mode === 'armed'
      ? 'Armed'
      : 'Idle';

  return (
    <div className="p-4 text-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-gray-400">Run Recorder</div>
        <div className="text-xs text-cyan-300 font-mono">{statusLabel}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
        <div className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded px-2 py-1">
          <span>Tick</span>
          <span className="font-mono">{currentTick}</span>
        </div>
        <div className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded px-2 py-1">
          <span>Rate</span>
          <span className="font-mono">{tickRate}Hz</span>
        </div>
        <div className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded px-2 py-1">
          <span>Sim</span>
          <span className={`font-mono ${isRunning ? 'text-green-400' : 'text-gray-400'}`}>
            {isRunning ? 'Running' : 'Paused'}
          </span>
        </div>
        <div className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded px-2 py-1">
          <span>Events</span>
          <span className="font-mono">{stimulus.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          onClick={onArm}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
        >
          Arm
        </button>
        <button
          onClick={mode === 'recording' ? onStopRecording : onStartRecording}
          className={`px-2 py-1 rounded border ${
            mode === 'recording'
              ? 'bg-red-700/30 border-red-500 text-red-200'
              : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200'
          }`}
          type="button"
        >
          {mode === 'recording' ? 'Stop' : 'Record'}
        </button>
        <button
          onClick={mode === 'replaying' ? onStopReplay : onStartReplay}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={!record}
        >
          {mode === 'replaying' ? 'Stop Replay' : 'Replay'}
        </button>
        <button
          onClick={onVerify}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={!record}
        >
          Verify
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          onClick={onExport}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={!record}
        >
          Export
        </button>
        <label className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200 text-center cursor-pointer">
          Import
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
      </div>

      {importError && (
        <div className="text-[10px] text-red-400 bg-red-900/20 border border-red-700/40 rounded px-2 py-1">
          {importError}
        </div>
      )}

      {record && (
        <div className="text-[10px] text-gray-400 bg-gray-800/40 border border-gray-700 rounded px-2 py-1">
          Recorded {record.trace.length} samples over {record.summary.tickCount} ticks.
        </div>
      )}

      {verificationStatus.status !== 'unknown' && (
        <div
          className={`text-[10px] rounded px-2 py-1 border ${
            verificationStatus.status === 'pass'
              ? 'bg-green-900/20 border-green-700 text-green-300'
              : 'bg-red-900/20 border-red-700 text-red-300'
          }`}
        >
          {verificationStatus.status === 'pass'
            ? 'Verification passed.'
            : `Mismatch at tick ${verificationStatus.mismatch?.tick ?? '-'} (${verificationStatus.mismatch?.probeId ?? '-'})`}
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Stimulus</div>
        {stimulus.length === 0 ? (
          <div className="text-[10px] text-gray-500">No events recorded yet.</div>
        ) : (
          <div className="space-y-1">
            {stimulus.map((event, index) => (
              <div
                key={`${event.nodeId}-${event.portName}-${event.tick}-${index}`}
                className="flex items-center gap-2 bg-gray-800/40 border border-gray-700 rounded px-2 py-1 text-[10px]"
              >
                <div className="font-mono text-gray-300">t{event.tick}</div>
                <div className="flex-1 text-gray-300">
                  {event.nodeId}.{event.portName} = {event.value}
                </div>
                <button
                  onClick={() => moveEvent(index, Math.max(0, index - 1))}
                  className="text-gray-400 hover:text-gray-200"
                  title="Move up"
                  type="button"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveEvent(index, Math.min(stimulus.length - 1, index + 1))}
                  className="text-gray-400 hover:text-gray-200"
                  title="Move down"
                  type="button"
                >
                  ▼
                </button>
                <button
                  onClick={() => removeEventAt(index)}
                  className="text-gray-400 hover:text-red-300"
                  title="Delete event"
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
