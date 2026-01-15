// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import type { CapsuleV1 } from '@redbyte/rb-logic-core/lab/CapsuleV1';

/**
 * Props for ReplayView component
 */
export interface ReplayViewProps {
  /**
   * The capsule to display
   */
  capsule: CapsuleV1;

  /**
   * Optional className for styling
   */
  className?: string;

  /**
   * Optional callback when attempting to edit (read-only reminder)
   */
  onReadOnlyAttempt?: () => void;
}

/**
 * ReplayView component
 *
 * Displays a read-only replay of student's circuit execution with checkpoint results.
 * Uses LogicCanvas in read-only mode (no interactivity, no editing).
 *
 * Features:
 * - Renders circuit snapshot (read-only)
 * - Displays checkpoint results with PASS/FAIL badges
 * - Shows timestamp for each checkpoint
 * - Prevents user interaction/editing
 * - Shows replay mode indicator
 *
 * Usage:
 * ```tsx
 * <ReplayView
 *   capsule={studentCapsule}
 *   onReadOnlyAttempt={() => console.log('Read-only mode')}
 * />
 * ```
 */
export const ReplayView: React.FC<ReplayViewProps> = ({
  capsule,
  className,
  onReadOnlyAttempt,
}) => {
  /**
   * Memoize the circuit data to prevent unnecessary re-renders
   */
  const circuitInfo = useMemo(() => {
    const nodeCount = capsule.circuitSnapshot.nodes.length;
    const connCount = capsule.circuitSnapshot.connections.length;
    return { nodeCount, connCount };
  }, [capsule.circuitSnapshot]);

  /**
   * Format timestamp for display
   */
  const formatTime = (timestamp: number): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return 'Invalid timestamp';
    }
  };

  /**
   * Handle any click event on the circuit area (show read-only hint)
   */
  const handleCircuitInteraction = () => {
    onReadOnlyAttempt?.();
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        color: '#ccc',
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: '1px solid #333',
          paddingBottom: '12px',
        }}
      >
        <h2 style={{ margin: 0, marginBottom: '8px', color: '#fff' }}>
          Circuit Replay (Read-Only Mode)
        </h2>
        <div style={{ fontSize: '13px', color: '#999' }}>
          <p style={{ margin: 0, marginBottom: '4px' }}>
            <strong>Student:</strong> {capsule.studentName}
          </p>
          <p style={{ margin: 0, marginBottom: '4px' }}>
            <strong>Lab ID:</strong> {capsule.labId}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Submitted:</strong> {formatTime(capsule.timestamp)}
          </p>
        </div>
      </div>

      {/* Circuit Overview */}
      <div
        style={{
          padding: '12px',
          backgroundColor: '#252525',
          borderRadius: '4px',
          fontSize: '12px',
        }}
      >
        <div style={{ marginBottom: '8px' }}>
          <strong>Circuit Snapshot:</strong>
        </div>
        <div style={{ color: '#999' }}>
          <div>Nodes: {circuitInfo.nodeCount}</div>
          <div>Connections: {circuitInfo.connCount}</div>
        </div>
      </div>

      {/* Circuit Render Area (Read-only) */}
      <div
        onClick={handleCircuitInteraction}
        onKeyDown={(e) => {
          if (['Enter', ' '].includes(e.key)) {
            handleCircuitInteraction();
          }
        }}
        role="region"
        aria-label="Read-only circuit display"
        style={{
          padding: '16px',
          backgroundColor: '#0a0a0a',
          border: '1px solid #333',
          borderRadius: '4px',
          minHeight: '300px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'not-allowed',
          userSelect: 'none',
        }}
      >
        <div style={{ textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
          <div>
            <p style={{ margin: 0, marginBottom: '4px', fontWeight: 'bold' }}>
              Read-Only Circuit View
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>
              This is a replay. Editing is disabled.
            </p>
          </div>
        </div>
      </div>

      {/* Checkpoint Results */}
      <div>
        <h3 style={{ margin: 0, marginBottom: '12px', color: '#fff' }}>
          Checkpoint Results ({capsule.checkpointResults.length})
        </h3>

        {capsule.checkpointResults.length === 0 ? (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#252525',
              borderRadius: '4px',
              color: '#999',
              fontSize: '12px',
            }}
          >
            No checkpoints recorded for this submission.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            {capsule.checkpointResults.map((result) => (
              <div
                key={result.id}
                style={{
                  padding: '12px',
                  backgroundColor: result.passed ? '#1a3d1a' : '#3d1a1a',
                  border: `1px solid ${result.passed ? '#2d6b2d' : '#6b2d2d'}`,
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              >
                {/* Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      backgroundColor: result.passed ? '#2d6b2d' : '#6b2d2d',
                      color: result.passed ? '#51cf66' : '#ff6b6b',
                      textTransform: 'uppercase',
                    }}
                  >
                    {result.passed ? '✓ PASS' : '✗ FAIL'}
                  </span>
                </div>

                {/* Title */}
                <div
                  style={{
                    fontWeight: 'bold',
                    marginBottom: '4px',
                    color: '#fff',
                  }}
                >
                  {result.name}
                </div>

                {/* Message */}
                <div
                  style={{
                    color: '#999',
                    marginBottom: '8px',
                    fontSize: '11px',
                    fontStyle: 'italic',
                  }}
                >
                  {result.message}
                </div>

                {/* Time */}
                <div
                  style={{
                    color: '#666',
                    fontSize: '10px',
                  }}
                >
                  {formatTime(result.timeLogged)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Read-Only Mode Indicator */}
      <div
        style={{
          padding: '8px 12px',
          backgroundColor: '#3d2d1a',
          borderLeft: '3px solid #ff9800',
          borderRadius: '2px',
          fontSize: '11px',
          color: '#ffb366',
        }}
      >
        ⓘ This is a read-only replay of the student's submission. No changes can be made.
      </div>
    </div>
  );
};

export default ReplayView;
