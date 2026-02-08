import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Cylinder, Text } from '@react-three/drei';
import * as THREE from 'three';
const PCBMaterial = new THREE.MeshStandardMaterial({ color: '#004400', roughness: 0.8, metalness: 0.1 });
const ComponentBlackMaterial = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.5 });
const ComponentSilverMaterial = new THREE.MeshStandardMaterial({ color: '#cccccc', roughness: 0.2, metalness: 0.8 });
const LEDOffMaterial = new THREE.MeshStandardMaterial({ color: '#330000', roughness: 0.3, emissive: '#330000', emissiveIntensity: 0.1 });
const LEDOnMaterial = new THREE.MeshStandardMaterial({ color: '#ff0000', roughness: 0.3, emissive: '#ff0000', emissiveIntensity: 2 });
const SlideSwitch = ({ index, isOn, position, onToggle }) => {
    return (_jsxs("group", { position: position, children: [_jsx(Box, { args: [0.6, 0.4, 1.2], position: [0, 0.2, 0], children: _jsx("meshStandardMaterial", { color: "#888" }) }), _jsx(Box, { args: [0.4, 0.6, 0.4], position: [0, 0.5, isOn ? -0.3 : 0.3], onClick: (e) => {
                    e.stopPropagation();
                    onToggle?.(index, !isOn);
                }, children: _jsx("meshStandardMaterial", { color: "#222" }) }), _jsxs(Text, { position: [0, 0, 1.0], rotation: [-Math.PI / 2, 0, 0], fontSize: 0.3, color: "white", children: ["SW", index] })] }));
};
const LED = ({ index, isOn, position }) => {
    return (_jsxs("group", { position: position, children: [_jsx(Cylinder, { args: [0.15, 0.15, 0.2], position: [0, 0.1, 0], children: _jsx("primitive", { object: isOn ? LEDOnMaterial : LEDOffMaterial }) }), _jsx(Box, { args: [0.4, 0.1, 0.4], position: [0, 0.05, 0], children: _jsx("meshStandardMaterial", { color: "#ccc" }) }), _jsxs(Text, { position: [0, 0, 0.5], rotation: [-Math.PI / 2, 0, 0], fontSize: 0.2, color: "white", children: ["LD", index] })] }));
};
const PushButton = ({ index, isPressed, position, onPress, onRelease }) => {
    return (_jsxs("group", { position: position, children: [_jsx(Box, { args: [0.8, 0.3, 0.8], position: [0, 0.15, 0], children: _jsx("meshStandardMaterial", { color: "#333" }) }), _jsx(Cylinder, { args: [0.25, 0.25, 0.4], position: [0, isPressed ? 0.2 : 0.35, 0], onPointerDown: (e) => {
                    e.stopPropagation();
                    onPress?.(index);
                }, onPointerUp: (e) => {
                    e.stopPropagation();
                    onRelease?.(index);
                }, onPointerOut: (e) => {
                    // Release if dragging out?
                    // Simplification: only release on explicit up
                }, children: _jsx("meshStandardMaterial", { color: "#111" }) }), _jsxs(Text, { position: [0, 0, 0.7], rotation: [-Math.PI / 2, 0, 0], fontSize: 0.2, color: "white", children: ["BTN", index] })] }));
};
export const Rb3DSceneBoard = ({ leds = 0, switches = 0, buttons = 0, onSwitchToggle, onButtonPress, onButtonRelease, }) => {
    // Generate positions for components
    // Board size approx 15x10 units
    return (_jsxs("group", { children: [_jsx(Box, { args: [14, 0.2, 10], position: [0, -0.1, 0], children: _jsx("primitive", { object: PCBMaterial }) }), _jsx(Box, { args: [3, 0.5, 3], position: [0, 0.25, 0], children: _jsx("primitive", { object: ComponentBlackMaterial }) }), _jsx(Text, { position: [0, 0.51, 0], rotation: [-Math.PI / 2, 0, 0], fontSize: 0.3, color: "#aaa", children: "SPARTAN-3E" }), _jsx(Box, { args: [12, 0.6, 0.8], position: [0, 0.3, -4], children: _jsx("primitive", { object: ComponentBlackMaterial }) }), _jsx("group", { position: [-5, 0, 4], children: Array.from({ length: 8 }).map((_, i) => (_jsx(SlideSwitch, { index: i, isOn: ((switches >> i) & 1) === 1, position: [i * 1.2, 0, 0], onToggle: onSwitchToggle }, i))) }), _jsx("group", { position: [-5, 0, 2.5], children: Array.from({ length: 8 }).map((_, i) => (_jsx(LED, { index: i, isOn: ((leds >> i) & 1) === 1, position: [i * 1.2, 0, 0] }, i))) }), _jsx("group", { position: [5, 0, 0], children: Array.from({ length: 4 }).map((_, i) => (_jsx(PushButton, { index: i, isPressed: ((buttons >> i) & 1) === 1, position: [0, 0, i * 1.5 - 2.25], onPress: onButtonPress, onRelease: onButtonRelease }, i))) })] }));
};
