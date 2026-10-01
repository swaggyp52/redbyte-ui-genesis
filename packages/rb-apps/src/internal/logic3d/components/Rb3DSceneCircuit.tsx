import React, { useMemo, useRef, useState, useEffect } from 'react';
import { TransformControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { NodeMesh } from '../meshes/NodeMesh';
import { WireMesh } from '../meshes/WireMesh';
import { SignalParticleSystem } from '../components/SignalParticle';
import { NodeLabel } from '../components/NodeLabel';
import type { ViewNode, ViewWire } from '@redbyte/rb-logic-adapter';
import type { Signal } from '@redbyte/rb-logic-core';
import { buildSelectionMap, isSceneSignalHigh, readSceneNodeMove, mergeWireProbeColorsForNetHighlight } from '../sceneContracts';
export { NET_HIGHLIGHT_COLOR, mergeWireProbeColorsForNetHighlight } from '../sceneContracts';

/** Easing: cubic-bezier(0.16, 1, 0.3, 1) approximated */
function easeOutExpo(t: number): number {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

interface Rb3DSceneCircuitProps {
    nodes: ViewNode[];
    wires: ViewWire[];
    signals: ReadonlyMap<string, Signal>;
    pulseMap: Map<string, number>;
    currentTime: number; // Wall clock or Tick time
    animateSignalFlow: boolean;
    selectedNodeIds?: ReadonlySet<string>;
    onNodeSelect?: (id: string, additive: boolean) => void;
    onNodeHover?: (id: string | null) => void;
    onNodeMove?: (id: string, position: { x: number; y: number }) => void;

    // Highlighting Props
    probeWireHighlights?: Map<string, string[]>;
    netHighlightWireIds?: Set<string>;
    mismatchWireHighlights?: Map<string, string[]> | null;
    mismatchNodeIds?: Set<string> | null;

    // Rise-up entrance animation
    enterAnimation?: boolean;
    onEnterAnimationComplete?: () => void;
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
    enterAnimation = false,
    onEnterAnimationComplete,
}) => {
    // ── Rise-up entrance animation state ──
    const animStartRef = useRef<number | null>(null);
    const [animProgress, setAnimProgress] = useState(enterAnimation ? 0 : 1);
    const animCompleteRef = useRef(!enterAnimation);

    useEffect(() => {
        if (enterAnimation) {
            animStartRef.current = null; // Will be set on first frame
            setAnimProgress(0);
            animCompleteRef.current = false;
        }
    }, [enterAnimation]);

    useFrame((_, delta) => {
        if (animCompleteRef.current) return;

        if (animStartRef.current === null) {
            animStartRef.current = performance.now();
        }

        const elapsed = performance.now() - animStartRef.current;
        const duration = 1000; // 1 second total animation
        const raw = Math.min(elapsed / duration, 1);
        const eased = easeOutExpo(raw);

        setAnimProgress(eased);

        if (raw >= 1 && !animCompleteRef.current) {
            animCompleteRef.current = true;
            onEnterAnimationComplete?.();
        }
    });

    const selectionMap = useMemo(() => buildSelectionMap(nodes, selectedNodeIds), [nodes, selectedNodeIds]);

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

    const handleTransformEnd = () => {
        const movement = readSceneNodeMove(activeTransformTarget);
        if (movement && onNodeMove) onNodeMove(movement.nodeId, movement.position);
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
            {nodes.map((node, index) => {
                const signalKey = `${node.id}.out`;
                const isActive = isSceneSignalHigh(signals.get(signalKey));

                // Rise-up: stagger each node by index, Y goes from 0 to 0.25
                const staggerDelay = Math.min(index * 0.03, 0.3); // max 300ms stagger
                const nodeProgress = animProgress >= 1 ? 1 : Math.max(0, Math.min(1, (animProgress - staggerDelay) / (1 - staggerDelay)));
                const animatedY = 0.25 * easeOutExpo(nodeProgress);
                const position: [number, number, number] = [node.view.x / 20, animatedY, node.view.y / 20];

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

            {/* Wires — delayed slightly behind nodes during rise-up */}
            {animProgress > 0.15 && wires.map((wire) => {
                const signalKey = wire.id.split('-')[0];
                const isActive = isSceneSignalHigh(signals.get(signalKey));
                const lastChange = pulseMap.get(signalKey) ?? 0;
                const pulse = animateSignalFlow && lastChange > 0
                    ? Math.max(0, 1 - (currentTime - lastChange) / 250)
                    : 0;

                // Wire Y also rises with animation
                const wireY = 0.25 * animProgress;
                const from: [number, number, number] = [wire.from.x / 20, wireY, wire.from.y / 20];
                const to: [number, number, number] = [wire.to.x / 20, wireY, wire.to.y / 20];
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
                        {/* Signal particles only after animation completes */}
                        {animProgress >= 1 && isActive && animateSignalFlow && (
                            <SignalParticleSystem from={from} to={to} isActive={isActive} wireId={wire.id} currentTime={currentTime} />
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
};
