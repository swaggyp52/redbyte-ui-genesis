import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useViewStateStore } from '../stores/viewStateStore';
import { useProbeStore } from '../stores/probeStore';
import { useOscilloscopeStore } from '../stores/oscilloscopeStore';
import { mark, measure, trackRender } from '@redbyte/rb-utils';
import { calculateMeasurements, } from '../utils/signalMeasurements';
import { getOscilloscopeHoverInfo } from '../utils/oscilloscopeHover';
const MAX_SAMPLES = 500; // Maximum samples to keep in buffer
const SAMPLE_INTERVAL = 50; // ms between samples (20 Hz)
export const OscilloscopeView = ({ engine, tickEngine, circuit, isRunning, width = 800, height = 600, showHints = true, onDismissHints, onHelp, debugTick, }) => {
    trackRender('OscilloscopeView');
    const canvasRef = useRef(null);
    const canvasContainerRef = useRef(null);
    const pendingDrawRef = useRef(null);
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 600 });
    const probes = useProbeStore((state) => state.probes);
    const activeProbeId = useProbeStore((state) => state.activeProbeId);
    const addProbe = useProbeStore((state) => state.addProbe);
    const removeProbe = useProbeStore((state) => state.removeProbe);
    const toggleProbe = useProbeStore((state) => state.toggleProbe);
    const setActiveProbe = useProbeStore((state) => state.setActiveProbe);
    const [probeData, setProbeData] = useState(new Map());
    const [voltageScale, setVoltageScale] = useState(1.5); // vertical scale
    const [viewEndTime, setViewEndTime] = useState(0);
    // Trigger configuration
    const [triggerConfig, setTriggerConfig] = useState({
        enabled: false,
        probeId: null,
        type: 'edge',
        edge: 'rising',
        level: 0.5,
        holdOff: 0,
    });
    // Cursors
    const [cursors, setCursors] = useState([]);
    const [showGrid, setShowGrid] = useState(true);
    const [selectedNodeId, setSelectedNodeId] = useState('');
    const [selectedPortName, setSelectedPortName] = useState('out');
    const [hoverInfo, setHoverInfo] = useState(null);
    // Clock tracking
    const [totalSamples, setTotalSamples] = useState(0);
    const [measurementUpdateCounter, setMeasurementUpdateCounter] = useState(0);
    const clockNode = useMemo(() => circuit.nodes.find((node) => node.type === 'Clock') ?? null, [circuit.nodes]);
    // QUARANTINE: Wall-clock time for UI display ONLY (not used in sampling)
    // Sampling is deterministic and derived from tick count only
    const startTimeRef = useRef(Date.now());
    const measurementUpdateRef = useRef(null);
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
    // QUARANTINE: UI-only wall-clock time display (not used in sampling logic)
    const getCurrentTime = useCallback(() => (Date.now() - startTimeRef.current) / 1000, []);
    useEffect(() => {
        pauseScrollRef.current = pauseScroll;
    }, [pauseScroll]);
    useEffect(() => {
        if (pauseScroll) {
            setViewEndTime((prev) => (prev === 0 ? getCurrentTime() : prev));
        }
        else {
            setViewEndTime(getCurrentTime());
        }
    }, [pauseScroll, getCurrentTime]);
    // Update canvas dimensions based on container size using ResizeObserver
    useEffect(() => {
        if (!canvasContainerRef.current)
            return;
        const updateDimensions = () => {
            if (canvasContainerRef.current) {
                const rect = canvasContainerRef.current.getBoundingClientRect();
                // Ensure non-zero dimensions to prevent canvas errors
                const width = Math.max(rect.width - 20, 100);
                const height = Math.max(rect.height - 20, 100);
                setCanvasDimensions(prev => {
                    if (prev.width === width && prev.height === height)
                        return prev;
                    return { width, height };
                });
            }
        };
        const observer = new ResizeObserver(() => {
            // Wrap in requestAnimationFrame to avoid "ResizeObserver loop limit exceeded"
            window.requestAnimationFrame(updateDimensions);
        });
        observer.observe(canvasContainerRef.current);
        // Initial measure
        updateDimensions();
        return () => observer.disconnect();
    }, []);
    // Auto-populate interesting nodes on initial load
    useEffect(() => {
        // Only run on initial load when probes are empty and circuit has nodes
        if (probes.length > 0 || circuit.nodes.length === 0)
            return;
        const initialProbes = [];
        // Priority order for auto-probing
        const priorityTypes = ['Clock', 'INPUT', 'PowerSource', 'Switch', 'OUTPUT', 'Lamp'];
        const probedNodes = new Set();
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
        if (!autoProbeEnabled)
            return;
        // Get currently probed node IDs
        const currentProbedNodeIds = new Set(probes.map((p) => p.nodeId));
        // Find newly selected nodes that aren't already probed
        const newlySelectedNodes = Array.from(selectedNodeIds).filter((nodeId) => !currentProbedNodeIds.has(nodeId));
        if (newlySelectedNodes.length === 0)
            return;
        // Add probes for newly selected nodes
        const newProbes = [];
        newlySelectedNodes.forEach((nodeId) => {
            const node = circuit.nodes.find((n) => n.id === nodeId);
            if (!node)
                return;
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
    // Sample signals from probes using TraceRecorder
    const sampleSignals = useCallback(() => {
        const traceRecorder = tickEngine.getTraceRecorder();
        if (!traceRecorder)
            return;
        const traces = traceRecorder.getAllTraces();
        if (traces.length === 0)
            return;
        setProbeData((prevData) => {
            const newData = new Map(prevData);
            probes.forEach((probe) => {
                if (!probe.enabled)
                    return;
                let data = newData.get(probe.id);
                if (!data) {
                    data = { probeId: probe.id, samples: [], measurements: null };
                    newData.set(probe.id, data);
                }
                // Get the signal key for this probe
                const signalKey = `${probe.nodeId}.${probe.portName}`;
                // Build samples from trace entries
                const newSamples = [];
                traces.forEach((trace) => {
                    const value = trace.signals.get(signalKey) ?? 0;
                    const timestamp = trace.tick / tickEngine.getTickRate(); // Convert tick to seconds
                    newSamples.push({ timestamp, value });
                });
                // Replace samples with trace data
                data.samples = newSamples;
                // Limit buffer size
                if (data.samples.length > MAX_SAMPLES) {
                    data.samples = data.samples.slice(-MAX_SAMPLES);
                }
            });
            // Update sample counter
            setTotalSamples(traces.length * probes.filter((p) => p.enabled).length);
            return newData;
        });
        if (!pauseScrollRef.current) {
            const latestTick = traces[traces.length - 1]?.tick ?? 0;
            setViewEndTime(latestTick / tickEngine.getTickRate());
        }
    }, [probes, tickEngine, pauseScrollRef]);
    // Poll TraceRecorder for updates
    useEffect(() => {
        const traceRecorder = tickEngine.getTraceRecorder();
        if (isRunning) {
            // Start trace recording if not already active
            if (!traceRecorder) {
                tickEngine.enableTracing(2000); // Keep last 2000 ticks
            }
            else if (!traceRecorder.isActive()) {
                traceRecorder.start();
            }
            // Reset UI display time when starting (does not affect sampling)
            startTimeRef.current = Date.now();
            setTotalSamples(0);
            setViewEndTime(0);
            // Poll trace data at 60fps (16ms interval)
            const pollInterval = window.setInterval(() => {
                sampleSignals();
            }, 16);
            // Start measurement updates (every 1 second)
            measurementUpdateRef.current = window.setInterval(() => {
                setMeasurementUpdateCounter((prev) => prev + 1);
            }, 1000);
            return () => {
                clearInterval(pollInterval);
                if (measurementUpdateRef.current) {
                    clearInterval(measurementUpdateRef.current);
                }
            };
        }
        else {
            // Stop measurement updates when paused
            if (measurementUpdateRef.current) {
                clearInterval(measurementUpdateRef.current);
                measurementUpdateRef.current = null;
            }
        }
    }, [isRunning, sampleSignals, tickEngine]);
    // Input changes are now captured by TraceRecorder automatically
    // No need for separate input-change sampling
    // Update measurements periodically
    useEffect(() => {
        if (!isRunning)
            return;
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
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
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
                    if (x < 0 || x > renderWidth)
                        continue;
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, renderHeight);
                    ctx.stroke();
                }
            }
        }
        // Draw waveforms
        probes.forEach((probe) => {
            if (!probe.enabled)
                return;
            const data = probeData.get(probe.id);
            if (!data || data.samples.length < 2)
                return;
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
                if (timeOffset > timeWindowSec)
                    return; // Sample too old
                const x = renderWidth - (timeOffset / timeWindowSec) * renderWidth;
                // Calculate y position (voltage axis)
                const y = renderHeight / 2 - (sample.value * voltageScale * renderHeight) / 4;
                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                    previousY = y;
                }
                else {
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
            if (!data || data.samples.length === 0)
                return;
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
            const nowCursorX = renderWidth - ((windowEndTime - nowCursorTime) / timeWindowSec) * renderWidth;
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
            const debugX = renderWidth - ((windowEndTime - debugTime) / timeWindowSec) * renderWidth;
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
            if (cursorX < 0 || cursorX > renderWidth)
                return; // Cursor off screen
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
        if (pendingDrawRef.current !== null)
            return;
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
        if (!selectedNodeId)
            return;
        const node = circuit.nodes.find((n) => n.id === selectedNodeId);
        if (!node)
            return;
        addProbe({
            nodeId: selectedNodeId,
            portName: selectedPortName,
            label: `${node.type}: ${selectedNodeId.substring(0, 8)}[${selectedPortName}]`,
        });
    };
    const handleAddClockProbe = () => {
        if (!clockNode)
            return;
        addProbe({
            nodeId: clockNode.id,
            portName: 'out',
            label: 'Clock out',
        });
    };
    // Remove probe
    const handleRemoveProbe = (probeId) => {
        removeProbe(probeId);
        setProbeData((prev) => {
            const newData = new Map(prev);
            newData.delete(probeId);
            return newData;
        });
    };
    // Toggle probe
    const handleToggleProbe = (probeId) => {
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
        if (clearRequestId === 0)
            return;
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
    const clampViewEndTime = useCallback((nextEndTime) => {
        const minEnd = sampleBounds.minSampleTime + timeWindowSec;
        const maxEnd = Math.max(sampleBounds.maxSampleTime, minEnd);
        return Math.min(maxEnd, Math.max(minEnd, nextEndTime));
    }, [sampleBounds, timeWindowSec]);
    const handlePauseScrollToggle = () => {
        togglePauseScroll();
    };
    const handleFollowNow = () => {
        setPauseScroll(false);
        setViewEndTime(getCurrentTime());
    };
    const handleScopeWheel = (e) => {
        if (!pauseScroll)
            return;
        if (sampleBounds.maxSampleTime <= 0)
            return;
        e.preventDefault();
        const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        const secondsPerPixel = timeWindowSec / canvasDimensions.width;
        const shiftSeconds = delta * secondsPerPixel * 10;
        setViewEndTime((prev) => clampViewEndTime(prev + shiftSeconds));
    };
    const handleCanvasHover = (e) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
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
    const handleCanvasClick = (e) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
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
        }
        else {
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
        if (probeData.size === 0)
            return;
        // Build CSV content
        const headers = ['Time (s)', ...probes.filter((p) => p.enabled).map((p) => p.label)];
        const rows = [headers];
        // Get all timestamps
        const allTimestamps = new Set();
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
        if (probeData.size === 0)
            return;
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
    return (_jsxs("div", { className: "h-full flex bg-gray-900 text-white overflow-hidden", children: [_jsxs("div", { className: "flex-1 flex flex-col min-w-0", children: [_jsxs("div", { className: "border-b border-gray-700 px-3 py-1.5 flex items-center gap-2 text-xs bg-gray-850 shrink-0 flex-wrap", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("label", { className: "text-gray-500 text-xs", children: "Time:" }), _jsxs("select", { value: timeWindowSec, onChange: (e) => setTimeWindowSec(Number(e.target.value)), className: "px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-xs", title: "Time window", children: [_jsx("option", { value: 1, children: "1s" }), _jsx("option", { value: 2, children: "2s" }), _jsx("option", { value: 5, children: "5s" }), _jsx("option", { value: 10, children: "10s" })] })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("label", { className: "text-gray-500 text-xs", children: "V:" }), _jsxs("select", { value: voltageScale, onChange: (e) => setVoltageScale(Number(e.target.value)), className: "px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-xs", title: "Voltage scale", children: [_jsx("option", { value: 0.5, children: "0.5" }), _jsx("option", { value: 1, children: "1" }), _jsx("option", { value: 1.5, children: "1.5" })] })] }), _jsx("div", { className: "w-px h-4 bg-gray-600" }), _jsx("button", { onClick: requestClear, className: "px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs", children: "Clear" }), _jsx("button", { onClick: handlePauseScrollToggle, className: `px-2 py-0.5 rounded text-xs border ${pauseScroll
                                    ? 'bg-cyan-700/20 border-cyan-500 text-cyan-200'
                                    : 'bg-gray-700 hover:bg-gray-600 border-gray-600'}`, title: "Pause scroll (keeps simulation running)", children: "Pause Scroll" }), pauseScroll && (_jsx("button", { onClick: handleFollowNow, className: "px-2 py-0.5 rounded text-xs border border-gray-600 bg-gray-700 hover:bg-gray-600", title: "Return to live", type: "button", children: "Follow Now" })), _jsxs("label", { className: "flex items-center gap-1.5 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: showGrid, onChange: (e) => setShowGrid(e.target.checked), className: "w-3 h-3" }), _jsx("span", { className: "text-gray-400 text-xs", children: "Grid" })] }), _jsxs("label", { className: "flex items-center gap-1.5 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: autoProbeEnabled, onChange: (e) => setAutoProbeEnabled(e.target.checked), className: "w-3 h-3" }), _jsx("span", { className: "text-gray-400 text-xs", children: "Auto" })] }), _jsx("button", { onClick: exportAsCSV, disabled: probeData.size === 0, className: "px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed text-xs", title: "Export as CSV", children: "CSV" }), _jsx("button", { onClick: exportAsJSON, disabled: probeData.size === 0, className: "px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed text-xs", title: "Export as JSON", children: "JSON" }), _jsx("div", { className: "flex-1" }), _jsxs("div", { className: "flex items-center gap-4 text-xs", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-gray-400", children: "Time:" }), _jsxs("span", { className: "font-mono text-cyan-300", children: [((Date.now() - startTimeRef.current) / 1000).toFixed(2), "s"] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-gray-400", children: "Tick:" }), _jsx("span", { className: "font-mono text-purple-300", children: tickEngine.getTickCount() })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-gray-400", children: "TickRate:" }), _jsxs("span", { className: "font-mono text-purple-300", children: [tickEngine.getTickRate(), "Hz"] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-gray-400", children: "Samples:" }), _jsx("span", { className: "font-mono text-cyan-300", children: totalSamples })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-gray-400", children: "Rate:" }), _jsxs("span", { className: "font-mono text-cyan-300", children: [1000 / SAMPLE_INTERVAL, "Hz"] })] }), (() => {
                                        const traceRecorder = tickEngine.getTraceRecorder();
                                        const stats = traceRecorder?.getStats();
                                        if (stats && stats.totalTicks > 0) {
                                            return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-gray-400", children: "Ticks:" }), _jsx("span", { className: "font-mono text-purple-300", children: stats.totalTicks })] }));
                                        }
                                        return null;
                                    })()] }), _jsx("div", { className: "w-px h-6 bg-gray-600" }), _jsx("div", { className: "text-gray-400 text-xs", children: isRunning ? (_jsx("span", { className: "text-green-400", children: "\u25CF Running" })) : (_jsx("span", { className: "text-gray-500", title: "Run the circuit to update waveforms", children: "\u25CB Paused (run to capture)" })) })] }), _jsxs("div", { ref: canvasContainerRef, className: "flex-1 flex items-center justify-center bg-gray-950 p-2 relative overflow-hidden", children: [_jsxs("div", { className: "absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-gray-900/80 border border-gray-700 rounded px-2 py-1 text-[10px]", "data-testid": "scope-micro-toolbar", children: [_jsx("button", { onClick: handlePauseScrollToggle, className: `px-1.5 py-0.5 rounded border ${pauseScroll
                                            ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
                                            : 'border-gray-600 text-gray-300 hover:bg-gray-700/60'}`, title: "Pause scroll (keeps simulation running)", type: "button", children: "P" }), pauseScroll && (_jsx("button", { onClick: handleFollowNow, className: "px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-700/60", title: "Return to live", type: "button", children: "L" })), _jsx("button", { onClick: requestClear, className: "px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-700/60", title: "Clear scope", type: "button", children: "C" }), _jsx("button", { onClick: toggleTimeCursor, className: `px-1.5 py-0.5 rounded border ${showTimeCursor
                                            ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
                                            : 'border-gray-600 text-gray-300 hover:bg-gray-700/60'}`, title: "Toggle time cursor", type: "button", children: "T" }), _jsx("button", { onClick: () => setShowTickGuides(!showTickGuides), className: `px-1.5 py-0.5 rounded border ${showTickGuides
                                            ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
                                            : 'border-gray-600 text-gray-300 hover:bg-gray-700/60'}`, title: "Toggle tick guides", type: "button", children: "K" }), _jsx("span", { className: "px-1 text-gray-400", children: pauseScroll ? 'Paused Scroll' : 'Live' }), onHelp && (_jsx("button", { onClick: onHelp, className: "px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-700/60", title: "Scope controls", type: "button", children: "?" }))] }), probes.length === 0 && showHints && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none z-10", children: _jsxs("div", { className: "bg-gray-800/90 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 space-y-2 max-w-sm pointer-events-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("div", { className: "font-semibold text-white", children: "\uD83D\uDCCA Oscilloscope" }), onDismissHints && (_jsx("button", { onClick: onDismissHints, className: "text-gray-500 hover:text-gray-300 transition-colors", title: "Dismiss hints", children: "\u2715" }))] }), _jsxs("div", { children: [_jsx("span", { className: "text-cyan-400", children: "Add probes \u2192" }), " Monitor signals over time"] }), _jsxs("div", { children: [_jsx("span", { className: "text-cyan-400", children: "Auto-Probe:" }), " Auto-add selected nodes"] }), _jsxs("div", { children: [_jsx("span", { className: "text-cyan-400", children: "Click canvas:" }), " Place cursor"] }), _jsxs("div", { children: [_jsx("span", { className: "text-cyan-400", children: "Shift+Click:" }), " Add 2nd cursor for \u0394t"] }), _jsxs("div", { children: [_jsx("span", { className: "text-cyan-400", children: "Run circuit:" }), " See waveforms"] }), _jsx("div", { className: "pt-2 border-t border-gray-700 text-gray-500", children: "Enable Auto-Probe, then select nodes in other views!" })] }) })), _jsx("canvas", { ref: canvasRef, width: canvasDimensions.width, height: canvasDimensions.height, onClick: handleCanvasClick, onMouseMove: handleCanvasHover, onMouseLeave: handleCanvasLeave, onWheel: handleScopeWheel, className: "cursor-crosshair border border-gray-700 rounded", "data-testid": "oscilloscope-canvas", "data-pause-scroll": pauseScroll ? 'on' : 'off', "data-view-end-time": viewEndTime.toFixed(4), "data-now-time": getCurrentTime().toFixed(4), "data-total-samples": totalSamples }), hoverInfo && (_jsxs("div", { className: "absolute z-20 pointer-events-none bg-gray-900/90 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200", style: {
                                    left: Math.min(hoverInfo.x + 12, canvasDimensions.width - 140),
                                    top: Math.max(6, Math.min(hoverInfo.y - 12, canvasDimensions.height - 40)),
                                }, children: [_jsx("div", { className: "font-mono", style: { color: hoverInfo.color }, children: hoverInfo.label }), _jsxs("div", { className: "text-gray-400", children: ["t=", hoverInfo.time.toFixed(3), "s, v=", hoverInfo.value] })] }))] })] }), _jsxs("div", { className: "w-64 border-l border-gray-700 flex flex-col bg-gray-850 overflow-hidden", children: [_jsxs("div", { className: "px-3 py-2 border-b border-gray-700 shrink-0", children: [_jsx("h3", { className: "text-sm font-semibold text-cyan-400", children: "\uD83D\uDCCA Probes" }), _jsx("div", { className: "text-[10px] text-gray-500 mt-0.5", children: "Monitor signal values" }), _jsxs("div", { className: "space-y-1.5", children: [_jsxs("select", { value: selectedNodeId, onChange: (e) => setSelectedNodeId(e.target.value), className: "w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs", title: "Select node to probe", children: [_jsx("option", { value: "", children: "Select node..." }), circuit.nodes.map((node) => (_jsxs("option", { value: node.id, children: [node.type, " (", node.id.slice(0, 8), ")"] }, node.id)))] }), _jsx("input", { type: "text", value: selectedPortName, onChange: (e) => setSelectedPortName(e.target.value), placeholder: "Port (e.g., 'output')", className: "w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs" }), _jsx("button", { onClick: handleAddProbe, disabled: !selectedNodeId, className: "w-full px-2 py-1 bg-cyan-700 hover:bg-cyan-600 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed", type: "button", children: "Add Probe" }), _jsx("button", { onClick: handleAddClockProbe, disabled: !clockNode, className: "w-full px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed", type: "button", children: "Add Clock Probe" })] })] }), _jsx("div", { className: "flex-1 overflow-y-auto px-3 py-2", children: probes.length === 0 ? (_jsxs("p", { className: "text-gray-500 text-xs text-center mt-4", children: ["No probes.", _jsx("br", {}), "Add a probe above."] })) : (_jsx("div", { className: "space-y-1.5", children: probes.map((probe) => {
                                const nodeExists = circuit.nodes.some((n) => n.id === probe.nodeId);
                                return (_jsxs("div", { className: `p-2 rounded border transition-colors ${probe.id === activeProbeId
                                        ? 'border-cyan-500/70 bg-cyan-900/20'
                                        : nodeExists
                                            ? 'border-gray-700 bg-gray-800 hover:bg-gray-800/80'
                                            : 'border-yellow-700/50 bg-yellow-900/10 hover:bg-yellow-900/20'}`, onClick: () => setActiveProbe(probe.id), children: [_jsxs("div", { className: "flex items-start gap-1.5 mb-1", children: [_jsx("div", { className: "w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0", style: { backgroundColor: probe.color } }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "text-xs font-medium truncate flex items-center gap-1", children: [probe.label, !nodeExists && (_jsx("span", { className: "text-yellow-500 text-[10px]", title: "Node not found in circuit", children: "\u26A0" }))] }), _jsx("div", { className: "text-[10px] text-gray-500 truncate", children: probe.nodeId.slice(0, 10) })] }), _jsx("button", { onClick: () => handleRemoveProbe(probe.id), className: "text-gray-400 hover:text-red-400 text-sm leading-none", title: "Remove probe", children: "\u00D7" })] }), _jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsxs("label", { className: "flex items-center gap-1 text-[10px] cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: probe.enabled, onChange: () => handleToggleProbe(probe.id), className: "w-3 h-3" }), _jsx("span", { className: "text-gray-400", children: "On" })] }), _jsx("div", { className: "flex-1" }), _jsx("div", { className: "text-[10px] text-gray-500", children: probeData.get(probe.id)?.samples.length ?? 0 })] }), probeData.get(probe.id)?.measurements && (_jsxs("div", { className: "mt-1 pt-1 border-t border-gray-700 space-y-0.5 text-[10px]", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-500", children: "Freq:" }), _jsxs("span", { className: "font-mono text-gray-300", children: [probeData.get(probe.id)?.measurements?.frequency?.toFixed(2) ?? '-', "Hz"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-500", children: "Period:" }), _jsxs("span", { className: "font-mono text-gray-300", children: [probeData.get(probe.id)?.measurements?.period?.toFixed(3) ?? '-', "s"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-500", children: "Duty:" }), _jsxs("span", { className: "font-mono text-gray-300", children: [probeData.get(probe.id)?.measurements?.dutyCycle?.toFixed(1) ?? '-', "%"] })] })] }))] }, probe.id));
                            }) })) }), cursors.length > 0 && (_jsxs("div", { className: "p-4 border-t border-gray-700 bg-gray-900", children: [_jsx("h4", { className: "text-sm font-semibold mb-2 text-yellow-400", children: "Cursor Measurements" }), _jsxs("div", { className: "space-y-2 text-xs", children: [cursors.map((cursor, index) => (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex justify-between", children: [_jsxs("span", { style: { color: cursor.color }, children: ["C", index + 1, " Time:"] }), _jsxs("span", { className: "font-mono", children: [cursor.time.toFixed(3), "s"] })] }), probes
                                                .filter((p) => p.enabled)
                                                .map((probe) => {
                                                const data = probeData.get(probe.id);
                                                if (!data || data.samples.length === 0)
                                                    return null;
                                                // Find closest sample to cursor
                                                const closestSample = data.samples.reduce((prev, curr) => Math.abs(curr.timestamp - cursor.time) <
                                                    Math.abs(prev.timestamp - cursor.time)
                                                    ? curr
                                                    : prev, data.samples[0]);
                                                return (_jsxs("div", { className: "flex justify-between pl-4", children: [_jsxs("span", { style: { color: probe.color }, children: [probe.label, ":"] }), _jsx("span", { className: "font-mono", children: closestSample?.value ?? '-' })] }, `${cursor.id}-${probe.id}`));
                                            })] }, cursor.id))), cursors.length === 2 && (_jsxs("div", { className: "mt-2 pt-2 border-t border-gray-700 space-y-1", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-green-400", children: "\u0394t:" }), _jsxs("span", { className: "font-mono", children: [Math.abs(cursors[1].time - cursors[0].time).toFixed(3), "s"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-green-400", children: "\u0394f:" }), _jsxs("span", { className: "font-mono", children: [(1 / Math.abs(cursors[1].time - cursors[0].time)).toFixed(2), "Hz"] })] })] }))] })] }))] })] }));
};
