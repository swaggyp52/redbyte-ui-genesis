// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { ProofPack } from '../recording/runRecord';
import { useRunRecorderStore } from '../stores/runRecorderStore';
import { decodeRunRecord } from '../recording/runRecord';
import { isProofPack } from '../recording/proofPack';
import {
  buildCircuitSummary,
  compareCircuitSummary,
  buildMismatchEntries,
  positionFromTick,
  tickFromPosition,
} from '../recording/runRecordUtils';

interface RunRecorderPanelProps {
  circuit: Circuit;
  isRunning: boolean;
  currentTick: number;
  tickRate: number;
  onArm: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onStartReplay: () => void;
  onStopReplay: () => void;
  onPauseReplay: () => void;
  onResumeReplay: () => void;
  onStepReplay: (ticks: number) => void;
  onJumpReplay: (tick: number) => void;
  onVerify: () => void;
  onExport: () => void;
  onExportProof: () => void;
  onRecordProof: () => void;
  onFocusTarget: (nodeId: string, portName: string) => void;
  onMismatchSelect: (probeId: string) => void;
  onImportProofPack: (pack: ProofPack) => void;
}

export const RunRecorderPanel: React.FC<RunRecorderPanelProps> = ({
  circuit,
  isRunning,
  currentTick,
  tickRate,
  onArm,
  onStartRecording,
  onStopRecording,
  onStartReplay,
  onStopReplay,
  onPauseReplay,
  onResumeReplay,
  onStepReplay,
  onJumpReplay,
  onVerify,
  onExport,
  onExportProof,
  onRecordProof,
  onFocusTarget,
  onMismatchSelect,
  onImportProofPack,
}) => {
  const {
    mode,
    stimulus,
    record,
    verificationStatus,
    playheadTick,
    replayPaused,
    setPlayheadTick,
    setRecord,
    applyEditedEvents,
    normalizeEvents,
  } = useRunRecorderStore();
  const [importError, setImportError] = React.useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
  const [selectedEventIndex, setSelectedEventIndex] = React.useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = React.useState(false);
  const [showProofGuide, setShowProofGuide] = React.useState(false);
  const timelineRef = React.useRef<HTMLDivElement>(null);

  const events = record ? record.stimulus : stimulus;
  const durationTicks = record?.summary.durationTicks ?? record?.summary.tickCount ?? 0;
  const startTick = record?.summary.startTick ?? 0;
  const maxTick = Math.max(durationTicks, 1);

  const compatibility = React.useMemo(() => {
    if (!record || !record.circuitSummary) return null;
    return compareCircuitSummary(buildCircuitSummary(circuit), record.circuitSummary);
  }, [circuit, record]);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const raw = JSON.parse(text);
        if (isProofPack(raw)) {
          setRecord(raw.runRecord);
          onImportProofPack(raw);
          setImportError(null);
          return;
        }
        const parsed = decodeRunRecord(text);
        setRecord(parsed);
        setImportError(null);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : 'Import failed');
      }
    };
    reader.readAsText(file);
  };

  const scrubToClientX = React.useCallback(
    (clientX: number) => {
      if (!record || !replayPaused || !timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const tick = tickFromPosition(clientX - rect.left, rect.width, durationTicks);
      setPlayheadTick(tick);
    },
    [record, replayPaused, durationTicks, setPlayheadTick]
  );

  React.useEffect(() => {
    if (!isScrubbing) return;
    const handleMove = (event: MouseEvent) => scrubToClientX(event.clientX);
    const handleUp = () => setIsScrubbing(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isScrubbing, scrubToClientX]);

  const handleEventUpdate = (index: number, updates: Partial<(typeof events)[number]>) => {
    if (!record) return;
    const next = [...events];
    next[index] = { ...next[index], ...updates };
    applyEditedEvents(next);
  };

  const handleEventDelete = (index: number) => {
    if (!record) return;
    const next = [...events];
    next.splice(index, 1);
    applyEditedEvents(next);
  };

  const handleEventDrop = (fromIndex: number, toIndex: number) => {
    if (!record) return;
    if (fromIndex === toIndex) return;
    const next = [...events];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    applyEditedEvents(next);
  };

  const statusLabel =
    mode === 'recording'
      ? 'Recording'
      : mode === 'replaying'
      ? 'Replaying'
      : mode === 'armed'
      ? 'Armed'
      : 'Idle';

  const handleRecordProof = () => {
    onRecordProof();
    setShowProofGuide(true);
    window.setTimeout(() => setShowProofGuide(false), 2500);
  };

  return (
    <div className="p-4 text-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-gray-400">Trace Explorer</div>
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
          <span className="font-mono">{events.length}</span>
        </div>
        <div className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded px-2 py-1">
          <span>t = tick / rate</span>
          <span className="font-mono">
            {tickRate > 0 ? `1/${tickRate}s` : '-'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-[11px]">
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
          onClick={handleRecordProof}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
        >
          Record Proof
        </button>
        <button
          onClick={mode === 'replaying' ? onStopReplay : onStartReplay}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={!record}
        >
          {mode === 'replaying' ? 'Stop' : 'Replay'}
        </button>
        <button
          onClick={replayPaused ? onResumeReplay : onPauseReplay}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={mode !== 'replaying'}
        >
          {replayPaused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={() => onStepReplay(1)}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={mode !== 'replaying' || !replayPaused}
        >
          Step
        </button>
        <button
          onClick={() => onStepReplay(10)}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={mode !== 'replaying' || !replayPaused}
        >
          Step 10
        </button>
        <button
          onClick={() => onJumpReplay(0)}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={!record}
        >
          Jump Start
        </button>
        <button
          onClick={() => onJumpReplay(durationTicks)}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={!record}
        >
          Jump End
        </button>
      </div>
      {showProofGuide && (
        <div className="text-[10px] text-cyan-300">
          Toggle inputs, then stop to capture a proof.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          onClick={onVerify}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={!record}
        >
          Verify
        </button>
        <button
          onClick={onExport}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={!record}
        >
          Export
        </button>
        <button
          onClick={onExportProof}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={!record}
        >
          Export Proof
        </button>
        <label className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200 text-center cursor-pointer">
          Import
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
        <button
          onClick={normalizeEvents}
          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
          type="button"
          disabled={!record || events.length === 0}
        >
          Normalize
        </button>
      </div>

      {importError && (
        <div className="text-[10px] text-red-400 bg-red-900/20 border border-red-700/40 rounded px-2 py-1">
          {importError}
        </div>
      )}

      {record && (
        <div className="text-[10px] text-gray-400 bg-gray-800/40 border border-gray-700 rounded px-2 py-1">
          Recorded {record.trace.length} samples over {record.summary.durationTicks ?? record.summary.tickCount} ticks.
          {compatibility && (
            <span className="ml-2 text-gray-500">Compat: {compatibility}</span>
          )}
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Run Timeline</div>
        <div
          ref={timelineRef}
          className={`relative h-12 bg-gray-900/70 border border-gray-700 rounded ${
            replayPaused ? 'cursor-pointer' : 'cursor-not-allowed'
          }`}
          onMouseDown={(event) => {
            if (!record || !replayPaused) return;
            setIsScrubbing(true);
            scrubToClientX(event.clientX);
          }}
          onClick={(event) => {
            if (!record || !replayPaused) return;
            scrubToClientX(event.clientX);
          }}
        >
          {events.map((event, index) => {
            const left = (positionFromTick(event.tick, 100, maxTick) / 100) * 100;
            return (
              <div
                key={`${event.nodeId}-${event.portName}-${event.tick}-${index}`}
                className="absolute top-2 h-6 w-1 bg-cyan-400/70"
                style={{ left: `${left}%` }}
              />
            );
          })}
          <div
            className="absolute top-0 bottom-0 w-px bg-cyan-300"
            style={{ left: `${(positionFromTick(playheadTick, 100, maxTick) / 100) * 100}%` }}
          />
          <div className="absolute bottom-1 left-2 text-[10px] text-gray-400">
            start t{startTick} • duration {durationTicks} ticks
          </div>
          <div className="absolute bottom-1 right-2 text-[10px] text-cyan-300 font-mono">
            playhead t{playheadTick}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wide text-gray-400">Stimulus Events</div>
          <div className="text-[10px] text-gray-500">click to focus</div>
        </div>
        {events.length === 0 ? (
          <div className="text-[10px] text-gray-500">No events recorded yet.</div>
        ) : (
          <div className="space-y-1">
            {events.map((event, index) => (
              <div
                key={`${event.nodeId}-${event.portName}-${event.tick}-${index}`}
                draggable={!!record}
                onDragStart={() => setDraggedIndex(index)}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onDragOver={(e) => {
                  if (!record) return;
                  e.preventDefault();
                  setDragOverIndex(index);
                }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!record || draggedIndex === null) return;
                  handleEventDrop(draggedIndex, index);
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onClick={() => {
                  setSelectedEventIndex(index);
                  onFocusTarget(event.nodeId, event.portName);
                }}
                className={`flex items-center gap-2 bg-gray-800/40 border rounded px-2 py-1 text-[10px] cursor-pointer ${
                  dragOverIndex === index
                    ? 'border-cyan-500 bg-cyan-900/20'
                    : selectedEventIndex === index
                    ? 'border-cyan-500/60 bg-cyan-900/10'
                    : 'border-gray-700'
                }`}
              >
                <div className="flex flex-col items-center text-gray-500 cursor-grab">
                  <span>••</span>
                </div>
                <input
                  type="number"
                  value={event.tick}
                  disabled={!record}
                  onChange={(e) =>
                    handleEventUpdate(index, { tick: Math.max(0, Number(e.target.value)) })
                  }
                  className="w-14 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-[10px] font-mono"
                  aria-label="Event tick number"
                />
                <input
                  type="text"
                  value={event.label ?? ''}
                  disabled={!record}
                  onChange={(e) => handleEventUpdate(index, { label: e.target.value })}
                  className="flex-1 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-[10px]"
                  placeholder={`${event.nodeId}.${event.portName}`}
                  aria-label="Event label"
                />
                <div className="font-mono text-gray-300">
                  {event.nodeId}.{event.portName}
                </div>
                <div className="px-2 py-0.5 rounded bg-gray-700 text-gray-200 font-mono">
                  {event.value}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEventDelete(index);
                  }}
                  className="text-gray-400 hover:text-red-300"
                  title="Delete event"
                  type="button"
                  disabled={!record}
                >
                  A-
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wide text-gray-400">Verification</div>
          {verificationStatus.status !== 'unknown' && (
            <div
              className={`text-[10px] px-2 py-0.5 rounded border ${
                verificationStatus.status === 'pass'
                  ? 'bg-green-900/20 border-green-700 text-green-300'
                  : 'bg-red-900/20 border-red-700 text-red-300'
              }`}
            >
              {verificationStatus.status === 'pass'
                ? '✅ VERIFIED'
                : `❌ MISMATCH t${verificationStatus.mismatch?.tick ?? '-'}`}
            </div>
          )}
        </div>

        {verificationStatus.status === 'fail' && verificationStatus.mismatch && (
          <div className="space-y-2 text-[10px] bg-gray-900/40 border border-gray-700 rounded px-2 py-2">
            <div className="flex items-center justify-between">
              <div className="text-gray-300">
                Divergence at tick {verificationStatus.mismatch.tick}
              </div>
              <button
                onClick={() => {
                  onPauseReplay();
                  onJumpReplay(verificationStatus.mismatch?.tick ?? 0);
                  const firstProbe = record?.probes.find((probe) =>
                    verificationStatus.mismatch?.probeIds.includes(probe.id)
                  );
                  if (firstProbe) {
                    onFocusTarget(firstProbe.nodeId, firstProbe.portName);
                  }
                }}
                className="px-2 py-0.5 rounded border border-gray-600 text-gray-200 hover:bg-gray-800"
                type="button"
              >
                Jump to divergence
              </button>
            </div>
            <div className="space-y-1">
              {buildMismatchEntries(verificationStatus.mismatch, record?.probes ?? []).map((entry) => (
                <button
                  key={entry.probeId}
                  onClick={() => onMismatchSelect(entry.probeId)}
                  className="flex items-center justify-between text-left w-full hover:text-orange-200"
                  type="button"
                >
                  <span className="text-gray-400">
                    {entry.label} ({entry.nodeId}.{entry.portName})
                  </span>
                  <span className="font-mono text-gray-200">
                    {entry.expected} → {entry.actual}
                  </span>
                </button>
              ))}
            </div>
            <div className="text-[10px] text-gray-500">
              Fan-in radius: 4 hops
            </div>
            <div className="pt-2 border-t border-gray-700">
              <div className="text-gray-400 mb-1">Recent stimulus</div>
              {verificationStatus.mismatch.recentStimulus.length === 0 ? (
                <div className="text-gray-500">No stimulus before divergence.</div>
              ) : (
                verificationStatus.mismatch.recentStimulus.map((event, index) => (
                  <div key={`${event.nodeId}-${event.tick}-${index}`} className="text-gray-300">
                    t{event.tick} {event.nodeId}.{event.portName} = {event.value}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
