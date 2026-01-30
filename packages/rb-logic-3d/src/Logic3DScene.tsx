// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CircuitEngine } from '@redbyte/rb-logic-core';
import { useToast } from '@redbyte/rb-primitives';
import { ViewAdapter } from '@redbyte/rb-logic-adapter';
import { use3DEngineSync } from './hooks/use3DEngineSync';

import { Rb3DViewport } from './components/Rb3DViewport';
import { Rb3DSceneCircuit } from './components/Rb3DSceneCircuit';

interface Logic3DSceneProps {
  engine: CircuitEngine;
  width?: number;
  height?: number;
  viewStateStore?: any; // Global view state store for selection sync
  showHints?: boolean;
  onDismissHints?: () => void;
  onHelp?: () => void;
  probeWireHighlights?: Map<string, string[]>;
  mismatchWireHighlights?: Map<string, string[]> | null;
  mismatchNodeIds?: Set<string> | null;
  mismatchPortKeys?: Set<string> | null;
  debugSignals?: Map<string, 0 | 1> | null;
  /** Optional chip metadata lookup for custom node rendering */
  getChipMetadata?: (nodeType: string) => any;
  /** Force a specific time for deterministic replay (optional) */
  forcedTime?: number;
  onLayoutChange?: () => void;
}

export const buildSelectionMap = (
  nodes: Array<{ id: string }>,
  selectedNodeIds: Set<string>
) => {
  const selectionMap = new Map<string, boolean>();
  nodes.forEach((node) => {
    selectionMap.set(node.id, selectedNodeIds.has(node.id));
  });
  return selectionMap;
};

// Hook to track last changed time for pulses
function usePulseMap(signals: Map<string, 0 | 1>, currentTime: number) {
  const [pulseMap, setPulseMap] = useState<Map<string, number>>(new Map());
  const previousSignalsRef = useRef<Map<string, 0 | 1>>(new Map());

  useEffect(() => {
    const previous = previousSignalsRef.current;
    const nextPulse = new Map(pulseMap);
    let changed = false;

    signals.forEach((value, key) => {
      const previousValue = previous.get(key);
      if (previousValue !== undefined && previousValue !== value) {
        nextPulse.set(key, currentTime);
        changed = true;
      }
    });

    previousSignalsRef.current = signals;
    if (changed) {
      setPulseMap(nextPulse);
    }
  }, [signals, pulseMap, currentTime]);

  return pulseMap;
}

