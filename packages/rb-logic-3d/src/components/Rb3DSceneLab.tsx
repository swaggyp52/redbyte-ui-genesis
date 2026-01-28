import React, { useMemo } from 'react';
import { useLabStore } from '../lab-model/store';
import { PART_DEFINITIONS } from '../lab-model/parts';
import { Box, Text, Line } from '@react-three/drei';
import { Rb3DViewport } from './Rb3DViewport';
import { WireMesh } from '../meshes/WireMesh';
import { useLabInteraction } from '../hooks/useLabInteraction';
import { computeNetlist } from '../lab-model/netlist';

// --- Visual Components ---
const BreadboardVisual = ({ dim }: { dim: { x: number; y: number; z: number } }) => {
    return (
        <group>
            {/* Main Body */}
            <Box args={[dim.x, dim.y, dim.z]}>
                <meshStandardMaterial color="#f0f0e6" roughness={0.8} />
            </Box>
            {/* Center Trench */}
            <Box args={[dim.x, 0.02, 0.2]} position={[0, dim.y / 2 + 0.01, 0]}>
                <meshStandardMaterial color="#cca" roughness={1} />
            </Box>
            {/* Power Rails Stripes (Red/Blue lines for visual cue) */}
            <Box args={[dim.x, 0.01, 0.05]} position={[0, dim.y / 2 + 0.01, -2.0]}>
                <meshBasicMaterial color="#d00" />
            </Box>
            <Box args={[dim.x, 0.01, 0.05]} position={[0, dim.y / 2 + 0.01, -1.7]}>
                <meshBasicMaterial color="#00d" />
            </Box>
            <Box args={[dim.x, 0.01, 0.05]} position={[0, dim.y / 2 + 0.01, 1.7]}>
                <meshBasicMaterial color="#d00" />
            </Box>
            <Box args={[dim.x, 0.01, 0.05]} position={[0, dim.y / 2 + 0.01, 2.0]}>
                <meshBasicMaterial color="#00d" />
            </Box>
            {/* Simple Grid Dots (Texture would be better, but dots work cheaply) */}
            {/* Omitted for perf (too many instanced meshes needed). Rely on structure. */}
        </group>
    );
};

const NanoVisual = ({ dim }: { dim: { x: number; y: number; z: number } }) => {
    const pcbHeight = 0.15;
    return (
        <group>
            {/* PCB */}
            <Box args={[dim.x, pcbHeight, dim.z]} position={[0, -dim.y / 2 + pcbHeight / 2, 0]}>
                <meshStandardMaterial color="#003366" roughness={0.3} metalness={0.5} />
            </Box>
            {/* USB Connector */}
            <Box args={[0.8, 0.4, 0.6]} position={[0, -dim.y / 2 + pcbHeight + 0.2, -dim.z / 2 + 0.3]}>
                <meshStandardMaterial color="#silver" roughness={0.2} metalness={0.9} />
            </Box>
            {/* Main IC */}
            <Box args={[0.8, 0.1, 0.8]} position={[0.2, -dim.y / 2 + pcbHeight + 0.05, 0.5]} rotation={[0, Math.PI / 4, 0]}>
                <meshStandardMaterial color="#111" roughness={0.2} />
            </Box>
            {/* Reset Button */}
            <Box args={[0.3, 0.2, 0.3]} position={[0, -dim.y / 2 + pcbHeight + 0.1, 0]}>
                <meshStandardMaterial color="#ccc" />
            </Box>
        </group>
    );
};

const LedVisual = ({ isOn }: { isOn: boolean }) => (
    <group rotation={[Math.PI / 2, 0, 0]}>
        {/* Bulb */}
        <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.6, 16]} />
            <meshStandardMaterial
                color={isOn ? '#ff2222' : '#880000'}
                emissive={isOn ? '#ff0000' : 'black'}
                emissiveIntensity={isOn ? 2 : 0}
                roughness={0.2}
                transparent
                opacity={0.9}
            />
        </mesh>
        {/* Rim */}
        <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
            <meshStandardMaterial color={isOn ? '#ff2222' : '#880000'} />
        </mesh>
    </group>
);

