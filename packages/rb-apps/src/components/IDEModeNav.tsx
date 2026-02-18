// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * IDEModeNav — The persistent 5-mode top navigation for the RedByte IDE.
 *
 *   Learn → Design → Verify → Export → Import
 *
 * Rules:
 * - One mode is always active. The canvas is ALWAYS visible; modes only change
 *   what's in the right dock, not what's on screen.
 * - The "Labs" button opens the template browser modal (not a back button).
 * - No other navigation competes with this bar inside the IDE.
 */

import React, { useCallback } from 'react';
import styles from './IDEModeNav.module.css';
import type { IDEMode } from '../apps/ide/IdeContext';
export type { IDEMode };

interface ModeDefinition {
  id: IDEMode;
  label: string;
  shortLabel: string;
  number: string;
  description: string;
}

const MODES: ModeDefinition[] = [
  {
    id: 'project',
    number: '01',
    label: 'Learn',
    shortLabel: 'Learn',
    description: 'Lab instructions, rubric, and pin map',
  },
  {
    id: 'design',
    number: '02',
    label: 'Design',
    shortLabel: 'Design',
    description: 'Schematic editor · VHDL view',
  },
  {
    id: 'verify',
    number: '03',
    label: 'Verify',
    shortLabel: 'Verify',
    description: 'Run tests · waveforms',
  },
  {
    id: 'export',
    number: '04',
    label: 'Export',
    shortLabel: 'Export',
    description: 'Generate VHDL + XDC for Vivado',
  },
  {
    id: 'import',
    number: '05',
    label: 'Import',
    shortLabel: 'Import',
    description: 'Import HDL + XDC from Vivado',
  },
];

interface ModeStatus {
  verify?: {
    passed: number;
    total: number;
  };
  export?: {
    ready: boolean;
    lastExportedAt?: string;
  };
}

export interface IDEModeNavProps {
  activeMode: IDEMode;
  onModeChange: (mode: IDEMode) => void;
  labNumber?: string;
  labTitle?: string;
  /** Opens the lab template browser modal */
  onOpenLabs?: () => void;
  /** @deprecated use onOpenLabs instead */
  onBackToLauncher?: () => void;
  modeStatus?: ModeStatus;
  /** If true, Export tab shows a soft warning (not a hard gate) */
  exportGate?: boolean;
}

const ModeTab: React.FC<{
  mode: ModeDefinition;
  isActive: boolean;
  modeStatus?: ModeStatus;
  onClick: () => void;
}> = ({ mode, isActive, modeStatus, onClick }) => {
  const verifyBadge =
    mode.id === 'verify' && modeStatus?.verify
      ? `${modeStatus.verify.passed}/${modeStatus.verify.total}`
      : null;

  const exportReady = mode.id === 'export' && modeStatus?.export?.ready;

  return (
    <button
      type="button"
      aria-pressed={isActive}
      className={[
        styles.modeTab,
        styles[`modeTab--${mode.id}`],
        isActive ? styles.modeTabActive : '',
      ].join(' ')}
      onClick={onClick}
      title={mode.description}
    >
      <span className={styles.modeNumber}>{mode.number}</span>
      <span className={styles.modeLabel}>{mode.label}</span>

      {verifyBadge && (
        <span
          className={[
            styles.modeBadge,
            modeStatus?.verify && modeStatus.verify.passed === modeStatus.verify.total
              ? styles.modeBadgeSuccess
              : styles.modeBadgePending,
          ].join(' ')}
          aria-label={`${modeStatus?.verify?.passed} of ${modeStatus?.verify?.total} tests passed`}
        >
          {verifyBadge}
        </span>
      )}

      {exportReady && (
        <span className={[styles.modeBadge, styles.modeBadgeExport].join(' ')} aria-label="Export ready">
          Ready
        </span>
      )}

      {isActive && <span className={styles.modeTabIndicator} aria-hidden="true" />}
    </button>
  );
};

export const IDEModeNav: React.FC<IDEModeNavProps> = ({
  activeMode,
  onModeChange,
  labNumber,
  labTitle,
  onOpenLabs,
  onBackToLauncher,
  modeStatus,
  exportGate,
}) => {
  // Support deprecated onBackToLauncher as fallback
  const labsHandler = onOpenLabs ?? onBackToLauncher;

  const handleModeClick = useCallback(
    (mode: IDEMode) => {
      if (mode !== activeMode) {
        onModeChange(mode);
      }
    },
    [activeMode, onModeChange]
  );

  return (
    <nav className={styles.root} aria-label="IDE modes">
      {/* Labs button + lab identity */}
      <div className={styles.labIdentity}>
        {labsHandler && (
          <button
            type="button"
            className={styles.labsBtn}
            onClick={labsHandler}
            aria-label="Load a template"
            title="Load a template"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
              <rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
              <rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Templates
          </button>
        )}

        <div className={styles.labMeta}>
          {labNumber && (
            <span className={styles.labChip}>
              {labNumber}
            </span>
          )}
          {labTitle && (
            <span className={styles.labTitleText}>{labTitle}</span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className={styles.navDivider} aria-hidden="true" />

      {/* Mode tabs */}
      <div className={styles.modeTabs}>
        {MODES.map((mode) => (
          <ModeTab
            key={mode.id}
            mode={mode}
            isActive={mode.id === activeMode}
            modeStatus={modeStatus}
            onClick={() => handleModeClick(mode.id)}
          />
        ))}

        {/* Flow arrow connectors */}
        <div className={styles.modeFlowArrows} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={styles.modeFlowArrow}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 5h8M6.5 2L9 5l-2.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div className={styles.spacer} aria-hidden="true" />

      {/* Export gate warning */}
      {exportGate && activeMode !== 'export' && (
        <div className={styles.exportGateHint} title="Run at least one simulation before exporting">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1L11 10H1L6 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M6 5v2.5M6 9v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Verify first
        </div>
      )}

      {/* Board target chip */}
      <div className={styles.boardChip} aria-label="Target board: Basys3">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <rect x="1" y="3" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.1" />
          <rect x="3" y="5" width="6" height="2" rx="0.5" stroke="currentColor" strokeWidth="1" />
          <path d="M3 3V2M6 3V1.5M9 3V2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M3 9v1M6 9v1.5M9 9v1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
        Basys3
      </div>
    </nav>
  );
};
