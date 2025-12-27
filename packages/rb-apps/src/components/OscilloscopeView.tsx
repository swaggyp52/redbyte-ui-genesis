// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { CircuitEngine, Node, Signal } from '@redbyte/rb-logic-core';
import { useViewStateStore } from '../stores/viewStateStore';
import {
  calculateMeasurements,
  detectTrigger,
  type SignalSample,
  type SignalMeasurements,
} from '../utils/signalMeasurements';

interface ProbeConfig {
  id: string;
  nodeId: string;
  portName: string;
  label: string;
  color: string;
  enabled: boolean;
}

interface ProbeData {
  probeId: string;
  samples: SignalSample[];
  measurements: SignalMeasurements | null;
}

interface Cursor {
  id: string;
  time: number;
  color: string;
}

interface TriggerConfig {
  enabled: boolean;
  probeId: string | null;
  type: 'edge' | 'level';
  edge: 'rising' | 'falling';
  level: number;
  holdOff: number;
}

interface OscilloscopeViewProps {
  engine: CircuitEngine;
  circuit: { nodes: Node[] };
  isRunning: boolean;
  width?: number;
  height?: number;
}

const COLORS = [
  '#00ffff', // cyan
  '#ffff00', // yellow
  '#ff00ff', // magenta
  '#00ff00', // green
  '#ff8800', // orange
  '#8800ff', // purple
  '#ff0088', // pink
  '#00ff88', // teal
];

const MAX_SAMPLES = 500; // Maximum samples to keep in buffer
const SAMPLE_INTERVAL = 50; // ms between samples (20 Hz)

