// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { PerspectiveId } from '../stores/layoutStore';
import { useClassroomModeStore, isSafeMode } from '../stores/classroomModeStore';
import { Tooltip, Menu, GuardrailConfirmModal } from '@redbyte/rb-primitives';
import { NEO_ACTION_ICONS } from '../ui/neoIcons';
import styles from './TopCommandBar.module.css';

/**
 * Logic Playground vNext Top Command Bar
 *
 * Layout: [Project] [Simulation (primary)] [Mode + Help]
 *
 * Design principles:
 * - Thin, structured, calm
 * - Step Mode is FIRST-CLASS (more prominent than Run)
 * - Clear visual hierarchy
 */

interface TopCommandBarProps {
  // Project controls
  projectName?: string;
  onNew?: () => void;
  onNewProject?: () => void;
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  onExportProject?: () => void;
  onGenerateSubmissionBundle?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onExamples?: () => void;
  onShare?: () => void;
  isDirty?: boolean;
  autosaveState?: 'saved' | 'unsaved';
  submissionBundleFilename?: string | null;
  submissionBundleStatus?: 'pass' | 'fail' | 'unknown';

  // Undo/Redo controls
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;

  // Simulation controls (primary)
  isRunning: boolean;
  onRun: () => void;
  onPause: () => void;
  onStep: (count?: number) => void;
  onReset?: () => void;
  tickCount: number;
  tickRate: number;
  onTickRateChange: (hz: number) => void;
  onResetTickCount?: () => void;

  // Layout + Help
  perspective: PerspectiveId;
  onPerspectiveChange: (perspective: PerspectiveId) => void;
  schematicMiniEnabled?: boolean;
  onToggleSchematicMini?: () => void;
  onHelp: () => void;
  onStartHere?: () => void;
  onManual?: () => void;
  onExportEvidence?: () => void;
  onOpenEvidence?: () => void;

