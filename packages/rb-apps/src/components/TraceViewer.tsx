// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useMemo } from 'react';
import type { TraceSnapshot } from '@redbyte/rb-logic-core';
import type { Circuit } from '@redbyte/rb-logic-core';

interface TraceViewerProps {
  traces: TraceSnapshot[];
  circuit: Circuit;
  currentTick: number;
  onSeekToTick?: (tick: number) => void;
  onClose?: () => void;
}

export const TraceViewer: React.FC<TraceViewerProps> = ({
  traces,
  circuit,
  currentTick,
  onSeekToTick,
  onClose,
}) => {
  const [selectedTick, setSelectedTick] = useState<number | null>(null);
  const [filter, setFilter] = useState('');

  const tickToShow = selectedTick ?? currentTick;
  const currentTrace = useMemo(() => {
    return traces.find((t) => t.tick === tickToShow);
  }, [traces, tickToShow]);

  const filteredChanges = useMemo(() => {
    if (!currentTrace) return [];

    return currentTrace.changedNodes.filter((nodeId) => {
      if (!filter) return true;
      const node = circuit.nodes.find((n) => n.id === nodeId);
      return node?.type.toLowerCase().includes(filter.toLowerCase()) ||
             nodeId.toLowerCase().includes(filter.toLowerCase());
    });
  }, [currentTrace, filter, circuit.nodes]);

  const stats = useMemo(() => {
    if (traces.length === 0) return null;
    const totalChanges = traces.reduce((sum, t) => sum + t.changedNodes.length, 0);
    return {
      totalTicks: traces.length,
      totalChanges,
      avgChangesPerTick: (totalChanges / traces.length).toFixed(1),
    };
  }, [traces]);

  const handleSeek = (tick: number) => {
    setSelectedTick(tick);
    if (onSeekToTick) {
      onSeekToTick(tick);
    }
  };

  if (traces.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center p-8">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">No Trace Data</h3>
          <p className="text-sm">
            Start the simulation to begin recording execution trace
          </p>
        </div>
      </div>
    );
  }

  const tickRange = { min: traces[0].tick, max: traces[traces.length - 1].tick };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-white">Execution Trace</h2>
          <p className="text-xs text-gray-400 mt-1">
            Viewing tick {tickToShow} of {tickRange.max}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-white"
          >
            Close
          </button>
        )}
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="px-4 py-2 bg-gray-850 border-b border-gray-700 flex items-center gap-6 text-xs">
          <div>
            <span className="text-gray-400">Total Ticks:</span>{' '}
            <span className="text-cyan-400 font-mono">{stats.totalTicks}</span>
          </div>
          <div>
            <span className="text-gray-400">Total Changes:</span>{' '}
            <span className="text-cyan-400 font-mono">{stats.totalChanges}</span>
          </div>
          <div>
            <span className="text-gray-400">Avg Changes/Tick:</span>{' '}
            <span className="text-cyan-400 font-mono">{stats.avgChangesPerTick}</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-850">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => handleSeek(Math.max(tickRange.min, tickToShow - 1))}
            disabled={tickToShow <= tickRange.min}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-gray-700 text-white"
          >
            ◀ Prev
          </button>
          <input
            type="range"
            min={tickRange.min}
            max={tickRange.max}
            value={tickToShow}
            onChange={(e) => handleSeek(parseInt(e.target.value))}
            className="flex-1"
          />
          <button
            onClick={() => handleSeek(Math.min(tickRange.max, tickToShow + 1))}
            disabled={tickToShow >= tickRange.max}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-gray-700 text-white"
          >
            Next ▶
          </button>
        </div>
        <div className="text-xs text-gray-400 text-center">
          Tick {tickToShow} / {tickRange.max}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Filter */}
        <div className="mb-4">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by node type or ID..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm placeholder-gray-500"
          />
        </div>

        {currentTrace ? (
          <div className="space-y-4">
            {/* Changed Nodes */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">
                Changed Nodes ({filteredChanges.length})
              </h3>
              {filteredChanges.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No changes this tick</p>
              ) : (
                <div className="space-y-2">
                  {filteredChanges.map((nodeId) => {
                    const node = circuit.nodes.find((n) => n.id === nodeId);
                    if (!node) return null;

                    const signals = Object.entries(currentTrace.signals)
                      .filter(([key]) => key.startsWith(nodeId + '.'))
                      .map(([key, value]) => ({
                        port: key.split('.')[1],
                        value,
                      }));

                    const state = currentTrace.nodeStates[nodeId];

                    return (
                      <div
                        key={nodeId}
                        className="p-3 bg-gray-800 rounded border border-gray-700"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-sm font-semibold text-cyan-400">
                              {node.type}
                            </span>
                            <span className="text-xs text-gray-500 ml-2 font-mono">
                              {nodeId}
                            </span>
                          </div>
                        </div>

                        {/* Signals */}
                        {signals.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-400 mb-1">Outputs:</div>
                            <div className="flex flex-wrap gap-2">
                              {signals.map(({ port, value }) => (
                                <div
                                  key={port}
                                  className="flex items-center gap-1 text-xs"
                                >
                                  <span className="text-gray-400">{port}:</span>
                                  <span
                                    className={`font-mono px-1.5 py-0.5 rounded ${
                                      value === 1
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                                    }`}
                                  >
                                    {value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* State */}
                        {state && Object.keys(state).length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-400 mb-1">State:</div>
                            <div className="text-xs font-mono text-white">
                              {JSON.stringify(state, null, 2)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            No trace data for tick {tickToShow}
          </div>
        )}
      </div>
    </div>
  );
};
