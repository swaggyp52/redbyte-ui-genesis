// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Modal } from '@redbyte/rb-primitives';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { CircuitStateSnapshot } from '../../../rb-logic-core/src/determinism';

interface DeterminismPanelProps {
  isOpen: boolean;
  onClose: () => void;
  getCurrentCircuit: () => Circuit | null;
  onRecordAction: (action: DeterminismAction) => void;
  onExportLog: () => void;
  isRecording: boolean;
  verificationResult: {
    liveHash: string;
    replayHash: string;
    equal: boolean;
  } | null;
  currentSnapshot: CircuitStateSnapshot | null;
  canNavigateForward: boolean;
  canNavigateBackward: boolean;
}

export type DeterminismAction =
  | { type: 'start-recording' }
  | { type: 'stop-recording' }
  | { type: 'verify-replay' }
  | { type: 'reset' }
  | { type: 'initialize-timetravel' }
  | { type: 'step-forward' }
  | { type: 'step-backward' };

/**
 * Determinism Tools Panel (Dev Only)
 *
 * Minimal UI for demonstrating deterministic record/replay and time travel capabilities.
 * This panel is purely presentational - all logic lives in:
 * - useDeterminismRecorder (adapter layer)
 * - rb-logic-core/determinism (core primitives)
 *
 * Milestone B (PR7): Record/Replay
 * - Opens via Cmd/Ctrl+Shift+D
 * - Start/Stop creates EventLog via recorder
 * - Verify calls verifyReplay() and displays results
 *
 * Milestone C (PR10): Time Travel
 * - Initialize time travel navigation
 * - Step forward/backward through event log
 * - Display current snapshot state
 */
export const DeterminismPanel: React.FC<DeterminismPanelProps> = ({
  isOpen,
  onClose,
  getCurrentCircuit,
  onRecordAction,
  onExportLog,
  isRecording,
  verificationResult,
  currentSnapshot,
  canNavigateForward,
  canNavigateBackward,
}) => {
  const handleStartRecording = () => {
    const circuit = getCurrentCircuit();
    if (!circuit) {
      alert('No active circuit found. Open Logic Playground first.');
      return;
    }
    onRecordAction({ type: 'start-recording' });
  };

  const handleStopRecording = () => {
    onRecordAction({ type: 'stop-recording' });
  };

  const handleVerify = () => {
    onRecordAction({ type: 'verify-replay' });
  };

  const handleReset = () => {
    onRecordAction({ type: 'reset' });
  };

  const handleInitializeTimeTravel = () => {
    onRecordAction({ type: 'initialize-timetravel' });
  };

  const handleStepForward = () => {
    onRecordAction({ type: 'step-forward' });
  };

  const handleStepBackward = () => {
    onRecordAction({ type: 'step-backward' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Determinism Tools (Dev)"
      width={550}
      height={550}
    >
      <div className="p-6 space-y-6">
        {/* Recording Controls */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Recording
          </h3>
          <div className="flex gap-3">
            <button
              onClick={handleStartRecording}
              disabled={isRecording}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                isRecording
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              Start Recording
            </button>
            <button
              onClick={handleStopRecording}
              disabled={!isRecording}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                !isRecording
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              Stop Recording
            </button>
          </div>
          {isRecording && (
            <div className="flex items-center gap-2 text-sm text-yellow-400">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span>Recording...</span>
            </div>
          )}
        </div>

        {/* Verification Controls */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Verification
          </h3>
          <div className="flex gap-3">
            <button
              onClick={handleVerify}
              disabled={isRecording}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                isRecording
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Verify Replay
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded font-medium bg-gray-600 hover:bg-gray-700 text-white transition-colors"
            >
              Reset
            </button>
            <button
              onClick={onExportLog}
              disabled={isRecording}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                isRecording
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-700 text-white'
              }`}
              title="Export event log + initial circuit for bug reports"
            >
              Export Log
            </button>
          </div>
        </div>

        {/* Time Travel Controls */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Time Travel (Milestone C)
          </h3>
          <div className="flex gap-3">
            <button
              onClick={handleInitializeTimeTravel}
              disabled={isRecording || !verificationResult}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                isRecording || !verificationResult
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              Initialize
            </button>
            <button
              onClick={handleStepBackward}
              disabled={!canNavigateBackward}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                !canNavigateBackward
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              ← Step Back
            </button>
            <button
              onClick={handleStepForward}
              disabled={!canNavigateForward}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                !canNavigateForward
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              Step Forward →
            </button>
          </div>
          {currentSnapshot && (
            <div className="text-sm text-gray-300 font-mono">
              Event {currentSnapshot.eventIndex + 1} of {currentSnapshot.totalEvents}
            </div>
          )}
        </div>

        {/* Results Display */}
        {verificationResult && (
          <div className="space-y-3 p-4 bg-gray-800 rounded border border-gray-700">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Verification Result
            </h3>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">Live Hash:</span>
                <span className="text-gray-200">{verificationResult.liveHash.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Replay Hash:</span>
                <span className="text-gray-200">{verificationResult.replayHash.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-700">
                <span className="text-gray-400">Status:</span>
                <span
                  className={`font-bold ${
                    verificationResult.equal ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {verificationResult.equal ? '✓ Deterministic' : '✗ Diverged'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
