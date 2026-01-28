// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * ECELabApp - Immersive FPGA Development Environment
 *
 * A stunning, production-grade lab simulation environment with
 * photorealistic board visualizations, real-time circuit diagrams,
 * and seamless hardware integration.
 */

import React, { useState, useEffect, useMemo } from 'react';
import BoardPanel from '../components/BoardPanel';
import { CompareView, type CompareSignalCheck } from '../components/CompareView';
import { CircuitCanvas } from '../components/boards/CircuitCanvas';
import { useHardwareStore } from '../stores/hardwareStore';
import { getSignalMap } from '../labs/signalMap';
import { getSimSnapshot, useSimStore, setSimInput } from '../labs/simAdapter';
import { EXPERIMENTS } from '../labs/experiments';
import type { HardwareTraceV1 } from '../hardware/traceFormat';
import { validateTrace } from '../hardware/traceFormat';
import { saveTraceToFS, loadTraceFromFS, saveCapsuleToFS, loadCapsuleFromFS } from '../utils/traceFileUtils';
import { createCapsule, validateCapsule, type RedByteCapsule } from '../hardware/capsuleFormat';
import { LabInstructions } from '../labs/LabInstructions';
import { InspectorPanel } from '../labs/InspectorPanel';
import { LAB_1_CONTENT } from '../labs/labContent';

interface ECELabAppProps {
  windowId?: string;
}

type ECELabMode = 'sim-only' | 'board-connected' | 'guided-lab' | 'inspector';
type ExecutionSource = 'sim' | 'hardware' | 'replay';
type RightPanelTab = 'board' | 'compare' | 'test';

// Board selector dropdown
const BoardSelector: React.FC<{
  value: string;
  onChange: (id: string) => void;
}> = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-[9px] font-bold tracking-wider text-gray-600">BOARD</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Select board"
      className="bg-transparent text-[10px] font-mono text-cyan-400 border-none outline-none cursor-pointer"
      style={{ textShadow: '0 0 8px rgba(0, 212, 255, 0.5)' }}
    >
      <option value="basys3">Basys3</option>
      <option value="spartan3e-starter">Spartan-3E</option>
    </select>
  </div>
);

// Vector Runner View component
import { vectorRunner, type VectorRunResult, type TestVector } from '../labs/vectorRunner';

