// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import * as THREE from 'three';

interface WireMeshProps {
  from: [number, number, number];
  to: [number, number, number];
  isActive: boolean;
}

export const WireMesh: React.FC<WireMeshProps> = ({ from, to, isActive }) => {
  const points = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeometry = new THREE.TubeGeometry(curve, 10, 0.05, 8, false);

  return (
    <mesh geometry={tubeGeometry}>
      <meshStandardMaterial
        color={isActive ? '#22c55e' : '#6b7280'}
        emissive={isActive ? '#22c55e' : '#000000'}
        emissiveIntensity={isActive ? 0.6 : 0}
      />
    </mesh>
  );
};
