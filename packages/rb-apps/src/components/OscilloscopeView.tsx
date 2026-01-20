// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { CircuitEngine, Node, TickEngine } from '@redbyte/rb-logic-core';
import { useViewStateStore } from '../stores/viewStateStore';
import { useProbeStore } from '../stores/probeStore';
import { useOscilloscopeStore } from '../stores/oscilloscopeStore';
import { mark, measure, trackRender } from '@redbyte/rb-utils';
import {
  calculateMeasurements,
  type SignalSample,
  type SignalMeasurements,
} from '../utils/signalMeasurements';
import { getOscilloscopeHoverInfo, type HoverInfo } from '../utils/oscilloscopeHover';

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
  tickEngine: TickEngine;
  circuit: { nodes: Node[] };
  isRunning: boolean;
  width?: number;
  height?: number;
  showHints?: boolean;
  onDismissHints?: () => void;
  onHelp?: () => void;
  debugTick?: number | null;
  // Signal update propagation for immediate sampling on input changes
  signals?: Map<string, 0 | 1>;
  signalsVersion?: number;
  signalsUpdateReason?: 'input' | 'tick';
}

const MAX_SAMPLES = 500; // Maximum samples to keep in buffer
const SAMPLE_INTERVAL = 50; // ms between samples (20 Hz)