  // Classroom: Reset callbacks
  onResetWorkspace?: () => void;
  onResetLayout?: () => void;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  projectName,
  onNew,
  onNewProject,
  onSaveProject,
  onOpenProject,
  onExportProject,
  onGenerateSubmissionBundle,
  onSave,
  onSaveAs,
  onExamples,
  onShare,
  isDirty = false,
  autosaveState = isDirty ? 'unsaved' : 'saved',
  submissionBundleFilename,
  submissionBundleStatus = 'unknown',
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isRunning,
  onRun,
  onPause,
  onStep,
  onReset,
  tickCount,
  tickRate,
  onTickRateChange,
  onResetTickCount,
  perspective,
  onPerspectiveChange,
  schematicMiniEnabled,
  onToggleSchematicMini,
  onHelp,
  onStartHere,
  onManual,
  onExportEvidence,
  onOpenEvidence,
  onResetWorkspace,
  onResetLayout,
}) => {
  const { safeMode, setSafeMode, isComplexityWarning } = useClassroomModeStore();
  const [showResetMenu, setShowResetMenu] = React.useState(false);
  const [resetConfirm, setResetConfirm] = React.useState<null | 'workspace' | 'layout'>(null);

  const handleSafeModeToggle = () => {
    setSafeMode(!safeMode);
  };

  const handleExportQuickAction = onExportProject ?? onExportEvidence ?? onSaveProject ?? onSave;

  const handleResetWorkspace = () => {
    setResetConfirm('workspace');
    setShowResetMenu(false);
  };

  const handleResetLayout = () => {
    setResetConfirm('layout');
    setShowResetMenu(false);
  };

  const executeResetWorkspace = () => {
    if (onResetWorkspace) {
      onResetWorkspace();
    } else {
      localStorage.removeItem('rb_circuit');
      localStorage.removeItem('rb_layout');
      window.location.reload();
    }
    setResetConfirm(null);
  };

  const executeResetLayout = () => {
    if (onResetLayout) {
      onResetLayout();
    } else {
      localStorage.removeItem('rb_layout');
      window.location.reload();
    }
    setResetConfirm(null);
  };

  // PHASE 2C: Mount breadcrumb
  if (import.meta.env.DEV || (typeof navigator !== 'undefined' && navigator.webdriver)) {
    if (typeof window !== 'undefined' && window.__RB_MOUNT_TRACE__) {
      const timestamp = typeof performance !== 'undefined' ? performance.now().toFixed(1) : Date.now();
      window.__RB_MOUNT_TRACE__.push(`${timestamp} TopCommandBar:render`);
    }
  }

  const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

  const submissionStatusClass =
    submissionBundleStatus === 'pass'
      ? styles.pillPass
      : submissionBundleStatus === 'fail'
        ? styles.pillFail
        : styles.pillNeutral;

  return (
    <div className={styles.chromeRoot} data-testid="top-command-bar" role="toolbar" aria-label="Main Toolbar">
      <div className={styles.chromeInner}>
      <GuardrailConfirmModal
        isOpen={resetConfirm === 'workspace'}
        title="Reset Workspace?"
        message="This will clear the current circuit, reset simulation state, and remove any unsaved changes."
        lossItems={['Current circuit', 'Undo/redo history', 'Unsaved changes']}
        confirmLabel="Reset Workspace"
        confirmTone="danger"
        onConfirm={executeResetWorkspace}
        onCancel={() => setResetConfirm(null)}
        onExport={handleExportQuickAction}
        exportLabel="Export First"
      />
      <GuardrailConfirmModal
        isOpen={resetConfirm === 'layout'}
        title="Reset Layout?"
        message="This will reset layout preferences (dock state, split view, camera) back to defaults."
        lossItems={['Layout preferences', 'Panel positions', 'View split settings']}
        confirmLabel="Reset Layout"
        confirmTone="warning"
        onConfirm={executeResetLayout}
        onCancel={() => setResetConfirm(null)}
      />
      {/* LEFT: Project */}
      <div className={styles.actionRow}>
        <span className={styles.sectionLabel}>Project</span>
        {projectName && (
          <div className={styles.projectName}>
            {projectName}
            {isDirty ? <span className={styles.projectDirty}>*</span> : null}
          </div>
        )}
        <span
          className={cx(styles.pill, autosaveState === 'unsaved' ? styles.pillUnsaved : styles.pillSaved)}
          data-testid="logic-playground-autosave-state"
        >
          {autosaveState === 'unsaved' ? 'Unsaved changes' : 'Saved'}
        </span>
        {onNewProject && (
          <button
            onClick={onNewProject}
            className={cx(styles.button, styles.buttonSecondary)}
            title="New Project"
          >
            New Project
          </button>
        )}
        {onOpenProject && (
          <button
            onClick={onOpenProject}
            className={cx(styles.button, styles.buttonSecondary)}
            title="Open Project"
          >
            Open Project
          </button>
        )}
        {onSaveProject && (
          <button
            onClick={onSaveProject}
            className={cx(styles.button, styles.buttonSecondary)}
            title="Save Project"
          >
            Save Project
          </button>
        )}
        {onExportProject && (
          <button
            onClick={onExportProject}
            className={cx(styles.button, styles.buttonSecondary)}
            title="Export Project Artifacts"
          >
            Export...
          </button>
        )}
        {onGenerateSubmissionBundle && (
          <button
            onClick={onGenerateSubmissionBundle}
            className={cx(styles.button, styles.buttonPrimary)}
            title="Generate deterministic submission bundle"
            data-testid="logic-playground-generate-submission-bundle"
          >
            Generate Submission Bundle
          </button>
        )}
        {submissionBundleFilename ? (
          <span
            className={cx(styles.pill, styles.mono, submissionStatusClass)}
            data-testid="logic-playground-submission-bundle-filename"
            title={submissionBundleFilename}
          >
            {submissionBundleFilename}
          </span>
        ) : null}
        {onNew && (
          <button
            onClick={onNew}
            className={cx(styles.button, styles.buttonSecondary)}
            title="New Circuit"
          >
            New Circuit
          </button>
        )}
        {onExamples && (
          <button
            onClick={onExamples}
            className={cx(styles.button, styles.buttonSecondary)}
            title="Load Example"
            data-testid="logic-playground-examples"
          >
            {NEO_ACTION_ICONS.examples} Examples
          </button>
        )}
        {onExportEvidence && (
          <button
            onClick={onExportEvidence}
            className={cx(styles.button, styles.buttonWarn)}
            title="Export evidence for grading – includes circuit snapshot, probes, and integrity hash."
            data-testid="export-evidence-button"
          >
            {NEO_ACTION_ICONS.exportEvidence} Export Lab Evidence
          </button>
        )}
        {onOpenEvidence && (
          <button
            onClick={onOpenEvidence}
            className={cx(styles.button, styles.buttonSuccess)}
            title="Open Lab Evidence (checks integrity hash - look for PASS badge)"
            data-testid="open-evidence-button"
          >
            {NEO_ACTION_ICONS.openEvidence} Open Lab Evidence…
          </button>
        )}
        {onSave && (
          <button
            onClick={onSave}
            className={cx(styles.button, isDirty ? styles.buttonPrimary : styles.buttonSecondary, isDirty && styles.highlight)}
            title="Save (Ctrl+S)"
          >
            {isDirty ? '● Save' : 'Save'}
          </button>
        )}
        {onSaveAs && (
          <button
            onClick={onSaveAs}
            className={cx(styles.button, styles.buttonSecondary)}
            title="Save As"
          >
            Save As
          </button>
        )}
        {onShare && (
          <button
            onClick={onShare}
            className={cx(styles.button, styles.buttonSecondary)}
            title="Share via link"
          >
            Share
          </button>
        )}

        {/* Undo/Redo buttons */}
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={cx(styles.button, styles.buttonGhost, styles.buttonIcon)}
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
        )}
        {onRedo && (
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={cx(styles.button, styles.buttonGhost, styles.buttonIcon)}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷
          </button>
        )}
      </div>

      {/* CENTER: Simulation (PRIMARY - Step-first design) */}
      <div className={styles.simBlock}>
        <span className={styles.sectionLabel}>Simulate</span>

        {/* STEP - First-class, prominent */}
        <button
          onClick={() => onStep(1)}
          data-testid="logic-playground-step"
          className={cx(styles.button, styles.buttonPrimary)}
          title="Step Once (Space)"
        >
          <span>{NEO_ACTION_ICONS.step}</span>
          <span>Step</span>
        </button>

        {/* RUN/PAUSE - Secondary but still prominent */}
        <button
          onClick={isRunning ? onPause : onRun}
          data-testid="logic-playground-run"
          className={cx(styles.button, isRunning ? styles.buttonWarn : styles.buttonSuccess)}
          title={isRunning ? 'Pause' : 'Run'}
        >
          {isRunning ? (
            <>
              <span>{NEO_ACTION_ICONS.pause}</span>
              <span>Pause</span>
            </>
          ) : (
            <>
              <span>{NEO_ACTION_ICONS.run}</span>
              <span>Run</span>
            </>
          )}
        </button>

        {/* Tick Rate */}
        <div className={cx(styles.sliderWrap, styles.segmentSplit)}>
          <input
            type="range"
            min="1"
            max="60"
            value={tickRate}
            onChange={(e) => onTickRateChange(parseInt(e.target.value, 10))}
            className={styles.slider}
            aria-label="Tick rate"
            title="Tick rate"
          />
          <span className={cx(styles.tickRate, styles.mono)}>{tickRate}Hz</span>
        </div>

        {/* Clock Widget */}
        <div className={cx(styles.clockBlock, styles.segmentSplit)}>
          <div>
            <span className={styles.clockLabel}>Clock</span>
            <div className={styles.mono}>
              <span className={styles.tickCount} title="A tick is one discrete simulation step.">
                T+{tickCount}
              </span>
              <span className={styles.sectionLabel}>
                <span
                  className={cx(styles.runDot, isRunning && styles.runDotActive)}
                />
                {isRunning ? `${tickRate}Hz` : 'Paused'}
              </span>
            </div>
          </div>
          {onResetTickCount && (
            <button
              onClick={onResetTickCount}
              className={cx(styles.button, styles.buttonGhost)}
              title="Reset tick counter"
            >
              Reset
            </button>
          )}
        </div>

        {/* Reset */}
        {onReset && (
          <button
            onClick={onReset}
            className={cx(styles.button, styles.buttonDanger, styles.buttonIcon)}
            title="Reset Circuit"
          >
            <span>↺</span>
          </button>
        )}
      </div>

      {/* RIGHT: Layout + Help (with Overflow) */}
      <div className={styles.rightCluster}>
        {/* Desktop View */}
        <div className={cx(styles.rightCluster, styles.desktopOnly)}>
          <span className={styles.sectionLabel}>Layout</span>

          <div className={styles.layoutToggle}>
            <Tooltip content="Standard View">
              <button
                onClick={() => onPerspectiveChange('standard')}
                className={cx(styles.layoutButton, perspective === 'standard' && styles.layoutButtonActive)}
              >
                Editor
              </button>
            </Tooltip>
            <Tooltip content="Split View (Circuit + Scope)">
              <button
                onClick={() => onPerspectiveChange('split')}
                className={cx(styles.layoutButton, perspective === 'split' && styles.layoutButtonActive)}
              >
                Split
              </button>
            </Tooltip>
          </div>

          {/* Safe Mode Toggle */}
          <button
            onClick={handleSafeModeToggle}
            className={cx(styles.button, safeMode ? styles.buttonSuccess : styles.buttonGhost)}
            title="Toggle Safe Mode (disables 3D, quad, animations)"
          >
            {NEO_ACTION_ICONS.safeMode} {safeMode ? 'Safe' : 'Normal'}
          </button>

          {/* Reset Menu */}
          <div className={styles.relativeWrap}>
            <button
              onClick={() => setShowResetMenu(!showResetMenu)}
              className={cx(styles.button, styles.buttonGhost)}
              title="Reset workspace or layout"
            >
              ↻
            </button>
            {showResetMenu && (
              <div className={styles.resetMenu}>
                <button
                  onClick={handleResetWorkspace}
                  className={styles.resetMenuItem}
                >
                  Reset Workspace
                </button>
                <button
                  onClick={handleResetLayout}
                  className={styles.resetMenuItem}
                >
                  Reset Layout
                </button>
              </div>
            )}
          </div>

          {onManual && (
            <button
              onClick={onManual}
              className={cx(styles.button, styles.buttonSecondary)}
              title="Open Guide"
            >
              Guide
            </button>
          )}
          <button
            onClick={onHelp}
            className={cx(styles.button, styles.buttonPrimary)}
            title="Help (?)"
          >
            ?
          </button>
        </div>

        {/* Mobile/Tight View: Overflow Menu */}
        <div className={styles.mobileOnly}>
          <Menu label="Layout & Help" align="right">
            <Menu.Item onClick={() => onPerspectiveChange('standard')}>Editor View</Menu.Item>
            <Menu.Item onClick={() => onPerspectiveChange('split')}>Split View</Menu.Item>
            <Menu.Separator />
            <Menu.Item onClick={handleSafeModeToggle}>{safeMode ? 'Disable Safe Mode' : 'Enable Safe Mode'}</Menu.Item>
            <Menu.Item onClick={handleResetLayout}>Reset Layout</Menu.Item>
            <Menu.Separator />
            <Menu.Item onClick={onHelp}>Shortcuts</Menu.Item>
            {onManual && <Menu.Item onClick={onManual}>Documentation</Menu.Item>}
            {onExamples && <Menu.Item onClick={onExamples}>Examples</Menu.Item>}
          </Menu>
        </div>
      </div>
      </div>
    </div>
  );
};
