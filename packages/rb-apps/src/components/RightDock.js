import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLogicViewStore } from '@redbyte/rb-logic-view';
import { PropertyInspector } from './PropertyInspector';
import { CircuitHealthPanel } from './CircuitHealthPanel';
import { LearnModePanel } from './LearnModePanel';
import { RunRecorderPanel } from './RunRecorderPanel';
import { useProbeStore } from '../stores/probeStore';
import { trackRender, useUiTickStore } from '@redbyte/rb-utils';
import { BoardIOPanel } from './BoardIOPanel';
export const RightDock = ({ circuit, engine, isRunning, isReplayMode = false, onNodeUpdate, onConnectionDelete, onRun, onPause, onStep, onResetTickCount, lastTickAt = null, highlightProbePaths = true, onToggleHighlightProbePaths, onFocusNode, onIssueHover, tickCount = 0, tickRate = 0, onRecordArm, onRecordStart, onRecordStop, onRecordReplayStart, onRecordReplayStop, onRecordReplayPause, onRecordReplayResume, onRecordReplayStep, onRecordReplayJump, onRecordVerify, onRecordExport, onRecordExportProof, onRecordProof, onRecordFocus, onRecordMismatchSelect, onRecordImportProofPack, onLoadExample, onExitLearnMode, chips = [], onChipInsert, onChipDelete, onChipEdit, ioMapping, ioInputStates = {}, ioOutputStates = {}, onIoToggleInput, onIoInitialize, onIoAssignPin, hardwareMode, onHardwareModeChange, boardConnected, initialTab = 'inspector', initialState = 'expanded', onStateChange, onTabChange, }) => {
    trackRender('RightDock');
    const [activeTab, setActiveTab] = useState(initialTab);
    const [dockState, setDockState] = useState(initialState);
    // Use shallow comparison to prevent re-renders when selection object reference changes but content is the same
    const rawSelection = useLogicViewStore(useShallow((state) => state.selection));
    const selection = useMemo(() => ({
        nodes: rawSelection?.nodes instanceof Set ? rawSelection.nodes : new Set(),
        wires: rawSelection?.wires instanceof Set ? rawSelection.wires : new Set(),
    }), [rawSelection]);
    // Select each probe store property individually to maintain stable references
    // (object literals in selectors create new references on every store update, breaking Zustand's getSnapshot cache)
    const probes = useProbeStore((state) => state.probes);
    const activeProbeId = useProbeStore((state) => state.activeProbeId);
    const addProbe = useProbeStore((state) => state.addProbe);
    const removeProbe = useProbeStore((state) => state.removeProbe);
    const renameProbe = useProbeStore((state) => state.renameProbe);
    const toggleProbe = useProbeStore((state) => state.toggleProbe);
    const setActiveProbe = useProbeStore((state) => state.setActiveProbe);
    const reorderProbes = useProbeStore((state) => state.reorderProbes);
    const uiTick = useUiTickStore((state) => state.uiTick);
    const [selectedNodeId, setSelectedNodeId] = useState('');
    const [selectedPortName, setSelectedPortName] = useState('out');
    const [probeValues, setProbeValues] = useState({});
    const [draggedProbeIndex, setDraggedProbeIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    // PHASE 2C: Mount breadcrumb
    if (import.meta.env.DEV || (typeof navigator !== 'undefined' && navigator.webdriver)) {
        if (typeof window !== 'undefined' && window.__RB_MOUNT_TRACE__) {
            const timestamp = typeof performance !== 'undefined' ? performance.now().toFixed(1) : Date.now();
            window.__RB_MOUNT_TRACE__.push(`${timestamp} RightDock:render`);
        }
    }
    const selectableNodes = useMemo(() => circuit.nodes.map((node) => ({ id: node.id, type: node.type })), [circuit.nodes]);
    const clockNode = useMemo(() => circuit.nodes.find((node) => node.type === 'Clock') ?? null, [circuit.nodes]);
    const portOptions = useMemo(() => {
        if (!selectedNodeId)
            return [];
        const outputs = engine.getNodeOutputs(selectedNodeId);
        const ports = Object.keys(outputs);
        if (ports.length > 0)
            return ports;
        return ['out'];
    }, [engine, selectedNodeId]);
    useEffect(() => {
        if (portOptions.length === 0)
            return;
        if (!portOptions.includes(selectedPortName)) {
            setSelectedPortName(portOptions[0]);
        }
    }, [portOptions, selectedPortName]);
    // PHASE 1.5: DEV-only fault injection for ISSUE-C validation (pointer events)
    useEffect(() => {
        if (!import.meta.env.DEV)
            return;
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const faultType = params.get('fault');
        if (faultType === 'pointer-block') {
            // Block pointer events on tab buttons to make them un-clickable
            console.warn('[FAULT INJECTION] ISSUE-C: pointer-block - expect tab clicks to fail');
            const style = document.createElement('style');
            style.textContent = `
        [data-testid^="rightdock-tab-"] {
          pointer-events: none !important;
        }
      `;
            document.head.appendChild(style);
            return () => {
                document.head.removeChild(style);
            };
        }
        if (faultType === 'hitbox-small') {
            // Make hit box for tab text too small (only icon clickable)
            console.warn('[FAULT INJECTION] ISSUE-C: hitbox-small - expect tab text clicks to fail');
            const style = document.createElement('style');
            style.textContent = `
        [data-testid^="rightdock-tab-"] span {
          width: 8px;
          height: 8px;
          display: block;
          overflow: hidden;
        }
      `;
            document.head.appendChild(style);
            return () => {
                document.head.removeChild(style);
            };
        }
    }, []);
    useEffect(() => {
        const firstSelected = Array.from(selection.nodes)[0];
        if (!firstSelected)
            return;
        setSelectedNodeId(firstSelected);
    }, [selection.nodes]);
    useEffect(() => {
        if (probes.length === 0) {
            setProbeValues({});
            return;
        }
        if (isRunning)
            return;
        const nextValues = {};
        probes.forEach((probe) => {
            const outputs = engine.getNodeOutputs(probe.nodeId);
            const value = outputs[probe.portName] ?? 0;
            nextValues[probe.id] = value;
        });
        setProbeValues(nextValues);
    }, [engine, probes, isRunning, circuit]);
    useEffect(() => {
        if (!isRunning)
            return;
        if (probes.length === 0) {
            setProbeValues({});
            return;
        }
        const nextValues = {};
        probes.forEach((probe) => {
            const outputs = engine.getNodeOutputs(probe.nodeId);
            const value = outputs[probe.portName] ?? 0;
            nextValues[probe.id] = value;
        });
        setProbeValues(nextValues);
    }, [engine, probes, isRunning, uiTick, circuit]);
    React.useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);
    React.useEffect(() => {
        setDockState(initialState);
    }, [initialState]);
    const handleStateToggle = () => {
        const nextState = dockState === 'collapsed' ? 'peek' : dockState === 'peek' ? 'expanded' : 'collapsed';
        setDockState(nextState);
        onStateChange?.(nextState);
    };
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        onTabChange?.(tab);
    };
    const handleAddProbe = () => {
        if (!selectedNodeId || !selectedPortName)
            return;
        const node = circuit.nodes.find((n) => n.id === selectedNodeId);
        if (!node)
            return;
        addProbe({
            nodeId: selectedNodeId,
            portName: selectedPortName,
            label: `${node.type} ${selectedPortName}`,
        });
    };
    const handleProbeSelect = (probeId) => {
        const probe = probes.find((item) => item.id === probeId);
        if (!probe)
            return;
        setActiveProbe(probeId);
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
    const handleAddFirstProbe = () => {
        if (selectableNodes.length === 0)
            return;
        const node = selectableNodes[0];
        const outputs = engine.getNodeOutputs(node.id);
        const portName = outputs[0] ?? 'out';
        setSelectedNodeId(node.id);
        setSelectedPortName(portName);
        addProbe({
            nodeId: node.id,
            portName,
            label: `${node.type} ${portName}`,
        });
    };
    if (dockState === 'collapsed') {
        return (_jsxs("div", { className: "w-14 border-l border-gray-700 bg-gray-900 flex flex-col items-center py-4 gap-4", children: [_jsx("button", { onClick: () => {
                        handleTabChange('inspector');
                        setDockState('peek');
                    }, className: "w-10 h-10 rounded hover:bg-gray-800 transition-colors flex items-center justify-center", title: "Inspector", type: "button", children: _jsx("span", { className: "text-xl", children: "\uD83D\uDD0D" }) }), _jsx("button", { onClick: () => {
                        handleTabChange('health');
                        setDockState('peek');
                    }, className: "w-10 h-10 rounded hover:bg-gray-800 transition-colors flex items-center justify-center", title: "Health", type: "button", children: _jsx("span", { className: "text-xl", children: "\uD83D\uDC8A" }) }), _jsx("button", { onClick: () => {
                        handleTabChange('learn');
                        setDockState('peek');
                    }, className: "w-10 h-10 rounded hover:bg-gray-800 transition-colors flex items-center justify-center", title: "Learn", type: "button", children: _jsx("span", { className: "text-xl", children: "\uD83C\uDF93" }) }), _jsx("button", { onClick: () => {
                        handleTabChange('probes');
                        setDockState('peek');
                    }, className: "w-10 h-10 rounded hover:bg-gray-800 transition-colors flex items-center justify-center", title: "Probes", type: "button", children: _jsx("span", { className: "text-xl", children: "\uD83D\uDCCA" }) }), _jsx("button", { onClick: () => {
                        handleTabChange('record');
                        setDockState('peek');
                    }, className: "w-10 h-10 rounded hover:bg-gray-800 transition-colors flex items-center justify-center", title: "Record", type: "button", children: _jsx("span", { className: "text-xl", children: "\u23FA\uFE0F" }) }), _jsx("button", { onClick: () => {
                        handleTabChange('chips');
                        setDockState('peek');
                    }, className: "w-10 h-10 rounded hover:bg-gray-800 transition-colors flex items-center justify-center", title: "Chips", type: "button", children: _jsx("span", { className: "text-xl", children: "\uD83E\uDDE9" }) })] }));
    }
    const width = dockState === 'peek' ? 'w-80' : 'w-96';
    return (_jsxs("div", { className: `${width} border-l border-gray-700 bg-gray-900 flex flex-col transition-all duration-200 shrink-0`, "data-testid": "right-dock", children: [_jsxs("div", { className: "flex items-center h-12 bg-gray-850 border-b border-gray-700", children: [_jsxs("div", { className: "flex-1 flex items-stretch h-full px-2 gap-1", role: "tablist", children: [_jsxs("button", { onClick: () => handleTabChange('inspector'), className: `flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'inspector'
                                    ? 'bg-cyan-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'}`, "aria-label": "Inspector", "aria-selected": activeTab === 'inspector' ? 'true' : 'false', role: "tab", tabIndex: activeTab === 'inspector' ? 0 : -1, "data-testid": "rightdock-tab-inspector", type: "button", children: [_jsx("span", { className: "mr-1 pointer-events-none select-none", children: "\uD83D\uDD0D" }), _jsx("span", { className: "pointer-events-none select-none", children: "Info" })] }), _jsxs("button", { onClick: () => handleTabChange('health'), className: `flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'health'
                                    ? 'bg-cyan-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'}`, "aria-label": "Health", "aria-selected": activeTab === 'health' ? 'true' : 'false', role: "tab", tabIndex: activeTab === 'health' ? 0 : -1, "data-testid": "rightdock-tab-health", type: "button", children: [_jsx("span", { className: "mr-1 pointer-events-none select-none", children: "\uD83D\uDC8A" }), _jsx("span", { className: "pointer-events-none select-none", children: "Health" })] }), _jsxs("button", { onClick: () => handleTabChange('learn'), className: `flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'learn'
                                    ? 'bg-cyan-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'}`, "aria-label": "Learn", "aria-selected": activeTab === 'learn' ? 'true' : 'false', role: "tab", tabIndex: activeTab === 'learn' ? 0 : -1, "data-testid": "rightdock-tab-learn", type: "button", children: [_jsx("span", { className: "mr-1 pointer-events-none select-none", children: "\uD83C\uDF93" }), _jsx("span", { className: "pointer-events-none select-none", children: "Learn" })] }), _jsxs("button", { onClick: () => handleTabChange('probes'), className: `flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'probes'
                                    ? 'bg-cyan-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'}`, "aria-label": "Probes", "aria-selected": activeTab === 'probes' ? 'true' : 'false', role: "tab", tabIndex: activeTab === 'probes' ? 0 : -1, "data-testid": "rightdock-tab-probes", type: "button", children: [_jsx("span", { className: "mr-1 pointer-events-none select-none", children: "\uD83D\uDCCA" }), _jsx("span", { className: "pointer-events-none select-none", children: "Probes" })] }), _jsxs("button", { onClick: () => handleTabChange('record'), className: `flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'record'
                                    ? 'bg-cyan-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'}`, "aria-label": "Record", "aria-selected": activeTab === 'record' ? 'true' : 'false', role: "tab", tabIndex: activeTab === 'record' ? 0 : -1, "data-testid": "rightdock-tab-record", type: "button", children: [_jsx("span", { className: "mr-1 pointer-events-none select-none", children: "\u23FA\uFE0F" }), _jsx("span", { className: "pointer-events-none select-none", children: "Record" })] }), _jsxs("button", { onClick: () => handleTabChange('chips'), className: `flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'chips'
                                    ? 'bg-cyan-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'}`, "aria-label": "Chips", "aria-selected": activeTab === 'chips' ? 'true' : 'false', role: "tab", tabIndex: activeTab === 'chips' ? 0 : -1, "data-testid": "rightdock-tab-chips", type: "button", children: [_jsx("span", { className: "mr-1 pointer-events-none select-none", children: "\uD83E\uDDE9" }), _jsx("span", { className: "pointer-events-none select-none", children: "Chips" })] }), _jsxs("button", { onClick: () => handleTabChange('io'), className: `flex-1 h-full w-full px-3 rounded text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'io'
                                    ? 'bg-cyan-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'}`, "aria-label": "IO", "aria-selected": activeTab === 'io' ? 'true' : 'false', role: "tab", tabIndex: activeTab === 'io' ? 0 : -1, "data-testid": "rightdock-tab-io", type: "button", children: [_jsx("span", { className: "mr-1 pointer-events-none select-none", children: "\uD83D\uDD0C" }), _jsx("span", { className: "pointer-events-none select-none", children: "IO" })] })] }), _jsx("button", { onClick: handleStateToggle, className: "h-full px-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors", title: dockState === 'peek' ? 'Expand' : 'Collapse', type: "button", "aria-label": dockState === 'peek' ? 'Expand Dock' : 'Collapse Dock', children: dockState === 'peek' ? '→' : '←' })] }), _jsxs("div", { className: "flex-1 overflow-hidden", children: [activeTab === 'inspector' && (_jsxs("div", { className: "h-full flex flex-col overflow-hidden", children: [_jsx("div", { className: "px-4 py-3 border-b border-gray-700/60 bg-gray-900/80", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[10px] uppercase tracking-wide text-gray-500", children: "Clock" }), _jsxs("div", { className: "mt-1 flex items-center gap-2 text-xs font-mono", children: [_jsxs("span", { className: "text-cyan-300", children: ["t", tickCount] }), _jsx("span", { className: `text-[10px] ${isRunning ? 'text-green-400' : tickCount === 0 ? 'text-gray-400' : 'text-yellow-300'}`, children: isRunning ? 'Running' : tickCount === 0 ? 'Stopped' : 'Paused' }), _jsx("span", { className: "text-[10px] text-gray-400", children: isRunning ? `${tickRate}Hz` : 'Manual' })] }), lastTickAt && (_jsxs("div", { className: "mt-1 text-[10px] text-gray-500", children: ["Last step ", new Date(lastTickAt).toLocaleTimeString()] }))] }), _jsxs("div", { className: "flex items-center gap-1", children: [onStep && (_jsx("button", { onClick: onStep, className: "px-2 py-1 text-[10px] rounded border border-blue-500/50 text-blue-200 hover:bg-blue-500/20", type: "button", title: "Advance one tick", children: "Step" })), onRun && onPause && (_jsx("button", { onClick: isRunning ? onPause : onRun, className: `px-2 py-1 text-[10px] rounded border ${isRunning
                                                        ? 'border-yellow-500/50 text-yellow-200 hover:bg-yellow-500/20'
                                                        : 'border-green-500/50 text-green-200 hover:bg-green-500/20'}`, type: "button", children: isRunning ? 'Pause' : 'Run' })), onResetTickCount && (_jsx("button", { onClick: onResetTickCount, className: "px-2 py-1 text-[10px] rounded border border-gray-600 text-gray-300 hover:bg-gray-700/60", type: "button", title: "Reset tick counter", children: "Reset" }))] })] }) }), _jsx("div", { className: "flex-1 overflow-hidden", children: _jsx(PropertyInspector, { circuit: circuit, engine: engine, isRunning: isRunning, isReplayMode: isReplayMode, onNodeUpdate: onNodeUpdate, onConnectionDelete: onConnectionDelete }) })] })), activeTab === 'health' && (_jsx("div", { className: "h-full overflow-y-auto", children: _jsx(CircuitHealthPanel, { circuit: circuit, onFocusNode: onFocusNode, onIssueHover: onIssueHover }) })), activeTab === 'learn' && (_jsx("div", { className: "h-full overflow-hidden", children: _jsx(LearnModePanel, { circuit: circuit, onLoadExample: onLoadExample, onExitLearnMode: onExitLearnMode }) })), activeTab === 'probes' && (_jsxs("div", { className: "h-full p-4 flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300", children: "Signal Probes" }), _jsx("span", { className: "text-[10px] text-gray-500", children: "Live values" })] }), _jsxs("label", { className: "flex items-center justify-between text-[10px] text-gray-400 bg-gray-800/40 border border-gray-700/60 rounded px-2 py-1", children: [_jsx("span", { children: "Highlight probed paths" }), _jsx("input", { type: "checkbox", checked: highlightProbePaths, onChange: (e) => onToggleHighlightProbePaths?.(e.target.checked), className: "w-3 h-3" })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("select", { value: selectedNodeId, onChange: (e) => setSelectedNodeId(e.target.value), className: "w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs", "aria-label": "Select node to probe", children: [_jsx("option", { value: "", children: "Select node..." }), selectableNodes.map((node) => (_jsxs("option", { value: node.id, children: [node.type, " (", node.id.slice(0, 8), ")"] }, node.id)))] }), _jsx("select", { value: selectedPortName, onChange: (e) => setSelectedPortName(e.target.value), className: "w-full px-2 py-1 bg-gray-800 rounded border border-gray-700 text-xs", "aria-label": "Select port to probe", children: portOptions.map((port) => (_jsx("option", { value: port, children: port }, port))) }), _jsx("button", { onClick: handleAddProbe, disabled: !selectedNodeId, className: "w-full px-2 py-1 bg-cyan-700 hover:bg-cyan-600 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed", type: "button", children: "Add Probe" }), _jsx("button", { onClick: handleAddClockProbe, disabled: !clockNode, className: "w-full px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed", type: "button", children: "Add Clock Probe" })] }), _jsx("div", { className: "flex-1 overflow-y-auto mt-1", children: probes.length === 0 ? (_jsxs("div", { className: "text-center py-12 text-gray-400 space-y-2", children: [_jsx("div", { className: "text-sm font-semibold", children: "No probes added" }), _jsx("div", { className: "text-xs text-gray-500", children: "Select a node output or add the first probe automatically." }), _jsx("button", { type: "button", onClick: handleAddFirstProbe, disabled: selectableNodes.length === 0, className: "mt-2 px-3 py-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed", children: "Add First Probe" })] })) : (_jsx("div", { className: "space-y-2", children: probes.map((probe, index) => (_jsxs("div", { draggable: true, onDragStart: (e) => {
                                            setDraggedProbeIndex(index);
                                            e.dataTransfer.effectAllowed = 'move';
                                        }, onDragOver: (e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            setDragOverIndex(index);
                                        }, onDragLeave: () => {
                                            setDragOverIndex(null);
                                        }, onDrop: (e) => {
                                            e.preventDefault();
                                            if (draggedProbeIndex !== null && draggedProbeIndex !== index) {
                                                reorderProbes(draggedProbeIndex, index);
                                            }
                                            setDraggedProbeIndex(null);
                                            setDragOverIndex(null);
                                        }, onDragEnd: () => {
                                            setDraggedProbeIndex(null);
                                            setDragOverIndex(null);
                                        }, className: `rounded border p-3 transition-colors cursor-move ${draggedProbeIndex === index
                                            ? 'opacity-50'
                                            : dragOverIndex === index
                                                ? 'border-cyan-500 bg-cyan-900/30'
                                                : activeProbeId === probe.id
                                                    ? 'border-cyan-500/60 bg-cyan-900/20'
                                                    : 'border-gray-700/50 bg-gray-800/50 hover:bg-gray-800/80'}`, onClick: () => handleProbeSelect(probe.id), children: [_jsxs("div", { className: "flex items-start gap-2", children: [_jsxs("div", { className: "flex flex-col items-center gap-0.5 pt-1 cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-400", children: [_jsx("div", { className: "w-1 h-1 bg-current rounded-full" }), _jsx("div", { className: "w-1 h-1 bg-current rounded-full" }), _jsx("div", { className: "w-1 h-1 bg-current rounded-full" })] }), _jsx("div", { className: "mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0", style: { backgroundColor: probe.color } }), _jsxs("div", { className: "flex-1 min-w-0 space-y-1", children: [_jsx("input", { value: probe.label, onChange: (e) => renameProbe(probe.id, e.target.value), onClick: (e) => e.stopPropagation(), className: "w-full bg-transparent text-sm font-medium text-white outline-none", "aria-label": "Probe label" }), _jsxs("div", { className: "text-[10px] text-gray-400 font-mono truncate", children: [probe.nodeId, " - ", probe.portName] })] }), _jsx("div", { className: `px-2 py-1 text-xs rounded font-mono ${probeValues[probe.id] === 1
                                                            ? 'bg-green-500/20 text-green-300'
                                                            : 'bg-gray-700/50 text-gray-400'}`, children: probeValues[probe.id] ?? 0 })] }), _jsxs("div", { className: "mt-2 flex items-center gap-2", children: [_jsxs("label", { className: "flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: probe.enabled, onChange: () => toggleProbe(probe.id), onClick: (e) => e.stopPropagation(), className: "w-3 h-3" }), "Enabled"] }), _jsx("div", { className: "flex-1" }), _jsx("button", { onClick: (e) => {
                                                            e.stopPropagation();
                                                            removeProbe(probe.id);
                                                        }, className: "px-2 py-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors", type: "button", children: "Remove" })] })] }, probe.id))) })) })] })), activeTab === 'record' && (_jsx("div", { className: "h-full overflow-y-auto", children: _jsx(RunRecorderPanel, { circuit: circuit, isRunning: isRunning, currentTick: tickCount, tickRate: tickRate, onArm: onRecordArm ?? (() => { }), onStartRecording: onRecordStart ?? (() => { }), onStopRecording: onRecordStop ?? (() => { }), onStartReplay: onRecordReplayStart ?? (() => { }), onStopReplay: onRecordReplayStop ?? (() => { }), onPauseReplay: onRecordReplayPause ?? (() => { }), onResumeReplay: onRecordReplayResume ?? (() => { }), onStepReplay: onRecordReplayStep ?? (() => { }), onJumpReplay: onRecordReplayJump ?? (() => { }), onVerify: onRecordVerify ?? (() => { }), onExport: onRecordExport ?? (() => { }), onExportProof: onRecordExportProof ?? (() => { }), onRecordProof: onRecordProof ?? (() => { }), onFocusTarget: onRecordFocus ?? (() => { }), onMismatchSelect: onRecordMismatchSelect ?? (() => { }), onImportProofPack: onRecordImportProofPack ?? (() => { }) }) })), activeTab === 'chips' && (_jsxs("div", { className: "h-full p-4", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300 mb-4", children: "Saved Chips" }), chips.length === 0 ? (_jsxs("div", { className: "text-center py-12 text-gray-400", children: [_jsx("div", { className: "text-4xl mb-2", children: "\uD83E\uDDE9" }), _jsx("div", { className: "text-sm", children: "No saved chips" }), _jsx("div", { className: "text-xs text-gray-500 mt-2", children: "Build a circuit and save it as a chip" })] })) : (_jsx("div", { className: "space-y-2", children: chips.map((chip) => (_jsxs("div", { className: "bg-gray-800/50 rounded p-3 hover:bg-gray-700/50 transition-colors cursor-pointer", onClick: () => onChipInsert?.(chip.id), children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("div", { className: "text-sm font-medium text-white", children: chip.name }), _jsxs("div", { className: "flex gap-1", children: [onChipEdit && (_jsx("button", { onClick: (e) => {
                                                                e.stopPropagation();
                                                                onChipEdit(chip.id);
                                                            }, className: "px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 rounded transition-colors", children: "Edit" })), onChipDelete && (_jsx("button", { onClick: (e) => {
                                                                e.stopPropagation();
                                                                onChipDelete(chip.id);
                                                            }, className: "px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors", children: "Delete" }))] })] }), chip.description && (_jsx("div", { className: "text-xs text-gray-400", children: chip.description }))] }, chip.id))) }))] })), activeTab === 'io' && (_jsx("div", { className: "h-full overflow-y-auto", children: ioMapping ? (_jsx(BoardIOPanel, { ioMapping: ioMapping, inputStates: ioInputStates, outputStates: ioOutputStates, onToggleInput: onIoToggleInput || (() => { }), onInitializeMapping: onIoInitialize, onAssignPin: onIoAssignPin, availableSignals: 
                            // We can pass available signals from parent if needed for mapping
                            // For now, we assume parent passes them implicitly or handled by specialized props if we extend BoardIOPanel
                            // Actually BoardIOPanel needs availableSignals explicitly to show mapping UI
                            // Let's rely on parent passing valid ioMapping
                            undefined, hardwareMode: hardwareMode, onHardwareModeChange: onHardwareModeChange, boardConnected: boardConnected })) : (_jsx("div", { className: "p-4 text-center text-gray-400 text-sm", children: "IO Mapping not available" })) }))] })] }));
};
