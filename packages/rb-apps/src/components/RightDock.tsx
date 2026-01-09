// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useState } from 'react';
import { shallow } from 'zustand/shallow';
import type { Circuit, CircuitEngine } from '@redbyte/rb-logic-core';
import type { ProofPack } from '../recording/runRecord';
import { useLogicViewStore } from '@redbyte/rb-logic-view';
import { PropertyInspector } from './PropertyInspector';
import { CircuitHealthPanel } from './CircuitHealthPanel';
import { LearnModePanel } from './LearnModePanel';
import { RunRecorderPanel } from './RunRecorderPanel';
import type { GuidedExample } from '../logic/learnMode';
import { useProbeStore } from '../stores/probeStore';
import { trackRender, useUiTickStore } from '@redbyte/rb-utils';

/**
 * Logic Playground vNext Right Dock
 *
 * Tabbed panel with:
 * - Inspector (selected node details, pin values, state)
 * - Probes/Scope (quick probe list + open scope)
 * - Chips (saved chips browse/insert)
 *
 * States: Collapsed / Peek / Expanded
 * Never overlaps the main stage
 */

export type RightDockTab = 'inspector' | 'health' | 'learn' | 'probes' | 'record' | 'chips';
export type RightDockState = 'collapsed' | 'peek' | 'expanded';

interface RightDockProps {
  circuit: Circuit;
  engine: CircuitEngine;
  isRunning: boolean;
  isReplayMode?: boolean;
  onNodeUpdate?: (nodeId: string, updates: any) => void;
  onConnectionDelete?: (connectionId: string) => void;
  onRun?: () => void;
  onPause?: () => void;
  onStep?: () => void;
  onResetTickCount?: () => void;
  lastTickAt?: number | null;
  highlightProbePaths?: boolean;
  onToggleHighlightProbePaths?: (enabled: boolean) => void;

  // Health tab
  onFocusNode?: (nodeId: string, portName?: string) => void;
  onIssueHover?: (nodeId: string | null, portName?: string | null) => void;

  // Record tab
  tickCount?: number;
  tickRate?: number;
  onRecordArm?: () => void;
  onRecordStart?: () => void;
  onRecordStop?: () => void;
  onRecordReplayStart?: () => void;
  onRecordReplayStop?: () => void;
  onRecordReplayPause?: () => void;
  onRecordReplayResume?: () => void;
  onRecordReplayStep?: (ticks: number) => void;
  onRecordReplayJump?: (tick: number) => void;
  onRecordVerify?: () => void;
  onRecordExport?: () => void;
  onRecordExportProof?: () => void;
  onRecordProof?: () => void;
  onRecordFocus?: (nodeId: string, portName: string) => void;
  onRecordMismatchSelect?: (probeId: string) => void;
  onRecordImportProofPack?: (pack: ProofPack) => void;

  // Learn tab
  onLoadExample?: (example: GuidedExample) => void;
  onExitLearnMode?: () => void;

  // Chips tab
  chips?: Array<{ id: string; name: string; description?: string }>;
  onChipInsert?: (chipId: string) => void;
  onChipDelete?: (chipId: string) => void;
  onChipEdit?: (chipId: string) => void;

  // State control
  initialTab?: RightDockTab;
  initialState?: RightDockState;
  onStateChange?: (state: RightDockState) => void;
  onTabChange?: (tab: RightDockTab) => void;
}