export const OscilloscopeView: React.FC<OscilloscopeViewProps> = ({
  engine,
  tickEngine,
  circuit,
  isRunning,
  width = 800,
  height = 600,
  showHints = true,
  onDismissHints,
  onHelp,
  debugTick,
  signals,
  signalsVersion,
  signalsUpdateReason,
}) => {
  trackRender('OscilloscopeView');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pendingDrawRef = useRef<number | null>(null);
  
  // Guardrail 1: Version-based sampling to prevent cascades
  const lastSampledVersionRef = useRef<number>(-1);
  
  // Guardrail 2: RAF batching for spam-click prevention
  const rafRef = useRef<number | null>(null);
  const pendingInputSampleRef = useRef<{
    version: number;
    reason: 'input' | 'tick';
  } | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });
  const probes = useProbeStore((state) => state.probes);
  const activeProbeId = useProbeStore((state) => state.activeProbeId);
  const addProbe = useProbeStore((state) => state.addProbe);
  const removeProbe = useProbeStore((state) => state.removeProbe);
  const toggleProbe = useProbeStore((state) => state.toggleProbe);
  const setActiveProbe = useProbeStore((state) => state.setActiveProbe);
  const [probeData, setProbeData] = useState<Map<string, ProbeData>>(new Map());
  const [voltageScale, setVoltageScale] = useState(1.5); // vertical scale
  const [viewEndTime, setViewEndTime] = useState(0);

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
  const [selectedPortName, setSelectedPortName] = useState<string>('out');
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  // Clock tracking
  const [totalSamples, setTotalSamples] = useState(0);
  const [measurementUpdateCounter, setMeasurementUpdateCounter] = useState(0);
  const clockNode = useMemo(
    () => circuit.nodes.find((node) => node.type === 'Clock') ?? null,
    [circuit.nodes]
  );

  const samplingIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const measurementUpdateRef = useRef<number | null>(null);
  const pauseScroll = useOscilloscopeStore((state) => state.pauseScroll);
  const setPauseScroll = useOscilloscopeStore((state) => state.setPauseScroll);
  const togglePauseScroll = useOscilloscopeStore((state) => state.togglePauseScroll);
  const showTimeCursor = useOscilloscopeStore((state) => state.showTimeCursor);
  const toggleTimeCursor = useOscilloscopeStore((state) => state.toggleTimeCursor);
  const timeWindowSec = useOscilloscopeStore((state) => state.timeWindowSec);
  const setTimeWindowSec = useOscilloscopeStore((state) => state.setTimeWindowSec);
  const showTickGuides = useOscilloscopeStore((state) => state.showTickGuides);
  const setShowTickGuides = useOscilloscopeStore((state) => state.setShowTickGuides);
  const clearRequestId = useOscilloscopeStore((state) => state.clearRequestId);
  const requestClear = useOscilloscopeStore((state) => state.requestClear);
  const pauseScrollRef = useRef(pauseScroll);

  // Get global selection state for auto-probe
  const selectedNodeIds = useViewStateStore((state) => state.selectedNodeIds);
  const autoProbeEnabled = useViewStateStore((state) => state.autoProbeEnabled);
  const setAutoProbeEnabled = useViewStateStore((state) => state.setAutoProbeEnabled);
  const getCurrentTime = useCallback(() => (Date.now() - startTimeRef.current) / 1000, []);

  useEffect(() => {
    pauseScrollRef.current = pauseScroll;
  }, [pauseScroll]);

  useEffect(() => {
    if (pauseScroll) {
      setViewEndTime((prev) => (prev === 0 ? getCurrentTime() : prev));
    } else {
      setViewEndTime(getCurrentTime());
    }
  }, [pauseScroll, getCurrentTime]);


  // Update canvas dimensions based on container size
  useEffect(() => {
    const updateCanvasDimensions = () => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect();
        setCanvasDimensions({
          width: Math.max(rect.width - 20, 400),
          height: Math.max(rect.height - 20, 300),
        });
      }
    };

    updateCanvasDimensions();
    window.addEventListener('resize', updateCanvasDimensions);
    return () => window.removeEventListener('resize', updateCanvasDimensions);
  }, []);

  // Auto-populate interesting nodes on initial load
  useEffect(() => {
    // Only run on initial load when probes are empty and circuit has nodes
    if (probes.length > 0 || circuit.nodes.length === 0) return;

    const initialProbes: Array<{ nodeId: string; portName: string; label: string }> = [];

    // Priority order for auto-probing
    const priorityTypes = ['Clock', 'INPUT', 'PowerSource', 'Switch', 'OUTPUT', 'Lamp'];
    const probedNodes = new Set<string>();

    // First pass: probe priority nodes
    priorityTypes.forEach((priorityType) => {
      circuit.nodes.forEach((node) => {
        if (node.type === priorityType && !probedNodes.has(node.id)) {
          const isInput = ['INPUT', 'PowerSource', 'Switch', 'Clock'].includes(node.type);
          const portName = isInput ? 'out' : 'in';

          initialProbes.push({
            nodeId: node.id,
            portName,
            label: `${node.type}: ${node.id.substring(0, 8)}`,
          });

          probedNodes.add(node.id);
        }
      });
    });

    // If we have too many probes, limit to first 8
    const limitedProbes = initialProbes.slice(0, 8);

    if (limitedProbes.length > 0) {
      limitedProbes.forEach((probe) => {
        addProbe({
          nodeId: probe.nodeId,
          portName: probe.portName,
          label: probe.label,
        });
      });
    }
  }, [addProbe, circuit.nodes, probes.length]);

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
    const newProbes: Array<{ nodeId: string; portName: string; label: string }> = [];

    newlySelectedNodes.forEach((nodeId) => {
      const node = circuit.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const isOutput = ['OUTPUT', 'Lamp'].includes(node.type);
      const portName = isOutput ? 'in' : 'out';

      newProbes.push({
        nodeId,
        portName,
        label: `${node.type}: ${nodeId.substring(0, 8)}`,
      });
    });

    if (newProbes.length > 0) {
      newProbes.forEach((probe) => {
        addProbe({
          nodeId: probe.nodeId,
          portName: probe.portName,
          label: probe.label,
        });
      });
    }
  }, [addProbe, selectedNodeIds, autoProbeEnabled, circuit.nodes, probes]);

  // Prune stale probe data when probes are removed elsewhere
  useEffect(() => {
    setProbeData((prev) => {
      const next = new Map(prev);
      const activeIds = new Set(probes.map((probe) => probe.id));
      Array.from(next.keys()).forEach((id) => {
        if (!activeIds.has(id)) {
          next.delete(id);
        }
      });
      return next;
    });
  }, [probes]);

  // Sample signals from probes
  const sampleSignals = useCallback(() => {
    // Sample on tick when running, or on input change when stopped
    if (!isRunning && signalsUpdateReason !== 'input') return;

    const relativeTime = getCurrentTime(); // seconds

    setProbeData((prevData) => {
      const newData = new Map(prevData);

      probes.forEach((probe) => {
        if (!probe.enabled) return;

        // Get the node - if it doesn't exist, continue sampling with value 0 (missing node)
        const node = circuit.nodes.find((n) => n.id === probe.nodeId);

        // Get signal value from engine (will be 0 if node doesn't exist)
        const outputs = node ? engine.getNodeOutputs(probe.nodeId) : {};
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

    if (!pauseScrollRef.current) {
      setViewEndTime(relativeTime);
    }
  }, [isRunning, signalsUpdateReason, probes, circuit.nodes, engine, getCurrentTime]);

  // Start/stop trace recording
  useEffect(() => {
    const traceRecorder = tickEngine.getTraceRecorder();

    if (isRunning) {
      // Start trace recording if not already active
      if (!traceRecorder) {
        tickEngine.enableTracing(2000); // Keep last 2000 ticks
      } else if (!traceRecorder.isActive()) {
        traceRecorder.start();
      }

      // Reset start time when starting
      startTimeRef.current = Date.now();
      setTotalSamples(0);
      setViewEndTime(0);

      // Start sampling
      samplingIntervalRef.current = window.setInterval(sampleSignals, SAMPLE_INTERVAL);

      // Start measurement updates (every 1 second)
      measurementUpdateRef.current = window.setInterval(() => {
        setMeasurementUpdateCounter((prev) => prev + 1);
      }, 1000);
    } else {
      // Stop sampling (but keep trace recording active for review)
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
  }, [isRunning, sampleSignals, tickEngine]);

  // Guardrails: Version-based sampling + RAF batching for input changes
  useEffect(() => {
    // Only batch input changes; tick changes are handled by interval
    const isInputChange = signalsUpdateReason === 'input' && !isRunning;
    if (!isInputChange) return;
    if (signalsVersion === undefined) return;

    // Store pending sample with latest version
    pendingInputSampleRef.current = { version: signalsVersion, reason: 'input' };

    // If RAF already scheduled, don't double-schedule
    if (rafRef.current !== null) return;

    // Schedule sampling at next frame
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingInputSampleRef.current;
      pendingInputSampleRef.current = null;
      if (!pending) return;

      // Prevent double-sampling same version
      if (lastSampledVersionRef.current === pending.version) return;
      lastSampledVersionRef.current = pending.version;

      sampleSignals();
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [signalsVersion, signalsUpdateReason, isRunning, sampleSignals]);

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

  const drawWaveforms = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    mark('oscilloscope-draw-start');

    const renderWidth = canvasDimensions.width;
    const renderHeight = canvasDimensions.height;

    // Clear canvas
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, renderWidth, renderHeight);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#1a2332';
      ctx.lineWidth = 1;

      // Vertical lines (time divisions)
      for (let i = 0; i <= 10; i++) {
        const x = (i / 10) * renderWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, renderHeight);
        ctx.stroke();
      }

      // Horizontal lines (voltage divisions)
      for (let i = 0; i <= 8; i++) {
        const y = (i / 8) * renderHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(renderWidth, y);
        ctx.stroke();
      }

      // Center line (thicker)
      ctx.strokeStyle = '#2a3342';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, renderHeight / 2);
      ctx.lineTo(renderWidth, renderHeight / 2);
      ctx.stroke();
    }

    // Get current time
    const currentTime = getCurrentTime();
    const windowEndTime = pauseScroll ? viewEndTime : currentTime;
    const windowStartTime = windowEndTime - timeWindowSec;

    // Draw tick guides
    if (showTickGuides) {
      const tickRate = tickEngine.getTickRate();
      if (tickRate > 0) {
        const tickInterval = 1 / tickRate;
        const firstTick = Math.ceil(windowStartTime / tickInterval) * tickInterval;
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
        ctx.lineWidth = 1;
        for (let tickTime = firstTick; tickTime <= windowEndTime; tickTime += tickInterval) {
          const timeOffset = windowEndTime - tickTime;
          const x = renderWidth - (timeOffset / timeWindowSec) * renderWidth;
          if (x < 0 || x > renderWidth) continue;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, renderHeight);
          ctx.stroke();
        }
      }
    }

    // Draw waveforms
    probes.forEach((probe) => {
      if (!probe.enabled) return;

      const data = probeData.get(probe.id);
      if (!data || data.samples.length < 2) return;

      ctx.strokeStyle = probe.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = probe.color;
      ctx.shadowBlur = 3;
      ctx.beginPath();

      let firstPoint = true;
      let previousY = 0;

      data.samples.forEach((sample) => {
        // Calculate x position (time axis)
        const timeOffset = windowEndTime - sample.timestamp;
        if (timeOffset > timeWindowSec) return; // Sample too old

        const x = renderWidth - (timeOffset / timeWindowSec) * renderWidth;

        // Calculate y position (voltage axis)
        const y = renderHeight / 2 - (sample.value * voltageScale * renderHeight) / 4;

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
          previousY = y;
        } else {
          ctx.lineTo(x, previousY);
          ctx.lineTo(x, y);
          previousY = y;
        }
      });

      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    const enabledProbes = probes.filter((probe) => probe.enabled);
    enabledProbes.forEach((probe, index) => {
      const data = probeData.get(probe.id);
      if (!data || data.samples.length === 0) return;
      const latestSample = data.samples[data.samples.length - 1];
      const label = `${probe.label} ${latestSample.value}`;
      ctx.font = '10px monospace';
      const textWidth = ctx.measureText(label).width;
      const labelX = renderWidth - textWidth - 12;
      const labelY = 12 + index * 14;
      ctx.fillStyle = 'rgba(10, 14, 26, 0.85)';
      ctx.fillRect(labelX - 4, labelY - 8, textWidth + 8, 14);
      ctx.fillStyle = probe.color;
      ctx.fillText(label, labelX, labelY + 2);
    });

    // Draw "now" cursor
    if (showTimeCursor) {
      const nowCursorTime = pauseScroll ? viewEndTime : currentTime;
      const nowCursorX =
        renderWidth - ((windowEndTime - nowCursorTime) / timeWindowSec) * renderWidth;
      if (nowCursorX >= 0 && nowCursorX <= renderWidth) {
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nowCursorX, 0);
        ctx.lineTo(nowCursorX, renderHeight);
        ctx.stroke();

        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px monospace';
        ctx.fillText(`t=${nowCursorTime.toFixed(2)}s`, nowCursorX + 4, 12);
      }
    }

    if (typeof debugTick === 'number' && tickEngine.getTickRate() > 0) {
      const debugTime = debugTick / tickEngine.getTickRate();
      const debugX =
        renderWidth - ((windowEndTime - debugTime) / timeWindowSec) * renderWidth;
      if (debugX >= 0 && debugX <= renderWidth) {
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(debugX, 0);
        ctx.lineTo(debugX, renderHeight);
        ctx.stroke();
        ctx.fillStyle = '#f97316';
        ctx.font = '10px monospace';
        ctx.fillText(`t=${debugTime.toFixed(2)}s`, debugX + 4, 24);
      }
    }

    // Draw cursors
    cursors.forEach((cursor, index) => {
      const timeOffset = windowEndTime - cursor.time;
      const cursorX = renderWidth - (timeOffset / timeWindowSec) * renderWidth;

      if (cursorX < 0 || cursorX > renderWidth) return; // Cursor off screen

      ctx.strokeStyle = cursor.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, renderHeight);
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
      ctx.fillText(`I"t: ${dt.toFixed(3)}s`, renderWidth - 150, 40);
      ctx.fillText(`I"f: ${freq.toFixed(2)}Hz`, renderWidth - 150, 60);
    }

    // Draw time labels
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    for (let i = 0; i <= 10; i++) {
      const time = windowEndTime - (timeWindowSec * (10 - i)) / 10;
      const x = (i / 10) * renderWidth;
      ctx.fillText(`${time.toFixed(1)}s`, x + 2, renderHeight - 5);
    }

    mark('oscilloscope-draw-end');
    measure('oscilloscope-draw', 'oscilloscope-draw-start', 'oscilloscope-draw-end');
  }, [
    probes,
    probeData,
    timeWindowSec,
    voltageScale,
    cursors,
    showGrid,
    canvasDimensions,
    getCurrentTime,
    pauseScroll,
    showTimeCursor,
    viewEndTime,
    showTickGuides,
    tickEngine,
    debugTick,
  ]);

  const scheduleDraw = useCallback(() => {
    if (pendingDrawRef.current !== null) return;
    pendingDrawRef.current = window.requestAnimationFrame(() => {
      pendingDrawRef.current = null;
      drawWaveforms();
    });
  }, [drawWaveforms]);

  // Render waveforms
  useEffect(() => {
    scheduleDraw();
    return () => {
      if (pendingDrawRef.current !== null) {
        window.cancelAnimationFrame(pendingDrawRef.current);
        pendingDrawRef.current = null;
      }
    };
  }, [scheduleDraw]);

  // Add probe
  const handleAddProbe = () => {
    if (!selectedNodeId) return;

    const node = circuit.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;

    addProbe({
      nodeId: selectedNodeId,
      portName: selectedPortName,
      label: `${node.type}: ${selectedNodeId.substring(0, 8)}[${selectedPortName}]`,
    });
  };

  const handleAddClockProbe = () => {
    if (!clockNode) return;
    addProbe({
      nodeId: clockNode.id,
      portName: 'out',
      label: 'Clock out',
    });
  };

  // Remove probe
  const handleRemoveProbe = (probeId: string) => {
    removeProbe(probeId);
    setProbeData((prev) => {
      const newData = new Map(prev);
      newData.delete(probeId);
      return newData;
    });
  };

  // Toggle probe
  const handleToggleProbe = (probeId: string) => {
    toggleProbe(probeId);
  };

  // Clear all data
  const handleClearData = useCallback(() => {
    setProbeData(new Map());
    startTimeRef.current = Date.now();
    setViewEndTime(0);

    // Also clear the trace recorder
    const traceRecorder = tickEngine.getTraceRecorder();
    if (traceRecorder) {
      traceRecorder.clear();
    }
  }, [tickEngine]);

  useEffect(() => {
    if (clearRequestId === 0) return;
    handleClearData();
  }, [clearRequestId, handleClearData]);

  const sampleBounds = useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;
    probeData.forEach((data) => {
      data.samples.forEach((sample) => {
        minTime = Math.min(minTime, sample.timestamp);
        maxTime = Math.max(maxTime, sample.timestamp);
      });
    });

    return {
      minSampleTime: Number.isFinite(minTime) ? minTime : 0,
      maxSampleTime: Number.isFinite(maxTime) ? maxTime : 0,
    };
  }, [probeData]);

  const clampViewEndTime = useCallback(
    (nextEndTime: number) => {
      const minEnd = sampleBounds.minSampleTime + timeWindowSec;
      const maxEnd = Math.max(sampleBounds.maxSampleTime, minEnd);
      return Math.min(maxEnd, Math.max(minEnd, nextEndTime));
    },
    [sampleBounds, timeWindowSec]
  );

  const handlePauseScrollToggle = () => {
    togglePauseScroll();
  };

  const handleFollowNow = () => {
    setPauseScroll(false);
    setViewEndTime(getCurrentTime());
  };

  const handleScopeWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!pauseScroll) return;
    if (sampleBounds.maxSampleTime <= 0) return;
    e.preventDefault();
    const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    const secondsPerPixel = timeWindowSec / canvasDimensions.width;
    const shiftSeconds = delta * secondsPerPixel * 10;
    setViewEndTime((prev) => clampViewEndTime(prev + shiftSeconds));
  };

  const handleCanvasHover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const currentTime = getCurrentTime();
    const windowEndTime = pauseScroll ? viewEndTime : currentTime;
    const hover = getOscilloscopeHoverInfo({
      x,
      y,
      width: canvasDimensions.width,
      height: canvasDimensions.height,
      timeScale: timeWindowSec,
      voltageScale,
      windowEndTime,
      probes,
      probeData,
    });

    setHoverInfo(hover);
  };

  const handleCanvasLeave = () => {
    setHoverInfo(null);
  };

  // Canvas click for cursor
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Calculate time from click position
    const currentTime = getCurrentTime();
    const windowEndTime = pauseScroll ? viewEndTime : currentTime;
    const timeOffset = ((canvasDimensions.width - x) / canvasDimensions.width) * timeWindowSec;
    const clickedTime = windowEndTime - timeOffset;

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
        timeWindowSec,
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
    <div className="h-full flex bg-gray-900 text-white overflow-hidden">
      {/* Main oscilloscope display */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="border-b border-gray-700 px-3 py-1.5 flex items-center gap-2 text-xs bg-gray-850 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-gray-500 text-xs">Time:</label>
            <select
              value={timeWindowSec}
              onChange={(e) => setTimeWindowSec(Number(e.target.value))}
              className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-xs"
              title="Time window"
            >
              <option value={1}>1s</option>
              <option value={2}>2s</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-gray-500 text-xs">V:</label>
            <select
              value={voltageScale}
              onChange={(e) => setVoltageScale(Number(e.target.value))}
              className="px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-xs"
              title="Voltage scale"
            >
              <option value={0.5}>0.5</option>
              <option value={1}>1</option>
              <option value={1.5}>1.5</option>
            </select>
          </div>

          <div className="w-px h-4 bg-gray-600" />

          <button
            onClick={requestClear}
            className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
          >
            Clear
          </button>

          <button
            onClick={handlePauseScrollToggle}
            className={`px-2 py-0.5 rounded text-xs border ${
              pauseScroll
                ? 'bg-cyan-700/20 border-cyan-500 text-cyan-200'
                : 'bg-gray-700 hover:bg-gray-600 border-gray-600'
            }`}
            title="Pause scroll (keeps simulation running)"
          >
            Pause Scroll
          </button>
          {pauseScroll && (
            <button
              onClick={handleFollowNow}
              className="px-2 py-0.5 rounded text-xs border border-gray-600 bg-gray-700 hover:bg-gray-600"
              title="Return to live"
              type="button"
            >
              Follow Now
            </button>
          )}

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="w-3 h-3"
            />
            <span className="text-gray-400 text-xs">Grid</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoProbeEnabled}
              onChange={(e) => setAutoProbeEnabled(e.target.checked)}
              className="w-3 h-3"
            />
            <span className="text-gray-400 text-xs">Auto</span>
          </label>

          <button
            onClick={exportAsCSV}
            disabled={probeData.size === 0}
            className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            title="Export as CSV"
          >
            CSV
          </button>

          <button
            onClick={exportAsJSON}
            disabled={probeData.size === 0}
            className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed text-xs"
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
              <span className="text-gray-400">Tick:</span>
              <span className="font-mono text-purple-300">{tickEngine.getTickCount()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">TickRate:</span>
              <span className="font-mono text-purple-300">{tickEngine.getTickRate()}Hz</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Samples:</span>
              <span className="font-mono text-cyan-300">{totalSamples}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Rate:</span>
              <span className="font-mono text-cyan-300">{1000 / SAMPLE_INTERVAL}Hz</span>
            </div>
            {(() => {
              const traceRecorder = tickEngine.getTraceRecorder();
              const stats = traceRecorder?.getStats();
              if (stats && stats.totalTicks > 0) {
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Ticks:</span>
                    <span className="font-mono text-purple-300">{stats.totalTicks}</span>
                  </div>
                );
              }
              return null;
            })()}
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
        <div ref={canvasContainerRef} className="flex-1 flex items-center justify-center bg-gray-950 p-2 relative overflow-hidden">
          <div
            className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-gray-900/80 border border-gray-700 rounded px-2 py-1 text-[10px]"
            data-testid="scope-micro-toolbar"
          >
            <button
              onClick={handlePauseScrollToggle}
              className={`px-1.5 py-0.5 rounded border ${
                pauseScroll
                  ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
                  : 'border-gray-600 text-gray-300 hover:bg-gray-700/60'
              }`}
              title="Pause scroll (keeps simulation running)"
              type="button"
            >
              P
            </button>
            {pauseScroll && (
              <button
                onClick={handleFollowNow}
                className="px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-700/60"
                title="Return to live"
                type="button"
              >
                L
              </button>
            )}
            <button
              onClick={requestClear}
              className="px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-700/60"
              title="Clear scope"
              type="button"
            >
              C
            </button>
            <button
              onClick={toggleTimeCursor}
              className={`px-1.5 py-0.5 rounded border ${
                showTimeCursor
                  ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
                  : 'border-gray-600 text-gray-300 hover:bg-gray-700/60'
              }`}
              title="Toggle time cursor"
              type="button"
            >
              T
            </button>
            <button
              onClick={() => setShowTickGuides(!showTickGuides)}
              className={`px-1.5 py-0.5 rounded border ${
                showTickGuides
                  ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
                  : 'border-gray-600 text-gray-300 hover:bg-gray-700/60'
              }`}
              title="Toggle tick guides"
              type="button"
            >
              K
            </button>
            <span className="px-1 text-gray-400">
              {pauseScroll ? 'Paused Scroll' : 'Live'}
            </span>
            {onHelp && (
              <button
                onClick={onHelp}
                className="px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-700/60"
                title="Scope controls"
                type="button"
              >
                ?
              </button>
            )}
          </div>
          {/* Interaction hints when no probes */}
          {probes.length === 0 && showHints && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="bg-gray-800/90 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 space-y-2 max-w-sm pointer-events-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-white">📊 Oscilloscope</div>
                  {onDismissHints && (
                    <button
                      onClick={onDismissHints}
                      className="text-gray-500 hover:text-gray-300 transition-colors"
                      title="Dismiss hints"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div><span className="text-cyan-400">Add probes →</span> Monitor signals over time</div>
                <div><span className="text-cyan-400">Auto-Probe:</span> Auto-add selected nodes</div>
                <div><span className="text-cyan-400">Click canvas:</span> Place cursor</div>
                <div><span className="text-cyan-400">Shift+Click:</span> Add 2nd cursor for Δt</div>
                <div><span className="text-cyan-400">Run circuit:</span> See waveforms</div>
                <div className="pt-2 border-t border-gray-700 text-gray-500">
                  Enable Auto-Probe, then select nodes in other views!
                </div>
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasHover}
            onMouseLeave={handleCanvasLeave}
            onWheel={handleScopeWheel}
            className="cursor-crosshair border border-gray-700 rounded"
            data-testid="oscilloscope-canvas"
            data-pause-scroll={pauseScroll ? 'on' : 'off'}
            data-view-end-time={viewEndTime.toFixed(4)}
            data-now-time={getCurrentTime().toFixed(4)}
            data-total-samples={totalSamples}
          />
          {hoverInfo && (
            <div
              className="absolute z-20 pointer-events-none bg-gray-900/90 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200"
              style={{
                left: Math.min(hoverInfo.x + 12, canvasDimensions.width - 140),
                top: Math.max(6, Math.min(hoverInfo.y - 12, canvasDimensions.height - 40)),
              }}
            >
              <div className="font-mono" style={{ color: hoverInfo.color }}>
                {hoverInfo.label}
              </div>
              <div className="text-gray-400">
                t={hoverInfo.time.toFixed(3)}s, v={hoverInfo.value}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar - Probes */}
      <div className="w-64 border-l border-gray-700 flex flex-col bg-gray-850 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-700 shrink-0">
          <h3 className="text-sm font-semibold text-cyan-400">📊 Probes</h3>
          <div className="text-[10px] text-gray-500 mt-0.5">Monitor signal values</div>

          {/* Add probe section */}
          <div className="space-y-1.5">
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs"
              title="Select node to probe"
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
              placeholder="Port (e.g., 'output')"
              className="w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs"
            />

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
        </div>

        {/* Active probes list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {probes.length === 0 ? (
            <p className="text-gray-500 text-xs text-center mt-4">
              No probes.
              <br />
              Add a probe above.
            </p>
          ) : (
            <div className="space-y-1.5">
              {probes.map((probe) => {
                const nodeExists = circuit.nodes.some((n) => n.id === probe.nodeId);
                return (
                  <div
                    key={probe.id}
                    className={`p-2 rounded border transition-colors ${
                      probe.id === activeProbeId
                        ? 'border-cyan-500/70 bg-cyan-900/20'
                        : nodeExists
                        ? 'border-gray-700 bg-gray-800 hover:bg-gray-800/80'
                        : 'border-yellow-700/50 bg-yellow-900/10 hover:bg-yellow-900/20'
                    }`}
                    onClick={() => setActiveProbe(probe.id)}
                  >
                    <div className="flex items-start gap-1.5 mb-1">
                      <div
                        className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0"
                        style={{ backgroundColor: probe.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate flex items-center gap-1">
                          {probe.label}
                          {!nodeExists && (
                            <span className="text-yellow-500 text-[10px]" title="Node not found in circuit">
                              ⚠
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {probe.nodeId.slice(0, 10)}
                        </div>
                      </div>
                    <button
                      onClick={() => handleRemoveProbe(probe.id)}
                      className="text-gray-400 hover:text-red-400 text-sm leading-none"
                      title="Remove probe"
                    >
                      ×
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={probe.enabled}
                        onChange={() => handleToggleProbe(probe.id)}
                        className="w-3 h-3"
                      />
                      <span className="text-gray-400">On</span>
                    </label>

                    <div className="flex-1" />

                    <div className="text-[10px] text-gray-500">
                      {probeData.get(probe.id)?.samples.length ?? 0}
                    </div>
                  </div>

                  {/* Signal measurements */}
                  {probeData.get(probe.id)?.measurements && (
                    <div className="mt-1 pt-1 border-t border-gray-700 space-y-0.5 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Freq:</span>
                        <span className="font-mono text-gray-300">
                          {probeData.get(probe.id)?.measurements?.frequency?.toFixed(2) ?? '-'}Hz
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Period:</span>
                        <span className="font-mono text-gray-300">
                          {probeData.get(probe.id)?.measurements?.period?.toFixed(3) ?? '-'}s
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Duty:</span>
                        <span className="font-mono text-gray-300">
                          {probeData.get(probe.id)?.measurements?.dutyCycle?.toFixed(1) ?? '-'}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
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
