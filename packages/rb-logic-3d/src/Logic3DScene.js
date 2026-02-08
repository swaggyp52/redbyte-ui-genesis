import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@redbyte/rb-primitives';
import { ViewAdapter } from '@redbyte/rb-logic-adapter';
import { use3DEngineSync } from './hooks/use3DEngineSync';
import { Rb3DViewport } from './components/Rb3DViewport';
import { Rb3DSceneCircuit } from './components/Rb3DSceneCircuit';
export const buildSelectionMap = (nodes, selectedNodeIds) => {
    const selectionMap = new Map();
    nodes.forEach((node) => {
        selectionMap.set(node.id, selectedNodeIds.has(node.id));
    });
    return selectionMap;
};
// Hook to track last changed time for pulses
function usePulseMap(signals, currentTime) {
    const [pulseMap, setPulseMap] = useState(new Map());
    const previousSignalsRef = useRef(new Map());
    useEffect(() => {
        const previous = previousSignalsRef.current;
        const nextPulse = new Map(pulseMap);
        let changed = false;
        signals.forEach((value, key) => {
            const previousValue = previous.get(key);
            if (previousValue !== undefined && previousValue !== value) {
                nextPulse.set(key, currentTime);
                changed = true;
            }
        });
        previousSignalsRef.current = signals;
        if (changed) {
            setPulseMap(nextPulse);
        }
    }, [signals, pulseMap, currentTime]);
    return pulseMap;
}
export const Logic3DScene = ({ engine, width = 800, height = 600, viewStateStore, showHints = true, onDismissHints, onHelp, probeWireHighlights, netHighlightWireIds, mismatchWireHighlights, mismatchNodeIds, debugSignals, forcedTime, onLayoutChange, enterAnimation: enterAnimationProp = false, }) => {
    const [showHelp, setShowHelp] = React.useState(false);
    const [followSelection, setFollowSelection] = useState(false);
    const [animateSignalFlow, setAnimateSignalFlow] = useState(true);
    const [enterAnimation, setEnterAnimation] = useState(enterAnimationProp);
    const hasAnimatedRef = useRef(false);
    // Auto-trigger enter animation on first mount
    useEffect(() => {
        if (!hasAnimatedRef.current) {
            hasAnimatedRef.current = true;
            setEnterAnimation(true);
        }
    }, []);
    // Camera State used for resets
    const [cameraTarget, setCameraTarget] = useState([0, 0.25, 0]);
    const [cameraPosition, setCameraPosition] = useState([10, 10, 10]);
    // Data Loading
    const liveSignals = use3DEngineSync(engine);
    const signals = debugSignals ?? liveSignals;
    // Time Source: Use forcedTime if provided (Replay), or Date.now() (Live)
    // Note: For true determinism in live mode, we should use engine.tickCount if available,
    // but Date.now() is acceptable for interactive live mode as long as replay uses recorded ticks.
    const [liveTime, setLiveTime] = useState(Date.now());
    useEffect(() => {
        if (forcedTime !== undefined)
            return;
        // Simple loop to keep particles moving in live mode
        let frameId;
        const updateTime = () => {
            setLiveTime(Date.now());
            frameId = requestAnimationFrame(updateTime);
        };
        frameId = requestAnimationFrame(updateTime);
        return () => cancelAnimationFrame(frameId);
    }, [forcedTime]);
    const currentTime = forcedTime ?? liveTime;
    const adapter = useMemo(() => {
        if (!engine || typeof engine.getCircuit !== 'function') {
            return null;
        }
        return new ViewAdapter(engine, '3d');
    }, [engine]);
    const viewState = useMemo(() => {
        if (!adapter) {
            return { nodes: [], wires: [] };
        }
        return adapter.computeViewState();
    }, [adapter]);
    const pulseMap = usePulseMap(signals, currentTime);
    // Selection Logic
    const selectedNodeIds = viewStateStore?.getState?.()?.selectedNodeIds || new Set();
    const handleNodeSelect = useCallback((nodeId, additive) => {
        if (viewStateStore) {
            viewStateStore.getState().selectNodes([nodeId], additive);
        }
    }, [viewStateStore]);
    const handleNodeHover = useCallback((nodeId) => {
        if (viewStateStore) {
            viewStateStore.getState().setHoveredNode(nodeId);
        }
    }, [viewStateStore]);
    const handleNodeMove = useCallback((nodeId, position) => {
        if (engine && typeof engine.updateNodePosition === 'function') {
            engine.updateNodePosition(nodeId, position);
            if (onLayoutChange) {
                onLayoutChange();
            }
        }
    }, [engine, onLayoutChange]);
    // Camera Following Logic
    useEffect(() => {
        if (!followSelection)
            return;
        const selectedId = Array.from(selectedNodeIds)[0];
        if (!selectedId)
            return;
        const targetNode = viewState.nodes.find((node) => node.id === selectedId);
        if (!targetNode)
            return;
        const targetX = targetNode.view.x / 20;
        const targetZ = targetNode.view.y / 20;
        // Update camera target smoothly
        setCameraTarget([targetX, 0.25, targetZ]);
    }, [followSelection, selectedNodeIds, viewState.nodes]);
    const circuit = engine?.getCircuit?.();
    const hasNodes = circuit?.nodes?.length > 0;
    return (_jsxs("div", { style: { width, height, position: 'relative' }, children: [_jsx(Rb3DViewport, { width: width, height: height, cameraPosition: cameraPosition, cameraTarget: cameraTarget, enterAnimation: enterAnimation, frameloop: enterAnimation ? 'always' : 'demand', onCameraChange: (pos, target) => {
                    // In a real implementation we might sync this to store
                }, children: _jsx(Rb3DSceneCircuit, { nodes: viewState.nodes, wires: viewState.wires, signals: signals, pulseMap: pulseMap, currentTime: currentTime, animateSignalFlow: animateSignalFlow, selectedNodeIds: selectedNodeIds, onNodeSelect: handleNodeSelect, onNodeHover: handleNodeHover, onNodeMove: () => {
                        const { toast } = useToast.getState();
                        toast({
                            title: "3D View is Read-Only",
                            description: "Switch to 2D view to edit the circuit.",
                            variant: "default"
                        });
                    }, probeWireHighlights: probeWireHighlights, netHighlightWireIds: netHighlightWireIds ?? undefined, mismatchWireHighlights: mismatchWireHighlights, mismatchNodeIds: mismatchNodeIds, enterAnimation: enterAnimation, onEnterAnimationComplete: () => setEnterAnimation(false) }) }), !hasNodes && showHints && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none", children: _jsxs("div", { className: "bg-[#0D1117]/90 border border-[#1B2028] rounded-lg p-4 text-xs text-[#8B949E] space-y-2 max-w-sm pointer-events-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("div", { className: "font-semibold text-white", children: "\uD83C\uDFAE 3D View" }), onDismissHints && (_jsx("button", { onClick: onDismissHints, className: "text-[#6E7681] hover:text-[#8B949E] transition-colors", title: "Dismiss hints", children: "\u2715" }))] }), _jsxs("div", { children: [_jsx("span", { className: "text-[#D4930D]", children: "Left Click + Drag:" }), " Rotate camera"] }), _jsxs("div", { children: [_jsx("span", { className: "text-[#D4930D]", children: "Right Click + Drag:" }), " Pan camera"] }), _jsxs("div", { children: [_jsx("span", { className: "text-[#D4930D]", children: "Scroll:" }), " Zoom in/out"] }), _jsxs("div", { children: [_jsx("span", { className: "text-[#D4930D]", children: "Click Node:" }), " Select component"] }), _jsx("div", { className: "pt-2 border-t border-[#1B2028] text-[#6E7681]", children: "Visualize circuits in 3D with flowing signal particles!" })] }) })), _jsx("div", { className: "absolute top-2 right-2 bg-amber-500/10 border border-amber-500/30 text-amber-500 px-2 py-1 rounded text-[10px] font-bold tracking-wider pointer-events-none select-none z-50", children: "3D VIEW (READ-ONLY)" }), _jsxs("div", { className: "absolute top-2 left-2 flex items-center gap-1.5 bg-[#070B14]/80 border border-[#1B2028] rounded px-2 py-1 text-[10px] z-50", "data-testid": "3d-micro-toolbar", children: [_jsx("button", { onClick: () => setFollowSelection((prev) => !prev), className: `px-1.5 py-0.5 rounded border ${followSelection
                            ? 'border-[#D4930D] text-[#D4930D] bg-[#D4930D]/10'
                            : 'border-[#2D333B] text-[#8B949E] hover:bg-[#161B22]/60'}`, title: "Follow selection", children: "Follow" }), _jsx("button", { onClick: () => setAnimateSignalFlow((prev) => !prev), className: `px-1.5 py-0.5 rounded border ${animateSignalFlow
                            ? 'border-[#D4930D] text-[#D4930D] bg-[#D4930D]/10'
                            : 'border-[#2D333B] text-[#8B949E] hover:bg-[#161B22]/60'}`, title: "Animate signal flow", children: "Flow" }), _jsx("button", { onClick: () => {
                            // Reset Camera
                            setCameraPosition([10, 10, 10]);
                            setCameraTarget([0, 0.25, 0]);
                        }, className: "px-1.5 py-0.5 rounded border border-[#2D333B] text-[#8B949E] hover:bg-[#161B22]/60", title: "Center camera", children: "Fit" }), onHelp && (_jsx("button", { onClick: onHelp, className: "px-1.5 py-0.5 rounded border border-[#2D333B] text-[#8B949E] hover:bg-[#161B22]/60", title: "3D controls", children: "?" })), _jsx("button", { onClick: () => setShowHelp(!showHelp), className: "px-1.5 py-0.5 rounded border border-[#2D333B] text-[#8B949E] hover:bg-[#161B22]/60", title: "Toggle inline help", children: "i" })] }), showHelp && (_jsxs("div", { className: "absolute top-10 right-2 bg-[#0D1117] border border-[#1B2028] rounded p-3 text-xs text-[#8B949E] space-y-1 shadow-xl z-50", children: [_jsx("div", { className: "font-semibold text-white mb-2", children: "3D View Controls" }), _jsxs("div", { children: [_jsx("span", { className: "text-[#D4930D]", children: "Left Click + Drag:" }), " Rotate camera"] }), _jsxs("div", { children: [_jsx("span", { className: "text-[#D4930D]", children: "Right Click + Drag:" }), " Pan camera"] }), _jsxs("div", { children: [_jsx("span", { className: "text-[#D4930D]", children: "Scroll:" }), " Zoom in/out"] }), _jsxs("div", { children: [_jsx("span", { className: "text-[#D4930D]", children: "Click Node:" }), " Select"] }), _jsxs("div", { children: [_jsx("span", { className: "text-[#D4930D]", children: "Ctrl+Click:" }), " Multi-select"] }), _jsxs("div", { className: "pt-2 border-t border-[#1B2028] text-[#6E7681]", children: [_jsx("div", { className: "text-[#B87333]", children: "\u25CF Green:" }), " Active signal (HIGH)", _jsx("div", { className: "text-[#6E7681]", children: "\u25CF Gray:" }), " Inactive (LOW)"] })] }))] }));
};
