// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { TickEngine, Node, Connection } from '@redbyte/rb-logic-core';
import { useLogicViewStore } from './useLogicViewStore';
import { NodeView, type ChipMetadata } from './components/NodeView';
import { WireView } from './components/WireView';
import { Toolbar } from './components/Toolbar';
import { renderGrid } from './tools/grid';
import { snapToGrid } from './tools/panzoom';

export interface LogicCanvasProps {
  engine: TickEngine;
  width?: number;
  height?: number;
  showToolbar?: boolean;
  getChipMetadata?: (nodeType: string) => ChipMetadata | undefined;
}

export const LogicCanvas: React.FC<LogicCanvasProps> = ({
  engine,
  width = 800,
  height = 600,
  showToolbar = true,
  getChipMetadata,
}) => {
  const {
    camera,
    setCamera,
    pan,
    zoom: zoomFn,
    selection,
    selectNode,
    selectWire,
    clearSelection,
    snapToGrid: shouldSnap,
    toggleSnapToGrid,
    gridSize,
    editingState,
    startWire,
    endWire,
  } = useLogicViewStore();

  const [circuit, setCircuit] = React.useState(engine.getCircuit());
  const [signals, setSignals] = React.useState<Map<string, 0 | 1>>(new Map());
  const svgRef = React.useRef<SVGSVGElement>(null);

  // Subscribe to engine updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCircuit(engine.getCircuit());
      setSignals(engine.getEngine().getAllSignals());
    }, 50);

    return () => clearInterval(interval);
  }, [engine]);

  // Mouse handlers for pan/zoom
  const [isPanning, setIsPanning] = React.useState(false);
  const [lastMouse, setLastMouse] = React.useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || e.shiftKey) {
      // Middle mouse or shift+click for panning
      setIsPanning(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
    } else if (e.button === 0 && !e.shiftKey) {
      // Left click on background clears selection
      clearSelection();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      pan(dx, dy);
      setLastMouse({ x: e.clientX, y: e.clientY });
    }

    // Update wire preview if drawing
    if (editingState.wireStartPort) {
      // Wire preview would be drawn here
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.ctrlKey ? -e.deltaY * 0.5 : -e.deltaY;
    zoomFn(delta, e.clientX, e.clientY);
  };

  const handleNodeMove = (nodeId: string, x: number, y: number) => {
    const newX = shouldSnap ? snapToGrid(x, gridSize) : x;
    const newY = shouldSnap ? snapToGrid(y, gridSize) : y;

    const updatedCircuit = {
      ...circuit,
      nodes: circuit.nodes.map((n) =>
        n.id === nodeId ? { ...n, position: { x: newX, y: newY } } : n
      ),
    };

    engine.setCircuit(updatedCircuit);
    setCircuit(updatedCircuit);
  };

  const handlePortClick = (nodeId: string, portName: string) => {
    if (editingState.wireStartPort) {
      // End wire
      const newConnection: Connection = {
        from: editingState.wireStartPort,
        to: { nodeId, portName },
      };

      const updatedCircuit = {
        ...circuit,
        connections: [...circuit.connections, newConnection],
      };

      engine.setCircuit(updatedCircuit);
      setCircuit(updatedCircuit);
      endWire();
    } else {
      // Start wire
      startWire({ nodeId, portName });
    }
  };

  const handleAddNode = (type: string) => {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type,
      position: {
        x: (-camera.x + width / 2) / camera.zoom,
        y: (-camera.y + height / 2) / camera.zoom,
      },
      rotation: 0,
      config: {},
    };

    const updatedCircuit = {
      ...circuit,
      nodes: [...circuit.nodes, newNode],
    };

    engine.setCircuit(updatedCircuit);
    setCircuit(updatedCircuit);
  };

  const handleDelete = () => {
    const updatedCircuit = {
      nodes: circuit.nodes.filter((n) => !selection.nodes.has(n.id)),
      connections: circuit.connections.filter(
        (c) =>
          !selection.nodes.has(c.from.nodeId) && !selection.nodes.has(c.to.nodeId)
      ),
    };

    engine.setCircuit(updatedCircuit);
    setCircuit(updatedCircuit);
    clearSelection();
  };

  // Keyboard handlers
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        clearSelection();
        if (editingState.wireStartPort) {
          endWire();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden' }}>
      {showToolbar && (
        <Toolbar
          engine={engine}
          onAddNode={handleAddNode}
          onDelete={handleDelete}
          snapToGrid={shouldSnap}
          onToggleSnap={toggleSnapToGrid}
        />
      )}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{
          background: '#0a0a0a',
          cursor: isPanning ? 'grabbing' : 'default',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Grid */}
        {renderGrid(camera, width, height, {
          size: gridSize,
          color: '#1a1a1a',
          majorLineInterval: 5,
          majorLineColor: '#2a2a2a',
        })}

        {/* Wires */}
        {circuit.connections.map((conn, idx) => {
          const wireId = `${conn.from.nodeId}.${conn.from.portName}-${conn.to.nodeId}.${conn.to.portName}`;
          const signal = signals.get(`${conn.from.nodeId}.${conn.from.portName}`);

          return (
            <WireView
              key={wireId}
              connection={conn}
              nodes={circuit.nodes}
              camera={camera}
              isSelected={selection.wires.has(wireId)}
              onSelect={selectWire}
              signal={signal}
            />
          );
        })}

        {/* Nodes */}
        {circuit.nodes.map((node) => (
          <NodeView
            key={node.id}
            node={node}
            camera={camera}
            isSelected={selection.nodes.has(node.id)}
            onSelect={selectNode}
            onMove={handleNodeMove}
            onPortClick={handlePortClick}
            signals={signals}
            chipMetadata={getChipMetadata?.(node.type)}
          />
        ))}
      </svg>
    </div>
  );
};
