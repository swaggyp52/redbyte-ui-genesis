// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { listExamples, type ExampleId, type ExampleMetadata } from '@redbyte/rb-apps';

interface ExamplePickerProps {
  open: boolean;
  onClose: () => void;
  onSelectExample: (exampleId: ExampleId) => void;
}

export function ExamplePicker({ open, onClose, onSelectExample }: ExamplePickerProps) {
  if (!open) return null;

  const examples = listExamples();
  const examplesByLayer = examples.reduce<Record<number, typeof examples>>((acc, ex) => {
    if (!acc[ex.layer]) acc[ex.layer] = [];
    acc[ex.layer].push(ex);
    return acc;
  }, {});

  const layerNames: Record<number, string> = {
    0: 'Foundation',
    1: 'Combinational Logic',
    2: 'Arithmetic & Logic',
    3: 'Memory & State',
    4: 'Control & Coordination',
    5: 'Memory Systems',
    6: 'Simple Processors',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 8,
          padding: 24,
          maxWidth: 800,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Open Example</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: 'var(--color-text)',
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <p style={{ marginBottom: 24, opacity: 0.7 }}>
          Load a pre-built example project with probes, IO mappings, and documentation
        </p>

        {Object.keys(examplesByLayer)
          .map(Number)
          .sort()
          .map((layer) => (
            <div key={layer} style={{ marginBottom: 24 }}>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  opacity: 0.6,
                  marginBottom: 12,
                }}
              >
                Layer {layer}: {layerNames[layer]}
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {examplesByLayer[layer].map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => {
                      onSelectExample(ex.id);
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      padding: 12,
                      border: '1px solid var(--color-border)',
                      borderRadius: 6,
                      backgroundColor: 'var(--color-surface-raised)',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-surface-highlight)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-surface-raised)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{ex.name}</span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor:
                            ex.difficulty === 'beginner'
                              ? 'rgba(0, 255, 136, 0.2)'
                              : ex.difficulty === 'intermediate'
                                ? 'rgba(255, 165, 0, 0.2)'
                                : 'rgba(255, 85, 85, 0.2)',
                          color:
                            ex.difficulty === 'beginner'
                              ? '#00ff88'
                              : ex.difficulty === 'intermediate'
                                ? '#ffa500'
                                : '#ff5555',
                        }}
                      >
                        {ex.difficulty}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>{ex.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
