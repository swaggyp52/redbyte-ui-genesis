// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createNeonMaterial, NODE_COLORS } from '../materials/neonMaterial';

interface NodeMeshProps {
  id: string;
  type: string;
  position: [number, number, number];
  isActive: boolean;
}

export const NodeMesh: React.FC<NodeMeshProps> = ({ id, type, position, isActive }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    const color = NODE_COLORS[type] || '#94a3b8';
    return createNeonMaterial(color, isActive);
  }, [type, isActive]);

  useFrame(() => {
    if (meshRef.current) {
      // Update emissive intensity based on active state
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const targetIntensity = isActive ? 0.8 : 0;
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetIntensity, 0.1);
    }
  });

  return (
    <mesh ref={meshRef} position={position} material={material}>
      <boxGeometry args={[1, 1, 0.5]} />
    </mesh>
  );
};