export const Logic3DScene: React.FC<Logic3DSceneProps> = ({
  engine,
  width = 800,
  height = 600,
  viewStateStore,
  showHints = true,
  onDismissHints,
  onHelp,
  probeWireHighlights,
  mismatchWireHighlights,
  mismatchNodeIds,
  debugSignals,
  forcedTime,
  onLayoutChange,
}) => {
  const [showHelp, setShowHelp] = React.useState(false);
  const [followSelection, setFollowSelection] = useState(false);
  const [animateSignalFlow, setAnimateSignalFlow] = useState(true);

  // Camera State used for resets
  const [cameraTarget, setCameraTarget] = useState<[number, number, number]>([0, 0.25, 0]);
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([10, 10, 10]);

  // Data Loading
  const liveSignals = use3DEngineSync(engine);
  const signals = debugSignals ?? liveSignals;

  // Time Source: Use forcedTime if provided (Replay), or Date.now() (Live)
  // Note: For true determinism in live mode, we should use engine.tickCount if available,
  // but Date.now() is acceptable for interactive live mode as long as replay uses recorded ticks.
  const [liveTime, setLiveTime] = useState(Date.now());

  useEffect(() => {
    if (forcedTime !== undefined) return;
    // Simple loop to keep particles moving in live mode
    let frameId: number;
    const updateTime = () => {
      setLiveTime(Date.now());
      frameId = requestAnimationFrame(updateTime);
    };
    frameId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(frameId);
  }, [forcedTime]);

  const currentTime = forcedTime ?? liveTime;

  const adapter = useMemo(() => {
    if (!engine || typeof engine.getCircuit !== 'function') {
      return null;
    }
    return new ViewAdapter(engine, '3d');
  }, [engine]);

  const viewState = useMemo(() => {
    if (!adapter) {
      return { nodes: [], wires: [] };
    }
    return adapter.computeViewState();
  }, [adapter]);

  const pulseMap = usePulseMap(signals, currentTime);

  // Selection Logic
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

  const handleNodeMove = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      if (engine && typeof engine.updateNodePosition === 'function') {
        engine.updateNodePosition(nodeId, position);
        if (onLayoutChange) {
          onLayoutChange();
        }
      }
    },
    [engine, onLayoutChange]
  );




  // Camera Following Logic
  useEffect(() => {
    if (!followSelection) return;
    const selectedId = Array.from(selectedNodeIds)[0];
    if (!selectedId) return;
    const targetNode = viewState.nodes.find((node: any) => node.id === selectedId);
    if (!targetNode) return;
    const targetX = targetNode.view.x / 20;
    const targetZ = targetNode.view.y / 20;

    // Update camera target smoothly
    setCameraTarget([targetX, 0.25, targetZ]);
  }, [followSelection, selectedNodeIds, viewState.nodes]);

  const circuit = engine?.getCircuit?.();
  const hasNodes = circuit?.nodes?.length > 0;

  return (
    <div style={{ width, height, position: 'relative' }}>
      <Rb3DViewport
        width={width}
        height={height}
        cameraPosition={cameraPosition}
        cameraTarget={cameraTarget}
        onCameraChange={(pos, target) => {
          // In a real implementation we might sync this to store
        }}
      >
        <Rb3DSceneCircuit
          nodes={viewState.nodes}
          wires={viewState.wires}
          signals={signals}
          pulseMap={pulseMap}
          currentTime={currentTime}
          animateSignalFlow={animateSignalFlow}
          selectedNodeIds={selectedNodeIds}
          onNodeSelect={handleNodeSelect}
          onNodeHover={handleNodeHover}
          onNodeMove={() => {
            const { toast } = useToast.getState(); // Access store directly or hook if available
            toast({
              title: "3D View is Read-Only",
              description: "Switch to 2D view to edit the circuit.",
              variant: "default"
            });
          }}
          probeWireHighlights={probeWireHighlights}
          mismatchWireHighlights={mismatchWireHighlights}
          mismatchNodeIds={mismatchNodeIds}
        />
      </Rb3DViewport>

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

      {/* 3D READ-ONLY BADGE */}
      <div className="absolute top-2 right-2 bg-amber-500/10 border border-amber-500/30 text-amber-500 px-2 py-1 rounded text-[10px] font-bold tracking-wider pointer-events-none select-none z-50">
        3D VIEW (READ-ONLY)
      </div>

      {/* Micro Toolbar */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-gray-900/80 border border-gray-700 rounded px-2 py-1 text-[10px] z-50" data-testid="3d-micro-toolbar">
        <button
          onClick={() => setFollowSelection((prev) => !prev)}
          className={`px-1.5 py-0.5 rounded border ${followSelection
            ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
            : 'border-gray-600 text-gray-300 hover:bg-gray-700/60'
            }`}
          title="Follow selection"
        >
          Follow
        </button>
        <button
          onClick={() => setAnimateSignalFlow((prev) => !prev)}
          className={`px-1.5 py-0.5 rounded border ${animateSignalFlow
            ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
            : 'border-gray-600 text-gray-300 hover:bg-gray-700/60'
            }`}
          title="Animate signal flow"
        >
          Flow
        </button>
        <button
          onClick={() => {
            // Reset Camera
            setCameraPosition([10, 10, 10]);
            setCameraTarget([0, 0.25, 0]);
          }}
          className="px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-700/60"
          title="Center camera"
        >
          Fit
        </button>
        {onHelp && (
          <button
            onClick={onHelp}
            className="px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-700/60"
            title="3D controls"
          >
            ?
          </button>
        )}
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-700/60"
          title="Toggle inline help"
        >
          i
        </button>
      </div>

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