const ResistorVisual = () => (
    <group rotation={[0, 0, Math.PI / 2]} position={[0, 0.1, 0]}>
        {/* Body */}
        <mesh>
            <cylinderGeometry args={[0.15, 0.15, 0.8, 12]} />
            <meshStandardMaterial color="#e0c0a0" />
        </mesh>
        {/* Color Bands (Static for visual flair) */}
        <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.155, 0.155, 0.1, 12]} />
            <meshStandardMaterial color="brown" />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.155, 0.155, 0.1, 12]} />
            <meshStandardMaterial color="black" />
        </mesh>
        <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.155, 0.155, 0.1, 12]} />
            <meshStandardMaterial color="red" />
        </mesh>
        <mesh position={[0, -0.25, 0]}>
            <cylinderGeometry args={[0.155, 0.155, 0.1, 12]} />
            <meshStandardMaterial color="gold" metalness={0.8} />
        </mesh>
    </group>
);


const FpgaVisual = ({ dim }: { dim: { x: number; y: number; z: number } }) => {
    // Indices for generation
    const swIndices = Array.from({ length: 16 }, (_, i) => i);
    const ledIndices = Array.from({ length: 16 }, (_, i) => i);
    const btnLabels = ['C', 'U', 'L', 'R', 'D']; // 0,1,2,3,4

    // Helper to match part definition pos (should technically read from PART_DEFINITIONS but fixed layout here is faster for pure visual)
    const getSwPos = (i: number) => [-4.5 + (i * 0.6), 0.15, 2.5] as const;
    const getLedPos = (i: number) => [-4.5 + (i * 0.6), 0.1, 2.0] as const;
    const btnCenter = { x: 4.5, z: 0.5 };
    const getBtnPos = (i: number) => {
        if (i === 0) return [btnCenter.x, 0.15, btnCenter.z] as const;
        if (i === 1) return [btnCenter.x, 0.15, btnCenter.z - 0.6] as const;
        if (i === 2) return [btnCenter.x - 0.6, 0.15, btnCenter.z] as const;
        if (i === 3) return [btnCenter.x + 0.6, 0.15, btnCenter.z] as const;
        return [btnCenter.x, 0.15, btnCenter.z + 0.6] as const;
    };

    return (
        <group>
            {/* PCB Board */}
            <Box args={[dim.x, dim.y, dim.z]}>
                <meshStandardMaterial color="#005533" roughness={0.6} />
            </Box>

            {/* White Silk Screen Areas (Decor) */}
            <Box args={[dim.x - 0.5, 0.01, dim.z - 0.5]} position={[0, dim.y / 2 + 0.005, 0]}>
                <meshBasicMaterial color="#006644" />
            </Box>

            {/* Switches */}
            {swIndices.map(i => (
                <group key={`vis-sw-${i}`} position={getSwPos(i)}>
                    <Box args={[0.3, 0.1, 0.5]}>
                        <meshStandardMaterial color="#888" />
                    </Box>
                    <Box args={[0.1, 0.3, 0.1]} position={[0, 0.1, 0]}>
                        <meshStandardMaterial color="#222" />
                    </Box>
                    <Text position={[0, 0, 0.4]} fontSize={0.2} rotation={[-Math.PI / 2, 0, 0]} color="white">
                        {i}
                    </Text>
                </group>
            ))}

            {/* LEDs */}
            {ledIndices.map(i => (
                <group key={`vis-led-${i}`} position={getLedPos(i)}>
                    <Box args={[0.2, 0.05, 0.1]}>
                        <meshStandardMaterial color="#222" />
                    </Box>
                    {/* The Lit Part - we'd need state to light this up. 
                        For now just the physical component. */}
                    <Box args={[0.15, 0.06, 0.05]} position={[0, 0.01, 0]}>
                        <meshStandardMaterial color="#400" />
                    </Box>
                    <Text position={[0, 0, -0.2]} fontSize={0.15} rotation={[-Math.PI / 2, 0, 0]} color="white">
                        LED{i}
                    </Text>
                </group>
            ))}

            {/* Buttons */}
            {btnLabels.map((lbl, i) => (
                <group key={`vis-btn-${i}`} position={getBtnPos(i)}>
                    <cylinderGeometry args={[0.25, 0.25, 0.1, 16]} />
                    <meshStandardMaterial color="#222" />
                    <mesh position={[0, 0.1, 0]}>
                        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
                        <meshStandardMaterial color="#111" />
                    </mesh>
                </group>
            ))}

            {/* 7-Seg Display Area */}
            <Box args={[3.0, 0.1, 1.5]} position={[2.6, 0.1, -2.0]}>
                <meshStandardMaterial color="#111" />
            </Box>

            {/* FPGA Chip (Center) */}
            <Box args={[1.5, 0.1, 1.5]} position={[0, 0.1, -0.5]}>
                <meshStandardMaterial color="#111" roughness={0.2} />
                <Text position={[0, 0.06, 0]} fontSize={0.2} rotation={[-Math.PI / 2, 0, 0]} color="#666">
                    XILINX
                </Text>
            </Box>
        </group>
    );
};


