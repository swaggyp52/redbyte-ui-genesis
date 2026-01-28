import React, { useMemo, useRef } from 'react';
import { Box, Cylinder, Text } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

interface Rb3DSceneBoardProps {
    leds?: number; // 8-bit integer
    switches?: number; // 8-bit integer
    buttons?: number; // 4-bit integer
    sevenSeg?: number; // Complicated to decode 7-seg logic here, maybe just pass a display value or skip for MVP
    onSwitchToggle?: (index: number, newValue: boolean) => void;
    onButtonPress?: (index: number) => void;
    onButtonRelease?: (index: number) => void;
}

const PCBMaterial = new THREE.MeshStandardMaterial({ color: '#004400', roughness: 0.8, metalness: 0.1 });
const ComponentBlackMaterial = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.5 });
const ComponentSilverMaterial = new THREE.MeshStandardMaterial({ color: '#cccccc', roughness: 0.2, metalness: 0.8 });
const LEDOffMaterial = new THREE.MeshStandardMaterial({ color: '#330000', roughness: 0.3, emissive: '#330000', emissiveIntensity: 0.1 });
const LEDOnMaterial = new THREE.MeshStandardMaterial({ color: '#ff0000', roughness: 0.3, emissive: '#ff0000', emissiveIntensity: 2 });

const SlideSwitch: React.FC<{
    index: number;
    isOn: boolean;
    position: [number, number, number];
    onToggle?: (index: number, newValue: boolean) => void;
}> = ({ index, isOn, position, onToggle }) => {
    return (
        <group position={position}>
            {/* Base */}
            <Box args={[0.6, 0.4, 1.2]} position={[0, 0.2, 0]}>
                <meshStandardMaterial color="#888" />
            </Box>
            {/* Actuator */}
            <Box
                args={[0.4, 0.6, 0.4]}
                position={[0, 0.5, isOn ? -0.3 : 0.3]}
                onClick={(e: ThreeEvent<PointerEvent>) => {
                    e.stopPropagation();
                    onToggle?.(index, !isOn);
                }}
            >
                <meshStandardMaterial color="#222" />
            </Box>
            <Text
                position={[0, 0, 1.0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.3}
                color="white"
            >
                SW{index}
            </Text>
        </group>
    );
};

const LED: React.FC<{
    index: number;
    isOn: boolean;
    position: [number, number, number];
}> = ({ index, isOn, position }) => {
    return (
        <group position={position}>
            <Cylinder args={[0.15, 0.15, 0.2]} position={[0, 0.1, 0]}>
                <primitive object={isOn ? LEDOnMaterial : LEDOffMaterial} />
            </Cylinder>
            <Box args={[0.4, 0.1, 0.4]} position={[0, 0.05, 0]}>
                <meshStandardMaterial color="#ccc" />
            </Box>
            <Text
                position={[0, 0, 0.5]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.2}
                color="white"
            >
                LD{index}
            </Text>
        </group>
    );
};

const PushButton: React.FC<{
    index: number;
    isPressed: boolean;
    position: [number, number, number];
    onPress?: (index: number) => void;
    onRelease?: (index: number) => void;
}> = ({ index, isPressed, position, onPress, onRelease }) => {
    return (
        <group position={position}>
            {/* Body */}
            <Box args={[0.8, 0.3, 0.8]} position={[0, 0.15, 0]}>
                <meshStandardMaterial color="#333" />
            </Box>
            {/* Button */}
            <Cylinder
                args={[0.25, 0.25, 0.4]}
                position={[0, isPressed ? 0.2 : 0.35, 0]}
                onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                    e.stopPropagation();
                    onPress?.(index);
                }}
                onPointerUp={(e: ThreeEvent<PointerEvent>) => {
                    e.stopPropagation();
                    onRelease?.(index);
                }}
                onPointerOut={(e: ThreeEvent<PointerEvent>) => {
                    // Release if dragging out?
                    // Simplification: only release on explicit up
                }}
            >
                <meshStandardMaterial color="#111" />
            </Cylinder>
            <Text
                position={[0, 0, 0.7]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.2}
                color="white"
            >
                BTN{index}
            </Text>
        </group>
    );
};

export const Rb3DSceneBoard: React.FC<Rb3DSceneBoardProps> = ({
    leds = 0,
    switches = 0,
    buttons = 0,
    onSwitchToggle,
    onButtonPress,
    onButtonRelease,
}) => {
    // Generate positions for components
    // Board size approx 15x10 units

    return (
        <group>
            {/* PCB Main Board */}
            <Box args={[14, 0.2, 10]} position={[0, -0.1, 0]}>
                <primitive object={PCBMaterial} />
            </Box>

            {/* FPGA Chip */}
            <Box args={[3, 0.5, 3]} position={[0, 0.25, 0]}>
                <primitive object={ComponentBlackMaterial} />
            </Box>
            <Text position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.3} color="#aaa">
                SPARTAN-3E
            </Text>

            {/* IO Headers (Decorative) */}
            <Box args={[12, 0.6, 0.8]} position={[0, 0.3, -4]}>
                <primitive object={ComponentBlackMaterial} />
            </Box>

            {/* Switches (Bottom Row) */}
            <group position={[-5, 0, 4]}>
                {Array.from({ length: 8 }).map((_, i) => (
                    <SlideSwitch
                        key={i}
                        index={i}
                        isOn={((switches >> i) & 1) === 1}
                        position={[i * 1.2, 0, 0]}
                        onToggle={onSwitchToggle}
                    />
                ))}
            </group>

            {/* LEDs (Above Switches) */}
            <group position={[-5, 0, 2.5]}>
                {Array.from({ length: 8 }).map((_, i) => (
                    <LED
                        key={i}
                        index={i}
                        isOn={((leds >> i) & 1) === 1}
                        position={[i * 1.2, 0, 0]}
                    />
                ))}
            </group>

            {/* Buttons (Right Side) */}
            <group position={[5, 0, 0]}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <PushButton
                        key={i}
                        index={i}
                        isPressed={((buttons >> i) & 1) === 1}
                        position={[0, 0, i * 1.5 - 2.25]}
                        onPress={onButtonPress}
                        onRelease={onButtonRelease}
                    />
                ))}
            </group>

        </group>
    );
};
