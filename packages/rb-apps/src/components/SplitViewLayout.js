import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
import { LogicCanvas, useLogicViewStore } from '@redbyte/rb-logic-view';
import { fitToBounds } from '@redbyte/rb-viewport';
// Lazy-load 3D scene to avoid loading heavy Three.js stack unless enabled
const Logic3DSceneLazy = React.lazy(() => import('../lazy/logic3d').then((m) => ({ default: m.Logic3DScene })));
import { SchematicView } from './SchematicView';
import { OscilloscopeView } from './OscilloscopeView';
import { CodeView } from './CodeView';
import { CircuitToolStrip } from './CircuitToolStrip';
import { HardwareMapper } from './HardwareMapper';
import { Icon } from '@redbyte/rb-icons';
import { useViewStateStore } from '../stores/viewStateStore';
// View metadata for headers
const VIEW_METADATA = {
    circuit: { icon: 'logic', label: 'Circuit View', color: 'cyan' },
    schematic: { icon: 'grid', label: 'Schematic View', color: 'blue' },
    '3d': { icon: 'chip', label: '3D View', color: 'purple' },
    oscilloscope: { icon: 'neon-wave', label: 'Oscilloscope', color: 'green' },
    code: { icon: 'code', label: 'HDL Code', color: 'yellow' },
};
const setsEqual = (a, b) => {
    if (a === b)
        return true;
    if (a.size !== b.size)
        return false;
    for (const v of a) {
        if (!b.has(v))
            return false;
    }
    return true;
};
const ViewRenderer = ({ view, engine, tickEngine, circuit, isRunning, tickCount, debugSignals, debugTick, mismatchWireHighlights, mismatchNodeIds, mismatchPortKeys, canUndo, canRedo, onUndo, onRedo, onCircuitChange, onNodeDoubleClick, viewStateStore, width, height, showCircuitHints, onDismissCircuitHints, showSchematicHints, onDismissSchematicHints, show3DHints, onDismiss3DHints, showOscilloscopeHints, onDismissOscilloscopeHints, getChipMetadata, onInputToggled, onProbeToggle, probedPorts, probeWireHighlights, highlightedPort, isReplayMode, onHelpOpen, disableToolStrip = false, onSignalsUpdated, latestSignals, signalsUpdateReason, signalsVersion, onNetHighlightWiresChanged, netHighlightWireIds, }) => {
    const containerRef = React.useRef(null);
    const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
    const toolMode = useLogicViewStore((state) => state.toolMode);
    const setToolMode = useLogicViewStore((state) => state.setToolMode);
    const snapToGrid = useLogicViewStore((state) => state.snapToGrid);
    const toggleSnapToGrid = useLogicViewStore((state) => state.toggleSnapToGrid);
    const setCamera = useLogicViewStore((state) => state.setCamera);
    const setCircuitViewSize = useViewStateStore((state) => state.setCircuitViewSize);
    React.useEffect(() => {
        if (!containerRef.current)
            return;
        const updateDimensions = () => {
            if (!containerRef.current)
                return;
            const rect = containerRef.current.getBoundingClientRect();
            const nextWidth = rect.width;
            const nextHeight = Math.max(0, rect.height - 32); // Subtract header height
            setDimensions((prev) => {
                if (Math.abs(prev.width - nextWidth) < 1 && Math.abs(prev.height - nextHeight) < 1) {
                    return prev;
                }
                return { width: nextWidth, height: nextHeight };
            });
        };
        const observer = new ResizeObserver(() => {
            window.requestAnimationFrame(updateDimensions);
        });
        observer.observe(containerRef.current);
        updateDimensions();
        return () => observer.disconnect();
    }, []);
    React.useEffect(() => {
        if (view === 'circuit') {
            setCircuitViewSize(dimensions);
        }
    }, [view, dimensions, setCircuitViewSize]);
    const handleFitToView = React.useCallback(() => {
        if (circuit.nodes.length === 0) {
            setCamera({ x: 0, y: 0, zoom: 1 });
            return;
        }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        circuit.nodes.forEach((node) => {
            minX = Math.min(minX, node.position.x);
            maxX = Math.max(maxX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxY = Math.max(maxY, node.position.y);
        });
        if (!isFinite(minX)) {
            setCamera({ x: 0, y: 0, zoom: 1 });
            return;
        }
        const nextCamera = fitToBounds({ minX, maxX, minY, maxY }, dimensions.width, dimensions.height, 100, 2);
        setCamera(nextCamera);
    }, [circuit.nodes, dimensions.width, dimensions.height, setCamera]);
    const handleResetView = React.useCallback(() => {
        setCamera({ x: 0, y: 0, zoom: 1 });
    }, [setCamera]);
    const renderMicroToolbar = () => {
        if (view !== 'circuit')
            return null;
        return (_jsxs("div", { className: "ml-3 flex items-center gap-1.5", "data-testid": "circuit-micro-toolbar", children: [_jsx("button", { onClick: () => setToolMode('select'), className: `px-2 py-1 rounded text-[10px] border ${toolMode === 'select'
                        ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
                        : 'border-gray-600 text-gray-300 hover:bg-gray-800/60'}`, title: "Select tool", type: "button", children: "SEL" }), _jsx("button", { onClick: () => setToolMode(toolMode === 'wire' ? 'select' : 'wire'), className: `px-2 py-1 rounded text-[10px] border ${toolMode === 'wire'
                        ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
                        : 'border-gray-600 text-gray-300 hover:bg-gray-800/60'}`, title: "Wire tool", type: "button", children: "W" }), _jsx("button", { onClick: toggleSnapToGrid, className: `px-2 py-1 rounded text-[10px] border ${snapToGrid
                        ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
                        : 'border-gray-600 text-gray-300 hover:bg-gray-800/60'}`, title: "Toggle snap to grid", type: "button", children: "G" }), _jsx("button", { onClick: handleFitToView, className: "px-2 py-1 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-800/60", title: "Fit to view", type: "button", children: "F" }), _jsx("button", { onClick: handleResetView, className: "px-2 py-1 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-800/60", title: "Reset view", type: "button", children: "0" }), onHelpOpen && (_jsx("button", { onClick: () => onHelpOpen('circuit-controls'), className: "px-2 py-1 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-800/60", title: "Circuit controls", type: "button", children: "?" }))] }));
    };
    const metadata = VIEW_METADATA[view];
    const containerStyle = {
        width: width || '100%',
        height: height || 'calc(100% - 32px)',
        position: 'relative',
        overflow: 'hidden',
    };
    const renderContent = () => {
        switch (view) {
            case 'circuit':
                return (_jsxs("div", { ref: containerRef, style: containerStyle, children: [_jsx(LogicCanvas, { engine: tickEngine, circuit: circuit, width: dimensions.width, height: dimensions.height, showToolbar: false, showHints: showCircuitHints, onDismissHints: onDismissCircuitHints, getChipMetadata: getChipMetadata, onNodeDoubleClick: onNodeDoubleClick, onCircuitChange: onCircuitChange, onProbeToggle: onProbeToggle, probedPorts: probedPorts, probeWireHighlights: probeWireHighlights, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, mismatchPortKeys: mismatchPortKeys, highlightedPort: highlightedPort, onInputToggled: onInputToggled, isRunning: isRunning, isReplayMode: isReplayMode, tickRate: tickEngine.getTickRate(), tickCount: tickCount, debugSignals: debugSignals, debugTick: debugTick, onSignalsUpdated: onSignalsUpdated, onNetHighlightWiresChanged: onNetHighlightWiresChanged }), onUndo && onRedo && !disableToolStrip && (_jsx(CircuitToolStrip, { circuit: circuit, width: dimensions.width, height: dimensions.height, canUndo: !!canUndo, canRedo: !!canRedo, onUndo: onUndo, onRedo: onRedo }))] }));
            case 'schematic':
                return (_jsx("div", { ref: containerRef, style: containerStyle, children: _jsx(SchematicView, { circuit: circuit, engine: engine, isRunning: isRunning, width: dimensions.width, height: dimensions.height, onCircuitChange: onCircuitChange, showHints: showSchematicHints, onDismissHints: onDismissSchematicHints, probeWireHighlights: probeWireHighlights, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, mismatchPortKeys: mismatchPortKeys, onHelp: onHelpOpen ? () => onHelpOpen('schematic-controls') : undefined, debugSignals: debugSignals, debugTick: debugTick, isReplayMode: isReplayMode }) }));
            case 'oscilloscope':
                return (_jsx("div", { ref: containerRef, style: containerStyle, children: _jsx(OscilloscopeView, { engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: isRunning, width: dimensions.width, height: dimensions.height, showHints: showOscilloscopeHints, onDismissHints: onDismissOscilloscopeHints, onHelp: onHelpOpen ? () => onHelpOpen('scope-controls') : undefined, debugTick: debugTick, signals: latestSignals, signalsVersion: signalsVersion, signalsUpdateReason: signalsUpdateReason }) }));
            case '3d':
                {
                    const disable3d = typeof window !== 'undefined' &&
                        new URLSearchParams(window.location.search).get('disable3d') === '1';
                    if (disable3d) {
                        return (_jsx("div", { ref: containerRef, style: containerStyle, className: "flex items-center justify-center text-sm text-gray-300", children: "3D view disabled by flag." }));
                    }
                    return (_jsx("div", { ref: containerRef, style: containerStyle, children: _jsx(React.Suspense, { fallback: _jsx("div", { className: "flex items-center justify-center h-full text-gray-400 text-sm", children: "Loading 3D\u2026" }), children: _jsx(Logic3DSceneLazy, { engine: engine, width: dimensions.width, height: dimensions.height, viewStateStore: viewStateStore, getChipMetadata: getChipMetadata, showHints: show3DHints, onDismissHints: onDismiss3DHints, probeWireHighlights: probeWireHighlights, netHighlightWireIds: netHighlightWireIds, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, mismatchPortKeys: mismatchPortKeys, debugSignals: signalsUpdateReason === 'input' ? latestSignals : debugSignals, onHelp: onHelpOpen ? () => onHelpOpen('3d-controls') : undefined, onLayoutChange: () => {
                                    // Trigger circuit save when 3D layout changes
                                    onCircuitChange({ ...engine.getCircuit() });
                                } }) }) }));
                }
            case 'code':
                return (_jsx("div", { ref: containerRef, style: containerStyle, children: _jsx(CodeView, { circuit: circuit, width: dimensions.width, height: dimensions.height, onHelp: onHelpOpen ? () => onHelpOpen('code-controls') : undefined }) }));
            default:
                return (_jsxs("div", { style: containerStyle, className: "flex items-center justify-center bg-gray-900 text-gray-500", children: ["Unknown view: ", view] }));
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-full min-h-0 min-w-0", children: [_jsxs("div", { className: `h-8 px-3 flex items-center gap-2 border-b border-gray-700/50 bg-gradient-to-r from-${metadata.color}-900/20 to-gray-900/20 shrink-0`, children: [_jsx(Icon, { name: metadata.icon, size: 16, className: `text-${metadata.color}-400` }), _jsx("span", { className: `text-xs font-semibold text-${metadata.color}-400 uppercase tracking-wide`, children: metadata.label }), renderMicroToolbar(), _jsxs("div", { className: "ml-auto text-[10px] text-gray-500", children: [circuit.nodes.length, " nodes \u2022 ", circuit.connections.length, " wires"] })] }), _jsx("div", { className: "flex-1 min-h-0 min-w-0 relative overflow-hidden", children: renderContent() })] }));
};
export const SplitViewLayout = ({ mode, views, splitRatio = 0.5, engine, tickEngine, circuit, isRunning, tickCount, debugSignals, debugTick, mismatchWireHighlights, mismatchNodeIds, mismatchPortKeys, canUndo, canRedo, onUndo, onRedo, onCircuitChange, onNodeDoubleClick, viewStateStore, showCircuitHints, onDismissCircuitHints, showSchematicHints, onDismissSchematicHints, show3DHints, onDismiss3DHints, showOscilloscopeHints, onDismissOscilloscopeHints, getChipMetadata, onInputToggled, onProbeToggle, probedPorts, probeWireHighlights, highlightedPort, isReplayMode, onHelpOpen, }) => {
    // Track latest signals and update reason for scope/3D reactivity
    const [latestSignals, setLatestSignals] = React.useState();
    const [signalsUpdateReason, setSignalsUpdateReason] = React.useState();
    const [signalsVersion, setSignalsVersion] = React.useState(0);
    const has3DView = views.includes('3d');
    const [netHighlightWireIds, setNetHighlightWireIds] = React.useState(() => new Set());
    const handleNetHighlightWiresChanged = React.useCallback((wireIds) => {
        setNetHighlightWireIds((prev) => (setsEqual(prev, wireIds) ? prev : wireIds));
    }, []);
    React.useEffect(() => {
        if (has3DView)
            return;
        setNetHighlightWireIds((prev) => (prev.size === 0 ? prev : new Set()));
    }, [has3DView]);
    // Handle logic updates from LogicCanvas
    const handleSignalsUpdated = React.useCallback((signals, reason) => {
        setLatestSignals(signals);
        setSignalsUpdateReason(reason);
        setSignalsVersion(v => v + 1);
    }, []);
    // PHASE 2C: Mount breadcrumb
    if (import.meta.env.DEV || (typeof navigator !== 'undefined' && navigator.webdriver)) {
        if (typeof window !== 'undefined' && window.__RB_MOUNT_TRACE__) {
            const timestamp = typeof performance !== 'undefined' ? performance.now().toFixed(1) : Date.now();
            window.__RB_MOUNT_TRACE__.push(`${timestamp} SplitViewLayout:render`);
        }
    }
    // Safety check: ensure engine and circuit are defined
    if (!engine || !tickEngine || !circuit) {
        return (_jsx("div", { className: "w-full h-full flex items-center justify-center bg-gray-900 text-gray-500", children: "Initializing circuit engine..." }));
    }
    // --- SUBAGENT C: Hardware Mapper ---
    // Headless component to handle auto-spawn
    // Uses key to reset if engine changes, but mostly stable
    // -----------------------------------
    // Renders the mapper, but returns null (headless)
    const hardwareMapper = (_jsx(HardwareMapper, { circuit: circuit, onCircuitChange: onCircuitChange }));
    // PHASE 1.5: DEV-only fault injection for ISSUE-A validation
    // When ?fault=selector-object is added, use unstable Zustand selector to trigger React #185
    if (import.meta.env.DEV) {
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        if (params.get('fault') === 'selector-object') {
            // This violates Zustand's selector contract: returns new object every render
            // Expected to trigger React #185 "Maximum update depth exceeded"
            const _unstableValue = useLogicViewStore((state) => ({
                toolMode: state.toolMode,
                timestamp: Date.now(), // NEW object every render = infinite loop
            }));
            if (import.meta.env.DEV) {
                console.warn('[FAULT INJECTION] ISSUE-A: unstable selector - expect React #185');
            }
        }
    }
    // Single view mode
    if (mode === 'single') {
        return (_jsxs("div", { className: "w-full h-full relative", children: [hardwareMapper, _jsx(ViewRenderer, { view: views[0] || 'circuit', engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: isRunning, tickCount: tickCount, debugSignals: debugSignals, debugTick: debugTick, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, mismatchPortKeys: mismatchPortKeys, canUndo: canUndo, canRedo: canRedo, onUndo: onUndo, onRedo: onRedo, onCircuitChange: onCircuitChange, onNodeDoubleClick: onNodeDoubleClick, viewStateStore: viewStateStore, getChipMetadata: getChipMetadata, showCircuitHints: showCircuitHints, onDismissCircuitHints: onDismissCircuitHints, showSchematicHints: showSchematicHints, onDismissSchematicHints: onDismissSchematicHints, show3DHints: show3DHints, onDismiss3DHints: onDismiss3DHints, showOscilloscopeHints: showOscilloscopeHints, onDismissOscilloscopeHints: onDismissOscilloscopeHints, onInputToggled: onInputToggled, onProbeToggle: onProbeToggle, probedPorts: probedPorts, probeWireHighlights: probeWireHighlights, highlightedPort: highlightedPort, isReplayMode: isReplayMode, onHelpOpen: onHelpOpen, onSignalsUpdated: handleSignalsUpdated, latestSignals: latestSignals, signalsUpdateReason: signalsUpdateReason, onNetHighlightWiresChanged: has3DView ? handleNetHighlightWiresChanged : undefined, netHighlightWireIds: has3DView ? netHighlightWireIds : undefined })] }));
    }
    // Horizontal split (side by side)
    if (mode === 'horizontal') {
        const primaryStyle = { flex: `0 0 ${Math.round(splitRatio * 100)}%` };
        const secondaryStyle = { flex: '1 1 0%' };
        return (_jsxs("div", { className: "w-full h-full flex gap-1 bg-gray-950", children: [_jsx("div", { className: "bg-gray-900 overflow-hidden", style: primaryStyle, children: _jsx(ViewRenderer, { view: views[0] || 'circuit', engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: isRunning, tickCount: tickCount, debugSignals: debugSignals, debugTick: debugTick, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, mismatchPortKeys: mismatchPortKeys, canUndo: canUndo, canRedo: canRedo, onUndo: onUndo, onRedo: onRedo, onCircuitChange: onCircuitChange, onNodeDoubleClick: onNodeDoubleClick, viewStateStore: viewStateStore, getChipMetadata: getChipMetadata, showCircuitHints: showCircuitHints, onDismissCircuitHints: onDismissCircuitHints, showSchematicHints: showSchematicHints, onDismissSchematicHints: onDismissSchematicHints, show3DHints: show3DHints, onDismiss3DHints: onDismiss3DHints, showOscilloscopeHints: showOscilloscopeHints, onDismissOscilloscopeHints: onDismissOscilloscopeHints, onInputToggled: onInputToggled, onProbeToggle: onProbeToggle, probedPorts: probedPorts, probeWireHighlights: probeWireHighlights, highlightedPort: highlightedPort, isReplayMode: isReplayMode, onHelpOpen: onHelpOpen, onSignalsUpdated: handleSignalsUpdated, latestSignals: latestSignals, signalsUpdateReason: signalsUpdateReason, signalsVersion: signalsVersion, onNetHighlightWiresChanged: has3DView ? handleNetHighlightWiresChanged : undefined, netHighlightWireIds: has3DView ? netHighlightWireIds : undefined }) }), _jsx("div", { className: "bg-gray-900 overflow-hidden", style: secondaryStyle, children: _jsx(ViewRenderer, { view: views[1] || 'schematic', engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: isRunning, tickCount: tickCount, debugSignals: debugSignals, debugTick: debugTick, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, mismatchPortKeys: mismatchPortKeys, canUndo: canUndo, canRedo: canRedo, onUndo: onUndo, onRedo: onRedo, onCircuitChange: onCircuitChange, onNodeDoubleClick: onNodeDoubleClick, viewStateStore: viewStateStore, getChipMetadata: getChipMetadata, showCircuitHints: showCircuitHints, onDismissCircuitHints: onDismissCircuitHints, showSchematicHints: showSchematicHints, onDismissSchematicHints: onDismissSchematicHints, show3DHints: show3DHints, onDismiss3DHints: onDismiss3DHints, showOscilloscopeHints: showOscilloscopeHints, onDismissOscilloscopeHints: onDismissOscilloscopeHints, onProbeToggle: onProbeToggle, probedPorts: probedPorts, probeWireHighlights: probeWireHighlights, highlightedPort: highlightedPort, isReplayMode: isReplayMode, onHelpOpen: onHelpOpen, onSignalsUpdated: handleSignalsUpdated, latestSignals: latestSignals, signalsUpdateReason: signalsUpdateReason, signalsVersion: signalsVersion, onNetHighlightWiresChanged: has3DView ? handleNetHighlightWiresChanged : undefined, netHighlightWireIds: has3DView ? netHighlightWireIds : undefined }) })] }));
    }
    // Vertical split (stacked)
    if (mode === 'vertical') {
        const primaryStyle = { flex: `0 0 ${Math.round(splitRatio * 100)}%` };
        const secondaryStyle = { flex: '1 1 0%' };
        return (_jsxs("div", { className: "w-full h-full flex flex-col gap-1 bg-gray-950", children: [_jsx("div", { className: "bg-gray-900 overflow-hidden", style: primaryStyle, children: _jsx(ViewRenderer, { view: views[0] || 'circuit', engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: isRunning, tickCount: tickCount, debugSignals: debugSignals, debugTick: debugTick, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, mismatchPortKeys: mismatchPortKeys, canUndo: canUndo, canRedo: canRedo, onUndo: onUndo, onRedo: onRedo, onCircuitChange: onCircuitChange, onNodeDoubleClick: onNodeDoubleClick, viewStateStore: viewStateStore, getChipMetadata: getChipMetadata, showCircuitHints: showCircuitHints, onDismissCircuitHints: onDismissCircuitHints, showSchematicHints: showSchematicHints, onDismissSchematicHints: onDismissSchematicHints, show3DHints: show3DHints, onDismiss3DHints: onDismiss3DHints, showOscilloscopeHints: showOscilloscopeHints, onDismissOscilloscopeHints: onDismissOscilloscopeHints, onInputToggled: onInputToggled, onProbeToggle: onProbeToggle, probedPorts: probedPorts, probeWireHighlights: probeWireHighlights, highlightedPort: highlightedPort, isReplayMode: isReplayMode, onHelpOpen: onHelpOpen, onSignalsUpdated: handleSignalsUpdated, latestSignals: latestSignals, signalsUpdateReason: signalsUpdateReason, signalsVersion: signalsVersion, onNetHighlightWiresChanged: has3DView ? handleNetHighlightWiresChanged : undefined, netHighlightWireIds: has3DView ? netHighlightWireIds : undefined }) }), _jsx("div", { className: "bg-gray-900 overflow-hidden", style: secondaryStyle, children: _jsx(ViewRenderer, { view: views[1] || 'oscilloscope', engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: isRunning, tickCount: tickCount, debugSignals: debugSignals, debugTick: debugTick, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, mismatchPortKeys: mismatchPortKeys, canUndo: canUndo, canRedo: canRedo, onUndo: onUndo, onRedo: onRedo, onCircuitChange: onCircuitChange, onNodeDoubleClick: onNodeDoubleClick, viewStateStore: viewStateStore, getChipMetadata: getChipMetadata, showCircuitHints: showCircuitHints, onDismissCircuitHints: onDismissCircuitHints, showSchematicHints: showSchematicHints, onDismissSchematicHints: onDismissSchematicHints, show3DHints: show3DHints, onDismiss3DHints: onDismiss3DHints, showOscilloscopeHints: showOscilloscopeHints, onDismissOscilloscopeHints: onDismissOscilloscopeHints, onProbeToggle: onProbeToggle, probedPorts: probedPorts, probeWireHighlights: probeWireHighlights, highlightedPort: highlightedPort, isReplayMode: isReplayMode, onHelpOpen: onHelpOpen, onSignalsUpdated: handleSignalsUpdated, latestSignals: latestSignals, signalsUpdateReason: signalsUpdateReason, signalsVersion: signalsVersion, onNetHighlightWiresChanged: has3DView ? handleNetHighlightWiresChanged : undefined, netHighlightWireIds: has3DView ? netHighlightWireIds : undefined }) })] }));
    }
    // Quad view (2x2 grid)
    if (mode === 'quad') {
        return (_jsxs("div", { className: "w-full h-full grid grid-cols-2 grid-rows-2 gap-1 bg-gray-950", children: [_jsx("div", { className: "bg-gray-900 overflow-hidden", children: _jsx(ViewRenderer, { view: views[0] || 'circuit', engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: isRunning, tickCount: tickCount, debugSignals: debugSignals, debugTick: debugTick, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, mismatchPortKeys: mismatchPortKeys, canUndo: canUndo, canRedo: canRedo, onUndo: onUndo, onRedo: onRedo, onCircuitChange: onCircuitChange, onNodeDoubleClick: onNodeDoubleClick, viewStateStore: viewStateStore, getChipMetadata: getChipMetadata, showCircuitHints: showCircuitHints, onDismissCircuitHints: onDismissCircuitHints, showSchematicHints: showSchematicHints, onDismissSchematicHints: onDismissSchematicHints, show3DHints: show3DHints, onDismiss3DHints: onDismiss3DHints, showOscilloscopeHints: showOscilloscopeHints, onDismissOscilloscopeHints: onDismissOscilloscopeHints, onInputToggled: onInputToggled, onProbeToggle: onProbeToggle, probedPorts: probedPorts, probeWireHighlights: probeWireHighlights, highlightedPort: highlightedPort, isReplayMode: isReplayMode, onHelpOpen: onHelpOpen, onSignalsUpdated: handleSignalsUpdated, latestSignals: latestSignals, signalsUpdateReason: signalsUpdateReason, signalsVersion: signalsVersion, onNetHighlightWiresChanged: has3DView ? handleNetHighlightWiresChanged : undefined, netHighlightWireIds: has3DView ? netHighlightWireIds : undefined }) }), _jsx("div", { className: "bg-gray-900 overflow-hidden", children: _jsx(ViewRenderer, { view: views[1] || 'schematic', engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: isRunning, tickCount: tickCount, debugSignals: debugSignals, debugTick: debugTick, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, mismatchPortKeys: mismatchPortKeys, canUndo: canUndo, canRedo: canRedo, onUndo: onUndo, onRedo: onRedo, onCircuitChange: onCircuitChange, onNodeDoubleClick: onNodeDoubleClick, viewStateStore: viewStateStore, getChipMetadata: getChipMetadata, showCircuitHints: showCircuitHints, onDismissCircuitHints: onDismissCircuitHints, showSchematicHints: showSchematicHints, onDismissSchematicHints: onDismissSchematicHints, show3DHints: show3DHints, onDismiss3DHints: onDismiss3DHints, showOscilloscopeHints: showOscilloscopeHints, onDismissOscilloscopeHints: onDismissOscilloscopeHints, onInputToggled: onInputToggled, onProbeToggle: onProbeToggle, probedPorts: probedPorts, probeWireHighlights: probeWireHighlights, highlightedPort: highlightedPort, isReplayMode: isReplayMode, onHelpOpen: onHelpOpen, onSignalsUpdated: handleSignalsUpdated, latestSignals: latestSignals, signalsUpdateReason: signalsUpdateReason, signalsVersion: signalsVersion, onNetHighlightWiresChanged: has3DView ? handleNetHighlightWiresChanged : undefined, netHighlightWireIds: has3DView ? netHighlightWireIds : undefined }) }), _jsx("div", { className: "bg-gray-900 overflow-hidden", children: _jsx(ViewRenderer, { view: views[2] || '3d', engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: isRunning, tickCount: tickCount, debugSignals: debugSignals, debugTick: debugTick, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, canUndo: canUndo, canRedo: canRedo, onUndo: onUndo, onRedo: onRedo, onCircuitChange: onCircuitChange, onNodeDoubleClick: onNodeDoubleClick, viewStateStore: viewStateStore, getChipMetadata: getChipMetadata, showCircuitHints: showCircuitHints, onDismissCircuitHints: onDismissCircuitHints, showSchematicHints: showSchematicHints, onDismissSchematicHints: onDismissSchematicHints, show3DHints: show3DHints, onDismiss3DHints: onDismiss3DHints, showOscilloscopeHints: showOscilloscopeHints, onDismissOscilloscopeHints: onDismissOscilloscopeHints, onInputToggled: onInputToggled, onProbeToggle: onProbeToggle, probedPorts: probedPorts, probeWireHighlights: probeWireHighlights, highlightedPort: highlightedPort, isReplayMode: isReplayMode, onHelpOpen: onHelpOpen, onSignalsUpdated: handleSignalsUpdated, latestSignals: latestSignals, signalsUpdateReason: signalsUpdateReason, signalsVersion: signalsVersion, onNetHighlightWiresChanged: has3DView ? handleNetHighlightWiresChanged : undefined, netHighlightWireIds: has3DView ? netHighlightWireIds : undefined }) }), _jsx("div", { className: "bg-gray-900 overflow-hidden", children: _jsx(ViewRenderer, { view: views[3] || 'oscilloscope', engine: engine, tickEngine: tickEngine, circuit: circuit, isRunning: isRunning, canUndo: canUndo, canRedo: canRedo, onUndo: onUndo, onRedo: onRedo, onCircuitChange: onCircuitChange, onNodeDoubleClick: onNodeDoubleClick, viewStateStore: viewStateStore, getChipMetadata: getChipMetadata, showCircuitHints: showCircuitHints, onDismissCircuitHints: onDismissCircuitHints, showSchematicHints: showSchematicHints, onDismissSchematicHints: onDismissSchematicHints, show3DHints: show3DHints, onDismiss3DHints: onDismiss3DHints, showOscilloscopeHints: showOscilloscopeHints, onDismissOscilloscopeHints: onDismissOscilloscopeHints, onProbeToggle: onProbeToggle, probedPorts: probedPorts, probeWireHighlights: probeWireHighlights, highlightedPort: highlightedPort, onHelpOpen: onHelpOpen, onSignalsUpdated: handleSignalsUpdated, latestSignals: latestSignals, signalsUpdateReason: signalsUpdateReason, signalsVersion: signalsVersion, onNetHighlightWiresChanged: has3DView ? handleNetHighlightWiresChanged : undefined, netHighlightWireIds: has3DView ? netHighlightWireIds : undefined }) })] }));
    }
    return null;
};
