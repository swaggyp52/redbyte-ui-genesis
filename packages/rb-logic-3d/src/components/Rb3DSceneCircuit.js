import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useMemo, useRef } from 'react';
import { TransformControls } from '@react-three/drei';
import { NodeMesh } from '../meshes/NodeMesh';
import { WireMesh } from '../meshes/WireMesh';
import { SignalParticleSystem } from '../components/SignalParticle';
import { NodeLabel } from '../components/NodeLabel';
export const Rb3DSceneCircuit = ({ nodes, wires, signals, pulseMap, currentTime, animateSignalFlow, selectedNodeIds = new Set(), onNodeSelect, onNodeHover, onNodeMove, probeWireHighlights, mismatchWireHighlights, mismatchNodeIds, }) => {
    const selectionMap = useMemo(() => {
        const map = new Map();
        nodes.forEach(node => map.set(node.id, selectedNodeIds.has(node.id)));
        return map;
    }, [nodes, selectedNodeIds]);
    // Track refs for all node meshes
    const nodeRefs = useRef(new Map());
    // Sync refs map with current nodes
    useMemo(() => {
        // We clean up old refs that are no longer in the nodes list
        // by creating a fresh map or just managing the existing one carefully.
        // For simplicity, we just rely on the callback ref pattern in the loop below.
    }, [nodes]);
    // Determine the single active object for TransformControls
    const activeTransformTarget = useMemo(() => {
        if (selectedNodeIds.size === 1) {
            const id = Array.from(selectedNodeIds)[0];
            return nodeRefs.current.get(id);
        }
        return undefined;
    }, [selectedNodeIds, nodes]); // Re-eval if nodes change (ref might update)
    const handleTransformEnd = (e) => {
        const target = e?.target?.object;
        if (target && target.userData?.nodeId && onNodeMove) {
            // target is the mesh.
            // Convert 3D position (x, -, z) back to 2D logic (x*20, z*20)
            // Y is strictly 0.25 in 3D, mapped to nothing in 2D.
            const x = target.position.x * 20;
            const y = target.position.z * 20;
            onNodeMove(target.userData.nodeId, { x, y });
        }
    };
    return (_jsxs(_Fragment, { children: [activeTransformTarget && (_jsx(TransformControls, { object: activeTransformTarget, mode: "translate", showY: false, translationSnap: 0.5, onMouseUp: handleTransformEnd })), nodes.map((node) => {
                const signalKey = `${node.id}.out`;
                const isActive = signals.get(signalKey) === 1;
                const position = [node.view.x / 20, 0.25, node.view.y / 20];
                const isSelected = selectionMap.get(node.id) ?? false;
                const isMismatch = mismatchNodeIds?.has(node.id) ?? false;
                const lastChange = pulseMap.get(signalKey) ?? 0;
                // Deterministic pulse calculation
                // Pulse intensity decays over 250ms (or ticks) from lastChange
                const pulse = animateSignalFlow && lastChange > 0
                    ? Math.max(0, 1 - (currentTime - lastChange) / 250)
                    : 0;
                return (_jsxs(React.Fragment, { children: [_jsx(NodeMesh, { ref: (el) => {
                                if (el)
                                    nodeRefs.current.set(node.id, el);
                                else
                                    nodeRefs.current.delete(node.id);
                            }, id: node.id, type: node.type, position: position, isActive: isActive, isSelected: isSelected, isMismatch: isMismatch, pulse: pulse, onSelect: onNodeSelect, onHover: onNodeHover }), _jsx(NodeLabel, { position: position, type: node.type, nodeId: node.id })] }, node.id));
            }), wires.map((wire) => {
                const signalKey = wire.id.split('-')[0];
                const isActive = signals.get(signalKey) === 1;
                const lastChange = pulseMap.get(signalKey) ?? 0;
                const pulse = animateSignalFlow && lastChange > 0
                    ? Math.max(0, 1 - (currentTime - lastChange) / 250)
                    : 0;
                const from = [wire.from.x / 20, 0.25, wire.from.y / 20];
                const to = [wire.to.x / 20, 0.25, wire.to.y / 20];
                const probeColors = probeWireHighlights?.get(wire.id);
                const mismatchColors = mismatchWireHighlights?.get(wire.id);
                return (_jsxs(React.Fragment, { children: [_jsx(WireMesh, { from: from, to: to, isActive: isActive, pulse: pulse, probeColors: probeColors, mismatchColors: mismatchColors }), isActive && animateSignalFlow && (_jsx(SignalParticleSystem, { from: from, to: to, isActive: isActive, wireId: wire.id, currentTime: currentTime }))] }, wire.id));
            })] }));
};
