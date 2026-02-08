// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import * as THREE from 'three';
/**
 * Creates a physically-based gate material with metallic finish.
 * Active gates emit a subtle warm glow; inactive gates are dark gunmetal.
 */
export function createNeonMaterial(color, isActive) {
    const material = new THREE.MeshStandardMaterial({
        color: isActive ? color : '#1a1f26',
        emissive: isActive ? color : '#000000',
        emissiveIntensity: isActive ? 0.35 : 0,
        metalness: 0.75,
        roughness: 0.25,
        envMapIntensity: 0.5,
    });
    return material;
}
/** Instrument-toned palette — metallic, muted, purposeful */
export const NODE_COLORS = {
    PowerSource: '#2DD4BF', // Teal — power source
    Switch: '#60A5FA', // Steel blue — input control
    Lamp: '#D4930D', // Amber — output indicator
    Wire: '#6B7280', // Neutral steel
    AND: '#94A3B8', // Brushed silver
    OR: '#A1A1AA', // Light steel
    NOT: '#F59E0B', // Amber — inverter
    NAND: '#8B949E', // Darker silver
    NOR: '#78716C', // Warm gray
    XOR: '#818CF8', // Indigo — special logic
    XNOR: '#7C72E0', // Deeper indigo
    Clock: '#22D3EE', // Cyan — timing/signal
    Delay: '#6EE7B7', // Soft green — propagation
    DFlipFlop: '#A78BFA', // Violet — sequential
    JKFlipFlop: '#A78BFA', // Violet — sequential
    RSLatch: '#C084FC', // Light violet — latch
    FullAdder: '#F0ABFC', // Pink — arithmetic
    Counter4Bit: '#E879F9', // Magenta — complex
    Probe: '#D4930D', // Amber — measurement
    Inverter: '#F59E0B', // Amber — same as NOT
};
