import React from 'react';
import type { SubmissionGateIssue } from '../labs/submissionGates';
import { resolveSubmissionGateFixIntent, type SubmissionGateFixIntent } from '../apps/labWorkspace/fixIntentMap';
import type { LabWorkspaceMode } from '../apps/labWorkspace/workspaceUx';
import { LAB_WORKSPACE_MODE_HINTS } from '../apps/labWorkspace/workspaceUx';
import { NEO_LABELS } from '../ui/neoGlossary';
import { NEO_ACTION_ICONS } from '../ui/neoIcons';
import type { LabExpectedBehaviorVisual } from '../labs/labDefinitions';
import type { IntelligenceAction, IntelligenceAnalyzeResult } from '../intelligence/client';
import styles from './WorkspaceRightSidebar.module.css';
import { StatusPill } from './StatusPill';

interface WorkspaceRightSidebarProps {
  labId: string;
  mode: LabWorkspaceMode;
  modeIndex: number;
  checklist: string[];
  issues: SubmissionGateIssue[];
  labGoal?: string;
  nextStepText: string;
  passCriteria: string[];
  commonMistakes: string[];
  conceptCallout: string;
  stageCommonMistake: string;
  whatGoodLooksLike: string;
  expectedBehaviorVisual: LabExpectedBehaviorVisual;
  readinessLabel: string;
  saveLabel: string;
  statusLabel: string;
  stageAccent?: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  onExportAction: () => void;
  onFixIntent: (intent: SubmissionGateFixIntent) => void;
  onAskRedByte: () => void;
  onExplainIssues: () => void;
  showExplainIssues: boolean;
  askRedByteLoading: boolean;
  askRedByteResult: IntelligenceAnalyzeResult | null;
  onAskRedByteAction: (action: IntelligenceAction) => void;
  lab4IoState?: {
    en: boolean;
    a: boolean;
    b: boolean;
    s2: boolean;
    s1: boolean;
    s0: boolean;
  };
  onLab4IoChange?: (next: {
    en: boolean;
    a: boolean;
    b: boolean;
    s2: boolean;
    s1: boolean;
    s0: boolean;
  }) => void;
  onResetLab4Workspace?: () => void;
}

const CHECKLIST_STAGE_LABELS = ['Design', 'Simulate', 'Hardware', 'Package'] as const;

function toOneSentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'Resolve this issue to keep your lab on track.';
  const firstSentence = trimmed.split(/[.!?]\s/, 1)[0] ?? trimmed;
  return firstSentence.endsWith('.') ? firstSentence : `${firstSentence}.`;
}