const PartMesh: React.FC<{ node: any; pinToNetId: Record<string, string> }> = ({ node, pinToNetId }) => {
    const def = PART_DEFINITIONS[node.type];
    const { handlePinHover, handlePinUnhover, handlePinClick } = useLabInteraction();

    const hoveredPin = useLabStore(state => state.interaction.hoveredPin);
    const highlightedPins = useLabStore(state => state.interaction.highlightedPins);
    const selectedNetId = useLabStore(state => state.interaction.selectedNetId);
    const pinStates = useLabStore(state => state.simulation.pinStates);

    if (!def) return null;

    const isLeOn = node.type === 'led-5mm' && pinStates[`${node.id}:anode`] === 1;

    return (
        <group
            position={[node.pose.position.x, node.pose.position.y, node.pose.position.z]}
            rotation={[node.pose.rotation.x, node.pose.rotation.y, node.pose.rotation.z]}
        >
            {/* Specialized Geometry */}
            {node.type === 'breadboard-half' ? (
                <BreadboardVisual dim={def.dimensions} />
            ) : node.type === 'arduino-nano' ? (
                <NanoVisual dim={def.dimensions} />
            ) : node.type === 'fpga-basys3' ? (
                <FpgaBoardVisual node={node} />
            ) : node.type === 'led-5mm' ? (
                <LedVisual isOn={isLeOn} />
            ) : node.type === 'resistor-dip' ? (
                <ResistorVisual />
            ) : (
                <>
                    <Box args={[def.dimensions.x, def.dimensions.y, def.dimensions.z]}>
                        <meshStandardMaterial color="#888" />
                    </Box>
                    <Text position={[0, def.dimensions.y / 2 + 0.15, 0]} fontSize={0.25} color="white" rotation={[-Math.PI / 2, 0, 0]}>
                        {def.name}
                    </Text>
                </>
            )}

            {/* Interactive Pins */}
            {def.pins.map(pin => {
                const isHovered = hoveredPin?.nodeId === node.id && hoveredPin?.pinId === pin.id;
                const pinNetId = selectedNetId ? pinToNetId[`${node.id}:${pin.id}`] : null;
                const isNetSelected = selectedNetId && pinNetId === selectedNetId;
                const isHighlighted = highlightedPins.some((h) => h.nodeId === node.id && h.pinId === pin.id);

                const pinColor = isHovered ? '#2ecc71'
                    : isHighlighted ? '#00d4ff'
                        : isNetSelected ? '#00d4ff'
                            : '#c0a000';

                return (
                    <group key={pin.id} position={[pin.position.x, pin.position.y, pin.position.z]}>
                        {/* Enlarged invisible hitbox for easy clicking */}
                        <mesh
                            visible={false}
                            onPointerOver={(e) => handlePinHover(node.id, pin.id, e as any)}
                            onPointerOut={(e) => handlePinUnhover(node.id, pin.id, e as any)}
                            onClick={(e) => handlePinClick(node.id, pin.id, e as any)}
                        >
                            <boxGeometry args={[0.3, 0.4, 0.3]} />
                            <meshBasicMaterial transparent opacity={0.0} />
                        </mesh>

                        {/* Visual pin */}
                        {
                            // Only show pin visual if not buried inside breadboard (breadboard holes are implicit)
                            node.type !== 'breadboard-half' && (
                                <Box args={[0.08, 0.08, 0.08]}>
                                    <meshBasicMaterial color={pinColor} />
                                </Box>
                            )
                        }

                        {/* For breadboard: Show highlight ring/box if hovered/active */}
                        {node.type === 'breadboard-half' && (isHovered || isHighlighted || isNetSelected) && (
                            <Box args={[0.15, 0.02, 0.15]} position={[0, 0.06, 0]}>
                                <meshBasicMaterial color={pinColor} />
                            </Box>
                        )}


                        {/* Pin label on hover */}
                        {isHovered && (
                            <Text
                                position={[0, 0.25, 0]}
                                fontSize={0.15}
                                color="white"
                                anchorX="center"
                                anchorY="bottom"
                                outlineWidth={0.02}
                                outlineColor="black"
                            >
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

    const startNode = nodes.find(n => n.id === interaction.wireStartPin!.nodeId);
    if (!startNode) return null;

    const startDef = PART_DEFINITIONS[startNode.type];
    const pinDef = startDef?.pins.find(p => p.id === interaction.wireStartPin!.pinId);
    if (!pinDef) return null;

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

const LabInteractionLayer = () => {
    const { handlePointerMove } = useLabInteraction();

    return (
        <mesh visible={false} onPointerMove={handlePointerMove} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[100, 100]} />
        </mesh>
    );
};

export const Rb3DSceneLab = ({ width = '100%', height = '100%' }: { width?: number | string, height?: number | string }) => {
    const graph = useLabStore(state => state.graph);
    const selectedNetId = useLabStore(state => state.interaction.selectedNetId);
    const netlist = useMemo(() => computeNetlist(graph), [graph]);

    return (
        <Rb3DViewport
            width={width}
            height={height}
            cameraPosition={[0, 8, 4]}
            cameraTarget={[0, 0, 0]}
        >
            <LabInteractionLayer />

            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1} />
            <gridHelper args={[20, 20, 0x444444, 0x222222]} />

            {graph.nodes.map(node => (
                <PartMesh key={node.id} node={node} pinToNetId={netlist.pinToNetId} />
            ))}

            {graph.wires.map(wire => {
                const sourceNode = graph.nodes.find(n => n.id === wire.sourceNodeId);
                const targetNode = graph.nodes.find(n => n.id === wire.targetNodeId);

                if (!sourceNode || !targetNode) return null;

                const sourceDef = PART_DEFINITIONS[sourceNode.type];
                const targetDef = PART_DEFINITIONS[targetNode.type];
                const sPin = sourceDef.pins.find(p => p.id === wire.sourcePinId);
                const tPin = targetDef.pins.find(p => p.id === wire.targetPinId);

                if (!sPin || !tPin) return null;

                const from: [number, number, number] = [
                    sourceNode.pose.position.x + sPin.position.x,
                    sourceNode.pose.position.y + sPin.position.y,
                    sourceNode.pose.position.z + sPin.position.z
                ];
                const to: [number, number, number] = [
                    targetNode.pose.position.x + tPin.position.x,
                    targetNode.pose.position.y + tPin.position.y,
                    targetNode.pose.position.z + tPin.position.z
                ];

                const pinStates = useLabStore.getState().simulation.pinStates;
                const val = pinStates[`${wire.sourceNodeId}:${wire.sourcePinId}`];
                const isActive = val === 1;
                const sourceKey = `${wire.sourceNodeId}:${wire.sourcePinId}`;
                const targetKey = `${wire.targetNodeId}:${wire.targetPinId}`;
                const isSelectedNet =
                    selectedNetId &&
                    netlist.pinToNetId[sourceKey] === selectedNetId &&
                    netlist.pinToNetId[targetKey] === selectedNetId;

                return (
                    <WireMesh
                        key={wire.id}
                        from={from}
                        to={to}
                        isActive={isActive}
                        pulse={isActive ? 1 : 0}
                        probeColors={isSelectedNet ? ['#00d4ff'] : undefined}
                    />
                );
            })}

            <GhostWire />

        </Rb3DViewport>
    );
};
