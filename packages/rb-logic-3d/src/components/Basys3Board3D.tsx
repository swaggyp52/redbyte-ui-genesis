// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Basys3Board3D — Digilent Basys3 (Artix-7) interactive 3D board model.
// 16 LEDs, 16 slide switches, 5-button cross layout (BTNC/BTNU/BTNL/BTNR/BTND).
// Mapped pins glow teal to show which signals the student's circuit connects to.

import React from 'react';
import { Box, Cylinder, Text } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Materials ────────────────────────────────────────────────────────────────

const PCBMaterial = new THREE.MeshStandardMaterial({
    color: '#1a3a1a',
    roughness: 0.75,
    metalness: 0.1,
});
const ComponentBlackMaterial = new THREE.MeshStandardMaterial({
    color: '#0d1117',
    roughness: 0.5,
    metalness: 0.05,
});
// Silkscreen text color on PCB: cream/white
const GoldTraceMaterial = new THREE.MeshStandardMaterial({
    color: '#c8a84b',
    roughness: 0.3,
    metalness: 0.8,
});
const LEDOffMaterial = new THREE.MeshStandardMaterial({
    color: '#1a2a1a',
    roughness: 0.3,
    emissive: '#001500',
    emissiveIntensity: 0.05,
});
const LEDOnMaterial = new THREE.MeshStandardMaterial({
    color: '#22ff44',
    roughness: 0.2,
    emissive: '#00ff22',
    emissiveIntensity: 2.5,
});
// Mapped-pin highlight material (teal outline glow)
const MappedPinMaterial = new THREE.MeshStandardMaterial({
    color: '#2ec4b6',
    roughness: 0.3,
    metalness: 0.0,
    emissive: '#1a8a82',
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.7,
});

