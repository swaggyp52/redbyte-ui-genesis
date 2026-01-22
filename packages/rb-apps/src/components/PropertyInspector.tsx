// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import { shallow } from 'zustand/shallow';
import { REPLAY_LOCK_MESSAGE } from '../utils/replayLock';
import type { Circuit, Node, Connection, Signal } from '@redbyte/rb-logic-core';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { useLogicViewStore } from '@redbyte/rb-logic-view';
import { useProbeStore } from '../stores/probeStore';

interface PropertyInspectorProps {
  circuit: Circuit;
  engine: CircuitEngine;
  isRunning: boolean;
  isReplayMode?: boolean;
  onNodeUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onConnectionDelete?: (connectionId: string) => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  circuit,
  engine,
  isRunning,
  isReplayMode = false,
  onNodeUpdate,
  onConnectionDelete,
}) => {
  // Use shallow comparison to prevent re-renders when selection object reference changes but content is the same
  const selection = useLogicViewStore((s) => s.selection, shallow);
  const addProbe = useProbeStore((s) => s.addProbe);
  const lockMessage = REPLAY_LOCK_MESSAGE;

  // Get selected nodes and connections
  const selectedNodes = useMemo(() => {
    if (!selection?.nodes) return [];
    return circuit.nodes.filter((n) => selection.nodes.has(n.id));
  }, [circuit.nodes, selection]);

  const selectedConnections = useMemo(() => {
    if (!selection?.wires) return [];
    return circuit.connections.filter((c) => {
      const id = `${c.from.nodeId}.${c.from.portName}->${c.to.nodeId}.${c.to.portName}`;
      return selection.wires.has(id);
    });
  }, [circuit.connections, selection]);

  // Get real-time signals for selected nodes
  const [nodeSignals, setNodeSignals] = React.useState<Map<string, Record<string, Signal>>>(new Map());
  const [nodeInputs, setNodeInputs] = React.useState<
    Map<string, Record<string, { value: Signal; source?: string }>>
  >(new Map());
  const [analogUiState, setAnalogUiState] = React.useState<Record<string, number>>({});
  const analogCommitTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!isRunning || selectedNodes.length === 0) {
      setNodeSignals(new Map());
      setNodeInputs(new Map());
      return;
    }

    const interval = setInterval(() => {
      const signals = new Map<string, Record<string, Signal>>();
      const inputs = new Map<string, Record<string, { value: Signal; source?: string }>>();
      const allSignals = engine.getAllSignals();
      for (const node of selectedNodes) {
        signals.set(node.id, engine.getNodeOutputs(node.id));
        const inputValues: Record<string, { value: Signal; source?: string }> = {};
        for (const connection of circuit.connections) {
          if (connection.to.nodeId !== node.id) continue;
          const sourceKey = `${connection.from.nodeId}.${connection.from.portName}`;
          const value = allSignals.get(sourceKey) ?? 0;
          inputValues[connection.to.portName] = { value, source: sourceKey };
        }
        inputs.set(node.id, inputValues);
      }
      setNodeSignals(signals);
      setNodeInputs(inputs);
    }, 200); // Reduced from 50ms to 200ms for better performance

    return () => clearInterval(interval);
  }, [isRunning, selectedNodes, engine, circuit.connections]);

  React.useEffect(() => {
    if (selectedNodes.length === 0) {
      setAnalogUiState({});
      return;
    }
    const node = selectedNodes[0];
    if (node.type === 'LDR') {
      const light = typeof node.state?.light === 'number' ? node.state.light : 0.5;
      setAnalogUiState({ light });
      return;
    }
    if (node.type === 'VoltageSource') {
      const voltage = typeof node.state?.voltage === 'number'
        ? node.state.voltage
        : (node.config?.voltage ?? 5);
      setAnalogUiState({ voltage });
      return;
    }
    setAnalogUiState({});
  }, [selectedNodes]);

  React.useEffect(() => {
    return () => {
      if (analogCommitTimerRef.current) {
        window.clearTimeout(analogCommitTimerRef.current);
      }
    };
  }, []);

  // Handle property changes
  const handleConfigChange = (nodeId: string, configKey: string, value: any) => {
    const node = selectedNodes.find((n) => n.id === nodeId);
    if (!node || !onNodeUpdate || isReplayMode) return;

    onNodeUpdate(nodeId, {
      config: {
        ...node.config,
        [configKey]: value,
      },
    });
  };

  const handleStateChange = (nodeId: string, stateKey: string, value: any) => {
    const node = selectedNodes.find((n) => n.id === nodeId);
    if (!node || !onNodeUpdate || isReplayMode) return;

    onNodeUpdate(nodeId, {
      state: {
        ...(node.state ?? {}),
        [stateKey]: value,
      },
    });
  };

  const handleAnalogStateChange = (nodeId: string, stateKey: string, value: number) => {
    const node = selectedNodes.find((n) => n.id === nodeId);
    if (!node || isReplayMode) return;

    const nextAnalogState = { ...analogUiState, [stateKey]: value };
    setAnalogUiState(nextAnalogState);

    const engineState = engine.getNodeState(nodeId) ?? {};
    engine.setNodeState(nodeId, { ...engineState, [stateKey]: value });

    if (!onNodeUpdate) return;

    if (analogCommitTimerRef.current) {
      window.clearTimeout(analogCommitTimerRef.current);
    }
    analogCommitTimerRef.current = window.setTimeout(() => {
      onNodeUpdate(nodeId, {
        state: {
          ...(node.state ?? {}),
          ...nextAnalogState,
        },
      });
    }, 120);
  };

  const handlePositionChange = (nodeId: string, x: number, y: number) => {
    if (!onNodeUpdate || isReplayMode) return;
    onNodeUpdate(nodeId, { position: { x, y } });
  };

  // Render nothing selected state
  if (selectedNodes.length === 0 && selectedConnections.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">👆</div>
          <div className="text-sm">Select a component</div>
        </div>
        <div className="mt-auto p-3 border-t border-gray-700/50 bg-gray-800/30">
          <div className="text-xs font-semibold text-gray-400 mb-2">Circuit</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/50 rounded px-2 py-1.5">
              <div className="text-[10px] text-gray-500">Components</div>
              <div className="text-lg font-bold text-cyan-400">{circuit.nodes.length}</div>
            </div>
            <div className="bg-gray-800/50 rounded px-2 py-1.5">
              <div className="text-[10px] text-gray-500">Wires</div>
              <div className="text-lg font-bold text-purple-400">{circuit.connections.length}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render node properties
  if (selectedNodes.length > 0) {
    const node = selectedNodes[0]; // Show first selected node
    const signals = nodeSignals.get(node.id) ?? {};
    const inputSignals = nodeInputs.get(node.id) ?? {};
    const engineState = engine.getNodeState(node.id) ?? {};
    const uiState = node.state ?? {};
    const analogControls = [
      node.type === 'LDR'
        ? {
          key: 'light',
          label: 'Light Level',
          min: 0,
          max: 1,
          step: 0.01,
          value: analogUiState.light ?? uiState.light ?? 0.5,
        }
        : null,
      node.type === 'VoltageSource'
        ? {
          key: 'voltage',
          label: 'Voltage (V)',
          min: 0,
          max: 5,
          step: 0.1,
          value: analogUiState.voltage ?? uiState.voltage ?? node.config?.voltage ?? 5,
        }
        : null,
    ].filter(Boolean) as Array<{ key: string; label: string; min: number; max: number; step: number; value: number }>;

    const analogPortsByType: Record<string, { inputs: string[]; outputs: string[] }> = {
      VoltageSource: { inputs: [], outputs: ['out'] },
      LDR: { inputs: [], outputs: ['resistance', 'v_out'] },
      FixedResistor: { inputs: [], outputs: ['resistance'] },
      VoltageDivider: { inputs: ['v_in', 'r1', 'r2'], outputs: ['v_out'] },
      LM358: { inputs: ['V_plus', 'V_minus'], outputs: ['out'] },
    };
    const analogPorts = analogPortsByType[node.type];

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header with component type */}
        <div className="p-3 border-b border-gray-700/50 bg-gradient-to-br from-cyan-900/20 to-purple-900/20">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
            <div className="text-xs font-semibold text-cyan-400">SELECTED</div>
          </div>
          <div className="text-lg font-bold text-white">{node.type}</div>
          <div className="text-[10px] text-gray-400 font-mono truncate mt-1">{node.id}</div>
          {selectedNodes.length > 1 && (
            <div className="mt-2 text-xs bg-cyan-500/10 border border-cyan-500/30 rounded px-2 py-1 text-cyan-300">
              +{selectedNodes.length - 1} more
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Live Outputs (when running) - Show prominently at top */}
          {isRunning && Object.keys(signals).length > 0 && (
            <div className="bg-gradient-to-br from-green-900/20 to-cyan-900/20 rounded-lg p-3 border border-green-500/30">
              <div className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                LIVE SIGNALS
              </div>
              <div className="space-y-1.5">
                {Object.entries(signals).map(([port, signal]) => (
                  <div key={port} className="flex items-center justify-between gap-2">
                    <span className="text-white text-sm font-medium">{port}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          addProbe({
                            nodeId: node.id,
                            portName: port,
                            label: `${node.type} ${port}`,
                          })
                        }
                        className="px-2 py-1 text-[10px] bg-gray-800/70 hover:bg-gray-700 rounded text-gray-200"
                        type="button"
                        title="Add probe to monitor this signal in Oscilloscope (press 4)"
                      >
                        Add Probe
                      </button>
                      <div
                        className={`font-bold text-lg px-3 py-1 rounded-md transition-all ${signal === 1
                          ? 'bg-green-500/30 text-green-300 shadow-lg shadow-green-500/20 scale-110'
                          : 'bg-gray-700/50 text-gray-500 scale-100'
                          }`}
                      >
                        {signal}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analog inputs */}
          {analogControls.length > 0 && (
            <div className="bg-cyan-900/10 rounded-lg p-3 border border-cyan-500/20">
              <div className="text-xs font-semibold text-cyan-300 mb-2">SIM INPUTS</div>
              <div className="space-y-3">
                {analogControls.map((control) => (
                  <div key={control.key}>
                    <div className="block text-gray-400 mb-1.5 text-xs">{control.label}</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        value={control.value}
                        onChange={(e) =>
                          handleAnalogStateChange(
                            node.id,
                            control.key,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        disabled={isReplayMode}
                        title={isReplayMode ? lockMessage : undefined}
                      />
                      <input
                        type="number"
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        value={control.value}
                        onChange={(e) =>
                          handleAnalogStateChange(
                            node.id,
                            control.key,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-20 px-2 py-1 bg-gray-800 rounded border border-gray-600 text-white text-sm font-mono"
                        disabled={isReplayMode}
                        title={isReplayMode ? lockMessage : undefined}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analog readings */}
          {isRunning && analogPorts && (analogPorts.inputs.length > 0 || analogPorts.outputs.length > 0) && (
            <div className="bg-slate-900/30 rounded-lg p-3 border border-slate-600/40">
              <div className="text-xs font-semibold text-slate-300 mb-2">ANALOG READINGS</div>
              {analogPorts.inputs.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Inputs</div>
                  <div className="space-y-1.5">
                    {analogPorts.inputs.map((port) => {
                      const entry = inputSignals[port];
                      const value = entry?.value ?? 0;
                      return (
                        <div key={port} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-slate-200">{port}</span>
                          <span className="text-slate-400 text-xs flex-1 truncate text-right">
                            {entry?.source ? `<- ${entry.source}` : 'unconnected'}
                          </span>
                          <span className="text-slate-100 font-mono">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {analogPorts.outputs.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Outputs</div>
                  <div className="space-y-1.5">
                    {analogPorts.outputs.map((port) => {
                      const value = signals[port] ?? 0;
                      return (
                        <div key={port} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-slate-200">{port}</span>
                          <span className="text-slate-100 font-mono">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Configuration */}
          {node.config && Object.keys(node.config).length > 0 && (
            <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs font-semibold text-gray-300 mb-3">SETTINGS</div>
              <div className="space-y-3">
                {Object.entries(node.config).map(([key, value]) => {
                  const labelText = key.replace(/([A-Z])/g, ' $1').trim() || 'Setting';

                  return (
                    <div key={key}>
                      <div className="block text-gray-400 mb-1.5 text-xs capitalize">{labelText}</div>
                      {typeof value === 'boolean' ? (
                        <label
                          className={`flex items-center gap-3 bg-gray-800/50 rounded px-3 py-2 transition-colors ${isReplayMode ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-700/50'
                            }`}
                          title={isReplayMode ? lockMessage : undefined}
                        >
                          <span className="sr-only">{labelText}</span>
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => handleConfigChange(node.id, key, e.target.checked)}
                            className="sr-only"
                            disabled={isReplayMode}
                          />
                          <div className={`w-10 h-5 rounded-full transition-all ${value ? 'bg-cyan-500' : 'bg-gray-600'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform ${value ? 'ml-5' : 'ml-0.5'}`}></div>
                          </div>
                          <span className="text-white text-sm font-medium">{value ? 'Enabled' : 'Disabled'}</span>
                        </label>
                      ) : typeof value === 'number' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={value}
                            onChange={(e) => handleConfigChange(node.id, key, parseFloat(e.target.value) || 0)}
                            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            disabled={isReplayMode}
                            title={isReplayMode ? lockMessage : undefined}
                          />
                          <input
                            type="number"
                            value={value}
                            onChange={(e) => handleConfigChange(node.id, key, parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 bg-gray-800 rounded border border-gray-600 text-white text-sm font-mono"
                            disabled={isReplayMode}
                            title={isReplayMode ? lockMessage : undefined}
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={String(value)}
                          onChange={(e) => handleConfigChange(node.id, key, e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800/50 rounded border border-gray-600 text-white text-sm"
                          disabled={isReplayMode}
                          title={isReplayMode ? lockMessage : undefined}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* State (read-only) */}
          {engineState && Object.keys(engineState).length > 0 && (
            <div className="bg-purple-900/10 rounded-lg p-3 border border-purple-500/20">
              <div className="text-xs font-semibold text-purple-300 mb-2">INTERNAL STATE</div>
              <div className="space-y-1.5">
                {Object.entries(engineState).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="text-white font-mono text-sm bg-gray-800/50 px-2 py-0.5 rounded">
                      {typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render connection properties
  if (selectedConnections.length > 0) {
    const conn = selectedConnections[0];

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-gray-700/50 bg-gradient-to-br from-purple-900/20 to-pink-900/20">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
            <div className="text-xs font-semibold text-purple-400">WIRE</div>
          </div>
          <div className="text-sm text-gray-300">Connection</div>
          {selectedConnections.length > 1 && (
            <div className="mt-2 text-xs bg-purple-500/10 border border-purple-500/30 rounded px-2 py-1 text-purple-300">
              +{selectedConnections.length - 1} more
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Connection Flow Visualization */}
          <div className="bg-gradient-to-r from-cyan-900/20 via-purple-900/20 to-pink-900/20 rounded-lg p-3 border border-gray-700/50">
            <div className="flex flex-col gap-3">
              {/* Source */}
              <div className="bg-cyan-900/30 rounded p-2 border-l-2 border-cyan-400">
                <div className="text-[10px] text-cyan-300 font-semibold mb-1">FROM</div>
                <div className="text-white text-sm font-medium mb-0.5">{conn.from.portName}</div>
                <div className="text-[10px] text-gray-400 font-mono truncate">{conn.from.nodeId}</div>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center text-gray-500">
                <div className="text-2xl">→</div>
              </div>

              {/* Target */}
              <div className="bg-pink-900/30 rounded p-2 border-l-2 border-pink-400">
                <div className="text-[10px] text-pink-300 font-semibold mb-1">TO</div>
                <div className="text-white text-sm font-medium mb-0.5">{conn.to.portName}</div>
                <div className="text-[10px] text-gray-400 font-mono truncate">{conn.to.nodeId}</div>
              </div>
            </div>
          </div>

          {/* Delete button */}
          {onConnectionDelete && (
            <button
              onClick={() => {
                const id = `${conn.from.nodeId}.${conn.from.portName}->${conn.to.nodeId}.${conn.to.portName}`;
                onConnectionDelete(id);
              }}
              className={`w-full px-4 py-3 border border-red-500/30 rounded-lg text-red-400 transition-all font-medium flex items-center justify-center gap-2 group ${isReplayMode
                ? 'bg-red-500/5 opacity-60 cursor-not-allowed'
                : 'bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 hover:text-red-300'
                }`}
              disabled={isReplayMode}
              title={isReplayMode ? lockMessage : undefined}
            >
              <span className="text-lg group-hover:scale-110 transition-transform">🗑️</span>
              <span>Delete Wire</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};
