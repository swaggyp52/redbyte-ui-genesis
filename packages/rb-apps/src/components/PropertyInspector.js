import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { REPLAY_LOCK_MESSAGE } from '../utils/replayLock';
import { useLogicViewStore } from '@redbyte/rb-logic-view';
import { useProbeStore } from '../stores/probeStore';
export const PropertyInspector = ({ circuit, engine, isRunning, isReplayMode = false, onNodeUpdate, onConnectionDelete, }) => {
    // Use shallow comparison to prevent re-renders when selection object reference changes but content is the same
    const selection = useLogicViewStore(useShallow((s) => s.selection));
    const addProbe = useProbeStore((s) => s.addProbe);
    const lockMessage = REPLAY_LOCK_MESSAGE;
    // Get selected nodes and connections
    const selectedNodes = useMemo(() => {
        if (!selection?.nodes)
            return [];
        return circuit.nodes.filter((n) => selection.nodes.has(n.id));
    }, [circuit.nodes, selection]);
    const selectedConnections = useMemo(() => {
        if (!selection?.wires)
            return [];
        return circuit.connections.filter((c) => {
            const id = `${c.from.nodeId}.${c.from.portName}->${c.to.nodeId}.${c.to.portName}`;
            return selection.wires.has(id);
        });
    }, [circuit.connections, selection]);
    // Get real-time signals for selected nodes
    const [nodeSignals, setNodeSignals] = React.useState(new Map());
    const [nodeInputs, setNodeInputs] = React.useState(new Map());
    const [analogUiState, setAnalogUiState] = React.useState({});
    const analogCommitTimerRef = React.useRef(null);
    React.useEffect(() => {
        if (!isRunning || selectedNodes.length === 0) {
            setNodeSignals(new Map());
            setNodeInputs(new Map());
            return;
        }
        const interval = setInterval(() => {
            const signals = new Map();
            const inputs = new Map();
            const allSignals = engine.getAllSignals();
            for (const node of selectedNodes) {
                signals.set(node.id, engine.getNodeOutputs(node.id));
                const inputValues = {};
                for (const connection of circuit.connections) {
                    if (connection.to.nodeId !== node.id)
                        continue;
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
    const handleConfigChange = (nodeId, configKey, value) => {
        const node = selectedNodes.find((n) => n.id === nodeId);
        if (!node || !onNodeUpdate || isReplayMode)
            return;
        onNodeUpdate(nodeId, {
            config: {
                ...node.config,
                [configKey]: value,
            },
        });
    };
    const handleStateChange = (nodeId, stateKey, value) => {
        const node = selectedNodes.find((n) => n.id === nodeId);
        if (!node || !onNodeUpdate || isReplayMode)
            return;
        onNodeUpdate(nodeId, {
            state: {
                ...(node.state ?? {}),
                [stateKey]: value,
            },
        });
    };
    const handleAnalogStateChange = (nodeId, stateKey, value) => {
        const node = selectedNodes.find((n) => n.id === nodeId);
        if (!node || isReplayMode)
            return;
        const nextAnalogState = { ...analogUiState, [stateKey]: value };
        setAnalogUiState(nextAnalogState);
        const engineState = engine.getNodeState(nodeId) ?? {};
        engine.setNodeState(nodeId, { ...engineState, [stateKey]: value });
        if (!onNodeUpdate)
            return;
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
    const handlePositionChange = (nodeId, x, y) => {
        if (!onNodeUpdate || isReplayMode)
            return;
        onNodeUpdate(nodeId, { position: { x, y } });
    };
    // Render nothing selected state
    if (selectedNodes.length === 0 && selectedConnections.length === 0) {
        return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "text-center py-8 text-gray-400", children: [_jsx("div", { className: "text-3xl mb-2", children: "\uD83D\uDC46" }), _jsx("div", { className: "text-sm", children: "Select a component" })] }), _jsxs("div", { className: "mt-auto p-3 border-t border-gray-700/50 bg-gray-800/30", children: [_jsx("div", { className: "text-xs font-semibold text-gray-400 mb-2", children: "Circuit" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { className: "bg-gray-800/50 rounded px-2 py-1.5", children: [_jsx("div", { className: "text-[10px] text-gray-500", children: "Components" }), _jsx("div", { className: "text-lg font-bold text-cyan-400", children: circuit.nodes.length })] }), _jsxs("div", { className: "bg-gray-800/50 rounded px-2 py-1.5", children: [_jsx("div", { className: "text-[10px] text-gray-500", children: "Wires" }), _jsx("div", { className: "text-lg font-bold text-purple-400", children: circuit.connections.length })] })] })] })] }));
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
        ].filter(Boolean);
        const analogPortsByType = {
            VoltageSource: { inputs: [], outputs: ['out'] },
            LDR: { inputs: [], outputs: ['resistance', 'v_out'] },
            FixedResistor: { inputs: [], outputs: ['resistance'] },
            VoltageDivider: { inputs: ['v_in', 'r1', 'r2'], outputs: ['v_out'] },
            LM358: { inputs: ['V_plus', 'V_minus'], outputs: ['out'] },
        };
        const analogPorts = analogPortsByType[node.type];
        return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden", children: [_jsxs("div", { className: "p-3 border-b border-gray-700/50 bg-gradient-to-br from-cyan-900/20 to-purple-900/20", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-cyan-400 animate-pulse" }), _jsx("div", { className: "text-xs font-semibold text-cyan-400", children: "SELECTED" })] }), _jsx("div", { className: "text-lg font-bold text-white", children: node.type }), _jsx("div", { className: "text-[10px] text-gray-400 font-mono truncate mt-1", children: node.id }), selectedNodes.length > 1 && (_jsxs("div", { className: "mt-2 text-xs bg-cyan-500/10 border border-cyan-500/30 rounded px-2 py-1 text-cyan-300", children: ["+", selectedNodes.length - 1, " more"] }))] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-3 space-y-3", children: [isRunning && Object.keys(signals).length > 0 && (_jsxs("div", { className: "bg-gradient-to-br from-green-900/20 to-cyan-900/20 rounded-lg p-3 border border-green-500/30", children: [_jsxs("div", { className: "text-xs font-semibold text-green-400 mb-2 flex items-center gap-1", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" }), "LIVE SIGNALS"] }), _jsx("div", { className: "space-y-1.5", children: Object.entries(signals).map(([port, signal]) => (_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "text-white text-sm font-medium", children: port }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => addProbe({
                                                            nodeId: node.id,
                                                            portName: port,
                                                            label: `${node.type} ${port}`,
                                                        }), className: "px-2 py-1 text-[10px] bg-gray-800/70 hover:bg-gray-700 rounded text-gray-200", type: "button", title: "Add probe to monitor this signal in Oscilloscope (press 4)", children: "Add Probe" }), _jsx("div", { className: `font-bold text-lg px-3 py-1 rounded-md transition-all ${signal === 1
                                                            ? 'bg-green-500/30 text-green-300 shadow-lg shadow-green-500/20 scale-110'
                                                            : 'bg-gray-700/50 text-gray-500 scale-100'}`, children: signal })] })] }, port))) })] })), analogControls.length > 0 && (_jsxs("div", { className: "bg-cyan-900/10 rounded-lg p-3 border border-cyan-500/20", children: [_jsx("div", { className: "text-xs font-semibold text-cyan-300 mb-2", children: "SIM INPUTS" }), _jsx("div", { className: "space-y-3", children: analogControls.map((control) => (_jsxs("div", { children: [_jsx("div", { className: "block text-gray-400 mb-1.5 text-xs", children: control.label }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "range", min: control.min, max: control.max, step: control.step, value: control.value, onChange: (e) => handleAnalogStateChange(node.id, control.key, parseFloat(e.target.value) || 0), className: "flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer", disabled: isReplayMode, title: isReplayMode ? lockMessage : undefined }), _jsx("input", { type: "number", min: control.min, max: control.max, step: control.step, value: control.value, onChange: (e) => handleAnalogStateChange(node.id, control.key, parseFloat(e.target.value) || 0), className: "w-20 px-2 py-1 bg-gray-800 rounded border border-gray-600 text-white text-sm font-mono", disabled: isReplayMode, title: isReplayMode ? lockMessage : undefined })] })] }, control.key))) })] })), isRunning && analogPorts && (analogPorts.inputs.length > 0 || analogPorts.outputs.length > 0) && (_jsxs("div", { className: "bg-slate-900/30 rounded-lg p-3 border border-slate-600/40", children: [_jsx("div", { className: "text-xs font-semibold text-slate-300 mb-2", children: "ANALOG READINGS" }), analogPorts.inputs.length > 0 && (_jsxs("div", { className: "mb-3", children: [_jsx("div", { className: "text-[10px] uppercase tracking-wide text-slate-400 mb-1", children: "Inputs" }), _jsx("div", { className: "space-y-1.5", children: analogPorts.inputs.map((port) => {
                                                const entry = inputSignals[port];
                                                const value = entry?.value ?? 0;
                                                return (_jsxs("div", { className: "flex items-center justify-between gap-2 text-sm", children: [_jsx("span", { className: "text-slate-200", children: port }), _jsx("span", { className: "text-slate-400 text-xs flex-1 truncate text-right", children: entry?.source ? `<- ${entry.source}` : 'unconnected' }), _jsx("span", { className: "text-slate-100 font-mono", children: value })] }, port));
                                            }) })] })), analogPorts.outputs.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "text-[10px] uppercase tracking-wide text-slate-400 mb-1", children: "Outputs" }), _jsx("div", { className: "space-y-1.5", children: analogPorts.outputs.map((port) => {
                                                const value = signals[port] ?? 0;
                                                return (_jsxs("div", { className: "flex items-center justify-between gap-2 text-sm", children: [_jsx("span", { className: "text-slate-200", children: port }), _jsx("span", { className: "text-slate-100 font-mono", children: value })] }, port));
                                            }) })] }))] })), node.config && Object.keys(node.config).length > 0 && (_jsxs("div", { className: "bg-gray-800/30 rounded-lg p-3 border border-gray-700/50", children: [_jsx("div", { className: "text-xs font-semibold text-gray-300 mb-3", children: "SETTINGS" }), _jsx("div", { className: "space-y-3", children: Object.entries(node.config).map(([key, value]) => {
                                        const labelText = key.replace(/([A-Z])/g, ' $1').trim() || 'Setting';
                                        return (_jsxs("div", { children: [_jsx("div", { className: "block text-gray-400 mb-1.5 text-xs capitalize", children: labelText }), typeof value === 'boolean' ? (_jsxs("label", { className: `flex items-center gap-3 bg-gray-800/50 rounded px-3 py-2 transition-colors ${isReplayMode ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-700/50'}`, title: isReplayMode ? lockMessage : undefined, children: [_jsx("span", { className: "sr-only", children: labelText }), _jsx("input", { type: "checkbox", checked: value, onChange: (e) => handleConfigChange(node.id, key, e.target.checked), className: "sr-only", disabled: isReplayMode }), _jsx("div", { className: `w-10 h-5 rounded-full transition-all ${value ? 'bg-cyan-500' : 'bg-gray-600'}`, children: _jsx("div", { className: `w-4 h-4 bg-white rounded-full mt-0.5 transition-transform ${value ? 'ml-5' : 'ml-0.5'}` }) }), _jsx("span", { className: "text-white text-sm font-medium", children: value ? 'Enabled' : 'Disabled' })] })) : typeof value === 'number' ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "range", min: "0", max: "100", value: value, onChange: (e) => handleConfigChange(node.id, key, parseFloat(e.target.value) || 0), className: "flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer", disabled: isReplayMode, title: isReplayMode ? lockMessage : undefined }), _jsx("input", { type: "number", value: value, onChange: (e) => handleConfigChange(node.id, key, parseFloat(e.target.value) || 0), className: "w-16 px-2 py-1 bg-gray-800 rounded border border-gray-600 text-white text-sm font-mono", disabled: isReplayMode, title: isReplayMode ? lockMessage : undefined })] })) : (_jsx("input", { type: "text", value: String(value), onChange: (e) => handleConfigChange(node.id, key, e.target.value), className: "w-full px-3 py-2 bg-gray-800/50 rounded border border-gray-600 text-white text-sm", disabled: isReplayMode, title: isReplayMode ? lockMessage : undefined }))] }, key));
                                    }) })] })), engineState && Object.keys(engineState).length > 0 && (_jsxs("div", { className: "bg-purple-900/10 rounded-lg p-3 border border-purple-500/20", children: [_jsx("div", { className: "text-xs font-semibold text-purple-300 mb-2", children: "INTERNAL STATE" }), _jsx("div", { className: "space-y-1.5", children: Object.entries(engineState).map(([key, value]) => (_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-gray-300 text-sm capitalize", children: key.replace(/([A-Z])/g, ' $1').trim() }), _jsx("span", { className: "text-white font-mono text-sm bg-gray-800/50 px-2 py-0.5 rounded", children: typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value) })] }, key))) })] }))] })] }));
    }
    // Render connection properties
    if (selectedConnections.length > 0) {
        const conn = selectedConnections[0];
        return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden", children: [_jsxs("div", { className: "p-3 border-b border-gray-700/50 bg-gradient-to-br from-purple-900/20 to-pink-900/20", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-purple-400 animate-pulse" }), _jsx("div", { className: "text-xs font-semibold text-purple-400", children: "WIRE" })] }), _jsx("div", { className: "text-sm text-gray-300", children: "Connection" }), selectedConnections.length > 1 && (_jsxs("div", { className: "mt-2 text-xs bg-purple-500/10 border border-purple-500/30 rounded px-2 py-1 text-purple-300", children: ["+", selectedConnections.length - 1, " more"] }))] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-3 space-y-3", children: [_jsx("div", { className: "bg-gradient-to-r from-cyan-900/20 via-purple-900/20 to-pink-900/20 rounded-lg p-3 border border-gray-700/50", children: _jsxs("div", { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "bg-cyan-900/30 rounded p-2 border-l-2 border-cyan-400", children: [_jsx("div", { className: "text-[10px] text-cyan-300 font-semibold mb-1", children: "FROM" }), _jsx("div", { className: "text-white text-sm font-medium mb-0.5", children: conn.from.portName }), _jsx("div", { className: "text-[10px] text-gray-400 font-mono truncate", children: conn.from.nodeId })] }), _jsx("div", { className: "flex items-center justify-center text-gray-500", children: _jsx("div", { className: "text-2xl", children: "\u2192" }) }), _jsxs("div", { className: "bg-pink-900/30 rounded p-2 border-l-2 border-pink-400", children: [_jsx("div", { className: "text-[10px] text-pink-300 font-semibold mb-1", children: "TO" }), _jsx("div", { className: "text-white text-sm font-medium mb-0.5", children: conn.to.portName }), _jsx("div", { className: "text-[10px] text-gray-400 font-mono truncate", children: conn.to.nodeId })] })] }) }), onConnectionDelete && (_jsxs("button", { onClick: () => {
                                const id = `${conn.from.nodeId}.${conn.from.portName}->${conn.to.nodeId}.${conn.to.portName}`;
                                onConnectionDelete(id);
                            }, className: `w-full px-4 py-3 border border-red-500/30 rounded-lg text-red-400 transition-all font-medium flex items-center justify-center gap-2 group ${isReplayMode
                                ? 'bg-red-500/5 opacity-60 cursor-not-allowed'
                                : 'bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 hover:text-red-300'}`, disabled: isReplayMode, title: isReplayMode ? lockMessage : undefined, children: [_jsx("span", { className: "text-lg group-hover:scale-110 transition-transform", children: "\uD83D\uDDD1\uFE0F" }), _jsx("span", { children: "Delete Wire" })] }))] })] }));
    }
    return null;
};
