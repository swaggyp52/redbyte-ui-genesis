// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { useCircuitStore } from '../stores/circuitStore';
import { useLabWorkflowStore } from '../stores/useLabWorkflowStore';

/**
 * TestVectorPanel
 *
 * Runs time-based test vectors with sequence-dependent behavior.
 * - Supports sequential logic testing (flip-flops, counters, state machines)
 * - Multi-tick stimulus sequences
 * - Expected vs actual output verification
 * - Visual pass/fail indicators
 */
export function TestVectorPanel() {
  const circuit = useCircuitStore((s) => s.circuit);
  const { labSpec } = useLabWorkflowStore();

  // UI state
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
  const [vectors, setVectors] = useState([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [expandedVector, setExpandedVector] = useState(null);

  // Load checkpoint if available
  useEffect(() => {
    if (labSpec?.checkpoints) {
      const vectorCheckpoint = labSpec.checkpoints.find(
        (cp) => cp.type === 'test-vector'
      );
      if (vectorCheckpoint) {
        setSelectedCheckpoint(vectorCheckpoint);
        setVectors(vectorCheckpoint.config?.vectors || []);
      }
    }
  }, [labSpec]);

  // Run test vectors
  const runVectors = useCallback(async () => {
    if (!circuit || vectors.length === 0) return;

    setRunning(true);
    setResults([]);

    try {
      // Create fresh engine
      const engine = new CircuitEngine(circuit);

      const testResults = vectors.map((vector) => {
        // Apply inputs at tick 0
        for (const [signal, value] of Object.entries(vector.inputs || {})) {
          const node = circuit.nodes.find(
            (n) => n.label === signal || n.id === signal
          );
          if (node && (node.type === 'SWITCH' || node.type === 'INPUT')) {
            engine.setNodeState(node.id, value);
          }
        }

        // Run to specified tick
        const targetTick = vector.tick || 1;
        for (let t = 0; t < targetTick; t++) {
          engine.tick();
        }

        // Read expected outputs
        const actual = {};
        const differences = [];
        const expectedOutputs = vector.expected || {};

        for (const [signal, expectedValue] of Object.entries(expectedOutputs)) {
          const node = circuit.nodes.find(
            (n) => n.label === signal || n.id === signal
          );
          if (node) {
            actual[signal] = engine.getNodeValue(node.id, 'Q') ?? 0;

            if (actual[signal] !== expectedValue) {
              differences.push({
                signal,
                expected: expectedValue,
                actual: actual[signal],
              });
            }
          }
        }

        return {
          vectorId: vector.id || vector.tick,
          tick: targetTick,
          pass: differences.length === 0,
          actual,
          differences,
        };
      });

      setResults(testResults);
    } catch (err) {
      console.error('Test vector error:', err);
      setResults(
        vectors.map((v) => ({
          vectorId: v.id || v.tick,
          tick: v.tick,
          pass: false,
          actual: {},
          differences: [{ error: err.message }],
        }))
      );
    } finally {
      setRunning(false);
    }
  }, [circuit, vectors]);

  // Compute summary statistics
  const stats = useMemo(() => {
    if (results.length === 0) {
      return { total: vectors.length, passed: 0, failed: 0, coverage: 0 };
    }
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    return {
      total: vectors.length,
      passed,
      failed,
      coverage: vectors.length > 0 ? Math.round((passed / vectors.length) * 100) : 0,
    };
  }, [results, vectors]);

  return (
    <div className="test-vector-panel">
      <div className="panel-header">
        <h2>Test Vectors</h2>
        <div className="header-controls">
          <button
            className="run-button"
            onClick={runVectors}
            disabled={running || vectors.length === 0}
          >
            {running ? 'Running...' : 'Run Vectors'}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {results.length > 0 && (
        <div className="vector-summary">
          <div className="stat">
            <span className="label">Total Vectors:</span>
            <span className="value">{stats.total}</span>
          </div>
          <div className={`stat ${stats.passed === stats.total ? 'all-pass' : ''}`}>
            <span className="label">Passed:</span>
            <span className={`value ${stats.passed > 0 ? 'pass' : ''}`}>
              {stats.passed}
            </span>
          </div>
          <div className={`stat ${stats.failed > 0 ? 'has-fail' : ''}`}>
            <span className="label">Failed:</span>
            <span className={`value ${stats.failed > 0 ? 'fail' : ''}`}>
              {stats.failed}
            </span>
          </div>
          <div className="stat">
            <span className="label">Pass Rate:</span>
            <span className="value">{stats.coverage}%</span>
          </div>
        </div>
      )}

      {/* Test Vectors List */}
      <div className="vectors-container">
        {vectors.length === 0 ? (
          <div className="empty-state">
            <p>No test vectors defined</p>
          </div>
        ) : (
          <div className="vectors-list">
            {vectors.map((vector, idx) => {
              const result = results.find((r) => r.vectorId === (vector.id || vector.tick));
              const isExpanded = expandedVector === idx;

              return (
                <React.Fragment key={idx}>
                  <div
                    className={`vector-row ${
                      result
                        ? result.pass
                          ? 'pass'
                          : 'fail'
                        : ''
                    }`}
                    onClick={() => setExpandedVector(isExpanded ? null : idx)}
                  >
                    <div className="vector-header">
                      <span className="vector-id">
                        Vector {idx + 1}
                        {vector.id && <span className="id-label">({vector.id})</span>}
                      </span>
                      <span className="vector-tick">tick={vector.tick || 1}</span>
                      {result && (
                        <span className={`badge ${result.pass ? 'pass' : 'fail'}`}>
                          {result.pass ? '✓ PASS' : '✗ FAIL'}
                        </span>
                      )}
                    </div>

                    <div className="vector-io">
                      {/* Inputs */}
                      {vector.inputs && (
                        <div className="io-section inputs">
                          <span className="io-label">Inputs:</span>
                          <div className="io-values">
                            {Object.entries(vector.inputs).map(([sig, val]) => (
                              <span key={`in-${sig}`} className="value-pair">
                                {sig}={val}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Expected Outputs */}
                      {vector.expected && (
                        <div className="io-section expected">
                          <span className="io-label">Expected:</span>
                          <div className="io-values">
                            {Object.entries(vector.expected).map(([sig, val]) => (
                              <span key={`exp-${sig}`} className="value-pair">
                                {sig}={val}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actual Outputs */}
                      {result && (
                        <div className={`io-section actual ${result.pass ? 'pass' : 'fail'}`}>
                          <span className="io-label">Actual:</span>
                          <div className="io-values">
                            {Object.entries(result.actual).map(([sig, val]) => (
                              <span key={`act-${sig}`} className="value-pair">
                                {sig}={val}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && result && !result.pass && (
                    <div className="vector-details">
                      <div className="details-content">
                        <h4>Test Failures:</h4>
                        {result.differences.map((diff, i) => (
                          <div key={i} className="failure-item">
                            <span className="signal">{diff.signal}:</span>
                            <span className="mismatch">
                              expected <span className="exp">{diff.expected}</span>
                              {' '}→ got <span className="act">{diff.actual}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .test-vector-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          background: #1e1e1e;
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          color: #e0e0e0;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #3a3a3a;
          padding-bottom: 0.75rem;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 1.25rem;
          color: #00ff88;
        }

        .header-controls {
          display: flex;
          gap: 0.5rem;
        }

        .run-button {
          padding: 0.5rem 1rem;
          background: #00cc44;
          color: #000;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        }

        .run-button:hover:not(:disabled) {
          background: #00ff55;
          box-shadow: 0 0 8px rgba(0, 255, 85, 0.5);
        }

        .run-button:disabled {
          background: #444;
          color: #888;
          cursor: not-allowed;
        }

        .vector-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 1rem;
          padding: 0.75rem;
          background: #2a2a2a;
          border-radius: 4px;
          border: 1px solid #3a3a3a;
        }

        .stat {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem;
          border-left: 3px solid #666;
        }

        .stat.all-pass {
          border-left-color: #00ff88;
          background: rgba(0, 255, 136, 0.1);
        }

        .stat.has-fail {
          border-left-color: #ff4444;
        }

        .stat .label {
          font-size: 0.85rem;
          color: #999;
        }

        .stat .value {
          font-weight: bold;
          color: #fff;
        }

        .stat .value.pass {
          color: #00ff88;
        }

        .stat .value.fail {
          color: #ff4444;
        }

        .vectors-container {
          flex: 1;
          overflow-y: auto;
          border: 1px solid #3a3a3a;
          border-radius: 4px;
          background: #252525;
        }

        .empty-state {
          padding: 2rem;
          text-align: center;
          color: #999;
        }

        .vectors-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.5rem;
        }

        .vector-row {
          padding: 0.75rem;
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .vector-row:hover {
          background: #2d2d2d;
          border-color: #555;
        }

        .vector-row.pass {
          border-left: 3px solid #00ff88;
          background: rgba(0, 255, 136, 0.05);
        }

        .vector-row.pass:hover {
          background: rgba(0, 255, 136, 0.1);
        }

        .vector-row.fail {
          border-left: 3px solid #ff4444;
          background: rgba(255, 68, 68, 0.05);
        }

        .vector-row.fail:hover {
          background: rgba(255, 68, 68, 0.1);
        }

        .vector-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .vector-id {
          font-weight: bold;
          color: #fff;
          flex: 0 0 auto;
        }

        .id-label {
          font-size: 0.85rem;
          color: #999;
          font-weight: normal;
        }

        .vector-tick {
          font-size: 0.85rem;
          color: #888;
          background: #333;
          padding: 0.2rem 0.5rem;
          border-radius: 3px;
        }

        .badge {
          margin-left: auto;
          font-weight: bold;
          padding: 0.3rem 0.75rem;
          border-radius: 3px;
          font-size: 0.85rem;
        }

        .badge.pass {
          background: #00ff88;
          color: #000;
        }

        .badge.fail {
          background: #ff4444;
          color: #fff;
        }

        .vector-io {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          font-size: 0.9rem;
        }

        .io-section {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
        }

        .io-section.inputs {
          color: #00aaff;
        }

        .io-section.expected {
          color: #ffcc00;
        }

        .io-section.actual {
          color: #00ff88;
        }

        .io-section.actual.fail {
          color: #ff6666;
        }

        .io-label {
          font-weight: bold;
          min-width: 80px;
          flex: 0 0 auto;
        }

        .io-values {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .value-pair {
          background: #333;
          padding: 0.2rem 0.5rem;
          border-radius: 3px;
          font-size: 0.9rem;
        }

        .vector-details {
          padding: 1rem;
          background: rgba(255, 68, 68, 0.1);
          border-left: 3px solid #ff4444;
          margin-top: -0.5rem;
        }

        .details-content h4 {
          margin: 0 0 0.5rem 0;
          color: #ff6666;
        }

        .failure-item {
          display: flex;
          gap: 0.5rem;
          padding: 0.4rem 0;
          margin-left: 0.5rem;
        }

        .failure-item .signal {
          color: #fff;
          font-weight: bold;
          min-width: 100px;
        }

        .failure-item .mismatch {
          color: #ccc;
        }

        .failure-item .exp,
        .failure-item .act {
          background: #333;
          padding: 0.1rem 0.4rem;
          border-radius: 2px;
          font-weight: bold;
        }

        .failure-item .exp {
          color: #ffcc00;
        }

        .failure-item .act {
          color: #ff6666;
        }
      `}</style>
    </div>
  );
}