export const OscilloscopeView: React.FC<OscilloscopeViewProps> = ({
  engine,
  circuit,
  isRunning,
  width = 800,
  height = 600,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [probes, setProbes] = useState<ProbeConfig[]>([]);
  const [probeData, setProbeData] = useState<Map<string, ProbeData>>(new Map());
  const [timeScale, setTimeScale] = useState(10); // seconds visible
  const [voltageScale, setVoltageScale] = useState(1.5); // vertical scale

  // Trigger configuration
  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>({
    enabled: false,
    probeId: null,
    type: 'edge',
    edge: 'rising',
    level: 0.5,
    holdOff: 0,
  });

  // Cursors
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [selectedPortName, setSelectedPortName] = useState<string>('output');

  // Clock tracking
  const [totalSamples, setTotalSamples] = useState(0);
  const [measurementUpdateCounter, setMeasurementUpdateCounter] = useState(0);

  const samplingIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const measurementUpdateRef = useRef<number | null>(null);

  // Get global selection state for auto-probe
  const { selectedNodeIds, autoProbeEnabled, setAutoProbeEnabled } = useViewStateStore();

  // Auto-probe selected nodes
  useEffect(() => {
    if (!autoProbeEnabled) return;

    // Get currently probed node IDs
    const currentProbedNodeIds = new Set(probes.map((p) => p.nodeId));

    // Find newly selected nodes that aren't already probed
    const newlySelectedNodes = Array.from(selectedNodeIds).filter(
      (nodeId) => !currentProbedNodeIds.has(nodeId)
    );

    if (newlySelectedNodes.length === 0) return;

    // Add probes for newly selected nodes
    const newProbes: ProbeConfig[] = [];
    let colorIndex = probes.length % COLORS.length;

    newlySelectedNodes.forEach((nodeId) => {
      const node = circuit.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const probeId = `probe-${Date.now()}-${nodeId}`;
      newProbes.push({
        id: probeId,
        nodeId,
        portName: 'output', // Default to output port
        label: `${node.type}[output]`,
        color: COLORS[colorIndex],
        enabled: true,
      });

      colorIndex = (colorIndex + 1) % COLORS.length;
    });

    if (newProbes.length > 0) {
      setProbes((prev) => [...prev, ...newProbes]);
    }
  }, [selectedNodeIds, autoProbeEnabled, circuit.nodes, probes]);

  // Sample signals from probes
  const sampleSignals = useCallback(() => {
    if (!isRunning) return;

    const now = Date.now();
    const relativeTime = (now - startTimeRef.current) / 1000; // seconds

    setProbeData((prevData) => {
      const newData = new Map(prevData);

      probes.forEach((probe) => {
        if (!probe.enabled) return;

        // Get the node
        const node = circuit.nodes.find((n) => n.id === probe.nodeId);
        if (!node) return;

        // Get signal value from engine
        const outputs = engine.getNodeOutputs(probe.nodeId);
        const value = outputs[probe.portName] ?? 0;

        // Get or create probe data
        let data = newData.get(probe.id);
        if (!data) {
          data = { probeId: probe.id, samples: [], measurements: null };
          newData.set(probe.id, data);
        }

        // Add sample
        data.samples.push({
          timestamp: relativeTime,
          value,
        });

        // Limit buffer size
        if (data.samples.length > MAX_SAMPLES) {
          data.samples = data.samples.slice(-MAX_SAMPLES);
        }
      });

      // Increment sample counter
      setTotalSamples((prev) => prev + probes.filter((p) => p.enabled).length);

      return newData;
    });
  }, [isRunning, probes, circuit.nodes, engine]);

  // Start/stop sampling
  useEffect(() => {
    if (isRunning) {
      // Reset start time when starting
      startTimeRef.current = Date.now();
      setTotalSamples(0);

      // Start sampling
      samplingIntervalRef.current = window.setInterval(sampleSignals, SAMPLE_INTERVAL);

      // Start measurement updates (every 1 second)
      measurementUpdateRef.current = window.setInterval(() => {
        setMeasurementUpdateCounter((prev) => prev + 1);
      }, 1000);
    } else {
      // Stop sampling
      if (samplingIntervalRef.current) {
        clearInterval(samplingIntervalRef.current);
        samplingIntervalRef.current = null;
      }
      if (measurementUpdateRef.current) {
        clearInterval(measurementUpdateRef.current);
        measurementUpdateRef.current = null;
      }
    }

    return () => {
      if (samplingIntervalRef.current) {
        clearInterval(samplingIntervalRef.current);
      }
      if (measurementUpdateRef.current) {
        clearInterval(measurementUpdateRef.current);
      }
    };
  }, [isRunning, sampleSignals]);

  // Update measurements periodically
  useEffect(() => {
    if (!isRunning) return;

    setProbeData((prevData) => {
      const newData = new Map(prevData);
      newData.forEach((data) => {
        if (data.samples.length >= 2) {
          data.measurements = calculateMeasurements(data.samples);
        }
      });
      return newData;
    });
  }, [measurementUpdateCounter, isRunning]);

  // Render waveforms
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#1a2332';
      ctx.lineWidth = 1;

      // Vertical lines (time divisions)
      const timeDiv = timeScale / 10;
      for (let i = 0; i <= 10; i++) {
        const x = (i / 10) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal lines (voltage divisions)
      for (let i = 0; i <= 8; i++) {
        const y = (i / 8) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center line (thicker)
      ctx.strokeStyle = '#2a3342';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }

    // Get current time
    const now = Date.now();
    const currentTime = (now - startTimeRef.current) / 1000;

    // Draw waveforms
    probes.forEach((probe) => {
      if (!probe.enabled) return;

      const data = probeData.get(probe.id);
      if (!data || data.samples.length < 2) return;

      ctx.strokeStyle = probe.color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      let firstPoint = true;

      data.samples.forEach((sample, index) => {
        // Calculate x position (time axis)
        const timeOffset = currentTime - sample.timestamp;
        if (timeOffset > timeScale) return; // Sample too old

        const x = width - (timeOffset / timeScale) * width;

        // Calculate y position (voltage axis)
        // Map 0-1 signal to vertical position
        const y = height / 2 - (sample.value * voltageScale * height) / 4;

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    });

    // Draw cursors
    cursors.forEach((cursor, index) => {
      const timeOffset = currentTime - cursor.time;
      const cursorX = width - (timeOffset / timeScale) * width;

      if (cursorX < 0 || cursorX > width) return; // Cursor off screen

      ctx.strokeStyle = cursor.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw cursor label
      ctx.fillStyle = cursor.color;
      ctx.font = '12px monospace';
      const label = index === 0 ? 'C1' : 'C2';
      ctx.fillText(`${label}: ${cursor.time.toFixed(3)}s`, cursorX + 5, 20 + index * 20);
    });

    // Draw delta measurements between cursors
    if (cursors.length === 2) {
      const dt = Math.abs(cursors[1].time - cursors[0].time);
      const freq = dt > 0 ? 1 / dt : 0;

      ctx.fillStyle = '#00ff00';
      ctx.font = '14px monospace';
      ctx.fillText(`Δt: ${dt.toFixed(3)}s`, width - 150, 40);
      ctx.fillText(`Δf: ${freq.toFixed(2)}Hz`, width - 150, 60);
    }

    // Draw time labels
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    for (let i = 0; i <= 10; i++) {
      const time = currentTime - (timeScale * (10 - i)) / 10;
      const x = (i / 10) * width;
      ctx.fillText(`${time.toFixed(1)}s`, x + 2, height - 5);
    }
  }, [probes, probeData, width, height, timeScale, voltageScale, cursors, showGrid]);

  // Add probe
  const handleAddProbe = () => {
    if (!selectedNodeId) return;

    const node = circuit.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;

    const probeId = `probe-${Date.now()}`;
    const colorIndex = probes.length % COLORS.length;

    setProbes([
      ...probes,
      {
        id: probeId,
        nodeId: selectedNodeId,
        portName: selectedPortName,
        label: `${node.type}[${selectedPortName}]`,
        color: COLORS[colorIndex],
        enabled: true,
      },
    ]);
  };

  // Remove probe
  const handleRemoveProbe = (probeId: string) => {
    setProbes(probes.filter((p) => p.id !== probeId));
    setProbeData((prev) => {
      const newData = new Map(prev);
      newData.delete(probeId);
      return newData;
    });
  };

  // Toggle probe
  const handleToggleProbe = (probeId: string) => {
    setProbes(
      probes.map((p) => (p.id === probeId ? { ...p, enabled: !p.enabled } : p))
    );
  };

  // Clear all data
  const handleClearData = () => {
    setProbeData(new Map());
    startTimeRef.current = Date.now();
  };

  // Canvas click for cursor
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Calculate time from click position
    const now = Date.now();
    const currentTime = (now - startTimeRef.current) / 1000;
    const timeOffset = ((width - x) / width) * timeScale;
    const clickedTime = currentTime - timeOffset;

    // Shift+click adds second cursor
    if (e.shiftKey && cursors.length < 2) {
      const cursorColor = cursors.length === 0 ? '#ffff00' : '#ff00ff';
      setCursors([...cursors, {
        id: `cursor-${Date.now()}`,
        time: clickedTime,
        color: cursorColor,
      }]);
    } else {
      // Regular click replaces first cursor
      setCursors([{
        id: `cursor-${Date.now()}`,
        time: clickedTime,
        color: '#ffff00',
      }]);
    }
  };

  // Export functions
  const exportAsCSV = () => {
    if (probeData.size === 0) return;

    // Build CSV content
    const headers = ['Time (s)', ...probes.filter((p) => p.enabled).map((p) => p.label)];
    const rows: string[][] = [headers];

    // Get all timestamps
    const allTimestamps = new Set<number>();
    probeData.forEach((data) => {
      data.samples.forEach((sample) => allTimestamps.add(sample.timestamp));
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // Build rows
    sortedTimestamps.forEach((timestamp) => {
      const row = [timestamp.toFixed(6)];
      probes.filter((p) => p.enabled).forEach((probe) => {
        const data = probeData.get(probe.id);
        const sample = data?.samples.find((s) => s.timestamp === timestamp);
        row.push(sample ? String(sample.value) : '-');
      });
      rows.push(row);
    });

    // Convert to CSV string
    const csvContent = rows.map((row) => row.join(',')).join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waveform-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsJSON = () => {
    if (probeData.size === 0) return;

    const exportData = {
      metadata: {
        exportTime: new Date().toISOString(),
        timeScale,
        voltageScale,
        sampleRate: 1000 / SAMPLE_INTERVAL,
        totalSamples,
      },
      probes: probes.filter((p) => p.enabled).map((probe) => {
        const data = probeData.get(probe.id);
        return {
          id: probe.id,
          nodeId: probe.nodeId,
          portName: probe.portName,
          label: probe.label,
          color: probe.color,
          samples: data?.samples || [],
          measurements: data?.measurements || null,
        };
      }),
    };

    // Download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waveform-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex bg-gray-900 text-white">
      {/* Main oscilloscope display */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b border-gray-700 p-2 flex items-center gap-4 text-sm bg-gray-850">
          <div className="flex items-center gap-2">
            <label className="text-gray-400">Time/Div:</label>
            <select
              value={timeScale}
              onChange={(e) => setTimeScale(Number(e.target.value))}
              className="px-2 py-1 bg-gray-800 rounded border border-gray-700"
            >
              <option value={1}>1s</option>
              <option value={2}>2s</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={20}>20s</option>
              <option value={30}>30s</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-gray-400">V/Div:</label>
            <select
              value={voltageScale}
              onChange={(e) => setVoltageScale(Number(e.target.value))}
              className="px-2 py-1 bg-gray-800 rounded border border-gray-700"
            >
              <option value={0.5}>0.5</option>
              <option value={1}>1</option>
              <option value={1.5}>1.5</option>
              <option value={2}>2</option>
            </select>
          </div>

          <div className="w-px h-6 bg-gray-600" />

          <button
            onClick={handleClearData}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Clear
          </button>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-400">Grid</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoProbeEnabled}
              onChange={(e) => setAutoProbeEnabled(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-400">Auto-Probe</span>
          </label>

          <button
            onClick={exportAsCSV}
            disabled={probeData.size === 0}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export as CSV"
          >
            CSV
          </button>

          <button
            onClick={exportAsJSON}
            disabled={probeData.size === 0}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export as JSON"
          >
            JSON
          </button>

          <div className="flex-1" />

          {/* Clock display */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Time:</span>
              <span className="font-mono text-cyan-300">
                {((Date.now() - startTimeRef.current) / 1000).toFixed(2)}s
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Samples:</span>
              <span className="font-mono text-cyan-300">{totalSamples}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Rate:</span>
              <span className="font-mono text-cyan-300">{1000 / SAMPLE_INTERVAL}Hz</span>
            </div>
          </div>

          <div className="w-px h-6 bg-gray-600" />

          <div className="text-gray-400 text-xs">
            {isRunning ? (
              <span className="text-green-400">● Running</span>
            ) : (
              <span className="text-gray-500">○ Paused</span>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center bg-gray-950 p-4">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onClick={handleCanvasClick}
            className="cursor-crosshair border border-gray-700 rounded"
          />
        </div>
      </div>

      {/* Right sidebar - Probes */}
      <div className="w-80 border-l border-gray-700 flex flex-col bg-gray-850">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-cyan-400">Probes</h3>

          {/* Add probe section */}
          <div className="space-y-2 mb-4">
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-sm"
            >
              <option value="">Select node...</option>
              {circuit.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.type} ({node.id.slice(0, 8)})
                </option>
              ))}
            </select>

            <input
              type="text"
              value={selectedPortName}
              onChange={(e) => setSelectedPortName(e.target.value)}
              placeholder="Port name (e.g., 'output')"
              className="w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-sm"
            />

            <button
              onClick={handleAddProbe}
              disabled={!selectedNodeId}
              className="w-full px-3 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Probe
            </button>
          </div>
        </div>

        {/* Active probes list */}
        <div className="flex-1 overflow-y-auto p-4">
          {probes.length === 0 ? (
            <p className="text-gray-500 text-sm text-center mt-8">
              No probes added yet.
              <br />
              Add a probe to start monitoring signals.
            </p>
          ) : (
            <div className="space-y-2">
              {probes.map((probe) => (
                <div
                  key={probe.id}
                  className="p-3 bg-gray-800 rounded border border-gray-700"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0"
                      style={{ backgroundColor: probe.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {probe.label}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {probe.nodeId.slice(0, 12)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveProbe(probe.id)}
                      className="text-gray-400 hover:text-red-400"
                      title="Remove probe"
                    >
                      ×
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={probe.enabled}
                        onChange={() => handleToggleProbe(probe.id)}
                        className="rounded"
                      />
                      <span className="text-gray-400">Enabled</span>
                    </label>

                    <div className="flex-1" />

                    <div className="text-xs text-gray-500">
                      {probeData.get(probe.id)?.samples.length ?? 0} samples
                    </div>
                  </div>

                  {/* Signal measurements */}
                  {probeData.get(probe.id)?.measurements && (
                    <div className="mt-2 pt-2 border-t border-gray-700 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Freq:</span>
                        <span className="font-mono">
                          {probeData.get(probe.id)?.measurements?.frequency?.toFixed(2) ?? '-'}Hz
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Period:</span>
                        <span className="font-mono">
                          {probeData.get(probe.id)?.measurements?.period?.toFixed(3) ?? '-'}s
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duty:</span>
                        <span className="font-mono">
                          {probeData.get(probe.id)?.measurements?.dutyCycle?.toFixed(1) ?? '-'}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cursor measurements */}
        {cursors.length > 0 && (
          <div className="p-4 border-t border-gray-700 bg-gray-900">
            <h4 className="text-sm font-semibold mb-2 text-yellow-400">
              Cursor Measurements
            </h4>
            <div className="space-y-2 text-xs">
              {cursors.map((cursor, index) => (
                <div key={cursor.id} className="space-y-1">
                  <div className="flex justify-between">
                    <span style={{ color: cursor.color }}>
                      C{index + 1} Time:
                    </span>
                    <span className="font-mono">{cursor.time.toFixed(3)}s</span>
                  </div>
                  {probes
                    .filter((p) => p.enabled)
                    .map((probe) => {
                      const data = probeData.get(probe.id);
                      if (!data || data.samples.length === 0) return null;

                      // Find closest sample to cursor
                      const closestSample = data.samples.reduce(
                        (prev, curr) =>
                          Math.abs(curr.timestamp - cursor.time) <
                          Math.abs(prev.timestamp - cursor.time)
                            ? curr
                            : prev,
                        data.samples[0]
                      );

                      return (
                        <div key={`${cursor.id}-${probe.id}`} className="flex justify-between pl-4">
                          <span style={{ color: probe.color }}>{probe.label}:</span>
                          <span className="font-mono">
                            {closestSample?.value ?? '-'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              ))}

              {/* Delta measurements */}
              {cursors.length === 2 && (
                <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-green-400">Δt:</span>
                    <span className="font-mono">
                      {Math.abs(cursors[1].time - cursors[0].time).toFixed(3)}s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-400">Δf:</span>
                    <span className="font-mono">
                      {(1 / Math.abs(cursors[1].time - cursors[0].time)).toFixed(2)}Hz
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
