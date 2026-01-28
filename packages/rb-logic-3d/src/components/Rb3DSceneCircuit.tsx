import React, { useMemo } from 'react';
import { NodeMesh } from '../meshes/NodeMesh';
import { WireMesh } from '../meshes/WireMesh';
import { SignalParticleSystem } from '../components/SignalParticle';
import { NodeLabel } from '../components/NodeLabel';

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

    // Highlighting Props
    probeWireHighlights?: Map<string, string[]>;
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
    probeWireHighlights,
    mismatchWireHighlights,
    mismatchNodeIds,
}) => {
    const selectionMap = useMemo(() => {
        const map = new Map<string, boolean>();
        nodes.forEach(node => map.set(node.id, selectedNodeIds.has(node.id)));
        return map;
    }, [nodes, selectedNodeIds]);

    return (
        <>
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
                const mismatchColors = mismatchWireHighlights?.get(wire.id);

                return (
                    <React.Fragment key={wire.id}>
                        <WireMesh
                            from={from}
                            to={to}
                            isActive={isActive}
                            pulse={pulse}
                            probeColors={probeColors}
                            mismatchColors={mismatchColors}
                        />
                        {isActive && animateSignalFlow && (
                            <SignalParticleSystem from={from} to={to} isActive={isActive} wireId={wire.id} />
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
};
