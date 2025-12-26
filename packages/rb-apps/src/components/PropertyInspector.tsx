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
      <div className="w-64 border-l border-gray-700 overflow-y-auto p-4 bg-gray-850">
        <h3 className="text-sm font-semibold mb-3 text-white">Inspector</h3>
        <div className="text-xs text-gray-400">
          <p className="mb-4">Select a node or connection to view properties</p>
          <div className="pt-4 border-t border-gray-700">
            <p className="font-semibold text-gray-300 mb-2">Circuit Stats</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Nodes:</span>
                <span className="text-cyan-400">{circuit.nodes.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Connections:</span>
                <span className="text-cyan-400">{circuit.connections.length}</span>
              </div>
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
      <div className="w-64 border-l border-gray-700 overflow-y-auto p-4 bg-gray-850">
        <h3 className="text-sm font-semibold mb-3 text-white">Node Properties</h3>

        {selectedNodes.length > 1 && (
          <div className="mb-3 text-xs bg-cyan-500/10 border border-cyan-500/30 rounded p-2 text-cyan-300">
            {selectedNodes.length} nodes selected (showing first)
          </div>
        )}

        <div className="space-y-3 text-xs">
          {/* Node Type */}
          <div>
            <label className="block text-gray-400 mb-1">Type</label>
            <div className="px-2 py-1.5 bg-gray-800 rounded border border-gray-700 text-white font-mono">
              {node.type}
            </div>
          </div>

          {/* Node ID */}
          <div>
            <label className="block text-gray-400 mb-1">ID</label>
            <div className="px-2 py-1.5 bg-gray-800 rounded border border-gray-700 text-gray-400 font-mono text-[10px] truncate">
              {node.id}
            </div>
          </div>

          {/* Position */}
          <div>
            <label className="block text-gray-400 mb-1">Position</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="number"
                  value={Math.round(node.x)}
                  onChange={(e) => handlePositionChange(node.id, parseInt(e.target.value) || 0, node.y)}
                  className="w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-white text-xs"
                  placeholder="X"
                />
              </div>
              <div>
                <input
                  type="number"
                  value={Math.round(node.y)}
                  onChange={(e) => handlePositionChange(node.id, node.x, parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-white text-xs"
                  placeholder="Y"
                />
              </div>
            </div>
          </div>

          {/* Configuration */}
          {node.config && Object.keys(node.config).length > 0 && (
            <div className="pt-3 border-t border-gray-700">
              <label className="block text-gray-400 mb-2 font-semibold">Configuration</label>
              <div className="space-y-2">
                {Object.entries(node.config).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-gray-400 mb-1 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    {typeof value === 'boolean' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => handleConfigChange(node.id, key, e.target.checked)}
                          className="rounded border-gray-700 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                        />
                        <span className="text-white text-xs">{value ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    ) : typeof value === 'number' ? (
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => handleConfigChange(node.id, key, parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-white text-xs"
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(value)}
                        onChange={(e) => handleConfigChange(node.id, key, e.target.value)}
                        className="w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-white text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* State (read-only) */}
          {state && Object.keys(state).length > 0 && (
            <div className="pt-3 border-t border-gray-700">
              <label className="block text-gray-400 mb-2 font-semibold">State</label>
              <div className="space-y-1.5">
                {Object.entries(state).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-gray-400 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className="text-white font-mono text-xs">
                      {typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Outputs (when running) */}
          {isRunning && Object.keys(signals).length > 0 && (
            <div className="pt-3 border-t border-gray-700">
              <label className="block text-gray-400 mb-2 font-semibold">Live Outputs</label>
              <div className="space-y-1.5">
                {Object.entries(signals).map(([port, signal]) => (
                  <div key={port} className="flex justify-between items-center">
                    <span className="text-gray-400">{port}:</span>
                    <span
                      className={`font-mono text-xs px-2 py-0.5 rounded ${
                        signal === 1
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                      }`}
                    >
                      {signal}
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
      <div className="w-64 border-l border-gray-700 overflow-y-auto p-4 bg-gray-850">
        <h3 className="text-sm font-semibold mb-3 text-white">Connection Properties</h3>

        {selectedConnections.length > 1 && (
          <div className="mb-3 text-xs bg-cyan-500/10 border border-cyan-500/30 rounded p-2 text-cyan-300">
            {selectedConnections.length} connections selected (showing first)
          </div>
        )}

        <div className="space-y-3 text-xs">
          {/* Source */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">Source</label>
            <div className="px-2 py-1.5 bg-gray-800 rounded border border-gray-700">
              <div className="text-white font-mono text-[10px] truncate mb-1">
                {conn.from.nodeId}
              </div>
              <div className="text-cyan-400">{conn.from.portName}</div>
            </div>
          </div>

          {/* Target */}
          <div>
            <label className="block text-gray-400 mb-1 font-semibold">Target</label>
            <div className="px-2 py-1.5 bg-gray-800 rounded border border-gray-700">
              <div className="text-white font-mono text-[10px] truncate mb-1">
                {conn.to.nodeId}
              </div>
              <div className="text-cyan-400">{conn.to.portName}</div>
            </div>
          </div>

          {/* Delete button */}
          {onConnectionDelete && (
            <div className="pt-3 border-t border-gray-700">
              <button
                onClick={() => {
                  const id = `${conn.from.nodeId}.${conn.from.portName}->${conn.to.nodeId}.${conn.to.portName}`;
                  onConnectionDelete(id);
                }}
                className="w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400 hover:text-red-300 transition-colors"
              >
                Delete Connection
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
