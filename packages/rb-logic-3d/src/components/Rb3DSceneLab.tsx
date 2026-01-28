import React, { useMemo } from 'react';
import { useLabStore } from '../lab-model/store';
import { PART_DEFINITIONS } from '../lab-model/parts';
import { Box, Text, Line } from '@react-three/drei';
import { Rb3DViewport } from './Rb3DViewport';
import { WireMesh } from '../meshes/WireMesh';
import { useLabInteraction } from '../hooks/useLabInteraction';
import { Vector3 } from 'three';

// --- Part Mesh with Interactive Pins ---
const PartMesh: React.FC<{ node: any; }> = ({ node }) => {
    const def = PART_DEFINITIONS[node.type];
    const { handlePinHover, handlePinUnhover, handlePinClick } = useLabInteraction();

    // Hovered state for feedback? Global store check or simple CSS cursor?
    const hoveredPin = useLabStore(state => state.interaction.hoveredPin);

    // Check sim state
    const pinStates = useLabStore(state => state.simulation.pinStates);

    if (!def) return null;

    // LED Logic: If type is LED and 'anode' is High (Simplified)
    const isLedOn = node.type === 'led-5mm' && pinStates[`${node.id}:anode`] === 1;

    return (
        <group
            position={[node.pose.position.x, node.pose.position.y, node.pose.position.z]}
            rotation={[node.pose.rotation.x, node.pose.rotation.y, node.pose.rotation.z]}
        >
            {/* Visual Body */}
            <Box args={[def.dimensions.x, def.dimensions.y, def.dimensions.z]}>
                <meshStandardMaterial
                    color={isLedOn ? '#ff0000' : (node.type === 'arduino-nano' ? '#0088cc' : '#eee')}
                    emissive={isLedOn ? '#ff0000' : 'black'}
                    emissiveIntensity={isLedOn ? 2 : 0}
                />
            </Box>
            <Text position={[0, def.dimensions.y / 2 + 0.1, 0]} fontSize={0.2} color="white" rotation={[-Math.PI / 2, 0, 0]}>
                {def.name}
            </Text>

            {/* Interactive Pins */}
            {def.pins.map(pin => {
                const isHovered = hoveredPin?.nodeId === node.id && hoveredPin?.pinId === pin.id;

                return (
                    <group key={pin.id} position={[pin.position.x, pin.position.y, pin.position.z]}>
                        {/* Hitbox (Invisible/Transparent but interactive) */}
                        <mesh
                            visible={false}
                            onPointerOver={(e) => handlePinHover(node.id, pin.id, e)}
                            onPointerOut={(e) => handlePinUnhover(node.id, pin.id, e)}
                            onClick={(e) => handlePinClick(node.id, pin.id, e)}
                        >
                            <boxGeometry args={[0.2, 0.2, 0.2]} />
                            <meshBasicMaterial transparent opacity={0.0} />
                        </mesh>

                        {/* Visual Pin (Highlight on hover) */}
                        <Box args={[0.05, 0.05, 0.05]}>
                            <meshBasicMaterial color={isHovered ? '#2ecc71' : 'gold'} />
                        </Box>
                        {isHovered && (
                            <Text position={[0, 0.15, 0]} fontSize={0.1} color="white" receiveShadow={false}>
                                {pin.id}
                            </Text>
                        )}
                    </group>
                );
            })}
        </group>
    );
};

// --- Ghost Wire Renderer ---
const GhostWire = () => {
    const interaction = useLabStore(state => state.interaction);
    const nodes = useLabStore(state => state.graph.nodes);

    if (interaction.mode !== 'wire' || !interaction.wireStartPin || !interaction.dragPosition) return null;

    // Resolve start position
    const startNode = nodes.find(n => n.id === interaction.wireStartPin!.nodeId);
    if (!startNode) return null;

    const startDef = PART_DEFINITIONS[startNode.type];
    const pinDef = startDef?.pins.find(p => p.id === interaction.wireStartPin!.pinId);
    if (!pinDef) return null;

    // Apply Node Transform to Pin Position (Simplified: Just adding for now, ideally use Matrix4)
    // NOTE: This assumes 0 rotation for MVP. Rotated parts need matrix math.
    const startPos: [number, number, number] = [
        startNode.pose.position.x + pinDef.position.x,
        startNode.pose.position.y + pinDef.position.y,
        startNode.pose.position.z + pinDef.position.z
    ];

    const endPos: [number, number, number] = [
        interaction.dragPosition.x,
        interaction.dragPosition.y,
        interaction.dragPosition.z
    ];

    return (
        <Line
            points={[startPos, endPos]}
            color="#2ecc71"
            lineWidth={2}
            dashed
            dashScale={2}
            dashSize={0.5}
            opacity={0.7}
            transparent
        />
    );
};


export const Rb3DSceneLab = ({ width = '100%', height = '100%' }: { width?: number | string, height?: number | string }) => {
    const graph = useLabStore(state => state.graph);
    const { handlePointerMove } = useLabInteraction();

    return (
        <Rb3DViewport
            width={width}
            height={height}
            cameraPosition={[0, 8, 4]}
            cameraTarget={[0, 0, 0]}
        >
            {/* Scene Handler for Pointer Move (Ghost Wire Drag) */}
            <mesh visible={false} onPointerMove={handlePointerMove} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[100, 100]} />
            </mesh>

            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1} />
            <gridHelper args={[20, 20, 0x444444, 0x222222]} />

            {graph.nodes.map(node => (
                <PartMesh key={node.id} node={node} />
            ))}

            {graph.wires.map(wire => {
                // Resolve positions needed for wire mesh
                const sourceNode = graph.nodes.find(n => n.id === wire.sourceNodeId);
                const targetNode = graph.nodes.find(n => n.id === wire.targetNodeId);

                if (!sourceNode || !targetNode) return null;

                const sourceDef = PART_DEFINITIONS[sourceNode.type];
                const targetDef = PART_DEFINITIONS[targetNode.type];
                const sPin = sourceDef.pins.find(p => p.id === wire.sourcePinId);
                const tPin = targetDef.pins.find(p => p.id === wire.targetPinId);

                if (!sPin || !tPin) return null;

                // Simple Transform (No Rotation Support yet)
                const from: [number, number, number] = [sourceNode.pose.position.x + sPin.position.x, sourceNode.pose.position.y + sPin.position.y, sourceNode.pose.position.z + sPin.position.z];
                const to: [number, number, number] = [targetNode.pose.position.x + tPin.position.x, targetNode.pose.position.y + tPin.position.y, targetNode.pose.position.z + tPin.position.z];

                // Visual State
                const pinStates = useLabStore.getState().simulation.pinStates;
                const val = pinStates[`${wire.sourceNodeId}:${wire.sourcePinId}`];
                const isActive = val === 1;

                return (
                    <WireMesh
                        key={wire.id}
                        from={from}
                        to={to}
                        isActive={isActive}
                        pulse={isActive ? 1 : 0}
                    />
                );
            })}

            <GhostWire />

        </Rb3DViewport>
    );
};