export const RightDock: React.FC<RightDockProps> = ({
  circuit,
  engine,
  isRunning,
  isReplayMode = false,
  onNodeUpdate,
  onConnectionDelete,
  onRun,
  onPause,
  onStep,
  onResetTickCount,
  lastTickAt = null,
  highlightProbePaths = true,
  onToggleHighlightProbePaths,
  onFocusNode,
  onIssueHover,
  tickCount = 0,
  tickRate = 0,
  onRecordArm,
  onRecordStart,
  onRecordStop,
  onRecordReplayStart,
  onRecordReplayStop,
  onRecordReplayPause,
  onRecordReplayResume,
  onRecordReplayStep,
  onRecordReplayJump,
  onRecordVerify,
  onRecordExport,
  onRecordExportProof,
  onRecordProof,
  onRecordFocus,
  onRecordMismatchSelect,
  onRecordImportProofPack,
  onLoadExample,
  onExitLearnMode,
  chips = [],
  onChipInsert,
  onChipDelete,
  onChipEdit,
  initialTab = 'inspector',
  initialState = 'expanded',
  onStateChange,
  onTabChange,
}) => {
  trackRender('RightDock');
  const [activeTab, setActiveTab] = useState<RightDockTab>(initialTab);
  const [dockState, setDockState] = useState<RightDockState>(initialState);
  const selection = useLogicViewStore((state) => state.selection);
  const {
    probes,
    activeProbeId,
    addProbe,
    removeProbe,
    renameProbe,
    toggleProbe,
    setActiveProbe,
    reorderProbes,
  } = useProbeStore(
    (state) => ({
      probes: state.probes,
      activeProbeId: state.activeProbeId,
      addProbe: state.addProbe,
      removeProbe: state.removeProbe,
      renameProbe: state.renameProbe,
      toggleProbe: state.toggleProbe,
      setActiveProbe: state.setActiveProbe,
      reorderProbes: state.reorderProbes,
    }),
    shallow
  );
  const uiTick = useUiTickStore((state) => state.uiTick);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [selectedPortName, setSelectedPortName] = useState<string>('out');
  const [probeValues, setProbeValues] = useState<Record<string, number>>({});
  const [draggedProbeIndex, setDraggedProbeIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const selectableNodes = useMemo(
    () => circuit.nodes.map((node) => ({ id: node.id, type: node.type })),
    [circuit.nodes]
  );
  const clockNode = useMemo(
    () => circuit.nodes.find((node) => node.type === 'Clock') ?? null,
    [circuit.nodes]
  );

  const portOptions = useMemo(() => {
    if (!selectedNodeId) return [];
    const outputs = engine.getNodeOutputs(selectedNodeId);
    const ports = Object.keys(outputs);
    if (ports.length > 0) return ports;
    return ['out'];
  }, [engine, selectedNodeId]);

  useEffect(() => {
    if (portOptions.length === 0) return;
    if (!portOptions.includes(selectedPortName)) {
      setSelectedPortName(portOptions[0]);
    }
  }, [portOptions, selectedPortName]);

  useEffect(() => {
    const firstSelected = Array.from(selection.nodes)[0];
    if (!firstSelected) return;
    setSelectedNodeId(firstSelected);
  }, [selection.nodes]);

  useEffect(() => {
    if (probes.length === 0) {
      setProbeValues({});
      return;
    }
    if (isRunning) return;
    const nextValues: Record<string, number> = {};
    probes.forEach((probe) => {
      const outputs = engine.getNodeOutputs(probe.nodeId);
      const value = outputs[probe.portName] ?? 0;
      nextValues[probe.id] = value;
    });
    setProbeValues(nextValues);
  }, [engine, probes, isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    if (probes.length === 0) {
      setProbeValues({});
      return;
    }
    const nextValues: Record<string, number> = {};
    probes.forEach((probe) => {
      const outputs = engine.getNodeOutputs(probe.nodeId);
      const value = outputs[probe.portName] ?? 0;
      nextValues[probe.id] = value;
    });
    setProbeValues(nextValues);
  }, [engine, probes, isRunning, uiTick]);

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    setDockState(initialState);
  }, [initialState]);

  const handleStateToggle = () => {
    const nextState: RightDockState =
      dockState === 'collapsed' ? 'peek' : dockState === 'peek' ? 'expanded' : 'collapsed';
    setDockState(nextState);
    onStateChange?.(nextState);
  };

  const handleTabChange = (tab: RightDockTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const handleAddProbe = () => {
    if (!selectedNodeId || !selectedPortName) return;
    const node = circuit.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    addProbe({
      nodeId: selectedNodeId,
      portName: selectedPortName,
      label: `${node.type} ${selectedPortName}`,
    });
  };

  const handleProbeSelect = (probeId: string) => {
    const probe = probes.find((item) => item.id === probeId);
    if (!probe) return;
    setActiveProbe(probeId);
  };

  const handleAddClockProbe = () => {
    if (!clockNode) return;
    addProbe({
      nodeId: clockNode.id,
      portName: 'out',
      label: 'Clock out',
    });
  };

  if (dockState === 'collapsed') {
    return (
      <div className="w-14 border-l border-gray-700 bg-gray-900 flex flex-col items-center py-4 gap-4">
        {/* Collapsed tabs - vertical icons */}
        <button
          onClick={() => {
            handleTabChange('inspector');
            setDockState('peek');
          }}
          className="w-10 h-10 rounded hover:bg-gray-800 transition-colors flex items-center justify-center"
          title="Inspector"
          type="button"
        >
          <span className="text-xl">🔍</span>
        </button>
        <button
          onClick={() => {
            handleTabChange('health');
            setDockState('peek');
          }}
          className="w-10 h-10 rounded hover:bg-gray-800 transition-colors flex items-center justify-center"
          title="Health"
          type="button"
        >
          <span className="text-xl">💊</span>
        </button>
        <button
          onClick={() => {
            handleTabChange('learn');
            setDockState('peek');
          }}
          className="w-10 h-10 rounded hover:bg-gray-800 transition-colors flex items-center justify-center"
          title="Learn"
          type="button"
        >
          <span className="text-xl">🎓</span>
        </button>
        <button
          onClick={() => {
            handleTabChange('probes');
            setDockState('peek');
          }}
          className="w-10 h-10 rounded hover:bg-gray-800 transition-colors flex items-center justify-center"
          title="Probes"
          type="button"
        >
          <span className="text-xl">📊</span>
        </button>
        <button
          onClick={() => {
            handleTabChange('record');
            setDockState('peek');
          }}
          className="w-10 h-10 rounded hover:bg-gray-800 transition-colors flex items-center justify-center"
          title="Record"
          type="button"
        >
          <span className="text-xl">dY"7</span>
        </button>
        <button
          onClick={() => {
            handleTabChange('chips');
            setDockState('peek');
          }}
          className="w-10 h-10 rounded hover:bg-gray-800 transition-colors flex items-center justify-center"
          title="Chips"
          type="button"
        >
          <span className="text-xl">🧩</span>
        </button>
      </div>
    );
  }

  const width = dockState === 'peek' ? 'w-80' : 'w-96';

  return (
    <div className={`${width} border-l border-gray-700 bg-gray-900 flex flex-col transition-all duration-200`}>
      {/* Tab Bar */}
      <div className="h-12 border-b border-gray-700 bg-gray-850 flex items-stretch px-2 gap-1">
        <button
          onClick={() => handleTabChange('inspector')}
          className={`flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'inspector'
              ? 'bg-cyan-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          aria-label="Inspector"
          data-testid="rightdock-tab-inspector"
          type="button"
        >
          <span className="mr-1 pointer-events-none select-none">🔍</span>
          <span className="pointer-events-none select-none">Info</span>
        </button>
        <button
          onClick={() => handleTabChange('health')}
          className={`flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'health'
              ? 'bg-cyan-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          aria-label="Health"
          data-testid="rightdock-tab-health"
          type="button"
        >
          <span className="mr-1 pointer-events-none select-none">💊</span>
          <span className="pointer-events-none select-none">Health</span>
        </button>
        <button
          onClick={() => handleTabChange('learn')}
          className={`flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'learn'
              ? 'bg-cyan-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          aria-label="Learn"
          data-testid="rightdock-tab-learn"
          type="button"
        >
          <span className="mr-1 pointer-events-none select-none">🎓</span>
          <span className="pointer-events-none select-none">Learn</span>
        </button>
        <button
          onClick={() => handleTabChange('probes')}
          className={`flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'probes'
              ? 'bg-cyan-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          aria-label="Probes"
          data-testid="rightdock-tab-probes"
          type="button"
        >
          <span className="mr-1 pointer-events-none select-none">📊</span>
          <span className="pointer-events-none select-none">Probes</span>
        </button>
        <button
          onClick={() => handleTabChange('record')}
          className={`flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'record'
              ? 'bg-cyan-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          aria-label="Record"
          data-testid="rightdock-tab-record"
          type="button"
        >
          <span className="mr-1 pointer-events-none select-none">dY"7</span>
          <span className="pointer-events-none select-none">Record</span>
        </button>
        <button
          onClick={() => handleTabChange('chips')}
          className={`flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'chips'
              ? 'bg-cyan-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          aria-label="Chips"
          data-testid="rightdock-tab-chips"
          type="button"
        >
          <span className="mr-1 pointer-events-none select-none">🧩</span>
          <span className="pointer-events-none select-none">Chips</span>
        </button>

        {/* Dock state toggle */}
        <button
          onClick={handleStateToggle}
          className="h-full px-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title={dockState === 'peek' ? 'Expand' : 'Collapse'}
          type="button"
        >
          {dockState === 'peek' ? '→' : '←'}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'inspector' && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700/60 bg-gray-900/80">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    Clock
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs font-mono">
                    <span className="text-cyan-300">t{tickCount}</span>
                    <span
                      className={`text-[10px] ${
                        isRunning ? 'text-green-400' : tickCount === 0 ? 'text-gray-400' : 'text-yellow-300'
                      }`}
                    >
                      {isRunning ? 'Running' : tickCount === 0 ? 'Stopped' : 'Paused'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {isRunning ? `${tickRate}Hz` : 'Manual'}
                    </span>
                  </div>
                  {lastTickAt && (
                    <div className="mt-1 text-[10px] text-gray-500">
                      Last step {new Date(lastTickAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {onStep && (
                    <button
                      onClick={onStep}
                      className="px-2 py-1 text-[10px] rounded border border-blue-500/50 text-blue-200 hover:bg-blue-500/20"
                      type="button"
                      title="Advance one tick"
                    >
                      Step
                    </button>
                  )}
                  {onRun && onPause && (
                    <button
                      onClick={isRunning ? onPause : onRun}
                      className={`px-2 py-1 text-[10px] rounded border ${
                        isRunning
                          ? 'border-yellow-500/50 text-yellow-200 hover:bg-yellow-500/20'
                          : 'border-green-500/50 text-green-200 hover:bg-green-500/20'
                      }`}
                      type="button"
                    >
                      {isRunning ? 'Pause' : 'Run'}
                    </button>
                  )}
                  {onResetTickCount && (
                    <button
                      onClick={onResetTickCount}
                      className="px-2 py-1 text-[10px] rounded border border-gray-600 text-gray-300 hover:bg-gray-700/60"
                      type="button"
                      title="Reset tick counter"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <PropertyInspector
                circuit={circuit}
                engine={engine}
                isRunning={isRunning}
                isReplayMode={isReplayMode}
                onNodeUpdate={onNodeUpdate}
                onConnectionDelete={onConnectionDelete}
              />
            </div>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="h-full overflow-y-auto">
            <CircuitHealthPanel
              circuit={circuit}
              onFocusNode={onFocusNode}
              onIssueHover={onIssueHover}
            />
          </div>
        )}

        {activeTab === 'learn' && (
          <div className="h-full overflow-hidden">
            <LearnModePanel
              circuit={circuit}
              onLoadExample={onLoadExample}
              onExitLearnMode={onExitLearnMode}
            />
          </div>
        )}

        {activeTab === 'probes' && (
          <div className="h-full p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">Signal Probes</h3>
              <span className="text-[10px] text-gray-500">Live values</span>
            </div>
            <label className="flex items-center justify-between text-[10px] text-gray-400 bg-gray-800/40 border border-gray-700/60 rounded px-2 py-1">
              <span>Highlight probed paths</span>
              <input
                type="checkbox"
                checked={highlightProbePaths}
                onChange={(e) => onToggleHighlightProbePaths?.(e.target.checked)}
                className="w-3 h-3"
              />
            </label>

            <div className="space-y-2">
              <select
                value={selectedNodeId}
                onChange={(e) => setSelectedNodeId(e.target.value)}
                className="w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs"
                aria-label="Select node to probe"
              >
                <option value="">Select node...</option>
                {selectableNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.type} ({node.id.slice(0, 8)})
                  </option>
                ))}
              </select>

              <select
                value={selectedPortName}
                onChange={(e) => setSelectedPortName(e.target.value)}
                className="w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs"
                aria-label="Select port to probe"
              >
                {portOptions.map((port) => (
                  <option key={port} value={port}>
                    {port}
                  </option>
                ))}
              </select>

              <button
                onClick={handleAddProbe}
                disabled={!selectedNodeId}
                className="w-full px-2 py-1 bg-cyan-700 hover:bg-cyan-600 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                Add Probe
              </button>

              <button
                onClick={handleAddClockProbe}
                disabled={!clockNode}
                className="w-full px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                Add Clock Probe
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-1">
              {probes.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-2">dY"S</div>
                  <div className="text-sm">No probes added</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Select a node and add a probe
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {probes.map((probe, index) => (
                    <div
                      key={probe.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedProbeIndex(index);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverIndex(index);
                      }}
                      onDragLeave={() => {
                        setDragOverIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedProbeIndex !== null && draggedProbeIndex !== index) {
                          reorderProbes(draggedProbeIndex, index);
                        }
                        setDraggedProbeIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedProbeIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={`rounded border p-3 transition-colors cursor-move ${
                        draggedProbeIndex === index
                          ? 'opacity-50'
                          : dragOverIndex === index
                          ? 'border-cyan-500 bg-cyan-900/30'
                          : activeProbeId === probe.id
                          ? 'border-cyan-500/60 bg-cyan-900/20'
                          : 'border-gray-700/50 bg-gray-800/50 hover:bg-gray-800/80'
                      }`}
                      onClick={() => handleProbeSelect(probe.id)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col items-center gap-0.5 pt-1 cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-400">
                          <div className="w-1 h-1 bg-current rounded-full" />
                          <div className="w-1 h-1 bg-current rounded-full" />
                          <div className="w-1 h-1 bg-current rounded-full" />
                        </div>
                        <div
                          className="mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: probe.color }}
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            value={probe.label}
                            onChange={(e) => renameProbe(probe.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-transparent text-sm font-medium text-white outline-none"
                            aria-label="Probe label"
                          />
                          <div className="text-[10px] text-gray-400 font-mono truncate">
                            {probe.nodeId} - {probe.portName}
                          </div>
                        </div>
                        <div
                          className={`px-2 py-1 text-xs rounded font-mono ${probeValues[probe.id] === 1
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-gray-700/50 text-gray-400'}`}
                        >
                          {probeValues[probe.id] ?? 0}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={probe.enabled}
                            onChange={() => toggleProbe(probe.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3 h-3"
                          />
                          Enabled
                        </label>
                        <div className="flex-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeProbe(probe.id);
                          }}
                          className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'record' && (
          <div className="h-full overflow-y-auto">
            <RunRecorderPanel
              circuit={circuit}
              isRunning={isRunning}
              currentTick={tickCount}
              tickRate={tickRate}
              onArm={onRecordArm ?? (() => {})}
              onStartRecording={onRecordStart ?? (() => {})}
              onStopRecording={onRecordStop ?? (() => {})}
              onStartReplay={onRecordReplayStart ?? (() => {})}
              onStopReplay={onRecordReplayStop ?? (() => {})}
              onPauseReplay={onRecordReplayPause ?? (() => {})}
              onResumeReplay={onRecordReplayResume ?? (() => {})}
              onStepReplay={onRecordReplayStep ?? (() => {})}
              onJumpReplay={onRecordReplayJump ?? (() => {})}
              onVerify={onRecordVerify ?? (() => {})}
              onExport={onRecordExport ?? (() => {})}
              onExportProof={onRecordExportProof ?? (() => {})}
              onRecordProof={onRecordProof ?? (() => {})}
              onFocusTarget={onRecordFocus ?? (() => {})}
              onMismatchSelect={onRecordMismatchSelect ?? (() => {})}
              onImportProofPack={onRecordImportProofPack ?? (() => {})}
            />
          </div>
        )}

        {activeTab === 'chips' && (
          <div className="h-full p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Saved Chips</h3>

            {chips.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">🧩</div>
                <div className="text-sm">No saved chips</div>
                <div className="text-xs text-gray-500 mt-2">
                  Build a circuit and save it as a chip
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {chips.map((chip) => (
                  <div
                    key={chip.id}
                    className="bg-gray-800/50 rounded p-3 hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => onChipInsert?.(chip.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-white">{chip.name}</div>
                      <div className="flex gap-1">
                        {onChipEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChipEdit(chip.id);
                            }}
                            className="px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 rounded transition-colors"
                          >
                            Edit
                          </button>
                        )}
                        {onChipDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChipDelete(chip.id);
                            }}
                            className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    {chip.description && (
                      <div className="text-xs text-gray-400">{chip.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