// ─── BUTTON NAMES (Basys3 cross layout) ──────────────────────────────────────
/** Basys3 5-button names: index → name */
const BUTTON_NAMES: ReadonlyArray<string> = ['BTNC', 'BTNU', 'BTNL', 'BTNR', 'BTND'];
/** Basys3 5-button cross positions relative to button group center */
const BUTTON_OFFSETS: ReadonlyArray<[number, number, number]> = [
    [0, 0, 0],       // BTNC — center
    [0, 0, -1.6],    // BTNU — up (toward PCB top)
    [-1.6, 0, 0],    // BTNL
    [1.6, 0, 0],     // BTNR
    [0, 0, 1.6],     // BTND
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface Basys3Board3DProps {
    /** 16-bit bitmask: LD0 = bit 0, LD15 = bit 15 */
    leds?: number;
    /** 16-bit bitmask: SW0 = bit 0, SW15 = bit 15 */
    switches?: number;
    /** 5-bit bitmask: BTNC=0, BTNU=1, BTNL=2, BTNR=3, BTND=4 */
    buttons?: number;
    /**
     * Pin names currently mapped by the student's circuit, e.g. ['SW0','SW1','LD0','CLK100MHZ'].
     * These components get a subtle teal highlight so students see which physical pins matter.
     */
    mappedPins?: string[];
    onSwitchToggle?: (index: number, newValue: boolean) => void;
    onButtonPress?: (index: number) => void;
    onButtonRelease?: (index: number) => void;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface SlideSwitchProps {
    index: number;
    isOn: boolean;
    isMapped: boolean;
    position: [number, number, number];
    onToggle?: (index: number, newValue: boolean) => void;
}

const SlideSwitch: React.FC<SlideSwitchProps> = ({ index, isOn, isMapped, position, onToggle }) => (
    <group position={position}>
        {/* Housing */}
        <Box args={[0.55, 0.35, 1.1]} position={[0, 0.175, 0]}>
            <meshStandardMaterial color={isMapped ? '#1e3a4a' : '#555'} />
        </Box>
        {/* Actuator knob */}
        <Box
            args={[0.35, 0.5, 0.35]}
            position={[0, 0.45, isOn ? -0.28 : 0.28]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                onToggle?.(index, !isOn);
            }}
        >
            <meshStandardMaterial color={isMapped ? '#2ec4b6' : '#222'} emissive={isMapped ? '#155550' : '#000'} emissiveIntensity={isMapped ? 0.3 : 0} />
        </Box>
        {/* Mapped highlight ring */}
        {isMapped && (
            <Box args={[0.64, 0.08, 1.2]} position={[0, 0.04, 0]}>
                <primitive object={MappedPinMaterial} />
            </Box>
        )}
        <Text position={[0, 0, 0.9]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.22} color={isMapped ? '#2ec4b6' : '#aaa'}>
            SW{index}
        </Text>
    </group>
);

interface LEDProps {
    index: number;
    isOn: boolean;
    isMapped: boolean;
    position: [number, number, number];
}

const LEDComponent: React.FC<LEDProps> = ({ index, isOn, isMapped, position }) => (
    <group position={position}>
        {/* LED dome */}
        <Cylinder args={[0.14, 0.14, 0.18]} position={[0, 0.09, 0]}>
            <primitive object={isOn ? LEDOnMaterial : LEDOffMaterial} />
        </Cylinder>
        {/* Mount pads */}
        <Box args={[0.36, 0.08, 0.36]} position={[0, 0.04, 0]}>
            <meshStandardMaterial color="#aaa" metalness={0.6} roughness={0.2} />
        </Box>
        {/* Mapped highlight ring */}
        {isMapped && (
            <Cylinder args={[0.22, 0.22, 0.04]} position={[0, 0.02, 0]}>
                <primitive object={MappedPinMaterial} />
            </Cylinder>
        )}
        {/* Point light for lit LED */}
        {isOn && (
            <pointLight color="#22ff44" intensity={0.6} distance={2.5} decay={2} position={[0, 0.5, 0]} />
        )}
        <Text position={[0, 0, 0.45]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.18} color={isMapped ? '#2ec4b6' : '#999'}>
            LD{index}
        </Text>
    </group>
);

interface PushButtonProps {
    index: number;
    name: string;
    isPressed: boolean;
    isMapped: boolean;
    position: [number, number, number];
    onPress?: (index: number) => void;
    onRelease?: (index: number) => void;
}

const PushButton: React.FC<PushButtonProps> = ({ index, name, isPressed, isMapped, position, onPress, onRelease }) => (
    <group position={position}>
        <Box args={[0.8, 0.25, 0.8]} position={[0, 0.125, 0]}>
            <meshStandardMaterial color={isMapped ? '#1e3a4a' : '#333'} />
        </Box>
        <Cylinder
            args={[0.22, 0.22, 0.35]}
            position={[0, isPressed ? 0.18 : 0.3, 0]}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                onPress?.(index);
            }}
            onPointerUp={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                onRelease?.(index);
            }}
        >
            <meshStandardMaterial color={isMapped ? '#2ec4b6' : '#111'} emissive={isMapped ? '#155550' : '#000'} emissiveIntensity={isMapped ? 0.4 : 0} />
        </Cylinder>
        {isMapped && (
            <Box args={[0.9, 0.06, 0.9]} position={[0, 0.03, 0]}>
                <primitive object={MappedPinMaterial} />
            </Box>
        )}
        <Text position={[0, 0, 0.65]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.2} color={isMapped ? '#2ec4b6' : '#ccc'}>
            {name}
        </Text>
    </group>
);

// ─── Main Board ────────────────────────────────────────────────────────────────

