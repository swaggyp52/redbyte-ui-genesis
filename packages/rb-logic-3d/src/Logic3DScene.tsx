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
  showHints?: boolean;
  onDismissHints?: () => void;
}

const Scene: React.FC<{
  engine: CircuitEngine;
  viewStateStore?: any;
}> = ({ engine, viewStateStore }) => {
  const signals = use3DEngineSync(engine);
  const adapter = React.useMemo(() => {
    if (!engine || typeof engine.getCircuit !== 'function') {
      return null;
    }
    return new ViewAdapter(engine, '3d');
  }, [engine]);

  const viewState = React.useMemo(() => {
    if (!adapter) {
      return { nodes: [], wires: [] };
    }
    return adapter.computeViewState();
  }, [adapter]);

  // Early return if no valid adapter
  if (!adapter) {
    return null;
  }

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

      {/* Camera controls with better settings */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
};

export const Logic3DScene: React.FC<Logic3DSceneProps> = ({
  engine,
  width = 800,
  height = 600,
  viewStateStore,
  showHints = true,
  onDismissHints,
}) => {
  const [showHelp, setShowHelp] = React.useState(false);
  const [webglFailed, setWebglFailed] = React.useState(false);
  const circuit = engine?.getCircuit?.();
  const hasNodes = circuit?.nodes?.length > 0;

  // Handle WebGL context loss
  React.useEffect(() => {
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.warn('WebGL context lost - 3D view disabled');
      setWebglFailed(true);
    };

    const handleContextRestored = () => {
      console.log('WebGL context restored');
      setWebglFailed(false);
    };

    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);

      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      };
    }
  }, []);

  if (webglFailed) {
    return (
      <div style={{ width, height, position: 'relative' }} className="flex items-center justify-center bg-gray-900">
        <div className="bg-gray-800/90 border border-yellow-700 rounded-lg p-6 text-center max-w-md">
          <div className="text-yellow-500 text-2xl mb-3">⚠️</div>
          <div className="font-semibold text-white mb-2">3D View Unavailable</div>
          <div className="text-sm text-gray-300 mb-4">
            WebGL context was lost. This can happen due to GPU driver issues or resource constraints.
          </div>
          <div className="text-xs text-gray-400">
            Switch to Circuit or Schematic view to continue working.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width, height, position: 'relative' }}>
      <Canvas
        camera={{ position: [10, 10, 10], fov: 50 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false
        }}
      >
        <color attach="background" args={['#0a0a0a']} />
        <fog attach="fog" args={['#0a0a0a', 20, 60]} />
        <Scene engine={engine} viewStateStore={viewStateStore} />
      </Canvas>

      {/* Empty state hints */}
      {!hasNodes && showHints && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-gray-800/90 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 space-y-2 max-w-sm pointer-events-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-white">🎮 3D View</div>
              {onDismissHints && (
                <button
                  onClick={onDismissHints}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  title="Dismiss hints"
                >
                  ✕
                </button>
              )}
            </div>
            <div><span className="text-cyan-400">Left Click + Drag:</span> Rotate camera</div>
            <div><span className="text-cyan-400">Right Click + Drag:</span> Pan camera</div>
            <div><span className="text-cyan-400">Scroll:</span> Zoom in/out</div>
            <div><span className="text-cyan-400">Click Node:</span> Select component</div>
            <div className="pt-2 border-t border-gray-700 text-gray-500">
              Visualize circuits in 3D with flowing signal particles!
            </div>
          </div>
        </div>
      )}

      {/* Help button */}
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="absolute top-2 right-2 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded border border-gray-600 z-50"
      >
        {showHelp ? 'Hide' : 'Controls'}
      </button>

      {/* Help overlay */}
      {showHelp && (
        <div className="absolute top-10 right-2 bg-gray-900 border border-gray-700 rounded p-3 text-xs text-gray-300 space-y-1 shadow-xl z-50">
          <div className="font-semibold text-white mb-2">3D View Controls</div>
          <div><span className="text-cyan-400">Left Click + Drag:</span> Rotate camera</div>
          <div><span className="text-cyan-400">Right Click + Drag:</span> Pan camera</div>
          <div><span className="text-cyan-400">Scroll:</span> Zoom in/out</div>
          <div><span className="text-cyan-400">Click Node:</span> Select</div>
          <div><span className="text-cyan-400">Ctrl+Click:</span> Multi-select</div>
          <div className="pt-2 border-t border-gray-700 text-gray-500">
            <div className="text-green-500">● Green:</div> Active signal (HIGH)
            <div className="text-gray-500">● Gray:</div> Inactive (LOW)
          </div>
        </div>
      )}
    </div>
  );
};