export const WorkspaceRightSidebar: React.FC<WorkspaceRightSidebarProps> = ({
  labId,
  mode,
  modeIndex,
  checklist,
  issues,
  labGoal,
  nextStepText,
  passCriteria,
  commonMistakes,
  conceptCallout,
  stageCommonMistake,
  whatGoodLooksLike,
  expectedBehaviorVisual,
  readinessLabel,
  saveLabel,
  statusLabel,
  stageAccent,
  primaryActionLabel,
  onPrimaryAction,
  onExportAction,
  onFixIntent,
  onAskRedByte,
  onExplainIssues,
  showExplainIssues,
  askRedByteLoading,
  askRedByteResult,
  onAskRedByteAction,
  lab4IoState,
  onLab4IoChange,
  onResetLab4Workspace,
}) => {
  const actionableIssues = React.useMemo(() => [...issues]
    .sort((left, right) => {
      if (left.severity === right.severity) return 0;
      return left.severity === 'block' ? -1 : 1;
    })
    .slice(0, 4), [issues]);
  const indexedActionableIssues = React.useMemo(
    () => actionableIssues.map((issue, index) => ({ issue, index })),
    [actionableIssues],
  );
  const blockingIssues = React.useMemo(
    () => indexedActionableIssues.filter(({ issue }) => issue.severity === 'block'),
    [indexedActionableIssues],
  );
  const warningIssues = React.useMemo(
    () => indexedActionableIssues.filter(({ issue }) => issue.severity === 'warn'),
    [indexedActionableIssues],
  );
  const hasGateIssues = indexedActionableIssues.length > 0;
  const hasBlockingIssues = blockingIssues.length > 0;
  const topIssue = indexedActionableIssues[0]?.issue ?? null;
  const intelBlockingActions = React.useMemo(
    () => askRedByteResult?.actions.filter((action) => action.severity === 'blocking') ?? [],
    [askRedByteResult],
  );
  const intelWarningActions = React.useMemo(
    () => askRedByteResult?.actions.filter((action) => action.severity !== 'blocking') ?? [],
    [askRedByteResult],
  );
  const intelFallback = Boolean(askRedByteResult?.debug?.fallback);
  const topIssueFixIntent = topIssue ? resolveSubmissionGateFixIntent(topIssue) : null;
  const isLab4 = labId === 'lab-4';
  const liveIo = lab4IoState ?? {
    en: false,
    a: false,
    b: false,
    s2: false,
    s1: false,
    s0: false,
  };
  const opcodeBinary = `${liveIo.s2 ? '1' : '0'}${liveIo.s1 ? '1' : '0'}${liveIo.s0 ? '1' : '0'}`;
  const opcodeName = React.useMemo(() => {
    const lookup: Record<string, string> = {
      '000': 'AND',
      '001': 'NAND',
      '010': 'OR',
      '011': 'NOR',
      '100': 'XOR',
      '101': 'XNOR',
      '110': 'SUM',
      '111': 'CARRY',
    };
    return lookup[opcodeBinary] ?? 'UNKNOWN';
  }, [opcodeBinary]);
  const currentF = liveIo.en ? (liveIo.a && liveIo.b ? 1 : 0) : 0;

  const commandActions = React.useMemo(() => {
    const actions: Array<{ id: string; label: string; onClick: () => void }> = [
      { id: 'primary', label: primaryActionLabel, onClick: onPrimaryAction },
    ];

    if (topIssueFixIntent) {
      actions.push({ id: 'fix', label: 'Fix', onClick: () => onFixIntent(topIssueFixIntent) });
      actions.push({ id: 'show', label: 'Show me', onClick: () => onFixIntent(topIssueFixIntent) });
    } else if (mode === 'submit') {
      actions.push({ id: 'export', label: 'Export', onClick: onExportAction });
    }

    return actions.slice(0, 3);
  }, [mode, onExportAction, onFixIntent, onPrimaryAction, primaryActionLabel, topIssueFixIntent]);

  return (
    <div data-testid="workspace-right-sidebar" className={styles.root} style={{ ['--rb-stage-accent' as string]: stageAccent ?? 'var(--rb-accent-build)' }}>
      <div data-testid="workspace-status-pills" className={styles.statusPills}>
        <StatusPill label={readinessLabel} tone={readinessLabel === 'READY' ? 'ready' : readinessLabel === 'WARNING' ? 'warning' : 'notReady'} />
        <StatusPill label={saveLabel} tone={saveLabel === 'SAVED' ? 'saved' : 'unsaved'} />
        <StatusPill label={statusLabel} tone={statusLabel === 'RUNNING' ? 'running' : statusLabel === 'DONE' ? 'done' : statusLabel === 'ERROR' ? 'error' : statusLabel === 'WARNING' ? 'warning' : 'ready'} />
      </div>

      {isLab4 ? (
        <div data-testid="lab4-wiring-checklist" className={styles.block}>
          <div className={styles.title}>Lab 4 Wiring Checklist</div>
          <ul className={styles.listWide}>
            <li className={styles.muted}>S2/S1/S0 order matters (SW3/SW2/SW1).</li>
            <li className={styles.muted}>When en=0, F must be blocked (0 or Z).</li>
            <li className={styles.muted}>Route F to LED1.</li>
          </ul>
          <div className={styles.mappingRow}>Mapping: EN↔SW8 · A↔SW5 · B↔SW4 · S2/S1/S0↔SW3/SW2/SW1 · F↔LED1</div>
        </div>
      ) : null}

      {isLab4 ? (
        <div data-testid="lab4-live-io" className={styles.block}>
          <div className={styles.title}>Live I/O</div>
          <div className={styles.liveIoGrid}>
            {([
              ['en', 'EN'],
              ['a', 'A'],
              ['b', 'B'],
              ['s2', 'S2'],
              ['s1', 'S1'],
              ['s0', 'S0'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                data-testid={`lab4-live-io-toggle-${key}`}
                className={`${styles.liveIoToggle} ${liveIo[key] ? styles.liveIoToggleOn : ''}`}
                onClick={() => onLab4IoChange?.({ ...liveIo, [key]: !liveIo[key] })}
              >
                {label}: {liveIo[key] ? '1' : '0'}
              </button>
            ))}
          </div>
          <div data-testid="lab4-live-io-opcode" className={styles.liveIoReadout}>
            Opcode {opcodeBinary} → {opcodeName}
          </div>
          <div className={styles.liveIoReadout}>Current F (sanity preview): {currentF}</div>
          <button
            type="button"
            data-testid="lab4-reset-workspace"
            className={styles.heroButton}
            onClick={() => onResetLab4Workspace?.()}
          >
            Reset Lab Workspace
          </button>
        </div>
      ) : null}

      {isLab4 ? (
        <div data-testid="lab4-learning-aids" className={styles.block}>
          <div className={styles.title}>Lab 4 Learning Aids</div>
          <div className={styles.muted} style={{ marginTop: 6 }}>
            Use this as a spec + debug checklist. It does not provide circuit wiring.
          </div>

          <div className={styles.aidSection}>
            <div className={styles.title}>Opcode spec</div>
            <ul className={styles.listWide}>
              <li className={styles.muted}>000 = AND</li>
              <li className={styles.muted}>001 = NAND</li>
              <li className={styles.muted}>010 = OR</li>
              <li className={styles.muted}>011 = NOR</li>
              <li className={styles.muted}>100 = XOR</li>
              <li className={styles.muted}>101 = XNOR</li>
              <li className={styles.muted}>110 = SUM</li>
              <li className={styles.muted}>111 = CARRY</li>
            </ul>
          </div>

          <div className={styles.aidSection}>
            <div className={styles.title}>Suggested test vectors</div>
            <ul className={styles.listWide}>
              <li className={styles.muted}>en=1, A=0, B=0 → verify all opcode outputs</li>
              <li className={styles.muted}>en=1, A=0, B=1 → verify all opcode outputs</li>
              <li className={styles.muted}>en=1, A=1, B=0 → verify all opcode outputs</li>
              <li className={styles.muted}>en=1, A=1, B=1 → verify all opcode outputs</li>
              <li className={styles.muted}>en=0 with multiple opcode settings → F blocked</li>
            </ul>
          </div>

          <div className={styles.aidSection}>
            <div className={styles.title}>Probe tips</div>
            <ul className={styles.listWide}>
              <li className={styles.muted}>Probe select lines S2/S1/S0 and output F together.</li>
              <li className={styles.muted}>Probe operation subpaths to ensure only selected op reaches F.</li>
              <li className={styles.muted}>Probe EN gating path to confirm en=0 blocks output.</li>
            </ul>
          </div>
        </div>
      ) : null}

      <div data-testid="workspace-next-step" className={styles.heroCard}>
        <div className={styles.title}>{NEO_LABELS.NEXT_ACTION}</div>
        <div className={styles.heroBody}>{nextStepText}</div>
        <div className={styles.commandActions}>
          {commandActions.map((action) => (
            <button
              key={action.id}
              type="button"
              data-testid={`workspace-next-action-${action.id}`}
              className={action.id === 'primary' ? `${styles.heroButton} ${styles.heroButtonPrimary}` : styles.heroButton}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div data-testid="workspace-edu-callouts" className={styles.block}>
        <div className={styles.title}>Diagnose</div>
        <div className={styles.heroBody}>{conceptCallout}</div>
        <div style={{ marginTop: 8 }}>
          <div className={styles.title}>Compare</div>
          <div className={styles.muted}>{stageCommonMistake}</div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div className={styles.title}>Capture</div>
          <div className={styles.muted}>{whatGoodLooksLike}</div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div className={styles.title}>{NEO_LABELS.PASS_LOOKS_LIKE}</div>
          <div className={styles.muted}>{passCriteria[0] ?? 'Complete current stage checks.'}</div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div className={styles.title}>{NEO_LABELS.COMMON_MISTAKES}</div>
          <div className={styles.muted}>{commonMistakes[0] ?? 'Skipping evidence capture before moving stages.'}</div>
        </div>
      </div>

      <div data-testid="workspace-expected-behavior" className={styles.block}>
        <div className={styles.title}>Expected behavior</div>
        <div className={styles.muted} style={{ marginTop: 4 }}>{expectedBehaviorVisual.title}</div>
        <div className={styles.visualTableWrap}>
          <table className={styles.visualTable}>
            <thead>
              <tr>
                {expectedBehaviorVisual.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expectedBehaviorVisual.rows.slice(0, 3).map((row, rowIndex) => (
                <tr key={`${expectedBehaviorVisual.kind}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {expectedBehaviorVisual.note ? <div className={styles.muted}>{expectedBehaviorVisual.note}</div> : null}
      </div>

      <div data-testid="workspace-intelligence" className={styles.block}>
        <div className={styles.title}>Studio Assistant</div>
        <button
          data-testid="workspace-intelligence-ask"
          type="button"
          className={styles.heroButton}
          onClick={onAskRedByte}
          disabled={askRedByteLoading}
        >
          {askRedByteLoading ? 'Diagnosing…' : 'Diagnose'}
        </button>
        {showExplainIssues ? (
          <button
            data-testid="workspace-intelligence-explain-issues"
            type="button"
            className={styles.heroButton}
            onClick={onExplainIssues}
            disabled={askRedByteLoading}
            style={{ marginLeft: 8 }}
          >
            {askRedByteLoading ? 'Comparing…' : 'Compare + Fix'}
          </button>
        ) : null}
        {askRedByteResult ? (
          <div data-testid="workspace-intelligence-summary" className={styles.intelResult}>
            <div style={{ whiteSpace: 'pre-line' }}>{askRedByteResult.summary}</div>
            {intelFallback && actionableIssues.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                <div className={styles.title}>Raw gate messages</div>
                <ul className={styles.list}>
                  {actionableIssues.slice(0, 3).map((issue, index) => (
                    <li key={`fallback-${issue.code}-${index}`} className={styles.muted}>
                      {issue.title}: {toOneSentence(issue.message)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {askRedByteResult.actions.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                {intelBlockingActions.length > 0 ? <div className={styles.title}>Blocking</div> : null}
                {intelBlockingActions.map((action, index) => (
                  <div key={`intel-block-${index}`} style={{ marginTop: 6 }}>
                    <div className={styles.issueBody}>{action.title ?? action.label}</div>
                    {action.why ? <div className={styles.muted}>{action.why}</div> : null}
                    <button
                      data-testid={`workspace-intelligence-action-${index}`}
                      type="button"
                      className={styles.issueFixButton}
                      onClick={() => onAskRedByteAction(action)}
                    >
                      Fix it
                    </button>
                  </div>
                ))}
                {intelWarningActions.length > 0 ? <div className={styles.title} style={{ marginTop: 8 }}>Warnings</div> : null}
                {intelWarningActions.map((action, index) => (
                  <div key={`intel-warn-${index}`} style={{ marginTop: 6 }}>
                    <div className={styles.issueBody}>{action.title ?? action.label}</div>
                    {action.why ? <div className={styles.muted}>{action.why}</div> : null}
                    <button
                      data-testid={`workspace-intelligence-warning-action-${index}`}
                      type="button"
                      className={styles.issueFixButton}
                      onClick={() => onAskRedByteAction(action)}
                    >
                      Fix it
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className={styles.muted} style={{ marginTop: 6 }}>
            Diagnose your current stage and take one concrete fix.
          </div>
        )}
      </div>

      <div data-testid="workspace-right-sidebar-checklist" className={styles.block}>
        <div className={styles.title} style={{ marginBottom: 8 }}>Checklist</div>
        <ul className={styles.listWide}>
          {checklist.map((step, index) => {
            const done = index < modeIndex;
            const active = index === modeIndex;
            const stageLabel = CHECKLIST_STAGE_LABELS[index] ?? `Step ${index + 1}`;
            return (
              <li key={`${index}-${step}`} className={[styles.checklistItem, done ? styles.checkDone : '', active ? styles.checkActive : ''].filter(Boolean).join(' ')}>
                <span style={{ color: done ? 'var(--rb-success)' : active ? 'var(--rb-info)' : 'var(--rb-text-muted)', fontWeight: 700 }}>
                  {done ? '✓ ' : active ? '• ' : '○ '}
                </span>
                <span style={{ fontWeight: 700 }}>{stageLabel}:</span> {step}
              </li>
            );
          })}
        </ul>
      </div>

      <div data-testid="workspace-right-sidebar-next-action" className={styles.block}>
        <div className={styles.title}>Status</div>
        <div className={styles.muted} style={{ marginTop: 4, fontSize: 12 }}>
          {LAB_WORKSPACE_MODE_HINTS[mode]}
        </div>
      </div>

      {labGoal && (
        <div className={styles.block}>
          <div className={styles.title}>Studio Goal</div>
          <div className={styles.muted} style={{ marginTop: 4, fontSize: 12 }}>{labGoal}</div>
        </div>
      )}

      <div data-testid="workspace-right-sidebar-fixes" style={{ display: 'grid', gap: 8 }}>
        <div className={styles.title}>Issues</div>

        <div data-testid="workspace-issues-blocking" style={{ display: 'grid', gap: 6 }}>
          <div className={styles.issueSectionTitle}>
            <span>{NEO_LABELS.BLOCKING}</span>
            <span data-testid="workspace-issues-blocking-chip" className={styles.issueCountChip}>({blockingIssues.length})</span>
          </div>
          {blockingIssues.length === 0 ? (
            <div className={styles.emptyHint}>{NEO_LABELS.NO_BLOCKING}</div>
          ) : (
            blockingIssues.map(({ issue, index }) => {
              const fixIntent = resolveSubmissionGateFixIntent(issue);
              return (
                <div
                  key={`block-${issue.code}-${index}`}
                  className={`${styles.issueCard} ${styles.issueCardBlocking}`}
                >
                  <div className={styles.issueTitle}>
                    <span>{NEO_ACTION_ICONS.blocking}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {issue.title}
                    </span>
                  </div>
                  <div className={styles.issueBody}>{toOneSentence(issue.message)}</div>
                  <button
                    data-testid={`workspace-right-sidebar-fix-${index}`}
                    type="button"
                    onClick={() => onFixIntent(fixIntent)}
                    className={styles.issueFixButton}
                  >
                    {fixIntent.label}
                  </button>
                  {issue.fixHint ? (
                    <details style={{ marginTop: 6 }}>
                      <summary className={styles.muted} style={{ cursor: 'pointer' }}>Why this matters</summary>
                      <div className={styles.muted} style={{ marginTop: 4 }}>{issue.fixHint}</div>
                    </details>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div data-testid="workspace-issues-warnings" style={{ display: 'grid', gap: 6 }}>
          <details data-testid="workspace-issues-warnings-collapse" open={!hasBlockingIssues}>
            <summary className={styles.issueSectionTitle}>
              <span>{NEO_LABELS.WARNINGS}</span>
              <span data-testid="workspace-issues-warnings-chip" className={styles.issueCountChip}>({warningIssues.length})</span>
            </summary>
            <div className={styles.warningSectionBody}>
              {warningIssues.length === 0 ? (
                <div className={styles.emptyHint}>{NEO_LABELS.NO_WARNINGS}</div>
              ) : (
                warningIssues.map(({ issue, index }) => {
                  const fixIntent = resolveSubmissionGateFixIntent(issue);
                  return (
                    <div
                      key={`warn-${issue.code}-${index}`}
                      className={`${styles.issueCard} ${styles.issueCardWarning}`}
                    >
                      <div className={styles.issueTitle}>
                        <span>{NEO_ACTION_ICONS.warning}</span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {issue.title}
                        </span>
                      </div>
                      <div className={styles.issueBody}>{toOneSentence(issue.message)}</div>
                      <button
                        data-testid={`workspace-right-sidebar-fix-${index}`}
                        type="button"
                        onClick={() => onFixIntent(fixIntent)}
                        className={styles.issueFixButton}
                      >
                        {fixIntent.label}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </details>
        </div>

        {!hasGateIssues ? (
          <div data-testid="workspace-right-sidebar-fixes-empty" className={styles.emptyHint}>
            No blocking fixes for this stage.
          </div>
        ) : null}
      </div>

      {labGoal ? null : (
        <div className={styles.emptyHint}>
          Continue through the workspace stages to complete this lab.
        </div>
      )}
    </div>
  );
};
