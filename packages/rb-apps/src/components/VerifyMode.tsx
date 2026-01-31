// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Verify Mode — Checkpoint Verification Runner
 *
 * Shows lab steps + checkpoints, runs verification, displays results.
 */

import React, { useState } from 'react';
import { useLabEngineStore } from '@redbyte/rb-lab-engine';
import type { CheckpointResult } from '@redbyte/rb-utils/labProjectSchema';

export const VerifyMode: React.FC = () => {
  const { project, verifyCheckpoint } = useLabEngineStore();
  const [verifying, setVerifying] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, CheckpointResult>>({});

  if (!project || !project.labSpec) {
    return (
      <div style={{ padding: 20 }}>
        <p>No lab specification loaded.</p>
      </div>
    );
  }

  const handleVerify = async (checkpointId: string) => {
    setVerifying(checkpointId);
    try {
      const result = await verifyCheckpoint(checkpointId);
      setResults((prev) => ({ ...prev, [checkpointId]: result }));
    } catch (err) {
      console.error('Verification failed:', err);
      setResults((prev) => ({
        ...prev,
        [checkpointId]: {
          passed: false,
          headline: `✗ Error: ${err instanceof Error ? err.message : String(err)}`,
          failures: [{ message: String(err) }],
          evidence: { expected: null, actual: null },
        },
      }));
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Steps Sidebar */}
      <div
        style={{
          width: 250,
          borderRight: '1px solid var(--rb-border, #333)',
          background: 'var(--rb-surface-1, #1e1e2e)',
          padding: 16,
          overflow: 'auto',
        }}
      >
        <h3 style={{ marginTop: 0, fontSize: 14, fontWeight: 600 }}>Lab Steps</h3>
        {project.labSpec.steps.map((step, idx) => (
          <div
            key={step.id}
            style={{
              padding: 8,
              marginBottom: 8,
              borderRadius: 4,
              border: '1px solid var(--rb-border, #333)',
              background: 'var(--rb-surface-2, #252538)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {idx + 1}. {step.title}
            </div>
            <div style={{ fontSize: 10, color: 'var(--rb-text-3, #71717a)', marginTop: 4 }}>
              {step.estimatedMinutes} min
            </div>
          </div>
        ))}
      </div>

      {/* Checkpoints */}
      <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
        <h2 style={{ marginTop: 0, fontSize: 16, fontWeight: 600 }}>Verify Mode — Run Checkpoints</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {project.labSpec.checkpoints.map((checkpoint) => {
            const result = results[checkpoint.id];
            const isVerifying = verifying === checkpoint.id;

            return (
              <div
                key={checkpoint.id}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid var(--rb-border, #333)',
                  background: 'var(--rb-surface-1, #1e1e2e)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {checkpoint.type === 'truth-table' && '📊 Truth Table Verification'}
                      {checkpoint.type === 'board-io' && '🎛 Board I/O Verification'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--rb-text-3, #71717a)', marginTop: 4 }}>
                      Checkpoint ID: {checkpoint.id}
                    </div>
                  </div>

                  <button
                    onClick={() => handleVerify(checkpoint.id)}
                    disabled={isVerifying}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: '1px solid var(--rb-accent, #3b82f6)',
                      background: isVerifying ? 'var(--rb-surface-2, #252538)' : 'var(--rb-accent, #3b82f6)',
                      color: isVerifying ? 'var(--rb-text-3, #71717a)' : 'white',
                      cursor: isVerifying ? 'not-allowed' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>

                {/* Result */}
                {result && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 6,
                      background: result.passed
                        ? 'rgba(34, 197, 94, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${result.passed ? '#22c55e' : '#ef4444'}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: result.passed ? '#22c55e' : '#ef4444',
                        marginBottom: 8,
                      }}
                    >
                      {result.headline}
                    </div>

                    {result.failures.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--rb-text-2, #a1a1aa)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Failures:</div>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {result.failures.map((failure, idx) => (
                            <li key={idx}>{failure.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
