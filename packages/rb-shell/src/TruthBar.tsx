// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';

/**
 * Determinism Mode for the Truth Bar
 */
export type DeterminismMode = 'live' | 'recording' | 'replay';

/**
 * Props for the Truth Bar / Evidence Bar component
 */
export interface TruthBarProps {
  /** Current determinism mode */
  mode: DeterminismMode;
  /** Current tick/event count */
  tickCount: number;
  /** Total events (for replay mode) */
  totalEvents?: number;
  /** Current state hash (first N chars shown) */
  hashPrefix?: string;
  /** Whether recording can be started (circuit available) */
  canRecord: boolean;
  /** Callback to toggle recording */
  onToggleRecording: () => void;
  /** Callback to verify replay */
  onVerify?: () => void;
  /** Verification status */
  verificationStatus?: 'pending' | 'pass' | 'fail';
  /** Callback to open full determinism panel */
  onOpenPanel?: () => void;
  /** Save state for the current circuit */
  saveState?: 'saved' | 'unsaved' | 'never';
  /** Human-readable last save label */
  lastSaveLabel?: string;
  /** Whether a verified proof pack exists */
  hasProofPack?: boolean;
  /** Callback to export proof pack directly */
  onExportProof?: () => void;
  /** Live count of recorded events during active recording */
  recordingEventCount?: number;
}

/**
 * Truth Bar / Evidence Bar — Always-visible determinism + evidence status
 *
 * This is the soul of RedByte: determinism isn't a debug feature,
 * it's the physics of the world. Every circuit, every tick, every state
 * is hashable, reproducible, and provable.
 *
 * Two-row layout:
 * Row 1: Mode indicator, tick counter, event count, save state
 * Row 2: Recording status, proof status, action buttons
 */
export const TruthBar: React.FC<TruthBarProps> = ({
  mode,
  tickCount,
  totalEvents,
  hashPrefix,
  canRecord,
  onToggleRecording,
  onVerify,
  verificationStatus,
  onOpenPanel,
  saveState = 'never',
  lastSaveLabel,
  hasProofPack = false,
  onExportProof,
  recordingEventCount = 0,
}) => {
  const modeConfig = useMemo(() => {
    switch (mode) {
      case 'recording':
        return {
          label: 'REC',
          color: 'text-red-400',
          bg: 'bg-red-500/20',
          border: 'border-red-500/50',
          pulse: true,
        };
      case 'replay':
        return {
          label: 'REPLAY',
          color: 'text-purple-400',
          bg: 'bg-purple-500/20',
          border: 'border-purple-500/50',
          pulse: false,
        };
      default:
        return {
          label: 'LIVE',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/20',
          border: 'border-emerald-500/50',
          pulse: false,
        };
    }
  }, [mode]);

  const verifyConfig = useMemo(() => {
    switch (verificationStatus) {
      case 'pass':
        return { icon: '\u2713', color: 'text-green-400', title: 'Deterministic - hashes match' };
      case 'fail':
        return { icon: '\u2717', color: 'text-red-400', title: 'Diverged - hashes differ' };
      default:
        return null;
    }
  }, [verificationStatus]);

  const saveLabelText = lastSaveLabel ?? (saveState === 'never' ? 'Never saved' : saveState === 'saved' ? 'Saved' : 'Unsaved');

  /* Recording status line */
  const recordingText = mode === 'recording'
    ? `Recording (${recordingEventCount} events)`
    : 'Recording: Off';

  /* Proof status line */
  const proofText = hasProofPack
    ? `Proof: Valid${hashPrefix ? ` (H:${hashPrefix})` : ''}`
    : 'Proof: None';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20">
      <div
        className="px-3 py-1.5 flex flex-col gap-1 border-t backdrop-blur-md"
        style={{ background: 'rgba(8, 12, 20, 0.94)', borderColor: 'var(--rb-border)' }}
      >
        {/* Row 1: Status indicators */}
        <div className="flex items-center gap-3">
          {/* Mode Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold tracking-wider ${modeConfig.bg} ${modeConfig.border} border ${modeConfig.color}`}
          >
            {modeConfig.pulse && (
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
            <span>{modeConfig.label}</span>
          </div>

          {/* Tick Counter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span className="text-slate-500">T:</span>
            <span className="text-cyan-400 font-semibold tabular-nums">
              {tickCount.toString().padStart(5, '0')}
            </span>
            {mode === 'replay' && totalEvents !== undefined && (
              <span className="text-slate-500">/ {totalEvents}</span>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-slate-700" />

          {/* Events */}
          <div className="text-xs text-slate-400 font-mono">
            Events: <span className="text-slate-300">{totalEvents ?? recordingEventCount}</span>
          </div>

          {/* Verification Status */}
          {verifyConfig && (
            <>
              <div className="w-px h-4 bg-slate-700" />
              <div
                className={`flex items-center gap-1 text-xs font-semibold ${verifyConfig.color}`}
                title={verifyConfig.title}
              >
                <span>{verifyConfig.icon}</span>
                <span>{verificationStatus === 'pass' ? 'PROVEN' : 'DIVERGED'}</span>
              </div>
            </>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Save State */}
          <div className="text-[11px] text-slate-500 font-mono">
            {saveLabelText}
          </div>
        </div>

        {/* Row 2: Recording / Proof status + Actions */}
        <div className="flex items-center gap-3">
          {/* Recording status text */}
          <span className="text-[11px] text-slate-500 font-mono">{recordingText}</span>

          <div className="w-px h-3 bg-slate-700/60" />

          {/* Proof status text */}
          <span className="text-[11px] text-slate-500 font-mono">{proofText}</span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Record Button */}
            <button
              type="button"
              onClick={onToggleRecording}
              disabled={!canRecord && mode !== 'recording'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900 ${
                mode === 'recording'
                  ? 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500'
                  : canRecord
                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white focus:ring-cyan-500'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
              title={mode === 'recording' ? 'Stop Recording' : canRecord ? 'Start Recording' : 'Open a circuit first'}
            >
              <span className={`w-2 h-2 rounded-full ${mode === 'recording' ? 'bg-white' : 'bg-red-500'}`} />
              <span>{mode === 'recording' ? 'STOP' : 'REC'}</span>
            </button>

            {/* Verify Button */}
            {mode !== 'recording' && onVerify && (
              <button
                type="button"
                onClick={onVerify}
                className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-600/80 hover:bg-blue-500 text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-slate-900"
                title="Verify determinism via replay"
              >
                VERIFY
              </button>
            )}

            {/* Export Proof Button */}
            {onExportProof && hasProofPack && (
              <button
                type="button"
                onClick={onExportProof}
                className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600/80 hover:bg-emerald-500 text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 focus:ring-offset-slate-900"
                title="Export proof pack"
              >
                EXPORT
              </button>
            )}

            {/* Expand Button */}
            {onOpenPanel && (
              <button
                type="button"
                onClick={onOpenPanel}
                className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                title="Open Determinism Panel"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 5L7 10L12 5" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
