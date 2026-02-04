import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import BoardPanel from '../components/BoardPanel';
import { toast } from '@redbyte/rb-primitives';
import { BoardIOPanel } from '../components/BoardIOPanel';
import { CompareView } from '../components/CompareView';
import { CircuitCanvas } from '../components/boards/CircuitCanvas'; // TODO: Remove if unused, but keeping type safely
import { SplitViewLayout } from '../components/SplitViewLayout';
import { CircuitEngine, TickEngine } from '@redbyte/rb-logic-core';
import { useUnifiedProjectStore } from '@redbyte/rb-lab-engine';
import { getAvailableSignals } from '@redbyte/rb-lab-engine/src/signals/signalSemantics';
import { useViewStateStore } from '../stores/viewStateStore';
import { useLabStore } from '../labs/labStore';
import { getSignalMap } from '../labs/signalMap';
import { getSimSnapshot, useSimStore, setSimInput } from '../labs/simAdapter';
import { EXPERIMENTS, DEFAULT_EXPERIMENT } from '../labs/experiments';
import { validateTrace } from '../hardware/traceFormat';
import { loadTraceFromFS, saveCapsuleToFS, loadCapsuleFromFS } from '../utils/traceFileUtils';
import { createCapsule } from '../hardware/capsuleFormat';
// Consolidate imports
import { vectorRunner } from '../labs/vectorRunner';
import { synthesizableVerilogFromNetlist } from '../export/verilogExport';
import { useHardwareStore } from '../stores/hardwareStore';
import { netlistFromCircuit } from '../export/netlistExport';
import { LabInstructions } from '../labs/LabInstructions';
import { InspectorPanel } from '../labs/InspectorPanel';
import { LABS } from '../labs/labContent';
// Checking imports... line 88 of LogicPlayground had it. Let's check ECELabApp imports.
// It seems exportEvidence is not imported. I'll add the import.
import { exportEvidenceCapsule } from '../utils/evidenceExport'; // Wait, checking available utils.
import { useRenderStormDetector } from '../hooks/useRenderStormDetector';
// Board selector dropdown
const BoardSelector = ({ value, onChange }) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[9px] font-bold tracking-wider text-gray-600", children: "BOARD" }), _jsxs("select", { value: value, onChange: (e) => onChange(e.target.value), "aria-label": "Select board", className: "bg-transparent text-[10px] font-mono text-cyan-400 border-none outline-none cursor-pointer", style: { textShadow: '0 0 8px rgba(0, 212, 255, 0.5)' }, children: [_jsx("option", { value: "basys3", children: "Basys3" }), _jsx("option", { value: "spartan3e-starter", children: "Spartan-3E" })] })] }));
// Vector Runner View component
const VectorRunnerView = ({ mode, presets }) => {
    const [results, setResults] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [selectedSuiteId, setSelectedSuiteId] = useState(presets?.[0]?.id || '');
    // Default loopback if no presets
    const loopbackVectors = [
        { id: 'v1', name: 'All Off', inputs: { SW: 0 }, expected: { LED: 0 } },
        { id: 'v2', name: 'SW0 On', inputs: { SW: 1 }, expected: { LED: 1 } },
        { id: 'v3', name: 'SW15 On', inputs: { SW: 0x8000 }, expected: { LED: 0x8000 } },
        { id: 'v4', name: 'All On', inputs: { SW: 0xFFFF }, expected: { LED: 0xFFFF } },
    ];
    const activeVectors = useMemo(() => {
        if (!presets || presets.length === 0)
            return loopbackVectors;
        const suite = presets.find(s => s.id === selectedSuiteId) || presets[0];
        if (!suite)
            return loopbackVectors;
        return suite.presets.map((p, idx) => ({
            id: `t${idx + 1}`,
            name: p.name,
            inputs: Object.entries(p.inputs).reduce((acc, [k, v]) => {
                acc[k] = typeof v === 'string' ? parseInt(v.replace(/_/g, ''), 2) : v;
                return acc;
            }, {}),
            expected: Object.entries(p.expectedOutputs).reduce((acc, [k, v]) => {
                acc[k] = typeof v === 'string' ? parseInt(v.replace(/_/g, ''), 2) : v;
                return acc;
            }, {}),
            holdTicks: p.holdTicks
        }));
    }, [presets, selectedSuiteId]);
    const setSelfCheckResults = useLabStore(s => s.setSelfCheckResults);
    const setPass = useLabStore(s => s.setPass);
    const handleRun = async () => {
        setIsRunning(true);
        setResults([]); // Clear previous
        try {
            // Run vectors
            const finalResults = await vectorRunner.runVectors(activeVectors, {
                mode,
                delayMs: 200,
                onUpdate: (latest) => setResults([...latest]),
            });
            // Analyze results
            const allPassed = finalResults.every(r => r.status === 'PASS');
            setPass(allPassed);
            if (allPassed) {
                toast.success({ message: 'Self-check passed! Ready for verification.', title: 'Verification Success' });
            }
            else {
                toast.warning({ message: 'Some checks failed. Review vector results.', title: 'Verification Failed' });
            }
            // Log to evidence (if using presets)
            if (selectedSuiteId && presets?.some(p => p.id === selectedSuiteId)) {
                setSelfCheckResults({
                    suiteId: selectedSuiteId,
                    passed: allPassed,
                    timestamp: new Date().toISOString(),
                    vectors: finalResults.map(r => ({
                        id: r.vectorId,
                        status: r.status,
                        error: r.error,
                        actual: r.actual
                    }))
                });
            }
        }
        finally {
            setIsRunning(false);
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-full p-4 overflow-auto custom-scrollbar", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { className: "flex flex-col", children: [_jsx("h3", { className: "text-[10px] font-black tracking-widest text-cyan-500 uppercase", children: "Vector Runner" }), presets && presets.length > 0 && (_jsx("select", { value: selectedSuiteId, onChange: (e) => setSelectedSuiteId(e.target.value), className: "mt-1 bg-black/40 text-[10px] text-gray-300 border border-gray-700 rounded", "aria-label": "Select test vector suite", children: presets.map(s => _jsx("option", { value: s.id, children: s.title }, s.id)) }))] }), _jsx("button", { type: "button", onClick: handleRun, disabled: isRunning, className: `px-4 py-1.5 rounded text-[10px] font-bold tracking-wider transition-all ${isRunning
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'}`, children: isRunning ? 'RUNNING...' : 'RUN VECTORS' })] }), _jsx("div", { className: "space-y-2", children: results.length === 0 ? (_jsx("div", { className: "text-[10px] text-gray-600 text-center py-8 border border-dashed border-gray-800 rounded", children: "No results yet. Click \"RUN VECTORS\" to start." })) : (results.map((r) => (_jsxs("div", { className: `p-2 rounded border flex items-center justify-between transition-all ${r.status === 'PASS' ? 'bg-green-500/10 border-green-500/20' :
                        r.status === 'FAIL' ? 'bg-red-500/10 border-red-500/20' :
                            r.status === 'RUNNING' ? 'bg-cyan-500/10 border-cyan-500/30 animate-pulse' :
                                'bg-gray-950/50 border-gray-800'}`, children: [_jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "text-[9px] font-bold text-gray-400 uppercase", children: r.vectorId }), _jsx("span", { className: "text-[10px] text-gray-200", children: activeVectors.find(v => v.id === r.vectorId)?.name || 'Unknown' })] }), _jsxs("div", { className: "flex items-center gap-4", children: [r.error && (_jsx("span", { className: "text-[8px] text-red-400 font-mono truncate max-w-[150px]", title: r.error, children: r.error })), _jsx("span", { className: `text-[10px] font-black ${r.status === 'PASS' ? 'text-green-400' :
                                        r.status === 'FAIL' ? 'text-red-400' :
                                            r.status === 'RUNNING' ? 'text-cyan-400' :
                                                'text-gray-600'}`, children: r.status })] })] }, r.vectorId)))) }), results.length > 0 && !isRunning && (_jsxs("div", { className: "mt-6 p-3 rounded bg-gray-950 border border-gray-900 border-l-2 border-l-cyan-500", children: [_jsx("div", { className: "text-[9px] font-bold text-gray-500 mb-1 uppercase", children: "Summary" }), _jsxs("div", { className: "flex gap-4", children: [_jsxs("div", { className: "text-[10px]", children: [_jsx("span", { className: "text-gray-500", children: "TOTAL:" }), " ", _jsx("span", { className: "text-gray-200", children: results.length })] }), _jsxs("div", { className: "text-[10px]", children: [_jsx("span", { className: "text-green-500", children: "PASS:" }), " ", _jsx("span", { className: "text-green-400", children: results.filter(r => r.status === 'PASS').length })] }), _jsxs("div", { className: "text-[10px]", children: [_jsx("span", { className: "text-red-500", children: "FAIL:" }), " ", _jsx("span", { className: "text-red-400", children: results.filter(r => r.status === 'FAIL').length })] })] })] }))] }));
};
export const ECELabAppComponent = ({ windowId, labId }) => {
    useRenderStormDetector('ECELabAppComponent');
    const [mode, setMode] = useState(labId ? 'guided-lab' : 'sim-only');
    const [executionSource, setExecutionSource] = useState('sim');
    const [rightTab, setRightTab] = useState('board');
    const [selectedBoard, setSelectedBoard] = useState('basys3');
    const [showStartGuide, setShowStartGuide] = useState(!labId);
    // Lab Management
    const setActiveLab = useLabStore((s) => s.setActiveLab);
    const { activeLabId, startLab, activeLabState, currentStepIndex, // Added for onboarding hint
    completeStep, setHardwareVerified, isDirty, setIsDirty, } = useLabStore();
    // Data Safety: Warn on exit
    React.useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);
    // Mark dirty on meaningful interaction
    const handleCircuitChange = React.useCallback(() => {
        if (!isDirty)
            setIsDirty(true);
    }, [isDirty, setIsDirty]);
    // Auto-save (Every 30s)
    React.useEffect(() => {
        const interval = setInterval(() => {
            if (isDirty) {
                // Persist to localStorage
                const saveState = {
                    labId,
                    stepIndex: useLabStore.getState().currentStepIndex,
                    timestamp: Date.now()
                };
                localStorage.setItem('rb-lab-autosave', JSON.stringify(saveState));
                setIsDirty(false);
                toast.info({ message: 'Progress saved automatically.', title: 'Auto-Save', duration: 2000 });
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [isDirty, setIsDirty, labId]);
    // Hardware Store
    const hardwareConnect = useHardwareStore(s => s.connect);
    const hardwareConnectionState = useHardwareStore(s => s.connectionState);
    const hardwareSnapshot = useHardwareStore(s => s.ioSnapshot);
    const handleDownloadSynthesisPack = async () => {
        if (!circuit.nodes.length) {
            alert("Circuit is empty!");
            return;
        }
        try {
            const netlist = netlistFromCircuit(circuit);
            const verilog = synthesizableVerilogFromNetlist(netlist, { board: 'basys3', includeClock: true });
            const zip = new JSZip();
            zip.file("top.v", verilog.topModule);
            zip.file("rb_primitives.v", verilog.primitivesLibrary);
            zip.file("basys3.xdc", verilog.constraintsXdc);
            zip.file("instructions.txt", `RedByte Manual Synthesis Instructions:

1. Create a new Vivado Project (RTL Project).
2. Select target part: xc7a35tcpg236-1 (Basys 3).
3. Add the following source files:
   - top.v
   - rb_primitives.v
4. Add constraints file:
   - basys3.xdc
5. Run Synthesis, Implementation, and Generate Bitstream.
6. Open Hardware Manager and program the device.
`);
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "lab_synthesis_pack.zip";
            a.click();
            a.click();
            URL.revokeObjectURL(url);
            toast.success({ message: 'Synthesis pack generated successfully.', title: 'Download Started' });
        }
        catch (e) {
            console.error("Export failed", e);
            // alert("Failed to generate synthesis pack. See console.");
            toast.error({ message: 'Failed to generate synthesis pack.', title: 'Export Error' });
        }
    };
    useEffect(() => {
        if (labId) {
            setActiveLab(labId);
            // Ensure mode switches to guided lab if ID is provided
            setMode('guided-lab');
        }
    }, [labId, setActiveLab]);
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
        if (!simAutoRun)
            return;
        const interval = setInterval(simRunTick, 100);
        return () => clearInterval(interval);
    }, [simAutoRun, simRunTick]);
    // Update sim board when selection changes
    useEffect(() => {
        setSimBoard?.(selectedBoard);
    }, [selectedBoard, setSimBoard]);
    // Comparison state
    const [checks, setChecks] = useState([]);
    // --- ENGINE INTEGRATION (New for SplitViewLayout) ---
    const [circuit, setCircuit] = useState(() => ({ nodes: [], connections: [] }));
    const [engine] = useState(() => new CircuitEngine({ nodes: [], connections: [] }));
    const [tickEngine] = useState(() => new TickEngine({ nodes: [], connections: [] }, { tickRate: 10 }));
    const unifiedProject = useUnifiedProjectStore((s) => s.currentProject);
    const updateUnifiedProject = useUnifiedProjectStore((s) => s.updateProject);
    const hasHydratedRef = useRef(false);
    const [ioTick, setIoTick] = useState(0);
    const [ioOutputStates, setIoOutputStates] = useState({});
    const fromCircuitV1 = useCallback((src) => {
        return {
            nodes: src.nodes.map((node) => ({
                id: node.id,
                type: node.type,
                x: node.x,
                y: node.y,
                rotation: node.rotation,
                config: node.params || {},
                label: node.label,
                state: node.state || {},
                inputs: {},
                outputs: {},
            })),
            connections: src.connections.map((conn) => ({
                id: conn.id,
                from: conn.fromNodeId,
                fromPin: conn.fromPin,
                to: conn.toNodeId,
                toPin: conn.toPin,
            })),
        };
    }, []);
    const toCircuitV1 = useCallback((src) => {
        return {
            schemaVersion: '1.0',
            nodes: src.nodes.map((node) => ({
                id: node.id,
                type: node.type,
                x: node.x || 0,
                y: node.y || 0,
                rotation: node.rotation || 0,
                params: node.config || {},
                label: node.label,
                state: node.state || {},
            })),
            connections: src.connections.map((conn) => ({
                id: conn.id,
                fromNodeId: conn.from,
                fromPin: conn.fromPin || 'out',
                toNodeId: conn.to,
                toPin: conn.toPin || 'in',
            })),
            customChips: [],
        };
    }, []);
    useEffect(() => {
        if (!unifiedProject || hasHydratedRef.current)
            return;
        if (unifiedProject.circuit.nodes.length === 0 && unifiedProject.circuit.connections.length === 0)
            return;
        const loaded = fromCircuitV1(unifiedProject.circuit);
        setCircuit(loaded);
        hasHydratedRef.current = true;
    }, [unifiedProject, fromCircuitV1]);
    useEffect(() => {
        if (!unifiedProject)
            return;
        if (!hasHydratedRef.current && circuit.nodes.length === 0 && circuit.connections.length === 0)
            return;
        const projectSignature = JSON.stringify(unifiedProject.circuit);
        const circuitSignature = JSON.stringify(toCircuitV1(circuit));
        if (projectSignature === circuitSignature) {
            return;
        }
        updateUnifiedProject((project) => ({
            ...project,
            circuit: toCircuitV1(circuit),
        }));
    }, [circuit, unifiedProject, updateUnifiedProject, toCircuitV1]);
    const ioMapping = unifiedProject?.ioMapping;
    const availableSignals = useMemo(() => {
        if (!unifiedProject)
            return { inputs: [], outputs: [] };
        return getAvailableSignals(unifiedProject);
    }, [unifiedProject]);
    const virtualIOState = unifiedProject?.boardMap?.virtualIOState ?? { switches: [], buttons: [] };
    // NOTE: resolveInputValue must be defined BEFORE ioInputStates useMemo that uses it
    const resolveInputValue = useCallback((pin) => {
        if (!pin)
            return false;
        if (pin.startsWith('SW')) {
            const idx = parseInt(pin.slice(2), 10);
            return Boolean(virtualIOState.switches[idx]);
        }
        if (pin.startsWith('BTN')) {
            const idx = parseInt(pin.slice(3), 10);
            return Boolean(virtualIOState.buttons[idx]);
        }
        return false;
    }, [virtualIOState.buttons, virtualIOState.switches]);
    const ioInputStates = useMemo(() => {
        if (!ioMapping)
            return {};
        const next = {};
        ioMapping.inputs.forEach((entry) => {
            next[entry.id] = resolveInputValue(entry.pin);
        });
        return next;
    }, [ioMapping, resolveInputValue]);
    const handleInitializeIoMapping = useCallback(() => {
        if (!unifiedProject)
            return;
        if (availableSignals.inputs.length === 0 && availableSignals.outputs.length === 0)
            return;
        updateUnifiedProject((project) => {
            if (project.ioMapping && (project.ioMapping.inputs.length > 0 || project.ioMapping.outputs.length > 0)) {
                return project;
            }
            const inputEntries = availableSignals.inputs.map((sig) => ({
                id: `in:${sig.id}`,
                nodeId: sig.id,
                port: 'out',
                label: sig.label,
            }));
            const outputEntries = availableSignals.outputs.map((sig) => ({
                id: `out:${sig.id}`,
                nodeId: sig.id,
                port: 'out',
                label: sig.label,
            }));
            return {
                ...project,
                ioMapping: {
                    inputs: inputEntries,
                    outputs: outputEntries,
                },
            };
        });
    }, [availableSignals.inputs, availableSignals.outputs, unifiedProject, updateUnifiedProject]);
    const handleAssignPin = useCallback((entry, pin) => {
        if (!unifiedProject)
            return;
        updateUnifiedProject((project) => {
            const current = project.ioMapping ?? { inputs: [], outputs: [] };
            const updateEntry = (item) => item.id === entry.id ? { ...item, pin: pin || undefined } : item;
            const inputs = current.inputs.map(updateEntry);
            const outputs = current.outputs.map(updateEntry);
            const signalKey = entry.label || entry.nodeId || entry.id;
            const signalToPinMap = { ...(project.boardMap?.signalToPinMap ?? {}) };
            if (pin) {
                signalToPinMap[signalKey] = pin;
            }
            else {
                delete signalToPinMap[signalKey];
            }
            const boardMap = {
                boardProfileId: project.boardMap?.boardProfileId || 'basys3',
                signalToPinMap,
                virtualIOState: project.boardMap?.virtualIOState || { switches: [], buttons: [] },
            };
            return {
                ...project,
                ioMapping: { inputs, outputs },
                boardMap,
            };
        });
    }, [unifiedProject, updateUnifiedProject]);
    const handleToggleInput = useCallback((entry) => {
        if (!unifiedProject)
            return;
        const nextValue = !resolveInputValue(entry.pin);
        updateUnifiedProject((project) => {
            const boardMap = project.boardMap ?? {
                boardProfileId: 'basys3',
                signalToPinMap: {},
                virtualIOState: { switches: [], buttons: [] },
            };
            const switches = [...(boardMap.virtualIOState?.switches ?? [])];
            const buttons = [...(boardMap.virtualIOState?.buttons ?? [])];
            if (entry.pin?.startsWith('SW')) {
                const idx = parseInt(entry.pin.slice(2), 10);
                if (!Number.isNaN(idx))
                    switches[idx] = nextValue;
            }
            if (entry.pin?.startsWith('BTN')) {
                const idx = parseInt(entry.pin.slice(3), 10);
                if (!Number.isNaN(idx))
                    buttons[idx] = nextValue;
            }
            return {
                ...project,
                boardMap: {
                    ...boardMap,
                    virtualIOState: { switches, buttons },
                },
            };
        });
        const prevState = engine.getNodeState(entry.nodeId) || {};
        engine.setNodeState(entry.nodeId, { ...prevState, isOn: nextValue });
        engine.tick();
        setIoTick((t) => t + 1);
    }, [engine, resolveInputValue, unifiedProject, updateUnifiedProject]);
    useEffect(() => {
        if (!ioMapping)
            return;
        try {
            const signals = engine.getAllSignals();
            const nextOutputs = {};
            ioMapping.outputs.forEach((entry) => {
                const key = `${entry.nodeId}.${entry.port}`;
                const value = signals.get(key);
                nextOutputs[entry.id] = Boolean(value);
            });
            setIoOutputStates(nextOutputs);
        }
        catch {
            setIoOutputStates({});
        }
    }, [engine, ioMapping, ioTick, circuit]);
    // Initialize engines
    useEffect(() => {
        engine.setCircuit(circuit);
        tickEngine.setCircuit(circuit);
    }, [circuit, engine, tickEngine]);
    // Sync SimStore Inputs -> Engine (if interacting with BoardPanel)
    useEffect(() => {
        // Find any IO nodes or Board nodes and update them based on SimInputs
        // For now, we assume direct wiring or a "Sim Board" node is present.
        // If logic playground uses specific nodes for IO, we map them here.
        // NOTE: This basic implementation assumes 'standard' IO nodes for now.
        // Real implementation would find 'fpga-basys3' node.
    }, [simInputs]);
    // Sync Engine Outputs -> SimStore (for BoardPanel visualization)
    useEffect(() => {
        if (!executionSource)
            return;
        const interval = setInterval(() => {
            if (executionSource === 'sim') {
                const tick = tickEngine.getTickCount();
                // Extract outputs (Hypothetically from engine nodes)
                // const newOutputs = ...
                // For now, we let the legacy SimAdapter loop handle 'computational' experiments
                // BUT if user is building custom circuits, we need to extract outputs here.
            }
        }, 50);
        return () => clearInterval(interval);
    }, [executionSource, tickEngine]);
    // Trace / Replay
    const isRecording = useHardwareStore((s) => s.isRecording);
    const traceBuffer = useHardwareStore((s) => s.traceBuffer);
    const recordingStartTick = useHardwareStore((s) => s.recordingStartTick);
    const startRecording = useHardwareStore((s) => s.startRecording);
    const stopRecording = useHardwareStore((s) => s.stopRecording);
    const [replayTrace, setReplayTrace] = useState(null);
    const [replayIndex, setReplayIndex] = useState(0);
    // Replay loader with validation + user feedback (NO auto-switch)
    useEffect(() => {
        const handleReplayLoad = (e) => {
            const trace = e.detail;
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
    const effectiveSnapshot = executionSource === 'replay' && replayTrace ? replayTrace.samples[replayIndex] ?? null :
        executionSource === 'hardware' ? ioSnapshot :
            simSnapshot; // 'sim' fallback
    // Capabilities come from source if possible, else current board selection
    const effectiveCapabilities = executionSource === 'sim' ? simCapabilities : capabilities;
    const safeSimInputs = useMemo(() => ({
        SW: typeof (simInputs?.SW) === 'number' ? simInputs.SW : parseInt(String(simInputs?.SW ?? '0'), 2),
        BTN: typeof (simInputs?.BTN) === 'number' ? simInputs.BTN : parseInt(String(simInputs?.BTN ?? '0'), 2),
    }), [simInputs]);
    const safeSimOutputs = useMemo(() => ({
        LED: typeof (simOutputs?.LED) === 'number' ? simOutputs.LED : parseInt(String(simOutputs?.LED ?? '0'), 2),
        SEG: typeof (simOutputs?.SEG) === 'number' ? simOutputs.SEG : parseInt(String(simOutputs?.SEG ?? '0'), 2),
        AN: typeof (simOutputs?.AN) === 'number' ? simOutputs.AN : parseInt(String(simOutputs?.AN ?? '0'), 2),
        DP: typeof (simOutputs?.DP) === 'number' ? simOutputs.DP : parseInt(String(simOutputs?.DP ?? '0'), 2),
    }), [simOutputs]);
    const displayInputs = useMemo(() => {
        if (executionSource === 'sim')
            return safeSimInputs;
        const src = effectiveSnapshot?.inputs;
        return {
            SW: typeof (src?.SW) === 'number' ? src.SW : safeSimInputs.SW,
            BTN: typeof (src?.BTN) === 'number' ? src.BTN : safeSimInputs.BTN,
        };
    }, [executionSource, effectiveSnapshot, safeSimInputs]);
    const displayOutputs = useMemo(() => {
        if (executionSource === 'sim')
            return safeSimOutputs;
        const src = effectiveSnapshot?.outputs;
        return {
            LED: typeof (src?.LED) === 'number' ? src.LED : safeSimOutputs.LED,
            SEG: typeof (src?.SEG) === 'number' ? src.SEG : safeSimOutputs.SEG,
            AN: typeof (src?.AN) === 'number' ? src.AN : safeSimOutputs.AN,
            DP: typeof (src?.DP) === 'number' ? src.DP : safeSimOutputs.DP,
        };
    }, [executionSource, effectiveSnapshot, safeSimOutputs]);
    // Current experiment (fallback to default to avoid empty canvas)
    const currentExperiment = EXPERIMENTS[activeExperimentId] ?? DEFAULT_EXPERIMENT;
    useEffect(() => {
        if (!EXPERIMENTS[activeExperimentId]) {
            setSimExperiment(DEFAULT_EXPERIMENT.id);
        }
    }, [activeExperimentId, setSimExperiment]);
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
                        if (!ok) {
                            console.error('Save failed');
                            toast.error({ message: 'Failed to save evidence capsule.', title: 'Export Error' });
                        }
                        else {
                            toast.success({ message: 'Lab evidence exported successfully.', title: 'Export Complete' });
                        }
                    });
                }
            }
        }
        else {
            setReplayTrace(null);
            startRecording();
        }
    };
    const handleLoadTrace = async () => {
        const name = window.prompt('Load trace/capsule filename:', 'trace.json');
        if (!name)
            return;
        // Try loading as capsule first
        const capsule = await loadCapsuleFromFS(name);
        if (capsule && capsule.trace) {
            if (import.meta.env.DEV)
                console.log('Loaded capsule:', capsule);
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
        if (rightTab !== 'compare')
            return;
        const boardId = effectiveCapabilities?.boardId || 'unknown';
        const map = getSignalMap(boardId);
        const sim = getSimSnapshot();
        const newChecks = [];
        for (const [signalName, hwLoc] of Object.entries(map)) {
            let expected = '-';
            if (sim) {
                let groupVal;
                if (hwLoc.group === 'SW' || hwLoc.group === 'BTN') {
                    groupVal = sim.inputs[hwLoc.group];
                }
                else {
                    groupVal = sim.outputs[hwLoc.group];
                }
                if (groupVal !== undefined) {
                    const intVal = typeof groupVal === 'number' ? groupVal : parseInt(groupVal || '0', 2);
                    expected = (intVal >> hwLoc.bit) & 1;
                }
            }
            let observed = '-';
            if (effectiveSnapshot) {
                if (hwLoc.group === 'SW') {
                    const swVal = effectiveSnapshot.inputs.SW;
                    const swInt = typeof swVal === 'number' ? swVal : parseInt(swVal || '0', 2);
                    observed = (swInt >> hwLoc.bit) & 1;
                }
                else if (hwLoc.group === 'BTN') {
                    const btnVal = effectiveSnapshot.inputs.BTN ?? 0;
                    const btnInt = typeof btnVal === 'number' ? btnVal : parseInt(btnVal || '0', 2);
                    observed = (btnInt >> hwLoc.bit) & 1;
                }
                else if (hwLoc.group === 'LED') {
                    const ledVal = effectiveSnapshot.outputs.LED;
                    const ledInt = typeof ledVal === 'number' ? ledVal : parseInt(ledVal || '0', 2);
                    observed = (ledInt >> hwLoc.bit) & 1;
                }
            }
            const pass = expected !== undefined && observed !== '-' && String(expected) === String(observed);
            newChecks.push({ signalName, expected: expected ?? '-', observed, pass });
        }
        setChecks(newChecks);
    }, [rightTab, effectiveSnapshot, effectiveCapabilities, replayTrace]);
    return (_jsxs("div", { className: "flex flex-col h-full bg-gradient-to-b from-gray-950 to-black font-mono", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-2 bg-gradient-to-b from-gray-900 to-black border-b border-gray-800", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded flex items-center justify-center", style: {
                                            background: 'linear-gradient(135deg, #1a3a2a 0%, #0a2a1a 100%)',
                                            border: '1px solid #2a4a3a',
                                            boxShadow: '0 0 10px rgba(0, 255, 136, 0.2)',
                                        }, children: _jsx("span", { className: "text-lg", style: { filter: 'drop-shadow(0 0 4px rgba(0,255,136,0.5))' }, children: "\u26A1" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-xs font-black tracking-widest text-gray-300", children: "ECE LAB" }), _jsx("div", { className: "text-[8px] tracking-wider text-gray-600", children: "FPGA DEVELOPMENT" })] })] }), _jsx("div", { className: "flex rounded-lg overflow-hidden border border-[#1a2a3a] bg-[#0a1018]", children: ['sim', 'hardware', 'replay'].map((src) => {
                                    // @ts-ignore
                                    const isBrowserDemo = typeof window !== 'undefined' && !window.electron;
                                    const isActive = executionSource === src;
                                    const color = src === 'sim' ? '#00ff88' : src === 'hardware' ? '#00d4ff' : '#ffaa00';
                                    const isReplayUnavailable = src === 'replay' && !replayTrace;
                                    const isHardwareUnavailable = src === 'hardware' && isBrowserDemo;
                                    const hasReplayReady = src === 'replay' && replayTrace && executionSource !== 'replay';
                                    const disabled = isReplayUnavailable || isHardwareUnavailable;
                                    const title = isReplayUnavailable
                                        ? 'No capsule loaded — use LOAD to import'
                                        : isHardwareUnavailable
                                            ? 'Hardware unavailable in Browser Demo. Install Local OS.'
                                            : undefined;
                                    return (_jsxs("button", { onClick: () => {
                                            if (disabled)
                                                return;
                                            setExecutionSource(src);
                                        }, title: title, className: "px-3 py-1 text-[10px] font-bold tracking-wider transition-all relative", style: {
                                            background: isActive ? `${color}15` : 'transparent',
                                            color: disabled ? '#2a3a4a' : isActive ? color : '#4a5a6a',
                                            borderRight: '1px solid #1a2a3a',
                                            textShadow: isActive ? `0 0 10px ${color}66` : 'none',
                                            cursor: disabled ? 'not-allowed' : 'pointer',
                                        }, children: [src.toUpperCase(), hasReplayReady && (_jsx("span", { className: "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse" }))] }, src));
                                }) }), _jsx("div", { className: "flex rounded-lg overflow-hidden", style: {
                                    background: '#0a1018',
                                    border: '1px solid #1a2a3a',
                                }, children: ['sim-only', 'board-connected', 'guided-lab', 'inspector'].map((m) => {
                                    const labels = {
                                        'sim-only': { text: 'SIMULATE', color: '#00ff88' },
                                        'board-connected': { text: 'HARDWARE', color: '#00d4ff' },
                                        'guided-lab': { text: 'LAB', color: '#aa88ff' },
                                        'inspector': { text: 'INSPECT', color: '#ffaa00' },
                                    };
                                    const { text, color } = labels[m];
                                    const isActive = mode === m;
                                    return (_jsx("button", { type: "button", onClick: () => setMode(m), className: "px-3 py-1.5 text-[10px] font-bold tracking-wider transition-all", style: {
                                            background: isActive ? `${color}15` : 'transparent',
                                            color: isActive ? color : '#4a5a6a',
                                            borderRight: '1px solid #1a2a3a',
                                            textShadow: isActive ? `0 0 10px ${color}66` : 'none',
                                        }, children: text }, m));
                                }) }), executionSource === 'sim' && mode === 'sim-only' && (_jsx(BoardSelector, { value: selectedBoard, onChange: setSelectedBoard }))] }), _jsx("div", { className: "flex items-center gap-4", children: _jsxs("div", { className: "flex items-center gap-2 px-2 py-1 rounded", style: {
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid #1a2a3a',
                            }, children: [replayTrace && executionSource !== 'replay' && (_jsx("button", { type: "button", onClick: () => setExecutionSource('replay'), className: "flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider animate-pulse", style: {
                                        background: 'rgba(255, 170, 0, 0.15)',
                                        color: '#ffaa00',
                                        border: '1px solid rgba(255, 170, 0, 0.3)',
                                    }, children: "\u25B6 SWITCH TO REPLAY" })), !replayTrace ? (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", onClick: handleToggleRecording, className: "flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider transition-all", style: {
                                                background: isRecording ? '#3a1a1a' : 'transparent',
                                                color: isRecording ? '#ff4444' : '#4a5a6a',
                                                border: isRecording ? '1px solid #4a2a2a' : '1px solid transparent',
                                            }, children: [_jsx("span", { className: `w-2 h-2 rounded-full ${isRecording ? 'animate-pulse' : ''}`, style: { background: isRecording ? '#ff4444' : '#3a3a3a' } }), isRecording ? 'STOP' : 'REC'] }), isRecording && (_jsxs("span", { className: "text-[9px] font-mono text-gray-600", children: [recordingStartTick > 0 ? simTick - recordingStartTick : 0, " ticks"] })), _jsx("button", { type: "button", onClick: () => {
                                                const filename = `lab_submission_${new Date().toISOString().replace(/[:.]/g, '-')}`;
                                                exportEvidenceCapsule(filename).then(ok => {
                                                    if (ok) {
                                                        // Optional: toast or alert
                                                    }
                                                    else {
                                                        alert('Export failed. See console.');
                                                    }
                                                });
                                            }, className: "flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold tracking-wider hover:bg-white/10 transition-all border border-transparent hover:border-white/20", style: { color: '#e4e4e7' }, children: "EXPORT" }), _jsxs("span", { className: "text-[9px] text-gray-600 font-mono", children: [traceBuffer.length, " samples"] }), !isRecording && (_jsx("button", { type: "button", onClick: handleLoadTrace, className: "text-[10px] font-bold text-gray-600 hover:text-gray-400 tracking-wider", children: "LOAD" }))] })) : (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[10px] font-bold text-indigo-400", children: "REPLAY" }), _jsx("input", { type: "range", title: "Scrub replay", min: 0, max: Math.max(0, replayTrace.samples.length - 1), value: replayIndex, onChange: (e) => setReplayIndex(Number(e.target.value)), className: "w-20 h-1 appearance-none cursor-pointer", style: { background: '#2a3a4a' } }), _jsxs("span", { className: "text-[9px] font-mono text-gray-600", children: [replayIndex, "/", replayTrace.samples.length] }), _jsx("button", { type: "button", onClick: () => setReplayTrace(null), className: "text-gray-600 hover:text-white text-xs", children: "\u00D7" })] })), _jsx("div", { className: "px-2 py-0.5 rounded text-[9px] font-bold tracking-wider", style: {
                                        background: mode === 'sim-only' ? 'rgba(0,255,136,0.1)' : 'rgba(0,212,255,0.1)',
                                        color: mode === 'sim-only' ? '#00ff88' : '#00d4ff',
                                        border: `1px solid ${mode === 'sim-only' ? '#00ff8833' : '#00d4ff33'}`,
                                    }, children: executionSource === 'sim' ? 'SIMULATION' : executionSource === 'hardware' ? 'LIVE HARDWARE' : 'REPLAY' })] }) }), showStartGuide && (_jsxs("div", { className: "bg-[#0a1520] border-b border-[#1a2a3a] px-4 py-2 flex items-center justify-between animate-fade-in relative z-10", children: [_jsxs("div", { className: "flex items-center gap-6 text-[10px] font-medium text-gray-400", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-5 h-5 rounded-full bg-cyan-900/30 text-cyan-400 flex items-center justify-center font-bold text-xs ring-1 ring-cyan-500/20", children: "1" }), _jsx("span", { children: "Select Source (Sim / Hardware)" })] }), _jsx("div", { className: "w-px h-4 bg-[#1a2a3a]" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-5 h-5 rounded-full bg-cyan-900/30 text-cyan-400 flex items-center justify-center font-bold text-xs ring-1 ring-cyan-500/20", children: "2" }), _jsx("span", { children: "Choose Experiment or Lab" })] }), _jsx("div", { className: "w-px h-4 bg-[#1a2a3a]" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-5 h-5 rounded-full bg-cyan-900/30 text-cyan-400 flex items-center justify-center font-bold text-xs ring-1 ring-cyan-500/20", children: "3" }), _jsx("span", { children: "Interact & Capture Evidence" })] })] }), _jsx("button", { onClick: () => setShowStartGuide(false), className: "text-gray-600 hover:text-gray-300 text-xs px-2", children: "\u2715" })] })), _jsx("div", { className: "flex-1 flex overflow-hidden", children: _jsx("div", { className: "flex-1 flex flex-col relative", style: {
                                borderRight: '1px solid #1a2a3a',
                            }, children: mode === 'guided-lab' ? (_jsx(LabInstructions, {})) : mode === 'inspector' ? (_jsx(InspectorPanel, {})) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: `flex items-center justify-between px-4 py-2 transition-opacity ${executionSource !== 'sim' ? 'opacity-50 pointer-events-none grayscale' : ''}`, style: {
                                            background: 'linear-gradient(180deg, #0a1520 0%, #080f18 100%)',
                                            borderBottom: '1px solid #1a2a3a',
                                        }, children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[9px] font-bold tracking-wider text-gray-600", children: "EXPERIMENT" }), currentStepIndex === 1 && (_jsxs("div", { className: "flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded animate-pulse", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-cyan-400" }), _jsx("span", { className: "text-[9px] font-bold text-cyan-400", children: "START HERE" })] }))] }), _jsx("select", { value: activeExperimentId, onChange: (e) => setSimExperiment(e.target.value), "aria-label": "Select experiment", className: "bg-transparent text-xs font-medium text-gray-300 border-none outline-none cursor-pointer", children: Object.values(EXPERIMENTS).map((exp) => (_jsx("option", { value: exp.id, className: "bg-gray-900", children: exp.name }, exp.id))) })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { type: "button", onClick: simRunTick, disabled: simAutoRun, className: "px-2 py-1 text-[10px] font-bold tracking-wider rounded transition-all disabled:opacity-30", style: {
                                                                    background: '#1a2a3a',
                                                                    color: '#8899aa',
                                                                    border: '1px solid #2a3a4a',
                                                                }, children: "STEP" }), _jsx("button", { type: "button", onClick: () => setSimAutoRun(!simAutoRun), className: "px-2 py-1 text-[10px] font-bold tracking-wider rounded transition-all", style: {
                                                                    background: simAutoRun ? 'rgba(0,255,136,0.15)' : '#1a2a3a',
                                                                    color: simAutoRun ? '#00ff88' : '#8899aa',
                                                                    border: simAutoRun ? '1px solid #00ff8833' : '1px solid #2a3a4a',
                                                                }, children: simAutoRun ? 'RUNNING' : 'RUN' }), _jsx("button", { type: "button", onClick: simReset, className: "px-2 py-1 text-[10px] font-bold tracking-wider rounded transition-all", style: {
                                                                    background: '#1a2a3a',
                                                                    color: '#8899aa',
                                                                    border: '1px solid #2a3a4a',
                                                                }, children: "RESET" })] }), _jsxs("div", { className: "px-2 py-0.5 rounded font-mono text-[10px]", style: {
                                                            background: 'rgba(0,0,0,0.3)',
                                                            color: '#00d4ff',
                                                            border: '1px solid #1a3a4a',
                                                        }, children: ["T:", simSnapshot.tick] })] })] }), _jsxs("div", { className: "flex-1 relative overflow-hidden bg-gray-950", children: [currentExperiment ? (
                                            /* Legacy Experiment Mode: Use Static Canvas for 'canned' experiments */
                                            _jsxs("div", { className: "absolute inset-0 flex flex-col", children: [_jsx(CircuitCanvas, { experiment: currentExperiment, inputs: displayInputs, outputs: displayOutputs, tick: simSnapshot.tick }), _jsx("div", { className: "absolute top-2 left-2 px-2 py-1 bg-gray-900/80 text-[10px] text-cyan-500 border border-cyan-500/30 rounded pointer-events-none", children: "PRE-BUILT EXPERIMENT" })] })) : (
                                            /* Interactive Mode: SplitViewLayout */
                                            /* Interactive Mode: SplitViewLayout */
                                            _jsxs("div", { className: "absolute inset-0", children: [_jsx(SplitViewLayout, { mode: "single", views: ['circuit'], engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: simAutoRun, tickCount: simSnapshot.tick, onCircuitChange: (newCircuit) => {
                                                            setCircuit(newCircuit);
                                                            engine.setCircuit(newCircuit);
                                                            tickEngine.setCircuit(newCircuit);
                                                        }, viewStateStore: useViewStateStore, 
                                                        // Connect simulation inputs if handling standard nodes
                                                        onInputToggled: (nodeId, port, val) => {
                                                            // forward to engine (using setNodeState for built-in nodes)
                                                            // Logic Core uses 'isOn' for Switch/Input state
                                                            engine.setNodeState(nodeId, { isOn: val });
                                                            engine.tick();
                                                        } }), circuit.nodes.length === 0 && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none", children: _jsxs("div", { className: "bg-[#0a1520] border border-[#1a2a3a] p-6 rounded-lg shadow-2xl text-center pointer-events-auto max-w-sm", children: [_jsx("h3", { className: "text-sm font-bold text-gray-200 mb-2", children: "Empty Circuit" }), _jsx("p", { className: "text-xs text-gray-400 mb-6", children: "Start by building a circuit or load a template to begin testing." }), _jsx("button", { type: "button", onClick: () => {
                                                                        // Create simple starter: Switch -> LED
                                                                        const starter = {
                                                                            nodes: [
                                                                                { id: 'sw0', type: 'switch', position: { x: 100, y: 100 }, state: { isOn: 0 }, config: { label: 'SW0' }, rotation: 0 },
                                                                                { id: 'led0', type: 'lamp', position: { x: 300, y: 100 }, state: { isOn: 0 }, config: { label: 'LED0', color: 'red' }, rotation: 0 }
                                                                            ],
                                                                            connections: [
                                                                                { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'led0', portName: 'in' } }
                                                                            ]
                                                                        };
                                                                        setCircuit(starter);
                                                                        engine.setCircuit(starter);
                                                                        tickEngine.setCircuit(starter);
                                                                    }, className: "bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2 rounded transition-colors w-full mb-3", children: "LOAD STARTER CIRCUIT" })] }) }))] })), currentExperiment && (_jsxs("div", { className: "absolute bottom-4 left-4 right-4 px-4 py-2 rounded pointer-events-none", style: {
                                                    background: 'rgba(0,0,0,0.7)',
                                                    backdropFilter: 'blur(8px)',
                                                    border: '1px solid #1a2a3a',
                                                }, children: [_jsx("div", { className: "text-[10px] font-bold tracking-wider text-gray-500 mb-1", children: currentExperiment?.name.toUpperCase() }), _jsx("div", { className: "text-xs text-gray-400", children: currentExperiment?.description })] }))] })] })) }) }), _jsxs("div", { className: "w-[480px] flex flex-col bg-gradient-to-b from-gray-900 to-black", children: [_jsx("div", { className: "flex bg-gray-900 border-b border-gray-800", children: ['board', 'compare', 'test'].map((tab) => {
                                    const isActive = rightTab === tab;
                                    const labels = { board: 'HARDWARE', compare: 'COMPARE', test: 'TEST' };
                                    const color = tab === 'board' ? '#00d4ff' : tab === 'compare' ? '#aa88ff' : '#00ff88';
                                    return (_jsx("button", { type: "button", onClick: () => setRightTab(tab), className: "flex-1 py-2 text-[10px] font-bold tracking-wider transition-all", style: {
                                            background: isActive ? `${color}10` : 'transparent',
                                            color: isActive ? color : '#4a5a6a',
                                            borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
                                            textShadow: isActive ? `0 0 10px ${color}66` : 'none',
                                        }, children: labels[tab] }, tab));
                                }) }), _jsx("div", { className: "flex-1 overflow-hidden", children: rightTab === 'board' ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 bg-black border-b border-gray-800", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${hardwareConnectionState === 'ready' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                                                                hardwareConnectionState === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                                                                    'bg-red-500'}` }), _jsx("span", { className: "text-[10px] font-bold text-gray-400", children: hardwareConnectionState === 'ready' ? 'CONNECTED' :
                                                                hardwareConnectionState === 'connecting' ? 'CONNECTING...' : 'DISCONNECTED' }), hardwareConnectionState !== 'ready' && (_jsx("button", { onClick: hardwareConnect, className: "text-[10px] text-cyan-500 hover:text-cyan-400 ml-2 font-bold", children: "CONNECT" }))] }), _jsx("button", { onClick: handleDownloadSynthesisPack, className: "flex items-center gap-1.5 px-2 py-1 bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-500/30 rounded text-[10px] font-bold transition-all", title: "Download Manual Synthesis Pack", children: "SYNTH PACK" })] }), hardwareConnectionState === 'ready' && (_jsxs("div", { className: "flex items-center gap-2 px-3 py-1 bg-gray-900 border-b border-gray-800", children: [_jsx("input", { type: "checkbox", id: "flashed-toggle", className: "rounded border-gray-600 bg-[#040608] text-cyan-500 focus:ring-0 focus:ring-offset-0", onChange: (e) => {
                                                        if (e.target.checked) {
                                                            setExecutionSource('hardware');
                                                            toast.info({
                                                                message: 'Hardware Mode Active',
                                                                title: 'Live IO enabled. Run self-check to verify.',
                                                                duration: 4000
                                                            });
                                                        }
                                                        else {
                                                            setExecutionSource('sim');
                                                        }
                                                    }, checked: executionSource === 'hardware' }), _jsxs("label", { htmlFor: "flashed-toggle", className: "text-[10px] text-gray-400 select-none cursor-pointer", children: ["I have flashed the board", executionSource === 'hardware' && _jsx("span", { className: "text-cyan-500 ml-1", children: "(Live IO Active)" })] }), executionSource === 'hardware' && (_jsx("div", { className: "flex-1 flex justify-end", children: _jsx("button", { onClick: () => {
                                                            setExecutionSource('hardware');
                                                            setRightTab('test');
                                                        }, className: "text-[9px] px-1.5 py-0.5 bg-green-900/30 text-green-400 border border-green-500/30 rounded font-mono hover:bg-green-900/50", title: "Run automated verification on hardware before exporting", children: "RUN SELF-CHECK" }) }))] })), _jsx(BoardIOPanel, { ioMapping: ioMapping ?? { inputs: [], outputs: [] }, 
                                            // Use hardware snapshot if in hardware mode and connected
                                            inputStates: executionSource === 'hardware' && hardwareSnapshot ?
                                                hardwareSnapshot.inputs
                                                : ioInputStates, outputStates: executionSource === 'hardware' && hardwareSnapshot ?
                                                hardwareSnapshot.outputs
                                                : ioOutputStates, onToggleInput: handleToggleInput, availableSignals: availableSignals, onInitializeMapping: handleInitializeIoMapping, onAssignPin: handleAssignPin }), _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(BoardPanel, { snapshot: effectiveSnapshot, capabilities: effectiveCapabilities, onInteraction: executionSource === 'sim' ? setSimInput : undefined, readOnly: executionSource === 'replay', executionSource: executionSource }) })] })) : rightTab === 'compare' ? (_jsx(CompareView, { ioSnapshot: effectiveSnapshot, checks: checks })) : (_jsx(VectorRunnerView, { mode: executionSource === 'sim' ? 'sim' : 'hardware', presets: LABS[activeLabId || '']?.presets })) })] })] }), _jsxs("div", { className: "flex items-center justify-between px-4 py-1 text-[9px] font-mono bg-black border-t border-gray-800", children: [_jsxs("div", { className: "flex items-center gap-4 text-gray-600", children: [_jsx("span", { children: "ECE 347 Lab Environment" }), _jsx("span", { children: "|" }), _jsx("span", { children: effectiveCapabilities?.boardName || 'No Board' })] }), _jsxs("div", { className: "flex items-center gap-4 text-gray-600", children: [_jsx("span", { children: new Date().toLocaleTimeString() }), _jsx("span", { className: "text-cyan-600", children: "v2.0.0" })] })] })] }));
};
