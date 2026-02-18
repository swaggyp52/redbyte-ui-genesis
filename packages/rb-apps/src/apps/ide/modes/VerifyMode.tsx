/**
 * VerifyMode — Deterministic vector execution, trace inspection, testbench generation
 *
 * When the IDE is in "Verify" mode:
 * - Run test vectors from project.vectors against the circuit
 * - Display PASS/FAIL results with failures list
 * - Show deterministic trace (all signal values at each step)
 * - Show determinism hash for reproducibility verification
 * - Warn if using internal simulation clock
 * - Export testbench.vhd that mirrors the exact same schedule
 */

import React, { useMemo, useState } from 'react';
import { useIde } from '../IdeContext';
import { runTestVectors, type VectorRunResult } from '../../../fpga/boards/basys3/vectorRunner';
import { generateTestbenchVhdl } from '../../../fpga/boards/basys3/testbenchGenerator';
import type { RBProject } from '../../../export/projectFormat';

export interface VerifyModeProps {
  // Optional: passed from parent if needed
}

/**
 * VerifyMode: Run vectors, show results, enable testbench export
 */
export const VerifyMode: React.FC<VerifyModeProps> = () => {
  const { circuit } = useIde();
  const [runResult, setRunResult] = useState<VectorRunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Mock for now; in real implementation, get from store
  const mockProject: RBProject = {
    kind: 'rb-project',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: 'Untitled Project',
    circuit,
    vectors: [],
    ioMapping: {},
    meta: {},
  };

  const hasVectors = (mockProject.vectors ?? []).length > 0;

  /**
   * Run test vectors
   */
  const handleRunVectors = async () => {
    if (!hasVectors) {
      alert('No test vectors defined. Add vectors to project.vectors first.');
      return;
    }

    setIsRunning(true);
    try {
      const result = await runTestVectors(circuit, mockProject.vectors ?? [], mockProject.ioMapping);
      setRunResult(result);
    } catch (error) {
      alert(`Error running vectors: ${error}`);
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * Export testbench.vhd
   */
  const handleExportTestbench = () => {
    if (!runResult?.pass) {
      alert('Cannot export testbench: vectors did not pass.');
      return;
    }

    const vhdlCode = generateTestbenchVhdl(mockProject, mockProject.vectors ?? []);

    // Trigger download
    const blob = new Blob([vhdlCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'testbench.vhd';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 bg-gray-950 text-gray-100 space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Verify Mode</h2>
        <p className="text-sm text-gray-400">Run test vectors and generate testbench.vhd</p>
      </div>

      {/* Vectors Status */}
      <div className="border border-gray-700 rounded p-3 bg-gray-900">
        <div className="text-sm">
          <span className="text-gray-400">Test Vectors: </span>
          <span className={hasVectors ? 'text-green-400' : 'text-yellow-400'}>
            {hasVectors ? `${mockProject.vectors?.length ?? 0} defined` : 'None defined'}
          </span>
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={handleRunVectors}
        disabled={!hasVectors || isRunning}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded"
      >
        {isRunning ? 'Running...' : 'Run Verification'}
      </button>

      {/* Results */}
      {runResult && (
        <>
          {/* Warning Banner */}
          {runResult.warningBanner && (
            <div className="border border-yellow-600 bg-yellow-900/20 rounded p-3">
              <p className="text-sm text-yellow-300">{runResult.warningBanner}</p>
            </div>
          )}

          {/* Status */}
          <div className="border border-gray-700 rounded p-3 bg-gray-900 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Status:</span>
              <span className={runResult.pass ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                {runResult.pass ? '✓ PASS' : '✗ FAIL'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Schedule:</span>
              <span className="text-cyan-400 font-mono text-sm">{runResult.schedule}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Determinism Hash:</span>
              <span className="text-cyan-400 font-mono text-xs">{runResult.deterministicHash}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Trace Samples:</span>
              <span className="text-gray-300">{runResult.trace.length}</span>
            </div>
          </div>

          {/* Failures (if any) */}
          {runResult.failures.length > 0 && (
            <div className="border border-red-700 rounded p-3 bg-red-900/20">
              <p className="text-sm font-semibold text-red-300 mb-2">Failures:</p>
              <div className="space-y-1 text-xs text-red-200 font-mono">
                {runResult.failures.map((f, i) => (
                  <div key={i}>
                    Tick {f.tick} {f.signal}: expected {f.expected}, got {f.actual}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trace Preview */}
          <details className="border border-gray-700 rounded">
            <summary className="p-3 bg-gray-900 cursor-pointer font-medium text-sm">
              Trace Data ({runResult.trace.length} samples)
            </summary>
            <div className="p-3 bg-gray-950 max-h-[300px] overflow-y-auto font-mono text-xs text-gray-400 space-y-1">
              {runResult.trace.slice(0, 20).map((sample, i) => (
                <div key={i}>
                  Tick {sample.tick} ({sample.phase}): {JSON.stringify(sample.signals).substring(0, 80)}...
                </div>
              ))}
              {runResult.trace.length > 20 && <div className="text-gray-500">... and {runResult.trace.length - 20} more</div>}
            </div>
          </details>

          {/* Export Button */}
          <button
            onClick={handleExportTestbench}
            disabled={!runResult.pass}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded"
          >
            {runResult.pass ? 'Export testbench.vhd' : 'Cannot export (vectors must pass)'}
          </button>
        </>
      )}
    </div>
  );
};

