import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import React, { useRef } from "react";

function ShaderSurface() {
  const mesh = useRef<any>();

  useFrame(({ clock }) => {
    mesh.current.material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh ref={mesh} scale={[10, 10, 1]}>
      <planeGeometry args={[2, 2, 256, 256]} />
      <shaderMaterial
        uniforms={{
          uTime: { value: 0 },
        }}
        vertexShader={\`
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 pos = position;
            pos.z += sin(pos.x * 4.0 + uTime) * 0.15;
            pos.z += cos(pos.y * 5.0 + uTime * 0.5) * 0.15;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        \`}
        fragmentShader={\`
          varying vec2 vUv;
          void main() {
            float glow = 0.15 / distance(vUv, vec2(0.5));
            vec3 neon = vec3(1.0, 0.1, 0.2) * glow * 2.0;
            gl_FragColor = vec4(neon, 1.0);
          }
        \`}
      />
    </mesh>
  );
}

export default function ShaderPlane() {
  return (
    <Canvas className="shader-bg" camera={{ position: [0, 0, 2] }}>
      <ShaderSurface />
    </Canvas>
  );
}

