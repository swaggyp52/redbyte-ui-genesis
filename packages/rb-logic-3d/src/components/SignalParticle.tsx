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
}

const PARTICLE_SPEED = 2; // Units per second
const PARTICLE_LIFETIME = 1; // Seconds before particle fades
const MAX_PARTICLES = 10; // Maximum particles per wire
const SPAWN_INTERVAL = 0.2; // Seconds between particle spawns

export const SignalParticleSystem: React.FC<SignalParticleSystemProps> = ({
  from,
  to,
  isActive,
  wireId,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const lastSpawnTime = useRef<number>(0);

  // Create curve path for particles to follow
  const curve = React.useMemo(() => {
    const fromVec = new THREE.Vector3(...from);
    const toVec = new THREE.Vector3(...to);

    // Add slight arc to the path for visual interest
    const midPoint = new THREE.Vector3().lerpVectors(fromVec, toVec, 0.5);
    midPoint.y += 0.3; // Lift mid-point slightly

    return new THREE.CatmullRomCurve3([fromVec, midPoint, toVec]);
  }, [from, to]);

  // Spawn particles when signal is active
  useEffect(() => {
    if (!isActive) {
      // Clear particles when signal becomes inactive
      setParticles([]);
      lastSpawnTime.current = 0;
      return;
    }
  }, [isActive]);

  useFrame((state, delta) => {
    if (!isActive) return;

    const currentTime = state.clock.elapsedTime;

    // Spawn new particle if enough time has passed
    if (
      currentTime - lastSpawnTime.current >= SPAWN_INTERVAL &&
      particles.filter((p) => p.active).length < MAX_PARTICLES
    ) {
      const newParticle: Particle = {
        id: `${wireId}-${currentTime}`,
        progress: 0,
        active: true,
        spawnTime: currentTime,
      };

      setParticles((prev) => [...prev, newParticle]);
      lastSpawnTime.current = currentTime;
    }

    // Update particle positions
    setParticles((prev) =>
      prev
        .map((p) => {
          if (!p.active) return p;

          const age = currentTime - p.spawnTime;
          if (age > PARTICLE_LIFETIME) {
            return { ...p, active: false };
          }

          const newProgress = p.progress + delta * PARTICLE_SPEED;
          return {
            ...p,
            progress: newProgress > 1 ? 1 : newProgress,
            active: newProgress <= 1,
          };
        })
        .filter((p) => p.active) // Remove inactive particles
    );
  });

  return (
    <>
      {particles.map((particle) => {
        const position = curve.getPointAt(particle.progress);
        const age = Date.now() / 1000 - particle.spawnTime;
        const opacity = Math.max(0, 1 - age / PARTICLE_LIFETIME);

        return (
          <mesh key={particle.id} position={[position.x, position.y, position.z]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial
              color="#00ffff"
              emissive="#00ffff"
              emissiveIntensity={1}
              transparent
              opacity={opacity}
            />
          </mesh>
        );
      })}
    </>
  );
};
