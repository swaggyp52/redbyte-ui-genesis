import { Canvas } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import React, { useRef } from "react";

export default function ParticleField() {
  const ref = useRef<any>();
  const count = 4000;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 10;
  }

  return (
    <Canvas className="particles-canvas" camera={{ position: [0, 0, 2] }}>
      <Points ref={ref} positions={positions} stride={3}>
        <PointMaterial size={0.01} color="#ff0033" transparent />
      </Points>
    </Canvas>
  );
}

