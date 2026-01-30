import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useLabStore } from '../lab-model/store';
import { useShallow } from 'zustand/react/shallow';
import { PART_DEFINITIONS } from '../lab-model/parts';
import { Box, Text, Line, TransformControls } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
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

const UnoVisual = ({ dim, isLive }: { dim: { x: number; y: number; z: number }, isLive?: boolean }) => {
    const pcbHeight = 0.15;
    return (
        <group>
            {/* PCB */}
            <Box args={[dim.x, pcbHeight, dim.z]} position={[0, -dim.y / 2 + pcbHeight / 2, 0]}>
                <meshStandardMaterial color="#004488" roughness={0.3} metalness={0.5} />
            </Box>

            {/* "LIVE" Hardware Badge */}
            {isLive && (
                <group position={[dim.x / 2 - 0.8, 0.45, dim.z / 2 - 0.8]}>
                    <Box args={[1.2, 0.1, 0.4]}>
                        <meshBasicMaterial color="#00e5ff" />
                    </Box>
                    <Text position={[0, 0.1, 0]} fontSize={0.2} color="black" rotation={[-Math.PI / 2, 0, 0]} fontWeight="bold">
                        LIVE
                    </Text>
                </group>
            )}

            {/* USB Connector (Standard B) */}
            <Box args={[1.2, 0.8, 1.6]} position={[-dim.x / 2 + 0.8, 0.4, -dim.z / 2 + 0.8]}>
                <meshStandardMaterial color="#silver" metalness={0.9} />
            </Box>
            {/* Power Jack */}
            <Box args={[0.9, 1.0, 1.4]} position={[-dim.x / 2 + 0.8, 0.5, dim.z / 2 - 1.2]}>
                <meshStandardMaterial color="#111" />
            </Box>
            {/* Main Processor (ATMega328P) */}
            <Box args={[2.8, 0.4, 0.8]} position={[1.0, 0.2, 0.5]}>
                <meshStandardMaterial color="#222" />
                <Text position={[0, 0.21, 0]} fontSize={0.2} rotation={[-Math.PI / 2, 0, 0]} color="#555">ATMEGA328P</Text>
            </Box>
            {/* Headers */}
            {/* Digital Header Top */}
            <Box args={[2.5, 0.8, 0.25]} position={[dim.x / 2 - 1.5, 0.4, -dim.z / 2 + 0.4]}>
                <meshStandardMaterial color="#111" />
            </Box>
            <Box args={[2.0, 0.8, 0.25]} position={[dim.x / 2 - 4.0, 0.4, -dim.z / 2 + 0.4]}>
                <meshStandardMaterial color="#111" />
            </Box>
            {/* Label */}
            <Text position={[0, 0.1, 0]} fontSize={0.4} color="white" rotation={[-Math.PI / 2, 0, 0]} opacity={0.3} transparent>
                ARDUINO UNO
            </Text>
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
            {/* USB Connector (Mini-B) */}
            <Box args={[0.8, 0.4, 0.6]} position={[0, 0.3, -dim.z / 2 + 0.3]}>
                <meshStandardMaterial color="#silver" roughness={0.2} metalness={0.9} />
            </Box>
            {/* Main IC */}
            <Box args={[0.7, 0.1, 0.7]} position={[0, 0.15, 0.5]} rotation={[0, 0, 0]}>
                <meshStandardMaterial color="#111" roughness={0.2} />
            </Box>
            {/* Reset Button */}
            <Box args={[0.3, 0.2, 0.3]} position={[0, 0.2, 0]}>
                <meshStandardMaterial color="#ccc" />
            </Box>
            {/* Labels */}
            <Text position={[0, 0.1, 1.5]} fontSize={0.3} color="white" rotation={[-Math.PI / 2, 0, 0]} opacity={0.4} transparent>
                NANO
            </Text>
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


const FpgaBoardVisual: React.FC<{ node: any }> = ({ node }) => {
    const dim = { x: 10.2, y: 0.16, z: 7.6 };
    const pinStates = useLabStore(state => state.simulation.pinStates);
    // Helper to safely get pin state (0 or 1)
    const getPinState = (pinId: string) => pinStates[`${node.id}:${pinId}`] ?? 0;

    // Layout constants matching parts.ts
    // SW0..15: z=-3.05 (Bottom), X: +4.1 (Right == SW0) -> -4.1
    const getSwPos = (i: number) => [4.1 - (i * 0.547), 0.10, -3.05] as const;
    // LED0..15: z=-2.30 (Above Switches), Same X range
    const getLedPos = (i: number) => [4.1 - (i * 0.547), 0.18, -2.30] as const;

    // Buttons (BTN0=Center, 1=U, 2=L, 3=R, 4=D)
    const btnLabels = ['C', 'U', 'D', 'L', 'R'];
    const getBtnPos = (lbl: string) => {
        const btnZ = 1.2;
        const btnY = 0.18;
        if (lbl === 'C') return [0, btnY, btnZ] as const;
        if (lbl === 'U') return [0, btnY, btnZ + 0.65] as const;
        if (lbl === 'D') return [0, btnY, btnZ - 0.65] as const;
        if (lbl === 'L') return [-0.9, btnY, btnZ] as const;
        if (lbl === 'R') return [0.9, btnY, btnZ] as const;
        return [0, 0, 0] as const;
    };
    const getBtnId = (lbl: string) => {
        // Map label back to ID used in parts.ts
        if (lbl === 'C') return 'BTN0';
        if (lbl === 'U') return 'BTN1';
        if (lbl === 'L') return 'BTN2';
        if (lbl === 'R') return 'BTN3';
        if (lbl === 'D') return 'BTN4';
        return 'BTN0';
    };

    return (
        <group>
            {/* PCB Base */}
            <Box args={[dim.x, dim.y, dim.z]}>
                <meshStandardMaterial color="#005533" roughness={0.6} />
            </Box>

            {/* Silkscreen / Decor Plane */}
            <Box args={[dim.x - 0.2, 0.01, dim.z - 0.2]} position={[0, dim.y / 2 + 0.005, 0]}>
                <meshBasicMaterial color="#006644" />
            </Box>

            {/* Switches */}
            {Array.from({ length: 16 }, (_, i) => {
                const isActive = getPinState(`SW${i}`) === 1;
                const pos = getSwPos(i);
                return (
                    <group key={`sw-${i}`} position={[pos[0], pos[1], pos[2]]}>
                        {/* Switch Body */}
                        <Box args={[0.3, 0.2, 0.5]}>
                            <meshStandardMaterial color="#888" />
                        </Box>
                        {/* Switch Toggle (moves when active) */}
                        <Box args={[0.2, 0.2, 0.2]} position={[0, 0.15, isActive ? -0.15 : 0.15]}>
                            <meshStandardMaterial color="white" />
                        </Box>
                        {/* Label */}
                        <Text position={[0, 0.11, 0.4]} fontSize={0.15} rotation={[-Math.PI / 2, 0, 0]} color="white">
                            {i}
                        </Text>
                    </group>
                );
            })}

            {/* LEDs */}
            {Array.from({ length: 16 }, (_, i) => {
                const isOn = getPinState(`LED${i}`) === 1;
                const pos = getLedPos(i);
                return (
                    <group key={`led-${i}`} position={[pos[0], pos[1], pos[2]]}>
                        {/* LED Dome */}
                        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                            <cylinderGeometry args={[0.1, 0.1, 0.05, 16]} />
                            <meshStandardMaterial
                                color={isOn ? '#ff2222' : '#440000'}
                                emissive={isOn ? '#ff0000' : 'black'}
                                emissiveIntensity={isOn ? 2.0 : 0}
                            />
                        </mesh>
                        <Text position={[0, 0.01, -0.2]} fontSize={0.12} rotation={[-Math.PI / 2, 0, 0]} color="#ccc">
                            LED{i}
                        </Text>
                    </group>
                );
            })}

            {/* Buttons */}
            {btnLabels.map(lbl => {
                const pinId = getBtnId(lbl);
                const isPressed = getPinState(pinId) === 1;
                const pos = getBtnPos(lbl);
                return (
                    <group key={`btn-${lbl}`} position={[pos[0], pos[1], pos[2]]}>
                        {/* Button Cap */}
                        <mesh position={[0, isPressed ? -0.05 : 0.05, 0]}>
                            <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
                            <meshStandardMaterial color="#111" />
                        </mesh>
                        {/* Button Housing ring */}
                        <mesh position={[0, -0.05, 0]}>
                            <cylinderGeometry args={[0.25, 0.25, 0.1, 16]} />
                            <meshStandardMaterial color="#333" />
                        </mesh>
                        <Text position={[0, 0.11, 0.35]} fontSize={0.15} rotation={[-Math.PI / 2, 0, 0]} color="white">
                            {lbl}
                        </Text>
                    </group>
                );
            })}

            {/* FPGA Chip (Center-ish) */}
            <Box args={[1.5, 0.1, 1.5]} position={[0, 0.1, -0.5]}>
                <meshStandardMaterial color="#111" roughness={0.2} />
                <Text position={[0, 0.06, 0]} fontSize={0.2} rotation={[-Math.PI / 2, 0, 0]} color="#666">
                    ARTIX-7
                </Text>
            </Box>
        </group>
    );
};


const PartMesh: React.FC<{ node: any; pinToNetId: Record<string, string>; isSelected?: boolean; onSelect?: (id: string) => void; nodeRefs: React.MutableRefObject<Map<string, THREE.Mesh>> }> = ({ node, pinToNetId, isSelected, onSelect, nodeRefs }) => {
    const def = PART_DEFINITIONS[node.type];
    const { handlePinHover, handlePinUnhover, handlePinClick } = useLabInteraction();

    const { hoveredPin, highlightedPins, selectedNetId, pinStates, transportConnected } = useLabStore(
        useShallow(state => ({
            hoveredPin: state.interaction.hoveredPin,
            highlightedPins: state.interaction.highlightedPins,
            selectedNetId: state.interaction.selectedNetId,
            pinStates: state.simulation.pinStates,
            transportConnected: state.getTransportStatus().connected,
        }))
    );

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
            ) : node.type === 'arduino-uno' ? (
                <UnoVisual dim={def.dimensions} isLive={node.hardware_target === 'arduino-uno' && transportConnected} />
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
                    <Box
                        args={[def.dimensions.x, def.dimensions.y, def.dimensions.z]}
                        ref={(el: any) => {
                            if (el) nodeRefs.current.set(node.id, el);
                            else nodeRefs.current.delete(node.id);
                        }}
                        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect?.(node.id); }}
                    >
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
    const { graph, selectedNetId, selectedNodeId, pinStates: wirePinStates } = useLabStore(
        useShallow(state => ({
            graph: state.graph,
            selectedNetId: state.interaction.selectedNetId,
            selectedNodeId: state.interaction.selectedNodeId,
            pinStates: state.simulation.pinStates,
        }))
    );
    const setSelectedNodeId = useLabStore(state => state.setSelectedNodeId);
    const updateNodePose = useLabStore(state => state.updateNodePose);
    const netlist = useMemo(() => computeNetlist(graph), [graph]);

    // Track refs for TransformControls
    const nodeRefs = React.useRef<Map<string, THREE.Mesh>>(new Map());

    const activeTransformTarget = useMemo(() => {
        if (!selectedNodeId) return undefined;
        return nodeRefs.current.get(selectedNodeId);
    }, [selectedNodeId, graph.nodes]);

    const handleTransformEnd = (e: any) => {
        const target = e?.target?.object;
        if (target && selectedNodeId) {
            updateNodePose(
                selectedNodeId,
                { x: target.position.x, y: target.position.y, z: target.position.z },
                { x: target.quaternion.x, y: target.quaternion.y, z: target.quaternion.z, w: target.quaternion.w }
            );
        }
    };

    return (
        <Rb3DViewport
            width={width}
            height={height}
            cameraPosition={[0, 8, 4]}
            cameraTarget={[0, 0, 0]}
        >
            {activeTransformTarget && (
                <TransformControls
                    object={activeTransformTarget}
                    mode="translate"
                    showY={false}
                    onMouseUp={handleTransformEnd}
                />
            )}
            <LabInteractionLayer />

            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1} />
            <gridHelper args={[20, 20, 0x444444, 0x222222]} />

            {graph.nodes.map(node => (
                <PartMesh
                    key={node.id}
                    node={node}
                    pinToNetId={netlist.pinToNetId}
                    isSelected={selectedNodeId === node.id}
                    onSelect={setSelectedNodeId}
                    nodeRefs={nodeRefs}
                />
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

                const val = wirePinStates[`${wire.sourceNodeId}:${wire.sourcePinId}`];
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
