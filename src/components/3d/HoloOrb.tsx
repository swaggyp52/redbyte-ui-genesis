import React from "react";
import { Canvas } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, OrbitControls } from "@react-three/drei";

export default function HoloOrb() {
  return (
    <Canvas camera={{ position: [0, 0, 4] }}>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} />

      <Sphere args={[1.3, 64, 64]}>
        <MeshDistortMaterial
          color="#ff0033"
          distort={0.4}
          speed={2}
          roughness={0}
        />
      </Sphere>

      <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={2} />
    </Canvas>
  );
}
