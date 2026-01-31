// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Design Mode — Circuit Editor (Vertical Slice)
 *
 * VERTICAL SLICE: Simplified circuit editor for Lab 0 (MUX).
 * Full LogicPlayground canvas integration deferred until loop validated.
 *
 * For now: simple node list + manual circuit builder.
 * After vertical slice: integrate LogicCanvas fully.
 */

import React, { useState } from 'react';
import { useLabEngineStore } from '@redbyte/rb-lab-engine';
import type { CircuitNode } from '@redbyte/rb-utils/labProjectSchema';

export const DesignMode: React.FC<{ windowId: string }> = () => {
  const { project, dispatch } = useLabEngineStore();
  const [selectedType, setSelectedType] = useState<string>('AND');

  if (!project) return null;

  const handleAddNode = () => {
    const nodeId = `node-${Date.now()}`;
    dispatch({
      v: 1,
      t: 'circuit/addNode',
      p: {
        nodeId,
        componentType: selectedType,
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100,
      },
    });
  };

  const handleAddConnection = (fromId: string, toId: string) => {
    const connId = `conn-${Date.now()}`;
    dispatch({
      v: 1,
      t: 'circuit/addConnection',
      p: {
        id: connId,
        fromNodeId: fromId,
        fromPin: 'Q',
        toNodeId: toId,
        toPin: 'A',
      },
    });
  };

  const handleDeleteNode = (nodeId: string) => {
    dispatch({
      v: 1,
      t: 'circuit/deleteNode',
      p: { nodeId },
    });
  };

  return (
    <div style={{ padding: 20, height: '100%', overflow: 'auto' }}>
      <h2 style={{ marginTop: 0, fontSize: 16, fontWeight: 600 }}>Design Mode — Build Your MUX</h2>

      {/* Component Palette */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--rb-text-2, #a1a1aa)' }}>
          Add Component:
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['AND', 'OR', 'NOT', 'SWITCH', 'LED'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: `1px solid ${selectedType === type ? 'var(--rb-accent, #3b82f6)' : 'var(--rb-border, #333)'}`,
                background: selectedType === type ? 'var(--rb-surface-2, #252538)' : 'transparent',
                color: 'var(--rb-text, #e4e4e7)',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {type}
            </button>
          ))}
          <button
            onClick={handleAddNode}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              border: '1px solid var(--rb-accent, #3b82f6)',
              background: 'var(--rb-accent, #3b82f6)',
              color: 'white',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            + Add {selectedType}
          </button>
        </div>
      </div>

      {/* Circuit Node List */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--rb-text-2, #a1a1aa)' }}>
          Circuit Nodes ({project.circuit.nodes.length}):
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {project.circuit.nodes.map((node) => (
            <div
              key={node.id}
              style={{
                padding: 8,
                borderRadius: 4,
                border: '1px solid var(--rb-border, #333)',
                background: 'var(--rb-surface-2, #252538)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
              }}
            >
              <div>
                <span style={{ fontWeight: 600 }}>{node.type}</span>
                {node.label && <span style={{ marginLeft: 8, color: 'var(--rb-text-3, #71717a)' }}>({node.label})</span>}
                <span style={{ marginLeft: 8, color: 'var(--rb-text-3, #71717a)', fontSize: 10 }}>
                  {node.id.slice(0, 12)}...
                </span>
              </div>
              <button
                onClick={() => handleDeleteNode(node.id)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 3,
                  border: '1px solid var(--rb-border, #333)',
                  background: 'transparent',
                  color: 'var(--rb-text-3, #71717a)',
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Connections */}
      <div>
        <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--rb-text-2, #a1a1aa)' }}>
          Connections ({project.circuit.connections.length}):
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {project.circuit.connections.map((conn) => (
            <div
              key={conn.id}
              style={{
                padding: 6,
                borderRadius: 4,
                border: '1px solid var(--rb-border, #333)',
                background: 'var(--rb-surface-1, #1e1e2e)',
                fontSize: 11,
                color: 'var(--rb-text-3, #71717a)',
              }}
            >
              {conn.fromNodeId.slice(0, 8)}…:{conn.fromPin} → {conn.toNodeId.slice(0, 8)}…:{conn.toPin}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 12,
          borderRadius: 6,
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          fontSize: 12,
          color: 'var(--rb-text-2, #a1a1aa)',
        }}
      >
        <strong style={{ color: 'var(--rb-accent, #3b82f6)' }}>Note:</strong> This is a simplified editor for the
        vertical slice. Full LogicPlayground canvas integration coming after loop validation.
      </div>
    </div>
  );
};
