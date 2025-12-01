import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as random from "maath/random";

export default function BackgroundEngine() {
  const positions = React.useMemo(() => random.inSphere(new Float32Array(5000), { radius: 1.5 }), []);

  return (
    <div className="rb-background">
      <Canvas camera={{ position: [0, 0, 1] }}>
        <Suspense fallback={null}>
          <Points positions={positions} stride={3} frustumCulled>
            <PointMaterial
              size={0.005}
              color="#ff1188"
              opacity={0.6}
              transparent
            />
          </Points>
        </Suspense>
      </Canvas>
    </div>
  );
}