export const Basys3Board3D: React.FC<Basys3Board3DProps> = ({
    leds = 0,
    switches = 0,
    buttons = 0,
    mappedPins = [],
    onSwitchToggle,
    onButtonPress,
    onButtonRelease,
}) => {
    const mappedSet = new Set(mappedPins);

    // Layout constants: board is ~20 units wide x 12 units deep
    const BOARD_W = 20;
    const BOARD_D = 12;
    // 16 switches/LEDs spread across the front section
    const SW_START_X = -(BOARD_W / 2) + 1.0;
    const SW_SPACING = (BOARD_W - 4.5) / 15; // fits 16 across

    return (
        <group>
            {/* ── PCB substrate ── */}
            <Box args={[BOARD_W, 0.18, BOARD_D]} position={[0, -0.09, 0]}>
                <primitive object={PCBMaterial} />
            </Box>

            {/* ── Gold trace strips (decorative) ── */}
            <Box args={[BOARD_W - 2, 0.04, 0.12]} position={[0, 0.02, 1.8]}>
                <primitive object={GoldTraceMaterial} />
            </Box>
            <Box args={[BOARD_W - 2, 0.04, 0.12]} position={[0, 0.02, 3.2]}>
                <primitive object={GoldTraceMaterial} />
            </Box>

            {/* ── FPGA chip (Artix-7) ── */}
            <Box args={[3.5, 0.45, 3.5]} position={[-2, 0.225, -2]}>
                <primitive object={ComponentBlackMaterial} />
            </Box>
            <Text position={[-2, 0.46, -2]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.28} color="#8ae1d0">
                ARTIX-7
            </Text>
            <Text position={[-2, 0.46, -1.4]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.18} color="#476a63">
                XC7A35T
            </Text>

            {/* ── DIGILENT logo area ── */}
            <Text position={[6, 0.1, -4.8]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.32} color="#2ec4b6">
                BASYS 3
            </Text>
            <Text position={[6, 0.1, -4.25]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.18} color="#476a63">
                DIGILENT
            </Text>

            {/* ── USB port (decorative, top-right) ── */}
            <Box args={[0.7, 0.45, 1.2]} position={[8.8, 0.225, -3]}>
                <meshStandardMaterial color="#888" metalness={0.7} roughness={0.2} />
            </Box>

            {/* ── VGA port (decorative, right edge) ── */}
            <Box args={[0.4, 0.7, 1.8]} position={[9.6, 0.35, 0]}>
                <meshStandardMaterial color="#22a" roughness={0.5} />
            </Box>

            {/* ── 7-segment display placeholder ── */}
            <Box args={[4.5, 0.2, 1.2]} position={[2.5, 0.1, -1.2]}>
                <meshStandardMaterial color="#111" />
            </Box>
            <Text position={[2.5, 0.21, -1.2]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.3} color="#234">
                8888
            </Text>

            {/* ── 16 Slide Switches ── */}
            <group>
                {Array.from({ length: 16 }).map((_, i) => (
                    <SlideSwitch
                        key={i}
                        index={i}
                        isOn={((switches >> i) & 1) === 1}
                        isMapped={mappedSet.has(`SW${i}`)}
                        position={[SW_START_X + i * SW_SPACING, 0, 4.8]}
                        onToggle={onSwitchToggle}
                    />
                ))}
            </group>

            {/* ── 16 LEDs (row above switches) ── */}
            <group>
                {Array.from({ length: 16 }).map((_, i) => (
                    <LEDComponent
                        key={i}
                        index={i}
                        isOn={((leds >> i) & 1) === 1}
                        isMapped={mappedSet.has(`LD${i}`)}
                        position={[SW_START_X + i * SW_SPACING, 0, 3.2]}
                    />
                ))}
            </group>

            {/* ── 5 Buttons in cross layout ── */}
            <group position={[5.5, 0, 1.0]}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <PushButton
                        key={i}
                        index={i}
                        name={BUTTON_NAMES[i]}
                        isPressed={((buttons >> i) & 1) === 1}
                        isMapped={mappedSet.has(BUTTON_NAMES[i])}
                        position={BUTTON_OFFSETS[i]}
                        onPress={onButtonPress}
                        onRelease={onButtonRelease}
                    />
                ))}
            </group>

            {/* ── Clock source indicator ── */}
            <Box args={[0.6, 0.35, 0.6]} position={[-7, 0.175, -2]}>
                <meshStandardMaterial color="#333" />
            </Box>
            <Text position={[-7, 0.36, -2]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.16} color={mappedSet.has('CLK100MHZ') ? '#2ec4b6' : '#666'}>
                100MHz
            </Text>

            {/* ── Mapped CLK ring ── */}
            {mappedSet.has('CLK100MHZ') && (
                <Box args={[0.8, 0.05, 0.8]} position={[-7, 0.025, -2]}>
                    <primitive object={MappedPinMaterial} />
                </Box>
            )}
        </group>
    );
};