const VectorRunnerView: React.FC<{
  mode: 'sim' | 'hardware';
}> = ({ mode }) => {
  const [results, setResults] = useState<VectorRunResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const loopbackVectors: TestVector[] = [
    { id: 'v1', name: 'All Off', inputs: { SW: 0 }, expected: { LED: 0 } },
    { id: 'v2', name: 'SW0 On', inputs: { SW: 1 }, expected: { LED: 1 } },
    { id: 'v3', name: 'SW15 On', inputs: { SW: 0x8000 }, expected: { LED: 0x8000 } },
    { id: 'v4', name: 'All On', inputs: { SW: 0xFFFF }, expected: { LED: 0xFFFF } },
  ];

  const handleRun = async () => {
    setIsRunning(true);
    try {
      await vectorRunner.runVectors(loopbackVectors, {
        mode,
        delayMs: 200,
        onUpdate: (latest) => setResults([...latest]),
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-black tracking-widest text-cyan-500 uppercase">Vector Runner</h3>
        <button
          type="button"
          onClick={handleRun}
          disabled={isRunning}
          className={`px-4 py-1.5 rounded text-[10px] font-bold tracking-wider transition-all ${isRunning
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
            }`}
        >
          {isRunning ? 'RUNNING...' : 'RUN VECTORS'}
        </button>
      </div>

      <div className="space-y-2">
        {results.length === 0 ? (
          <div className="text-[10px] text-gray-600 text-center py-8 border border-dashed border-gray-800 rounded">
            No results yet. Click "RUN VECTORS" to start.
          </div>
        ) : (
          results.map((r) => (
            <div
              key={r.vectorId}
              className={`p-2 rounded border flex items-center justify-between transition-all ${r.status === 'PASS' ? 'bg-green-500/10 border-green-500/20' :
                r.status === 'FAIL' ? 'bg-red-500/10 border-red-500/20' :
                  r.status === 'RUNNING' ? 'bg-cyan-500/10 border-cyan-500/30 animate-pulse' :
                    'bg-gray-950/50 border-gray-800'
                }`}
            >
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400 uppercase">{r.vectorId}</span>
                <span className="text-[10px] text-gray-200">
                  {loopbackVectors.find(v => v.id === r.vectorId)?.name || 'Unknown'}
                </span>
              </div>

              <div className="flex items-center gap-4">
                {r.error && (
                  <span className="text-[8px] text-red-400 font-mono truncate max-w-[150px]" title={r.error}>
                    {r.error}
                  </span>
                )}
                <span className={`text-[10px] font-black ${r.status === 'PASS' ? 'text-green-400' :
                  r.status === 'FAIL' ? 'text-red-400' :
                    r.status === 'RUNNING' ? 'text-cyan-400' :
                      'text-gray-600'
                  }`}>
                  {r.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {results.length > 0 && !isRunning && (
        <div className="mt-6 p-3 rounded bg-gray-950 border border-gray-900 border-l-2 border-l-cyan-500">
          <div className="text-[9px] font-bold text-gray-500 mb-1 uppercase">Summary</div>
          <div className="flex gap-4">
            <div className="text-[10px]">
              <span className="text-gray-500">TOTAL:</span> <span className="text-gray-200">{results.length}</span>
            </div>
            <div className="text-[10px]">
              <span className="text-green-500">PASS:</span> <span className="text-green-400">{results.filter(r => r.status === 'PASS').length}</span>
            </div>
            <div className="text-[10px]">
              <span className="text-red-500">FAIL:</span> <span className="text-red-400">{results.filter(r => r.status === 'FAIL').length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ECELabAppComponent: React.FC<ECELabAppProps> = ({ windowId }) => {
  const [mode, setMode] = useState<ECELabMode>('sim-only');
  const [executionSource, setExecutionSource] = useState<ExecutionSource>('sim');
  const [rightTab, setRightTab] = useState<RightPanelTab>('board');
  const [selectedBoard, setSelectedBoard] = useState<string>('basys3');
  const [showStartGuide, setShowStartGuide] = useState(true);

  // Hardware state
  const ioSnapshot = useHardwareStore((s) => s.ioSnapshot);
  const capabilities = useHardwareStore((s) => s.capabilities);

  // ... rest of the component

  // Sim state (split selectors to prevent infinite re-render)
  const simTick = useSimStore((s) => s.tick);
  const simInputs = useSimStore((s) => s.inputs);
  const simOutputs = useSimStore((s) => s.outputs);

  const simSnapshot = useMemo(() => ({
    timestamp: new Date().toISOString(),
    tick: simTick,
    inputs: simInputs,
    outputs: simOutputs
  }), [simTick, simInputs, simOutputs]);

  const simCapabilities = useSimStore((s) => s.capabilities);

  // Sim actions
  const activeExperimentId = useSimStore((s) => s.activeExperimentId);
  const setSimExperiment = useSimStore((s) => s.setExperiment);
  const simAutoRun = useSimStore((s) => s.autoRun);
  const setSimAutoRun = useSimStore((s) => s.setAutoRun);
  const simRunTick = useSimStore((s) => s.runTick);
  const simReset = useSimStore((s) => s.reset);
  const setSimBoard = useSimStore((s) => s.setBoard);

  // Auto-run effect
  useEffect(() => {
    if (!simAutoRun) return;
    const interval = setInterval(simRunTick, 100);
    return () => clearInterval(interval);
  }, [simAutoRun, simRunTick]);

  // Update sim board when selection changes
  useEffect(() => {
    setSimBoard?.(selectedBoard);
  }, [selectedBoard, setSimBoard]);

  // Comparison state
  const [checks, setChecks] = useState<CompareSignalCheck[]>([]);

  // Trace / Replay
  const isRecording = useHardwareStore((s) => s.isRecording);
  const traceBuffer = useHardwareStore((s) => s.traceBuffer);
  const recordingStartTick = useHardwareStore((s) => s.recordingStartTick);
  const startRecording = useHardwareStore((s) => s.startRecording);
  const stopRecording = useHardwareStore((s) => s.stopRecording);

  const [replayTrace, setReplayTrace] = useState<HardwareTraceV1 | null>(null);
  const [replayIndex, setReplayIndex] = useState<number>(0);

  // Replay loader with validation + user feedback (NO auto-switch)
  useEffect(() => {
    const handleReplayLoad = (e: Event) => {
      const trace = (e as CustomEvent).detail;
      if (!trace) {
        alert('No trace data in evidence capsule.');
        return;
      }
      const validation = validateTrace(trace);
      if (!validation.ok) {
        console.error('Invalid replay trace:', validation.errors);
        alert(`Invalid trace: ${validation.errors.slice(0, 2).join(', ')}`);
        return;
      }
      setReplayTrace(trace);
      setReplayIndex(0);
      // Do NOT auto-switch to replay; user must explicitly click REPLAY source
    };
    window.addEventListener('rb:load-replay', handleReplayLoad);
    return () => window.removeEventListener('rb:load-replay', handleReplayLoad);
  }, []);

  // Effective snapshot (Arbiter)
  const effectiveSnapshot =
    executionSource === 'replay' && replayTrace ? replayTrace.samples[replayIndex] ?? null :
      executionSource === 'hardware' ? ioSnapshot :
        simSnapshot; // 'sim' fallback

  // Capabilities come from source if possible, else current board selection
  const effectiveCapabilities = executionSource === 'sim' ? simCapabilities : capabilities;

  // Current experiment
  const currentExperiment = EXPERIMENTS[activeExperimentId];

  // Recording handlers
  const handleToggleRecording = () => {
    if (isRecording) {
      const trace = stopRecording();
      if (trace && trace.samples.length > 0) {
        const name = window.prompt('Save capsule as:', `capsule-${Date.now()}.json`);
        if (name) {
          const capsule = createCapsule({
            labId: mode === 'guided-lab' ? 'lab-1' : 'free-play', // specific lab ID if available
            executionSource: executionSource,
            mode: mode,
            deviceBoardId: effectiveCapabilities?.boardId || 'unknown',
            trace: trace
          });
          saveCapsuleToFS(capsule, name).then(ok => {
            if (!ok) console.error('Save failed');
          });
        }
      }
    } else {
      setReplayTrace(null);
      startRecording();
    }
  };

  const handleLoadTrace = async () => {
    const name = window.prompt('Load trace/capsule filename:', 'trace.json');
    if (!name) return;

    // Try loading as capsule first
    const capsule = await loadCapsuleFromFS(name);
    if (capsule && capsule.trace) {
      if (import.meta.env.DEV) console.log('Loaded capsule:', capsule);
      setReplayTrace(capsule.trace);
      setReplayIndex(0);
      // Do NOT auto-switch; user clicks REPLAY source button to activate
      return;
    }

    // Fallback: legacy trace
    const trace = await loadTraceFromFS(name);
    if (trace) {
      setReplayTrace(trace);
      setReplayIndex(0);
      // Do NOT auto-switch; user clicks REPLAY source button to activate
    }
  };

  // Comparison logic
  useEffect(() => {
    if (rightTab !== 'compare') return;

    const boardId = effectiveCapabilities?.boardId || 'unknown';
    const map = getSignalMap(boardId);
    const sim = getSimSnapshot();
    const newChecks: CompareSignalCheck[] = [];

    for (const [signalName, hwLoc] of Object.entries(map)) {
      let expected: number | string = '-';
      if (sim) {
        let groupVal: number | string | undefined;
        if (hwLoc.group === 'SW' || hwLoc.group === 'BTN') {
          groupVal = sim.inputs[hwLoc.group];
        } else {
          groupVal = sim.outputs[hwLoc.group];
        }
        if (groupVal !== undefined) {
          const intVal = typeof groupVal === 'number' ? groupVal : parseInt(groupVal as string || '0', 2);
          expected = (intVal >> hwLoc.bit) & 1;
        }
      }

      let observed: number | string = '-';
      if (effectiveSnapshot) {
        if (hwLoc.group === 'SW') {
          const swVal = effectiveSnapshot.inputs.SW;
          const swInt = typeof swVal === 'number' ? swVal : parseInt(swVal as string || '0', 2);
          observed = (swInt >> hwLoc.bit) & 1;
        } else if (hwLoc.group === 'BTN') {
          const btnVal = effectiveSnapshot.inputs.BTN ?? 0;
          const btnInt = typeof btnVal === 'number' ? btnVal : parseInt(btnVal as string || '0', 2);
          observed = (btnInt >> hwLoc.bit) & 1;
        } else if (hwLoc.group === 'LED') {
          const ledVal = effectiveSnapshot.outputs.LED;
          const ledInt = typeof ledVal === 'number' ? ledVal : parseInt(ledVal as string || '0', 2);
          observed = (ledInt >> hwLoc.bit) & 1;
        }
      }

      const pass = expected !== undefined && observed !== '-' && String(expected) === String(observed);
      newChecks.push({ signalName, expected: expected ?? '-', observed, pass });
    }

    setChecks(newChecks);
  }, [rightTab, effectiveSnapshot, effectiveCapabilities, replayTrace]);

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: 'linear-gradient(180deg, #08101a 0%, #040810 100%)',
        fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
      }}
    >
      {/* === HEADER BAR === */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          background: 'linear-gradient(180deg, #101820 0%, #0a1018 100%)',
          borderBottom: '1px solid #1a2a3a',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        {/* Left: Logo & Mode Switcher */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #1a3a2a 0%, #0a2a1a 100%)',
                border: '1px solid #2a4a3a',
                boxShadow: '0 0 10px rgba(0, 255, 136, 0.2)',
              }}
            >
              <span className="text-lg" style={{ filter: 'drop-shadow(0 0 4px rgba(0,255,136,0.5))' }}>⚡</span>
            </div>
            <div>
              <div className="text-xs font-black tracking-widest text-gray-300">ECE LAB</div>
              <div className="text-[8px] tracking-wider text-gray-600">FPGA DEVELOPMENT</div>
            </div>
          </div>

          {/* Execution Source Switcher (The Arbiter) */}
          <div className="flex rounded-lg overflow-hidden border border-[#1a2a3a] bg-[#0a1018]">
            {(['sim', 'hardware', 'replay'] as ExecutionSource[]).map((src) => {
              const isActive = executionSource === src;
              const color = src === 'sim' ? '#00ff88' : src === 'hardware' ? '#00d4ff' : '#ffaa00';
              const isReplayUnavailable = src === 'replay' && !replayTrace;
              const hasReplayReady = src === 'replay' && replayTrace && executionSource !== 'replay';
              return (
                <button
                  key={src}
                  onClick={() => {
                    if (isReplayUnavailable) return; // No-op if no capsule
                    setExecutionSource(src);
                  }}
                  title={isReplayUnavailable ? 'No capsule loaded — use LOAD to import' : undefined}
                  className="px-3 py-1 text-[10px] font-bold tracking-wider transition-all relative"
                  style={{
                    background: isActive ? `${color}15` : 'transparent',
                    color: isReplayUnavailable ? '#2a3a4a' : isActive ? color : '#4a5a6a',
                    borderRight: '1px solid #1a2a3a',
                    textShadow: isActive ? `0 0 10px ${color}66` : 'none',
                    cursor: isReplayUnavailable ? 'not-allowed' : 'pointer',
                  }}
                >
                  {src.toUpperCase()}
                  {hasReplayReady && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* View Mode Switcher */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{
              background: '#0a1018',
              border: '1px solid #1a2a3a',
            }}
          >
            {(['sim-only', 'board-connected', 'guided-lab', 'inspector'] as ECELabMode[]).map((m) => {
              const labels = {
                'sim-only': { text: 'SIMULATE', color: '#00ff88' },
                'board-connected': { text: 'HARDWARE', color: '#00d4ff' },
                'guided-lab': { text: 'LAB', color: '#aa88ff' },
                'inspector': { text: 'INSPECT', color: '#ffaa00' },
              };
              const { text, color } = labels[m];
              const isActive = mode === m;

              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="px-3 py-1.5 text-[10px] font-bold tracking-wider transition-all"
                  style={{
                    background: isActive ? `${color}15` : 'transparent',
                    color: isActive ? color : '#4a5a6a',
                    borderRight: '1px solid #1a2a3a',
                    textShadow: isActive ? `0 0 10px ${color}66` : 'none',
                  }}
                >
                  {text}
                </button>
              );
            })}
          </div>

          {/* Board Selector (sim only) */}
          {executionSource === 'sim' && mode === 'sim-only' && (
            <BoardSelector value={selectedBoard} onChange={setSelectedBoard} />
          )}
        </div>

        {/* Right: Recording & Status */}
        <div className="flex items-center gap-4">
          {/* Trace Controls */}
          <div
            className="flex items-center gap-2 px-2 py-1 rounded"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid #1a2a3a',
            }}
          >
            {/* Replay loaded but not active — show prompt */}
            {replayTrace && executionSource !== 'replay' && (
              <button
                type="button"
                onClick={() => setExecutionSource('replay')}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider animate-pulse"
                style={{
                  background: 'rgba(255, 170, 0, 0.15)',
                  color: '#ffaa00',
                  border: '1px solid rgba(255, 170, 0, 0.3)',
                }}
              >
                ▶ SWITCH TO REPLAY
              </button>
            )}
            {!replayTrace ? (
              <>
                <button
                  type="button"
                  onClick={handleToggleRecording}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider transition-all"
                  style={{
                    background: isRecording ? '#3a1a1a' : 'transparent',
                    color: isRecording ? '#ff4444' : '#4a5a6a',
                    border: isRecording ? '1px solid #4a2a2a' : '1px solid transparent',
                  }}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${isRecording ? 'animate-pulse' : ''}`}
                    style={{ background: isRecording ? '#ff4444' : '#3a3a3a' }}
                  />
                  {isRecording ? 'STOP' : 'REC'}
                </button>
                {isRecording && (
                  <span className="text-[9px] font-mono text-gray-600">
                    {traceBuffer.length} samples
                  </span>
                )}
                {!isRecording && (
                  <button
                    type="button"
                    onClick={handleLoadTrace}
                    className="text-[10px] font-bold text-gray-600 hover:text-gray-400 tracking-wider"
                  >
                    LOAD
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-indigo-400">REPLAY</span>
                <input
                  type="range"
                  title="Scrub replay"
                  min={0}
                  max={Math.max(0, replayTrace.samples.length - 1)}
                  value={replayIndex}
                  onChange={(e) => setReplayIndex(Number(e.target.value))}
                  className="w-20 h-1 appearance-none cursor-pointer"
                  style={{ background: '#2a3a4a' }}
                />
                <span className="text-[9px] font-mono text-gray-600">
                  {replayIndex}/{replayTrace.samples.length}
                </span>
                <button
                  type="button"
                  onClick={() => setReplayTrace(null)}
                  className="text-gray-600 hover:text-white text-xs"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div
            className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider"
            style={{
              background: mode === 'sim-only' ? 'rgba(0,255,136,0.1)' : 'rgba(0,212,255,0.1)',
              color: mode === 'sim-only' ? '#00ff88' : '#00d4ff',
              border: `1px solid ${mode === 'sim-only' ? '#00ff8833' : '#00d4ff33'}`,
            }}
          >
            {executionSource === 'sim' ? 'SIMULATION' : executionSource === 'hardware' ? 'LIVE HARDWARE' : 'REPLAY'}
          </div>
        </div>
      </div>

      {/* === START HERE GUIDE === */}
      {showStartGuide && (
        <div className="bg-[#0a1520] border-b border-[#1a2a3a] px-4 py-2 flex items-center justify-between animate-fade-in relative z-10">
          <div className="flex items-center gap-6 text-[10px] font-medium text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-900/30 text-cyan-400 flex items-center justify-center font-bold text-xs ring-1 ring-cyan-500/20">1</span>
              <span>Select Source (Sim / Hardware)</span>
            </div>
            <div className="w-px h-4 bg-[#1a2a3a]" />
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-900/30 text-cyan-400 flex items-center justify-center font-bold text-xs ring-1 ring-cyan-500/20">2</span>
              <span>Choose Experiment or Lab</span>
            </div>
            <div className="w-px h-4 bg-[#1a2a3a]" />
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-900/30 text-cyan-400 flex items-center justify-center font-bold text-xs ring-1 ring-cyan-500/20">3</span>
              <span>Interact & Capture Evidence</span>
            </div>
          </div>
          <button
            onClick={() => setShowStartGuide(false)}
            className="text-gray-600 hover:text-gray-300 text-xs px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* === MAIN CONTENT === */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: Circuit Canvas / Lab Instructions / Inspector */}
        <div
          className="flex-1 flex flex-col relative"
          style={{
            borderRight: '1px solid #1a2a3a',
          }}
        >
          {mode === 'guided-lab' ? (
            <LabInstructions />
          ) : mode === 'inspector' ? (
            <InspectorPanel />
          ) : (
            <>
              {/* Experiment Controls Bar - Only active if Sim source */}
              <div
                className={`flex items-center justify-between px-4 py-2 transition-opacity ${executionSource !== 'sim' ? 'opacity-50 pointer-events-none grayscale' : ''
                  }`}
                style={{
                  background: 'linear-gradient(180deg, #0a1520 0%, #080f18 100%)',
                  borderBottom: '1px solid #1a2a3a',
                }}
              >
                <div className="flex items-center gap-4">
                  <span className="text-[9px] font-bold tracking-wider text-gray-600">EXPERIMENT</span>
                  <select
                    value={activeExperimentId}
                    onChange={(e) => setSimExperiment(e.target.value)}
                    aria-label="Select experiment"
                    className="bg-transparent text-xs font-medium text-gray-300 border-none outline-none cursor-pointer"
                  >
                    {Object.values(EXPERIMENTS).map((exp) => (
                      <option key={exp.id} value={exp.id} className="bg-gray-900">
                        {exp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  {/* Sim Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={simRunTick}
                      disabled={simAutoRun}
                      className="px-2 py-1 text-[10px] font-bold tracking-wider rounded transition-all disabled:opacity-30"
                      style={{
                        background: '#1a2a3a',
                        color: '#8899aa',
                        border: '1px solid #2a3a4a',
                      }}
                    >
                      STEP
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimAutoRun(!simAutoRun)}
                      className="px-2 py-1 text-[10px] font-bold tracking-wider rounded transition-all"
                      style={{
                        background: simAutoRun ? 'rgba(0,255,136,0.15)' : '#1a2a3a',
                        color: simAutoRun ? '#00ff88' : '#8899aa',
                        border: simAutoRun ? '1px solid #00ff8833' : '1px solid #2a3a4a',
                      }}
                    >
                      {simAutoRun ? 'RUNNING' : 'RUN'}
                    </button>
                    <button
                      type="button"
                      onClick={simReset}
                      className="px-2 py-1 text-[10px] font-bold tracking-wider rounded transition-all"
                      style={{
                        background: '#1a2a3a',
                        color: '#8899aa',
                        border: '1px solid #2a3a4a',
                      }}
                    >
                      RESET
                    </button>
                  </div>

                  {/* Tick Counter */}
                  <div
                    className="px-2 py-0.5 rounded font-mono text-[10px]"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      color: '#00d4ff',
                      border: '1px solid #1a3a4a',
                    }}
                  >
                    T:{simSnapshot.tick}
                  </div>
                </div>
              </div>

              {/* Circuit Visualization Canvas */}
              <div className="flex-1 relative overflow-hidden">
                {currentExperiment && (
                  <CircuitCanvas
                    experiment={currentExperiment}
                    inputs={{
                      SW: typeof simInputs.SW === 'number' ? simInputs.SW : parseInt(String(simInputs.SW || '0'), 2),
                      BTN: typeof simInputs.BTN === 'number' ? simInputs.BTN : parseInt(String(simInputs.BTN || '0'), 2),
                    }}
                    outputs={{
                      LED: typeof simOutputs.LED === 'number' ? simOutputs.LED : parseInt(String(simOutputs.LED || '0'), 2),
                      SEG: typeof simOutputs.SEG === 'number' ? simOutputs.SEG : parseInt(String(simOutputs.SEG || '0'), 2),
                      AN: typeof simOutputs.AN === 'number' ? simOutputs.AN : parseInt(String(simOutputs.AN || '0'), 2),
                      DP: typeof simOutputs.DP === 'number' ? simOutputs.DP : parseInt(String(simOutputs.DP || '0'), 2),
                    }}
                    tick={simSnapshot.tick}
                  />
                )}

                {/* Experiment description overlay */}
                <div
                  className="absolute bottom-4 left-4 right-4 px-4 py-2 rounded"
                  style={{
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid #1a2a3a',
                  }}
                >
                  <div className="text-[10px] font-bold tracking-wider text-gray-500 mb-1">
                    {currentExperiment?.name.toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-400">
                    {currentExperiment?.description}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANE: Board Visualization */}
        <div
          className="w-[480px] flex flex-col"
          style={{
            background: 'linear-gradient(180deg, #060a10 0%, #040608 100%)',
          }}
        >
          {/* Tab Switcher */}
          <div
            className="flex"
            style={{
              background: '#0a1018',
              borderBottom: '1px solid #1a2a3a',
            }}
          >
            {(['board', 'compare', 'test'] as RightPanelTab[]).map((tab) => {
              const isActive = rightTab === tab;
              const labels = { board: 'HARDWARE', compare: 'COMPARE', test: 'TEST' };
              const color = tab === 'board' ? '#00d4ff' : tab === 'compare' ? '#aa88ff' : '#00ff88';

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRightTab(tab)}
                  className="flex-1 py-2 text-[10px] font-bold tracking-wider transition-all"
                  style={{
                    background: isActive ? `${color}10` : 'transparent',
                    color: isActive ? color : '#4a5a6a',
                    borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
                    textShadow: isActive ? `0 0 10px ${color}66` : 'none',
                  }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === 'board' ? (
              <BoardPanel
                snapshot={effectiveSnapshot}
                capabilities={effectiveCapabilities}
                onInteraction={executionSource === 'sim' ? setSimInput : undefined}
                readOnly={executionSource === 'replay'}
                executionSource={executionSource}
              />
            ) : rightTab === 'compare' ? (
              <CompareView ioSnapshot={effectiveSnapshot} checks={checks} />
            ) : (
              <VectorRunnerView mode={executionSource === 'sim' ? 'sim' : 'hardware'} />
            )}
          </div>
        </div>
      </div>

      {/* === FOOTER STATUS BAR === */}
      <div
        className="flex items-center justify-between px-4 py-1 text-[9px] font-mono"
        style={{
          background: '#040608',
          borderTop: '1px solid #1a2a3a',
        }}
      >
        <div className="flex items-center gap-4 text-gray-600">
          <span>ECE 347 Lab Environment</span>
          <span>|</span>
          <span>{effectiveCapabilities?.boardName || 'No Board'}</span>
        </div>
        <div className="flex items-center gap-4 text-gray-600">
          <span>{new Date().toLocaleTimeString()}</span>
          <span className="text-cyan-600">v2.0.0</span>
        </div>
      </div>
    </div>
  );
};
