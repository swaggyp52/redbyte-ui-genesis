// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useRef, useMemo, useState, useEffect } from 'react';
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
  isMismatch?: boolean;
  pulse?: number;
  onSelect?: (nodeId: string, additive: boolean) => void;
  onHover?: (nodeId: string | null) => void;
}

export const NodeMesh = React.forwardRef<THREE.Mesh, NodeMeshProps>(({
  id,
  type,
  position,
  isActive,
  isSelected = false,
  isMismatch = false,
  pulse = 0,
  onSelect,
  onHover,
}, ref) => {
  const localRef = useRef<THREE.Mesh>(null);

  // Merge refs so both local usage and parent access work
  React.useImperativeHandle(ref, () => localRef.current as THREE.Mesh);

  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const material = useMemo(() => {
    const color = isMismatch ? '#f97316' : NODE_COLORS[type] || '#94a3b8';
    return createNeonMaterial(color, isActive || isMismatch);
  }, [type, isActive, isMismatch]);

  const geometry = useMemo(() => createNodeGeometry(type), [type]);
  const rotation = useMemo(() => getGeometryRotation(type), [type]);
  const scale = useMemo(() => getGeometryScale(type), [type]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(() => {
    if (localRef.current) {
      // Update emissive intensity based on active state
      const mat = localRef.current.material as THREE.MeshStandardMaterial;
      const pulseBoost = pulse * 0.6;
      const targetIntensity = (isActive ? 0.8 : 0) + pulseBoost;
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetIntensity, 0.1);
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!isDragging && onSelect) {
      onSelect(id, event.shiftKey);
    }
    setIsDragging(false);
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setIsDragging(false);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (event.buttons > 0) {
      setIsDragging(true);
    }
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    document.body.style.cursor = isSelected ? 'grab' : 'pointer';
    if (onHover) {
      onHover(id);
    }
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'default';
    if (onHover) {
      onHover(null);
    }
  };

  return (
    <mesh
      ref={localRef}
      position={position}
      material={material}
      geometry={geometry}
      rotation={rotation}
      scale={scale}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      userData={{ nodeId: id }}
    >
      <SelectionGlow isSelected={isSelected} isHovered={hovered} />
    </mesh>
  );
});

NodeMesh.displayName = 'NodeMesh';
