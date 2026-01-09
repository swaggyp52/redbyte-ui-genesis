// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';

interface WireMeshProps {
  from: [number, number, number];
  to: [number, number, number];
  isActive: boolean;
  pulse?: number;
  probeColors?: string[];
  mismatchColors?: string[];
}

export const WireMesh: React.FC<WireMeshProps> = ({
  from,
  to,
  isActive,
  pulse = 0,
  probeColors,
  mismatchColors,
}) => {
  const curve = useMemo(() => {
    const points = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
    return new THREE.CatmullRomCurve3(points);
  }, [from[0], from[1], from[2], to[0], to[1], to[2]]);
  const tubeGeometry = useMemo(() => new THREE.TubeGeometry(curve, 10, 0.05, 8, false), [curve]);
  const glowGeometry = useMemo(() => new THREE.TubeGeometry(curve, 10, 0.08, 8, false), [curve]);
  const pulseBoost = pulse * 0.6;
  const emissiveIntensity = (isActive ? 0.6 : 0.1) + pulseBoost;

  useEffect(() => {
    return () => {
      tubeGeometry.dispose();
      glowGeometry.dispose();
    };
  }, [tubeGeometry, glowGeometry]);

  return (
    <>
      {probeColors?.map((color, index) => (
        <mesh key={`${color}-${index}`} geometry={glowGeometry}>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.35}
            transparent
            opacity={0.45}
          />
        </mesh>
      ))}
      {mismatchColors?.map((color, index) => (
        <mesh key={`${color}-mismatch-${index}`} geometry={glowGeometry}>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.5}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}
      <mesh geometry={tubeGeometry}>
        <meshStandardMaterial
          color={isActive ? '#22c55e' : '#6b7280'}
          emissive={isActive ? '#22c55e' : '#000000'}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
    </>
  );
};
