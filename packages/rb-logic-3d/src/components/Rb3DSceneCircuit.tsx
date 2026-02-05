import React, { useMemo, useRef } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { NodeMesh } from '../meshes/NodeMesh';
import { WireMesh } from '../meshes/WireMesh';
import { SignalParticleSystem } from '../components/SignalParticle';
import { NodeLabel } from '../components/NodeLabel';

export const NET_HIGHLIGHT_COLOR = '#fbbf24';

export const mergeWireProbeColorsForNetHighlight = (
    probeColors: string[] | undefined,
    isNetHighlighted: boolean
) => {
    if (!isNetHighlighted) return probeColors;
    if (!probeColors) return [NET_HIGHLIGHT_COLOR];
    if (probeColors.includes(NET_HIGHLIGHT_COLOR)) return probeColors;
    return [...probeColors, NET_HIGHLIGHT_COLOR];
};

interface Rb3DSceneCircuitProps {
    nodes: any[]; // Replace with ViewStateNode type from adapter if available
    wires: any[]; // Replace with ViewStateWire type
    signals: Map<string, 0 | 1>;
    pulseMap: Map<string, number>;
    currentTime: number; // Wall clock or Tick time
    animateSignalFlow: boolean;
    selectedNodeIds?: Set<string>;
    onNodeSelect?: (id: string, additive: boolean) => void;
    onNodeHover?: (id: string | null) => void;
    onNodeMove?: (id: string, position: { x: number; y: number }) => void;

    // Highlighting Props
    probeWireHighlights?: Map<string, string[]>;
    netHighlightWireIds?: Set<string>;
    mismatchWireHighlights?: Map<string, string[]> | null;
    mismatchNodeIds?: Set<string> | null;
}

export const Rb3DSceneCircuit: React.FC<Rb3DSceneCircuitProps> = ({
    nodes,
    wires,
    signals,
    pulseMap,
    currentTime,
    animateSignalFlow,
    selectedNodeIds = new Set(),
    onNodeSelect,
    onNodeHover,
    onNodeMove,
    probeWireHighlights,
    netHighlightWireIds,
    mismatchWireHighlights,
    mismatchNodeIds,
}) => {
    const selectionMap = useMemo(() => {
        const map = new Map<string, boolean>();
        nodes.forEach(node => map.set(node.id, selectedNodeIds.has(node.id)));
        return map;
    }, [nodes, selectedNodeIds]);

    // Track refs for all node meshes
    const nodeRefs = useRef<Map<string, THREE.Mesh>>(new Map());

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

    const handleTransformEnd = (e: any) => {
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

    return (
        <>
            {/* Transform Controls (Gizmo) */}
            {activeTransformTarget && (
                <TransformControls
                    object={activeTransformTarget}
                    mode="translate"
                    showY={false} // Lock vertical movement
                    translationSnap={0.5} // 10 units in 2D logic (since 20 scale factor) -> 0.5 * 20 = 10 grid snap
                    onMouseUp={handleTransformEnd}
                />
            )}

            {/* Nodes */}
            {nodes.map((node) => {
                const signalKey = `${node.id}.out`;
                const isActive = signals.get(signalKey) === 1;
                const position: [number, number, number] = [node.view.x / 20, 0.25, node.view.y / 20];
                const isSelected = selectionMap.get(node.id) ?? false;
                const isMismatch = mismatchNodeIds?.has(node.id) ?? false;
                const lastChange = pulseMap.get(signalKey) ?? 0;

                // Deterministic pulse calculation
                // Pulse intensity decays over 250ms (or ticks) from lastChange
                const pulse = animateSignalFlow && lastChange > 0
                    ? Math.max(0, 1 - (currentTime - lastChange) / 250)
                    : 0;

                return (
                    <React.Fragment key={node.id}>
                        <NodeMesh
                            ref={(el) => {
                                if (el) nodeRefs.current.set(node.id, el);
                                else nodeRefs.current.delete(node.id);
                            }}
                            id={node.id}
                            type={node.type}
                            position={position}
                            isActive={isActive}
                            isSelected={isSelected}
                            isMismatch={isMismatch}
                            pulse={pulse}
                            onSelect={onNodeSelect}
                            onHover={onNodeHover}
                        />
                        <NodeLabel position={position} type={node.type} nodeId={node.id} />
                    </React.Fragment>
                );
            })}

            {/* Wires */}
            {wires.map((wire) => {
                const signalKey = wire.id.split('-')[0];
                const isActive = signals.get(signalKey) === 1;
                const lastChange = pulseMap.get(signalKey) ?? 0;
                const pulse = animateSignalFlow && lastChange > 0
                    ? Math.max(0, 1 - (currentTime - lastChange) / 250)
                    : 0;

                const from: [number, number, number] = [wire.from.x / 20, 0.25, wire.from.y / 20];
                const to: [number, number, number] = [wire.to.x / 20, 0.25, wire.to.y / 20];
                const probeColors = probeWireHighlights?.get(wire.id);
                const isNetHighlighted = netHighlightWireIds?.has(wire.id) ?? false;
                const mergedProbeColors = mergeWireProbeColorsForNetHighlight(probeColors, isNetHighlighted);
                const mismatchColors = mismatchWireHighlights?.get(wire.id);

                return (
                    <React.Fragment key={wire.id}>
                        <WireMesh
                            from={from}
                            to={to}
                            isActive={isActive}
                            pulse={pulse}
                            probeColors={mergedProbeColors}
                            mismatchColors={mismatchColors}
                        />
                        {isActive && animateSignalFlow && (
                            <SignalParticleSystem from={from} to={to} isActive={isActive} wireId={wire.id} currentTime={currentTime} />
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
};
