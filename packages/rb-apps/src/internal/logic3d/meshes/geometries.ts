// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import * as THREE from 'three';

/**
 * Factory function to create geometry based on node type
 * Returns visually distinct shapes for different gate types
 */
export function createNodeGeometry(type: string): THREE.BufferGeometry {
  switch (type) {
    case 'AND':
    case 'NAND':
      // Box geometry for AND gates
      return new THREE.BoxGeometry(1, 1, 0.5);

    case 'OR':
    case 'NOR':
      // Sphere geometry for OR gates
      return new THREE.SphereGeometry(0.5, 16, 16);

    case 'NOT':
    case 'Inverter':
      // Cone geometry for NOT gates
      return new THREE.ConeGeometry(0.5, 1, 16);

    case 'XOR':
    case 'XNOR':
      // Torus geometry for XOR gates
      return new THREE.TorusGeometry(0.4, 0.2, 16, 32);

    case 'Clock':
      // Cylinder geometry for Clock
      return new THREE.CylinderGeometry(0.5, 0.5, 0.8, 16);

    case 'Switch':
    case 'PowerSource':
      // Octahedron for inputs/sources
      return new THREE.OctahedronGeometry(0.5);

    case 'Lamp':
    case 'Probe':
      // Icosahedron for outputs/displays
      return new THREE.IcosahedronGeometry(0.5);

    case 'DFlipFlop':
    case 'JKFlipFlop':
    case 'RSLatch':
      // Larger box for flip-flops and latches
      return new THREE.BoxGeometry(1.2, 1.2, 0.6);

    case 'FullAdder':
    case 'Counter4Bit':
      // Even larger box for complex chips
      return new THREE.BoxGeometry(1.5, 1.5, 0.7);

    default:
      // For custom chips, create extruded polygon
      if (type.length > 0) {
        // Create a hexagonal shape for custom chips
        const shape = new THREE.Shape();
        const sides = 6;
        const radius = 0.6;

        for (let i = 0; i < sides; i++) {
          const angle = (i / sides) * Math.PI * 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          if (i === 0) {
            shape.moveTo(x, y);
          } else {
            shape.lineTo(x, y);
          }
        }
        shape.closePath();

        const extrudeSettings = {
          depth: 0.4,
          bevelEnabled: true,
          bevelThickness: 0.05,
          bevelSize: 0.05,
          bevelSegments: 2,
        };

        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
      }

      // Fallback: box geometry
      return new THREE.BoxGeometry(1, 1, 0.5);
  }
}

/**
 * Get recommended rotation for a geometry type
 * Some geometries look better with specific orientations
 */
export function getGeometryRotation(type: string): [number, number, number] {
  switch (type) {
    case 'NOT':
    case 'Inverter':
      // Point cone upward
      return [0, 0, 0];

    case 'XOR':
    case 'XNOR':
      // Rotate torus to lie flat
      return [Math.PI / 2, 0, 0];

    default:
      return [0, 0, 0];
  }
}

/**
 * Get scale multiplier for specific node types
 * Allows fine-tuning size for visual consistency
 */
export function getGeometryScale(type: string): number {
  switch (type) {
    case 'Clock':
    case 'Switch':
    case 'PowerSource':
      return 0.9; // Slightly smaller for input sources

    case 'Lamp':
    case 'Probe':
      return 0.8; // Smaller for outputs

    case 'DFlipFlop':
    case 'JKFlipFlop':
    case 'RSLatch':
      return 1.1; // Slightly larger for flip-flops

    case 'FullAdder':
    case 'Counter4Bit':
      return 1.3; // Larger for complex components

    default:
      return 1.0;
  }
}
