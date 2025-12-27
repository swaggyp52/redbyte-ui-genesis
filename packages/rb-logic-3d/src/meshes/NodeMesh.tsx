// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useRef, useMemo, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { createNeonMaterial, NODE_COLORS } from '../materials/neonMaterial';
import { createNodeGeometry, getGeometryRotation, getGeometryScale } from './geometries';
import { SelectionGlow } from '../components/SelectionGlow';

interface NodeMeshProps {
  id: string;
  type: string;
  position: [number, number, number];
  isActive: boolean;
  isSelected?: boolean;
  onSelect?: (nodeId: string, additive: boolean) => void;
  onHover?: (nodeId: string | null) => void;
}

export const NodeMesh: React.FC<NodeMeshProps> = ({
  id,
  type,
  position,
  isActive,
  isSelected = false,
  onSelect,
  onHover,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const material = useMemo(() => {
    const color = NODE_COLORS[type] || '#94a3b8';
    return createNeonMaterial(color, isActive);
  }, [type, isActive]);

  const geometry = useMemo(() => createNodeGeometry(type), [type]);
  const rotation = useMemo(() => getGeometryRotation(type), [type]);
  const scale = useMemo(() => getGeometryScale(type), [type]);

  useFrame(() => {
    if (meshRef.current) {
      // Update emissive intensity based on active state
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const targetIntensity = isActive ? 0.8 : 0;
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetIntensity, 0.1);
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (onSelect) {
      onSelect(id, event.shiftKey);
    }
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    if (onHover) {
      onHover(id);
    }
  };

  const handlePointerOut = () => {
    setHovered(false);
    if (onHover) {
      onHover(null);
    }
  };

  return (
    <mesh
      ref={meshRef}
      position={position}
      material={material}
      geometry={geometry}
      rotation={rotation}
      scale={scale}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      userData={{ nodeId: id }}
    >
      <SelectionGlow isSelected={isSelected} isHovered={hovered} />
    </mesh>
  );
};
