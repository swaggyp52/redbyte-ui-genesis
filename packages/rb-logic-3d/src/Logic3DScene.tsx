// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import type { CircuitEngine } from '@redbyte/rb-logic-core';
import { ViewAdapter } from '@redbyte/rb-logic-adapter';
import { NodeMesh } from './meshes/NodeMesh';
import { WireMesh } from './meshes/WireMesh';
import { use3DEngineSync } from './hooks/use3DEngineSync';
import { NodeLabel } from './components/NodeLabel';
import { SignalParticleSystem } from './components/SignalParticle';

interface Logic3DSceneProps {
  engine: CircuitEngine;
  width?: number;
  height?: number;
  viewStateStore?: any; // Global view state store for selection sync
}

const Scene: React.FC<{
  engine: CircuitEngine;
  viewStateStore?: any;
}> = ({ engine, viewStateStore }) => {
  const signals = use3DEngineSync(engine);
  const adapter = React.useMemo(() => new ViewAdapter(engine, '3d'), [engine]);
  const viewState = adapter.computeViewState();

  // Get selection state from global store if available
  const selectedNodeIds = viewStateStore?.getState?.()?.selectedNodeIds || new Set<string>();

  const handleNodeSelect = useCallback(
    (nodeId: string, additive: boolean) => {
      if (viewStateStore) {
        viewStateStore.getState().selectNodes([nodeId], additive);
      }
    },
    [viewStateStore]
  );

  const handleNodeHover = useCallback(
    (nodeId: string | null) => {
      if (viewStateStore) {
        viewStateStore.getState().setHoveredNode(nodeId);
      }
    },
    [viewStateStore]
  );

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
        const position: [number, number, number] = [node.view.x / 20, 0.25, node.view.y / 20];
        const isSelected = selectedNodeIds.has(node.id);

        return (
          <React.Fragment key={node.id}>
            <NodeMesh
              id={node.id}
              type={node.type}
              position={position}
              isActive={isActive}
              isSelected={isSelected}
              onSelect={handleNodeSelect}
              onHover={handleNodeHover}
            />
            <NodeLabel position={position} type={node.type} nodeId={node.id} />
          </React.Fragment>
        );
      })}

      {/* Wires with signal particles */}
      {viewState.wires.map((wire) => {
        const fromNode = viewState.nodes.find((n) =>
          wire.id.startsWith(n.id)
        );
        const signalKey = wire.id.split('-')[0];
        const isActive = signals.get(signalKey) === 1;
        const from: [number, number, number] = [wire.from.x / 20, 0.25, wire.from.y / 20];
        const to: [number, number, number] = [wire.to.x / 20, 0.25, wire.to.y / 20];

        return (
          <React.Fragment key={wire.id}>
            <WireMesh from={from} to={to} isActive={isActive} />
            {isActive && (
              <SignalParticleSystem from={from} to={to} isActive={isActive} wireId={wire.id} />
            )}
          </React.Fragment>
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
  viewStateStore,
}) => {
  return (
    <div style={{ width, height }}>
      <Canvas camera={{ position: [10, 10, 10], fov: 50 }}>
        <color attach="background" args={['#0a0a0a']} />
        <fog attach="fog" args={['#0a0a0a', 20, 60]} />
        <Scene engine={engine} viewStateStore={viewStateStore} />
      </Canvas>
    </div>
  );
};
