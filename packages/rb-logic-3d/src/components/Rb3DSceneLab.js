import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useMemo } from 'react';
import { useLabStore } from '../lab-model/store';
import { useShallow } from 'zustand/react/shallow';
import { PART_DEFINITIONS } from '../lab-model/parts';
import { Box, Text, Line, TransformControls } from '@react-three/drei';
import { Rb3DViewport } from './Rb3DViewport';
import { WireMesh } from '../meshes/WireMesh';
import { useLabInteraction } from '../hooks/useLabInteraction';
import { computeNetlist } from '../lab-model/netlist';
// --- Visual Components ---
const BreadboardVisual = ({ dim }) => {
    return (_jsxs("group", { children: [_jsx(Box, { args: [dim.x, dim.y, dim.z], children: _jsx("meshStandardMaterial", { color: "#f0f0e6", roughness: 0.8 }) }), _jsx(Box, { args: [dim.x, 0.02, 0.2], position: [0, dim.y / 2 + 0.01, 0], children: _jsx("meshStandardMaterial", { color: "#cca", roughness: 1 }) }), _jsx(Box, { args: [dim.x, 0.01, 0.05], position: [0, dim.y / 2 + 0.01, -2.0], children: _jsx("meshBasicMaterial", { color: "#d00" }) }), _jsx(Box, { args: [dim.x, 0.01, 0.05], position: [0, dim.y / 2 + 0.01, -1.7], children: _jsx("meshBasicMaterial", { color: "#00d" }) }), _jsx(Box, { args: [dim.x, 0.01, 0.05], position: [0, dim.y / 2 + 0.01, 1.7], children: _jsx("meshBasicMaterial", { color: "#d00" }) }), _jsx(Box, { args: [dim.x, 0.01, 0.05], position: [0, dim.y / 2 + 0.01, 2.0], children: _jsx("meshBasicMaterial", { color: "#00d" }) })] }));
};
const UnoVisual = ({ dim, isLive }) => {
    const pcbHeight = 0.15;
    return (_jsxs("group", { children: [_jsx(Box, { args: [dim.x, pcbHeight, dim.z], position: [0, -dim.y / 2 + pcbHeight / 2, 0], children: _jsx("meshStandardMaterial", { color: "#004488", roughness: 0.3, metalness: 0.5 }) }), isLive && (_jsxs("group", { position: [dim.x / 2 - 0.8, 0.45, dim.z / 2 - 0.8], children: [_jsx(Box, { args: [1.2, 0.1, 0.4], children: _jsx("meshBasicMaterial", { color: "#00e5ff" }) }), _jsx(Text, { position: [0, 0.1, 0], fontSize: 0.2, color: "black", rotation: [-Math.PI / 2, 0, 0], fontWeight: "bold", children: "LIVE" })] })), _jsx(Box, { args: [1.2, 0.8, 1.6], position: [-dim.x / 2 + 0.8, 0.4, -dim.z / 2 + 0.8], children: _jsx("meshStandardMaterial", { color: "#silver", metalness: 0.9 }) }), _jsx(Box, { args: [0.9, 1.0, 1.4], position: [-dim.x / 2 + 0.8, 0.5, dim.z / 2 - 1.2], children: _jsx("meshStandardMaterial", { color: "#111" }) }), _jsxs(Box, { args: [2.8, 0.4, 0.8], position: [1.0, 0.2, 0.5], children: [_jsx("meshStandardMaterial", { color: "#222" }), _jsx(Text, { position: [0, 0.21, 0], fontSize: 0.2, rotation: [-Math.PI / 2, 0, 0], color: "#555", children: "ATMEGA328P" })] }), _jsx(Box, { args: [2.5, 0.8, 0.25], position: [dim.x / 2 - 1.5, 0.4, -dim.z / 2 + 0.4], children: _jsx("meshStandardMaterial", { color: "#111" }) }), _jsx(Box, { args: [2.0, 0.8, 0.25], position: [dim.x / 2 - 4.0, 0.4, -dim.z / 2 + 0.4], children: _jsx("meshStandardMaterial", { color: "#111" }) }), _jsx(Text, { position: [0, 0.1, 0], fontSize: 0.4, color: "white", rotation: [-Math.PI / 2, 0, 0], opacity: 0.3, transparent: true, children: "ARDUINO UNO" })] }));
};
const NanoVisual = ({ dim }) => {
    const pcbHeight = 0.15;
    return (_jsxs("group", { children: [_jsx(Box, { args: [dim.x, pcbHeight, dim.z], position: [0, -dim.y / 2 + pcbHeight / 2, 0], children: _jsx("meshStandardMaterial", { color: "#003366", roughness: 0.3, metalness: 0.5 }) }), _jsx(Box, { args: [0.8, 0.4, 0.6], position: [0, 0.3, -dim.z / 2 + 0.3], children: _jsx("meshStandardMaterial", { color: "#silver", roughness: 0.2, metalness: 0.9 }) }), _jsx(Box, { args: [0.7, 0.1, 0.7], position: [0, 0.15, 0.5], rotation: [0, 0, 0], children: _jsx("meshStandardMaterial", { color: "#111", roughness: 0.2 }) }), _jsx(Box, { args: [0.3, 0.2, 0.3], position: [0, 0.2, 0], children: _jsx("meshStandardMaterial", { color: "#ccc" }) }), _jsx(Text, { position: [0, 0.1, 1.5], fontSize: 0.3, color: "white", rotation: [-Math.PI / 2, 0, 0], opacity: 0.4, transparent: true, children: "NANO" })] }));
};
const LedVisual = ({ isOn }) => (_jsxs("group", { rotation: [Math.PI / 2, 0, 0], children: [_jsxs("mesh", { position: [0, 0.3, 0], children: [_jsx("cylinderGeometry", { args: [0.25, 0.25, 0.6, 16] }), _jsx("meshStandardMaterial", { color: isOn ? '#ff2222' : '#880000', emissive: isOn ? '#ff0000' : 'black', emissiveIntensity: isOn ? 2 : 0, roughness: 0.2, transparent: true, opacity: 0.9 })] }), _jsxs("mesh", { position: [0, 0, 0], children: [_jsx("cylinderGeometry", { args: [0.3, 0.3, 0.1, 16] }), _jsx("meshStandardMaterial", { color: isOn ? '#ff2222' : '#880000' })] })] }));
const ResistorVisual = () => (_jsxs("group", { rotation: [0, 0, Math.PI / 2], position: [0, 0.1, 0], children: [_jsxs("mesh", { children: [_jsx("cylinderGeometry", { args: [0.15, 0.15, 0.8, 12] }), _jsx("meshStandardMaterial", { color: "#e0c0a0" })] }), _jsxs("mesh", { position: [0, 0.1, 0], children: [_jsx("cylinderGeometry", { args: [0.155, 0.155, 0.1, 12] }), _jsx("meshStandardMaterial", { color: "brown" })] }), _jsxs("mesh", { position: [0, 0.25, 0], children: [_jsx("cylinderGeometry", { args: [0.155, 0.155, 0.1, 12] }), _jsx("meshStandardMaterial", { color: "black" })] }), _jsxs("mesh", { position: [0, -0.1, 0], children: [_jsx("cylinderGeometry", { args: [0.155, 0.155, 0.1, 12] }), _jsx("meshStandardMaterial", { color: "red" })] }), _jsxs("mesh", { position: [0, -0.25, 0], children: [_jsx("cylinderGeometry", { args: [0.155, 0.155, 0.1, 12] }), _jsx("meshStandardMaterial", { color: "gold", metalness: 0.8 })] })] }));
const FpgaBoardVisual = ({ node }) => {
    const dim = { x: 10.2, y: 0.16, z: 7.6 };
    const pinStates = useLabStore(state => state.simulation.pinStates);
    // Helper to safely get pin state (0 or 1)
    const getPinState = (pinId) => pinStates[`${node.id}:${pinId}`] ?? 0;
    // Layout constants matching parts.ts
    // SW0..15: z=-3.05 (Bottom), X: +4.1 (Right == SW0) -> -4.1
    const getSwPos = (i) => [4.1 - (i * 0.547), 0.10, -3.05];
    // LED0..15: z=-2.30 (Above Switches), Same X range
    const getLedPos = (i) => [4.1 - (i * 0.547), 0.18, -2.30];
    // Buttons (BTN0=Center, 1=U, 2=L, 3=R, 4=D)
    const btnLabels = ['C', 'U', 'D', 'L', 'R'];
    const getBtnPos = (lbl) => {
        const btnZ = 1.2;
        const btnY = 0.18;
        if (lbl === 'C')
            return [0, btnY, btnZ];
        if (lbl === 'U')
            return [0, btnY, btnZ + 0.65];
        if (lbl === 'D')
            return [0, btnY, btnZ - 0.65];
        if (lbl === 'L')
            return [-0.9, btnY, btnZ];
        if (lbl === 'R')
            return [0.9, btnY, btnZ];
        return [0, 0, 0];
    };
    const getBtnId = (lbl) => {
        // Map label back to ID used in parts.ts
        if (lbl === 'C')
            return 'BTN0';
        if (lbl === 'U')
            return 'BTN1';
        if (lbl === 'L')
            return 'BTN2';
        if (lbl === 'R')
            return 'BTN3';
        if (lbl === 'D')
            return 'BTN4';
        return 'BTN0';
    };
    return (_jsxs("group", { children: [_jsx(Box, { args: [dim.x, dim.y, dim.z], children: _jsx("meshStandardMaterial", { color: "#005533", roughness: 0.6 }) }), _jsx(Box, { args: [dim.x - 0.2, 0.01, dim.z - 0.2], position: [0, dim.y / 2 + 0.005, 0], children: _jsx("meshBasicMaterial", { color: "#006644" }) }), Array.from({ length: 16 }, (_, i) => {
                const isActive = getPinState(`SW${i}`) === 1;
                const pos = getSwPos(i);
                return (_jsxs("group", { position: [pos[0], pos[1], pos[2]], children: [_jsx(Box, { args: [0.3, 0.2, 0.5], children: _jsx("meshStandardMaterial", { color: "#888" }) }), _jsx(Box, { args: [0.2, 0.2, 0.2], position: [0, 0.15, isActive ? -0.15 : 0.15], children: _jsx("meshStandardMaterial", { color: "white" }) }), _jsx(Text, { position: [0, 0.11, 0.4], fontSize: 0.15, rotation: [-Math.PI / 2, 0, 0], color: "white", children: i })] }, `sw-${i}`));
            }), Array.from({ length: 16 }, (_, i) => {
                const isOn = getPinState(`LED${i}`) === 1;
                const pos = getLedPos(i);
                return (_jsxs("group", { position: [pos[0], pos[1], pos[2]], children: [_jsxs("mesh", { rotation: [Math.PI / 2, 0, 0], position: [0, 0.02, 0], children: [_jsx("cylinderGeometry", { args: [0.1, 0.1, 0.05, 16] }), _jsx("meshStandardMaterial", { color: isOn ? '#ff2222' : '#440000', emissive: isOn ? '#ff0000' : 'black', emissiveIntensity: isOn ? 2.0 : 0 })] }), _jsxs(Text, { position: [0, 0.01, -0.2], fontSize: 0.12, rotation: [-Math.PI / 2, 0, 0], color: "#ccc", children: ["LED", i] })] }, `led-${i}`));
            }), btnLabels.map(lbl => {
                const pinId = getBtnId(lbl);
                const isPressed = getPinState(pinId) === 1;
                const pos = getBtnPos(lbl);
                return (_jsxs("group", { position: [pos[0], pos[1], pos[2]], children: [_jsxs("mesh", { position: [0, isPressed ? -0.05 : 0.05, 0], children: [_jsx("cylinderGeometry", { args: [0.2, 0.2, 0.1, 16] }), _jsx("meshStandardMaterial", { color: "#111" })] }), _jsxs("mesh", { position: [0, -0.05, 0], children: [_jsx("cylinderGeometry", { args: [0.25, 0.25, 0.1, 16] }), _jsx("meshStandardMaterial", { color: "#333" })] }), _jsx(Text, { position: [0, 0.11, 0.35], fontSize: 0.15, rotation: [-Math.PI / 2, 0, 0], color: "white", children: lbl })] }, `btn-${lbl}`));
            }), _jsxs(Box, { args: [1.5, 0.1, 1.5], position: [0, 0.1, -0.5], children: [_jsx("meshStandardMaterial", { color: "#111", roughness: 0.2 }), _jsx(Text, { position: [0, 0.06, 0], fontSize: 0.2, rotation: [-Math.PI / 2, 0, 0], color: "#666", children: "ARTIX-7" })] })] }));
};
const PartMesh = ({ node, pinToNetId, isSelected, onSelect, nodeRefs, readOnly, onEditAttempt }) => {
    const def = PART_DEFINITIONS[node.type];
    const { handlePinHover, handlePinUnhover, handlePinClick } = useLabInteraction();
    const { hoveredPin, highlightedPins, selectedNetId, pinStates, transportConnected } = useLabStore(useShallow(state => ({
        hoveredPin: state.interaction.hoveredPin,
        highlightedPins: state.interaction.highlightedPins,
        selectedNetId: state.interaction.selectedNetId,
        pinStates: state.simulation.pinStates,
        transportConnected: state.getTransportStatus().connected,
    })));
    if (!def)
        return null;
    const isLeOn = node.type === 'led-5mm' && pinStates[`${node.id}:anode`] === 1;
    return (_jsxs("group", { position: [node.pose.position.x, node.pose.position.y, node.pose.position.z], rotation: [node.pose.rotation.x, node.pose.rotation.y, node.pose.rotation.z], children: [node.type === 'breadboard-half' ? (_jsx(BreadboardVisual, { dim: def.dimensions })) : node.type === 'arduino-uno' ? (_jsx(UnoVisual, { dim: def.dimensions, isLive: node.hardware_target === 'arduino-uno' && transportConnected })) : node.type === 'arduino-nano' ? (_jsx(NanoVisual, { dim: def.dimensions })) : node.type === 'fpga-basys3' ? (_jsx(FpgaBoardVisual, { node: node })) : node.type === 'led-5mm' ? (_jsx(LedVisual, { isOn: isLeOn })) : node.type === 'resistor-dip' ? (_jsx(ResistorVisual, {})) : (_jsxs(_Fragment, { children: [_jsx(Box, { args: [def.dimensions.x, def.dimensions.y, def.dimensions.z], ref: (el) => {
                            if (el)
                                nodeRefs.current.set(node.id, el);
                            else
                                nodeRefs.current.delete(node.id);
                        }, onClick: (e) => { e.stopPropagation(); onSelect?.(node.id); }, children: _jsx("meshStandardMaterial", { color: "#888" }) }), _jsx(Text, { position: [0, def.dimensions.y / 2 + 0.15, 0], fontSize: 0.25, color: "white", rotation: [-Math.PI / 2, 0, 0], children: def.name })] })), def.pins.map(pin => {
                const isHovered = hoveredPin?.nodeId === node.id && hoveredPin?.pinId === pin.id;
                const pinNetId = selectedNetId ? pinToNetId[`${node.id}:${pin.id}`] : null;
                const isNetSelected = selectedNetId && pinNetId === selectedNetId;
                const isHighlighted = highlightedPins.some((h) => h.nodeId === node.id && h.pinId === pin.id);
                const pinColor = isHovered ? '#2ecc71'
                    : isHighlighted ? '#00d4ff'
                        : isNetSelected ? '#00d4ff'
                            : '#c0a000';
                return (_jsxs("group", { position: [pin.position.x, pin.position.y, pin.position.z], children: [_jsxs("mesh", { visible: false, onPointerOver: (e) => handlePinHover(node.id, pin.id, e), onPointerOut: (e) => handlePinUnhover(node.id, pin.id, e), onClick: (e) => {
                                if (readOnly) {
                                    e.stopPropagation();
                                    onEditAttempt?.();
                                    return;
                                }
                                handlePinClick(node.id, pin.id, e);
                            }, children: [_jsx("boxGeometry", { args: [0.3, 0.4, 0.3] }), _jsx("meshBasicMaterial", { transparent: true, opacity: 0.0 })] }), 
                        // Only show pin visual if not buried inside breadboard (breadboard holes are implicit)
                        node.type !== 'breadboard-half' && (_jsx(Box, { args: [0.08, 0.08, 0.08], children: _jsx("meshBasicMaterial", { color: pinColor }) })), node.type === 'breadboard-half' && (isHovered || isHighlighted || isNetSelected) && (_jsx(Box, { args: [0.15, 0.02, 0.15], position: [0, 0.06, 0], children: _jsx("meshBasicMaterial", { color: pinColor }) })), isHovered && (_jsx(Text, { position: [0, 0.25, 0], fontSize: 0.15, color: "white", anchorX: "center", anchorY: "bottom", outlineWidth: 0.02, outlineColor: "black", children: pin.id }))] }, pin.id));
            })] }));
};
// --- Ghost Wire Renderer ---
const GhostWire = () => {
    const interaction = useLabStore(state => state.interaction);
    const nodes = useLabStore(state => state.graph.nodes);
    if (interaction.mode !== 'wire' || !interaction.wireStartPin || !interaction.dragPosition)
        return null;
    const startNode = nodes.find(n => n.id === interaction.wireStartPin.nodeId);
    if (!startNode)
        return null;
    const startDef = PART_DEFINITIONS[startNode.type];
    const pinDef = startDef?.pins.find(p => p.id === interaction.wireStartPin.pinId);
    if (!pinDef)
        return null;
    const startPos = [
        startNode.pose.position.x + pinDef.position.x,
        startNode.pose.position.y + pinDef.position.y,
        startNode.pose.position.z + pinDef.position.z
    ];
    const endPos = [
        interaction.dragPosition.x,
        interaction.dragPosition.y,
        interaction.dragPosition.z
    ];
    return (_jsx(Line, { points: [startPos, endPos], color: "#2ecc71", lineWidth: 2, dashed: true, dashScale: 2, dashSize: 0.5, opacity: 0.7, transparent: true }));
};
const LabInteractionLayer = () => {
    const { handlePointerMove } = useLabInteraction();
    return (_jsx("mesh", { visible: false, onPointerMove: handlePointerMove, position: [0, 0, 0], rotation: [-Math.PI / 2, 0, 0], children: _jsx("planeGeometry", { args: [100, 100] }) }));
};
export const Rb3DSceneLab = ({ width = '100%', height = '100%', active = true, readOnly = false, onEditAttempt, }) => {
    const { graph, selectedNetId, selectedNodeId, pinStates: wirePinStates } = useLabStore(useShallow(state => ({
        graph: state.graph,
        selectedNetId: state.interaction.selectedNetId,
        selectedNodeId: state.interaction.selectedNodeId,
        pinStates: state.simulation.pinStates,
    })));
    const setSelectedNodeId = useLabStore(state => state.setSelectedNodeId);
    const updateNodePose = useLabStore(state => state.updateNodePose);
    const netlist = useMemo(() => computeNetlist(graph), [graph]);
    // Track refs for TransformControls
    const nodeRefs = React.useRef(new Map());
    const activeTransformTarget = useMemo(() => {
        if (!selectedNodeId)
            return undefined;
        return nodeRefs.current.get(selectedNodeId);
    }, [selectedNodeId, graph.nodes]);
    const handleTransformEnd = (e) => {
        if (readOnly) {
            onEditAttempt?.();
            return;
        }
        const target = e?.target?.object;
        if (target && selectedNodeId) {
            updateNodePose(selectedNodeId, { x: target.position.x, y: target.position.y, z: target.position.z }, { x: target.quaternion.x, y: target.quaternion.y, z: target.quaternion.z, w: target.quaternion.w });
        }
    };
    return (_jsxs(Rb3DViewport, { width: width, height: height, active: active, cameraPosition: [0, 8, 4], cameraTarget: [0, 0, 0], children: [!readOnly && activeTransformTarget && (_jsx(TransformControls, { object: activeTransformTarget, mode: "translate", showY: false, onMouseUp: handleTransformEnd })), !readOnly && _jsx(LabInteractionLayer, {}), _jsx("ambientLight", { intensity: 0.5 }), _jsx("directionalLight", { position: [5, 10, 5], intensity: 1 }), _jsx("gridHelper", { args: [20, 20, 0x444444, 0x222222] }), graph.nodes.map(node => (_jsx(PartMesh, { node: node, pinToNetId: netlist.pinToNetId, isSelected: selectedNodeId === node.id, onSelect: setSelectedNodeId, nodeRefs: nodeRefs, readOnly: readOnly, onEditAttempt: onEditAttempt }, node.id))), graph.wires.map(wire => {
                const sourceNode = graph.nodes.find(n => n.id === wire.sourceNodeId);
                const targetNode = graph.nodes.find(n => n.id === wire.targetNodeId);
                if (!sourceNode || !targetNode)
                    return null;
                const sourceDef = PART_DEFINITIONS[sourceNode.type];
                const targetDef = PART_DEFINITIONS[targetNode.type];
                const sPin = sourceDef.pins.find(p => p.id === wire.sourcePinId);
                const tPin = targetDef.pins.find(p => p.id === wire.targetPinId);
                if (!sPin || !tPin)
                    return null;
                const from = [
                    sourceNode.pose.position.x + sPin.position.x,
                    sourceNode.pose.position.y + sPin.position.y,
                    sourceNode.pose.position.z + sPin.position.z
                ];
                const to = [
                    targetNode.pose.position.x + tPin.position.x,
                    targetNode.pose.position.y + tPin.position.y,
                    targetNode.pose.position.z + tPin.position.z
                ];
                const val = wirePinStates[`${wire.sourceNodeId}:${wire.sourcePinId}`];
                const isActive = val === 1;
                const sourceKey = `${wire.sourceNodeId}:${wire.sourcePinId}`;
                const targetKey = `${wire.targetNodeId}:${wire.targetPinId}`;
                const isSelectedNet = selectedNetId &&
                    netlist.pinToNetId[sourceKey] === selectedNetId &&
                    netlist.pinToNetId[targetKey] === selectedNetId;
                return (_jsx(WireMesh, { from: from, to: to, isActive: isActive, pulse: isActive ? 1 : 0, probeColors: isSelectedNet ? ['#00d4ff'] : undefined }, wire.id));
            }), !readOnly && _jsx(GhostWire, {})] }));
};
