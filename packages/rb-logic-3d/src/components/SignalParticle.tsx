// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Particle {
  id: string;
  progress: number;
  active: boolean;
  spawnTime: number;
}

interface SignalParticleSystemProps {
  from: [number, number, number];
  to: [number, number, number];
  isActive: boolean;
  wireId: string;
  currentTime: number; // ms
}

const PARTICLE_SPEED = 2;
const TRAVERSAL_DURATION = 1 / PARTICLE_SPEED;
const SPAWN_INTERVAL = 0.12; // Denser particle flow

export const SignalParticleSystem: React.FC<SignalParticleSystemProps> = ({
  from,
  to,
  isActive,
  wireId,
  currentTime,
}) => {
  // Create curve path
  const curve = React.useMemo(() => {
    const fromVec = new THREE.Vector3(...from);
    const toVec = new THREE.Vector3(...to);

    // Add slight arc
    const midPoint = new THREE.Vector3().lerpVectors(fromVec, toVec, 0.5);
    midPoint.y += 0.3;

    return new THREE.CatmullRomCurve3([fromVec, midPoint, toVec]);
  }, [from, to]);

  // Purely functional particle determination
  // We want particles spawned at t = k * SPAWN_INTERVAL
  // such that their age at currentTime is < TRAVERSAL_DURATION
  // AND they were spawned after the wire became active (if we tracked that).
  // For A+++ visual polish, we assume "Active" acts as a gate.
  // If not active, no particles. If active, we render the "steady state" stream.
  // This avoids storing "when did it become active".

  if (!isActive) return null;

  const nowSec = currentTime / 1000;

  // Particles live from age 0 to TRAVERSAL_DURATION
  // SpawnTime = k * SPAWN_INTERVAL
  // Age = nowSec - SpawnTime
  // 0 <= nowSec - k*INTERVAL <= TRAVERSAL_DURATION
  // k*INTERVAL <= nowSec
  // k*INTERVAL >= nowSec - TRAVERSAL_DURATION

  // k <= nowSec / INTERVAL
  // k >= (nowSec - TRAVERSAL_DURATION) / INTERVAL

  const threadOffset = 0; // Could use wireId hash to offset phases if desired

  const minK = Math.ceil((nowSec - TRAVERSAL_DURATION) / SPAWN_INTERVAL);
  const maxK = Math.floor(nowSec / SPAWN_INTERVAL);

  const particles = [];
  for (let k = minK; k <= maxK; k++) {
    const spawnTime = k * SPAWN_INTERVAL;
    const age = nowSec - spawnTime;
    const progress = age * PARTICLE_SPEED;

    // Safety clamp (though mathematical bounds should hold)
    if (progress >= 0 && progress <= 1) {
      particles.push({ k, progress });
    }
  }

  return (
    <>
      {particles.map(({ k, progress }) => {
        const position = curve.getPointAt(progress);
        // Gentle vertical oscillation for arc feel
        const yOffset = Math.sin(progress * Math.PI) * 0.08;
        const fade = progress > 0.8 ? (1 - progress) / 0.2 : 1;

        return (
          <mesh key={`${wireId}-p-${k}`} position={[position.x, position.y + yOffset, position.z]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial
              color="#D4930D"
              emissive="#D4930D"
              emissiveIntensity={1.2}
              transparent
              opacity={fade}
            />
          </mesh>
        );
      })}
    </>
  );
};
