// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import type { CircuitEngine } from '@redbyte/rb-logic-core';
import { ViewAdapter } from '@redbyte/rb-logic-adapter';
import { NodeMesh } from './meshes/NodeMesh';
import { WireMesh } from './meshes/WireMesh';
import { use3DEngineSync } from './hooks/use3DEngineSync';

interface Logic3DSceneProps {
  engine: CircuitEngine;
  width?: number;
  height?: number;
}

const Scene: React.FC<{ engine: CircuitEngine }> = ({ engine }) => {
  const signals = use3DEngineSync(engine);
  const adapter = React.useMemo(() => new ViewAdapter(engine, '3d'), [engine]);
  const viewState = adapter.computeViewState();

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={1} />

      {/* Grid floor */}
      <Grid args={[100, 100]} cellColor="#333" sectionColor="#555" fadeDistance={50} />

      {/* Nodes */}
      {viewState.nodes.map((node) => {
        const isActive = signals.get(`${node.id}.out`) === 1;
        return (
          <NodeMesh
            key={node.id}
            id={node.id}
            type={node.type}
            position={[node.view.x / 20, 0.25, node.view.y / 20]}
            isActive={isActive}
          />
        );
      })}

      {/* Wires */}
      {viewState.wires.map((wire) => {
        const fromNode = viewState.nodes.find((n) =>
          wire.id.startsWith(n.id)
        );
        const signalKey = wire.id.split('-')[0];
        const isActive = signals.get(signalKey) === 1;

        return (
          <WireMesh
            key={wire.id}
            from={[wire.from.x / 20, 0.25, wire.from.y / 20]}
            to={[wire.to.x / 20, 0.25, wire.to.y / 20]}
            isActive={isActive}
          />
        );
      })}

      {/* Camera controls */}
      <OrbitControls makeDefault />
    </>
  );
};

export const Logic3DScene: React.FC<Logic3DSceneProps> = ({
  engine,
  width = 800,
  height = 600,
}) => {
  return (
    <div style={{ width, height }}>
      <Canvas camera={{ position: [10, 10, 10], fov: 50 }}>
        <color attach="background" args={['#0a0a0a']} />
        <fog attach="fog" args={['#0a0a0a', 20, 60]} />
        <Scene engine={engine} />
      </Canvas>
    </div>
  );
};
