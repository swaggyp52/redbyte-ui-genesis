// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { CircuitEngine } from '@redbyte/rb-logic-core';
import { useCircuitStore } from '../stores/circuitStore';
import { useLabWorkflowStore } from '../stores/useLabWorkflowStore';

/**
 * TruthTableAnalyzer
 * 
 * Professional truth table editor and automated test runner.
 * - Supports N-input, M-output combinational circuits
 * - Auto-generates all 2^N combinations
 * - Runs deterministic tests via CircuitEngine
 * - Compares actual vs expected outputs
 * - Reports pass/fail with visual indicators
 */
export function TruthTableAnalyzer() {
  const circuit = useCircuitStore((s) => s.circuit);
  const { labSpec } = useLabWorkflowStore();
  
  // UI state
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);
  const [inputSignals, setInputSignals] = useState([]);
  const [outputSignals, setOutputSignals] = useState([]);
  const [rows, setRows] = useState([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);

  // Load checkpoint if available
  useEffect(() => {
    if (labSpec?.checkpoints) {
      const truthTableCheckpoint = labSpec.checkpoints.find(
        (cp) => cp.type === 'truth-table'
      );
      if (truthTableCheckpoint) {
        setSelectedCheckpoint(truthTableCheckpoint);
        setInputSignals(truthTableCheckpoint.config?.inputs || []);
        setOutputSignals(truthTableCheckpoint.config?.outputs || []);
        initializeTable(
          truthTableCheckpoint.config?.inputs || [],
          truthTableCheckpoint.config?.table || []
        );
      }
    }
  }, [labSpec]);

  // Initialize truth table rows
  const initializeTable = useCallback((inputs, existingTable) => {
    const numRows = Math.pow(2, inputs.length);
    const newRows = [];

    for (let i = 0; i < numRows; i++) {
      const inputValues = {};
      for (let bit = 0; bit < inputs.length; bit++) {
        inputValues[inputs[bit]] = (i >> bit) & 1 ? 1 : 0;
      }

      // Find existing row or create new one
      const existing = existingTable?.find((row) =>
        inputs.every((sig) => row.inputs[sig] === inputValues[sig])
      );

      newRows.push({
        id: i,
        inputs: inputValues,
        expected: existing?.outputs || {},
      });
    }

    setRows(newRows);
  }, []);

  // Update expected output for a row
  const updateExpected = useCallback((rowId, signal, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, expected: { ...row.expected, [signal]: value } }
          : row
      )
    );
  }, []);

  // Run truth table test
  const runTest = useCallback(async () => {
    if (!circuit) return;

    setRunning(true);
    setResults([]);

    try {
      // Create fresh engine for each test
      const engine = new CircuitEngine(circuit);

      const testResults = rows.map((row) => {
        // Set inputs via SWITCH nodes
        for (const [signal, value] of Object.entries(row.inputs)) {
          const node = circuit.nodes.find(
            (n) => n.label === signal || n.id === signal
          );
          if (node && (node.type === 'SWITCH' || node.type === 'INPUT')) {
            engine.setNodeState(node.id, value);
          }
        }

        // Tick to propagate
        engine.tick();

        // Read outputs
        const actual = {};
        const differences = [];

        for (const signal of outputSignals) {
          const node = circuit.nodes.find(
            (n) => n.label === signal || n.id === signal
          );
          if (node) {
            actual[signal] = engine.getNodeValue(node.id, 'Q') ?? 0;
            const expected = row.expected[signal] ?? 0;

            if (actual[signal] !== expected) {
              differences.push({
                signal,
                expected,
                actual: actual[signal],
              });
            }
          }
        }

        return {
          rowId: row.id,
          pass: differences.length === 0,
          actual,
          differences,
        };
      });

      setResults(testResults);
    } catch (err) {
      console.error('Truth table test error:', err);
      setResults(
        rows.map((row) => ({
          rowId: row.id,
          pass: false,
          actual: {},
          differences: [{ error: err.message }],
        }))
      );
    } finally {
      setRunning(false);
    }
  }, [circuit, rows, outputSignals]);

  // Compute summary statistics
  const stats = useMemo(() => {
    if (results.length === 0) {
      return { total: rows.length, passed: 0, failed: 0, coverage: 0 };
    }
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    return {
      total: rows.length,
      passed,
      failed,
      coverage: rows.length > 0 ? Math.round((passed / rows.length) * 100) : 0,
    };
  }, [results, rows]);

  return (
    <div className="truth-table-analyzer">
      <div className="analyzer-header">
        <h2>Truth Table Analysis</h2>
        <div className="header-controls">
          <button
            className="run-button"
            onClick={runTest}
            disabled={running || rows.length === 0}
          >
            {running ? 'Running...' : 'Run Test'}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {results.length > 0 && (
        <div className="test-summary">
          <div className="stat">
            <span className="label">Total Rows:</span>
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
            <span className="label">Coverage:</span>
            <span className="value">{stats.coverage}%</span>
          </div>
        </div>
      )}

      {/* Truth Table */}
      <div className="truth-table-container">
        <table className="truth-table">
          <thead>
            <tr>
              <th className="row-header"></th>
              {inputSignals.map((sig) => (
                <th key={`in-${sig}`} className="input-header">
                  {sig}
                </th>
              ))}
              <th className="sep-col"></th>
              {outputSignals.map((sig) => (
                <th key={`out-${sig}`} className="output-header">
                  {sig}
                </th>
              ))}
              {results.length > 0 && <th className="result-header">Result</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const result = results.find((r) => r.rowId === row.id);
              const isExpanded = expandedRow === row.id;

              return (
                <React.Fragment key={row.id}>
                  <tr
                    className={`truth-table-row ${
                      result
                        ? result.pass
                          ? 'pass'
                          : 'fail'
                        : ''
                    }`}
                    onClick={() =>
                      result && setExpandedRow(isExpanded ? null : row.id)
                    }
                  >
                    <td className="row-number">{idx}</td>
                    {inputSignals.map((sig) => (
                      <td key={`in-${row.id}-${sig}`} className="input-cell">
                        <span className="bit-value">
                          {row.inputs[sig] ?? 0}
                        </span>
                      </td>
                    ))}
                    <td className="sep-col"></td>
                    {outputSignals.map((sig) => (
                      <td
                        key={`out-${row.id}-${sig}`}
                        className="output-cell editable"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          min="0"
                          max="1"
                          value={row.expected[sig] ?? 0}
                          onChange={(e) =>
                            updateExpected(
                              row.id,
                              sig,
                              parseInt(e.target.value) || 0
                            )
                          }
                          disabled={running}
                        />
                      </td>
                    ))}
                    {result && (
                      <td className="result-cell">
                        <span className={`badge ${result.pass ? 'pass' : 'fail'}`}>
                          {result.pass ? '✓' : '✗'}
                        </span>
                      </td>
                    )}
                  </tr>

                  {/* Expanded row details */}
                  {isExpanded && result && !result.pass && (
                    <tr className="detail-row">
                      <td colSpan={inputSignals.length + outputSignals.length + 3}>
                        <div className="row-details">
                          <h4>Discrepancies:</h4>
                          {result.differences.map((diff, i) => (
                            <div key={i} className="difference">
                              <span className="signal">{diff.signal}:</span>
                              <span className="values">
                                Expected <span className="val">{diff.expected}</span>
                                {' '}but got{' '}
                                <span className="val">{diff.actual}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        .truth-table-analyzer {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          background: #1e1e1e;
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          color: #e0e0e0;
        }

        .analyzer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #3a3a3a;
          padding-bottom: 0.75rem;
        }

        .analyzer-header h2 {
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

        .test-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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

        .truth-table-container {
          overflow-x: auto;
          border: 1px solid #3a3a3a;
          border-radius: 4px;
          background: #252525;
        }

        .truth-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }

        .truth-table thead {
          background: #2a2a2a;
          position: sticky;
          top: 0;
        }

        .truth-table th {
          padding: 0.75rem;
          text-align: center;
          border-bottom: 2px solid #3a3a3a;
          font-weight: bold;
          color: #00ff88;
        }

        .truth-table th.input-header {
          background: rgba(0, 150, 255, 0.1);
          border-right: 1px solid #3a3a3a;
        }

        .truth-table th.output-header {
          background: rgba(255, 200, 0, 0.1);
          border-left: 1px solid #3a3a3a;
        }

        .truth-table th.sep-col {
          width: 1px;
          background: #3a3a3a;
        }

        .truth-table th.result-header {
          background: rgba(0, 255, 136, 0.1);
          width: 60px;
        }

        .truth-table td {
          padding: 0.6rem 0.75rem;
          border-bottom: 1px solid #333;
          text-align: center;
        }

        .truth-table tr.truth-table-row:hover {
          background: #2d2d2d;
        }

        .truth-table tr.pass {
          background: rgba(0, 255, 136, 0.05);
        }

        .truth-table tr.pass td {
          border-bottom-color: rgba(0, 255, 136, 0.3);
        }

        .truth-table tr.fail {
          background: rgba(255, 68, 68, 0.05);
        }

        .truth-table tr.fail td {
          border-bottom-color: rgba(255, 68, 68, 0.3);
        }

        .row-number {
          color: #888;
          font-weight: bold;
          width: 40px;
        }

        .bit-value {
          font-weight: bold;
          color: #fff;
          font-size: 1rem;
        }

        .output-cell.editable {
          background: rgba(255, 200, 0, 0.05);
        }

        .output-cell.editable input {
          width: 2rem;
          padding: 0.3rem;
          background: #333;
          border: 1px solid #555;
          border-radius: 2px;
          color: #fff;
          text-align: center;
          font-family: monospace;
        }

        .output-cell.editable input:focus {
          outline: none;
          border-color: #00ff88;
          box-shadow: 0 0 4px rgba(0, 255, 136, 0.5);
        }

        .result-cell {
          font-weight: bold;
        }

        .badge {
          display: inline-block;
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }

        .badge.pass {
          background: #00ff88;
          color: #000;
        }

        .badge.fail {
          background: #ff4444;
          color: #fff;
        }

        .detail-row {
          background: #2a2a2a;
        }

        .row-details {
          padding: 1rem;
          background: rgba(255, 68, 68, 0.1);
          border-radius: 4px;
          margin: 0.5rem 0;
        }

        .row-details h4 {
          margin: 0 0 0.5rem 0;
          color: #ff6666;
        }

        .difference {
          display: flex;
          gap: 0.5rem;
          padding: 0.4rem 0;
          border-left: 2px solid #ff6666;
          padding-left: 0.5rem;
        }

        .difference .signal {
          color: #fff;
          font-weight: bold;
          min-width: 120px;
        }

        .difference .values {
          color: #ccc;
        }

        .difference .val {
          background: #333;
          padding: 0.1rem 0.4rem;
          border-radius: 2px;
          color: #ffaa00;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}
