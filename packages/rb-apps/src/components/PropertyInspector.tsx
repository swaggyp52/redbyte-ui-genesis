// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import type { Circuit, Node, Connection, Signal } from '@redbyte/rb-logic-core';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

interface PropertyInspectorProps {
  circuit: Circuit;
  engine: CircuitEngine;
  isRunning: boolean;
  onNodeUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onConnectionDelete?: (connectionId: string) => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  circuit,
  engine,
  isRunning,
  onNodeUpdate,
  onConnectionDelete,
}) => {
  const selection = useLogicViewStore((s) => s.selection);

  // Get selected nodes and connections
  const selectedNodes = useMemo(() => {
    return circuit.nodes.filter((n) => selection.nodes.has(n.id));
  }, [circuit.nodes, selection.nodes]);

  const selectedConnections = useMemo(() => {
    return circuit.connections.filter((c) => {
      const id = `${c.from.nodeId}.${c.from.portName}->${c.to.nodeId}.${c.to.portName}`;
      return selection.wires.has(id);
    });
  }, [circuit.connections, selection.wires]);

  // Get real-time signals for selected nodes
  const [nodeSignals, setNodeSignals] = React.useState<Map<string, Record<string, Signal>>>(new Map());

  React.useEffect(() => {
    if (!isRunning || selectedNodes.length === 0) {
      setNodeSignals(new Map());
      return;
    }

    const interval = setInterval(() => {
      const signals = new Map<string, Record<string, Signal>>();
      for (const node of selectedNodes) {
        signals.set(node.id, engine.getNodeOutputs(node.id));
      }
      setNodeSignals(signals);
    }, 200); // Reduced from 50ms to 200ms for better performance

    return () => clearInterval(interval);
  }, [isRunning, selectedNodes, engine]);

  // Handle property changes
  const handleConfigChange = (nodeId: string, configKey: string, value: any) => {
    const node = selectedNodes.find((n) => n.id === nodeId);
    if (!node || !onNodeUpdate) return;

    onNodeUpdate(nodeId, {
      config: {
        ...node.config,
        [configKey]: value,
      },
    });
  };

  const handlePositionChange = (nodeId: string, x: number, y: number) => {
    if (!onNodeUpdate) return;
    onNodeUpdate(nodeId, { x, y });
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
    const state = engine.getNodeState(node.id) ?? {};

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
                  <div key={port} className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{port}</span>
                    <div
                      className={`font-bold text-lg px-3 py-1 rounded-md transition-all ${
                        signal === 1
                          ? 'bg-green-500/30 text-green-300 shadow-lg shadow-green-500/20 scale-110'
                          : 'bg-gray-700/50 text-gray-500 scale-100'
                      }`}
                    >
                      {signal}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Configuration */}
          {node.config && Object.keys(node.config).length > 0 && (
            <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs font-semibold text-gray-300 mb-3">SETTINGS</div>
              <div className="space-y-3">
                {Object.entries(node.config).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-gray-400 mb-1.5 text-xs capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    {typeof value === 'boolean' ? (
                      <label className="flex items-center gap-3 cursor-pointer bg-gray-800/50 rounded px-3 py-2 hover:bg-gray-700/50 transition-colors">
                        <div className={`w-10 h-5 rounded-full transition-all ${value ? 'bg-cyan-500' : 'bg-gray-600'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform ${value ? 'ml-5' : 'ml-0.5'}`}></div>
                        </div>
                        <span className="text-white text-sm font-medium">{value ? 'Enabled' : 'Disabled'}</span>
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => handleConfigChange(node.id, key, e.target.checked)}
                          className="hidden"
                        />
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
                        />
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => handleConfigChange(node.id, key, parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 bg-gray-800 rounded border border-gray-600 text-white text-sm font-mono"
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={String(value)}
                        onChange={(e) => handleConfigChange(node.id, key, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800/50 rounded border border-gray-600 text-white text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* State (read-only) */}
          {state && Object.keys(state).length > 0 && (
            <div className="bg-purple-900/10 rounded-lg p-3 border border-purple-500/20">
              <div className="text-xs font-semibold text-purple-300 mb-2">INTERNAL STATE</div>
              <div className="space-y-1.5">
                {Object.entries(state).map(([key, value]) => (
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
              className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 hover:text-red-300 transition-all font-medium flex items-center justify-center gap-2 group"
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
