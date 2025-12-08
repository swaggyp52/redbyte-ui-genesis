// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import * as THREE from 'three';

export function createNeonMaterial(color: string, isActive: boolean): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: isActive ? color : '#2a2a2a',
    emissive: isActive ? color : '#000000',
    emissiveIntensity: isActive ? 0.8 : 0,
    metalness: 0.3,
    roughness: 0.4,
  });

  return material;
}

export const NODE_COLORS: Record<string, string> = {
  PowerSource: '#4ade80',
  Switch: '#60a5fa',
  Lamp: '#fbbf24',
  Wire: '#94a3b8',
  AND: '#c084fc',
  OR: '#f472b6',
  NOT: '#fb923c',
  NAND: '#a78bfa',
  XOR: '#ec4899',
  Clock: '#22d3ee',
  Delay: '#a3e635',
};
