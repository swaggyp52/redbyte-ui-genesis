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
  onFixIntent: (intent: SubmissionGateFixIntent) => void;
  onAskRedByte: () => void;
  onExplainIssues: () => void;
  showExplainIssues: boolean;
  askRedByteLoading: boolean;
  askRedByteResult: IntelligenceAnalyzeResult | null;
  onAskRedByteAction: (action: IntelligenceAction) => void;
}

const CHECKLIST_STAGE_LABELS = ['Design', 'Simulate', 'Hardware', 'Package'] as const;

function toOneSentence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'Resolve this issue to keep your lab on track.';
  const firstSentence = trimmed.split(/[.!?]\s/, 1)[0] ?? trimmed;
  return firstSentence.endsWith('.') ? firstSentence : `${firstSentence}.`;
}

export const WorkspaceRightSidebar: React.FC<WorkspaceRightSidebarProps> = ({
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
  onFixIntent,
  onAskRedByte,
  onExplainIssues,
  showExplainIssues,
  askRedByteLoading,
  askRedByteResult,
  onAskRedByteAction,
}) => {
  const prioritizedIssues = [...issues].sort((left, right) => {
    if (left.severity === right.severity) return 0;
    return left.severity === 'block' ? -1 : 1;
  });
  const actionableIssues = prioritizedIssues.slice(0, 4);
  const blockingIssues = actionableIssues.filter((issue) => issue.severity === 'block');
  const warningIssues = actionableIssues.filter((issue) => issue.severity === 'warn');
  const hasGateIssues = actionableIssues.length > 0;
  const intelBlockingActions = askRedByteResult?.actions.filter((action) => action.severity === 'blocking') ?? [];
  const intelWarningActions = askRedByteResult?.actions.filter((action) => action.severity !== 'blocking') ?? [];
  const intelFallback = Boolean(askRedByteResult?.debug?.fallback);

  return (
    <div data-testid="workspace-right-sidebar" className={styles.root} style={{ ['--rb-stage-accent' as string]: stageAccent ?? 'var(--rb-accent-build)' }}>
      <div data-testid="workspace-status-pills" className={styles.statusPills}>
        <StatusPill label={readinessLabel} tone={readinessLabel === 'READY' ? 'ready' : readinessLabel === 'WARNING' ? 'warning' : 'notReady'} />
        <StatusPill label={saveLabel} tone={saveLabel === 'SAVED' ? 'saved' : 'unsaved'} />
        <StatusPill label={statusLabel} tone={statusLabel === 'RUNNING' ? 'running' : statusLabel === 'DONE' ? 'done' : statusLabel === 'ERROR' ? 'error' : statusLabel === 'WARNING' ? 'warning' : 'ready'} />
      </div>

      <div data-testid="workspace-next-step" className={styles.heroCard}>
        <div className={styles.title}>{NEO_LABELS.NEXT_ACTION}</div>
        <div className={styles.heroBody}>{nextStepText}</div>
        <button type="button" className={styles.heroButton}>{NEO_LABELS.OPEN_STAGE}</button>
        <div data-testid="workspace-pass-criteria" style={{ marginTop: 8 }}>
          <div className={styles.title}>{NEO_LABELS.PASS_LOOKS_LIKE}</div>
          <ul className={styles.list}>
            {(passCriteria.length > 0 ? passCriteria : ['Complete the stage checklist and verify expected behavior.'])
              .slice(0, 2)
              .map((item, index) => (
                <li key={`pass-${index}-${item}`} className={styles.muted}>
                  {item}
                </li>
              ))}
          </ul>
        </div>
        <div data-testid="workspace-common-mistakes" style={{ marginTop: 8 }}>
          <div className={styles.title}>{NEO_LABELS.COMMON_MISTAKES}</div>
          <ul className={styles.list}>
            {(commonMistakes.length > 0 ? commonMistakes : ['Skipping checks before moving to the next stage.'])
              .slice(0, 2)
              .map((item, index) => (
                <li key={`mistake-${index}-${item}`} className={styles.muted}>
                  {item}
                </li>
              ))}
          </ul>
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

      <div className={styles.block}>
        <div className={styles.title}>Current Studio Step</div>
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--rb-text, #e4e4e7)' }}>{LAB_WORKSPACE_MODE_HINTS[mode]}</div>
      </div>

      <div data-testid="workspace-right-sidebar-next-action" className={styles.block}>
        <div className={styles.title}>{NEO_LABELS.NEXT_ACTION}</div>
        <div className={styles.muted} style={{ marginTop: 4, fontSize: 12 }}>
          {checklist[modeIndex] ?? checklist[0] ?? 'Continue through the current stage guidance.'}
        </div>
      </div>

      {labGoal && (
        <div className={styles.block}>
          <div className={styles.title}>Studio Goal</div>
          <div className={styles.muted} style={{ marginTop: 4, fontSize: 12 }}>{labGoal}</div>
        </div>
      )}

      <div data-testid="workspace-right-sidebar-fixes" style={{ display: 'grid', gap: 8 }}>
        <div className={styles.title}>{NEO_LABELS.ISSUES}</div>

        <div data-testid="workspace-issues-blocking" style={{ display: 'grid', gap: 6 }}>
          <div className={styles.issueSectionTitle}>{NEO_LABELS.BLOCKING}</div>
          {blockingIssues.length === 0 ? (
            <div className={styles.emptyHint}>{NEO_LABELS.NO_BLOCKING}</div>
          ) : null}
        </div>

        <div data-testid="workspace-issues-warnings" style={{ display: 'grid', gap: 6 }}>
          <div className={styles.issueSectionTitle}>{NEO_LABELS.WARNINGS}</div>
          {warningIssues.length === 0 ? (
            <div className={styles.emptyHint}>{NEO_LABELS.NO_WARNINGS}</div>
          ) : null}
        </div>

        {actionableIssues.map((issue, index) => {
          const fixIntent = resolveSubmissionGateFixIntent(issue);
          return (
            <div
              key={`${issue.code}-${index}`}
              className={[styles.issueCard, issue.severity === 'block' ? styles.issueCardBlocking : styles.issueCardWarning].join(' ')}
            >
              <div className={styles.issueTitle}>
                <span>{issue.severity === 'block' ? NEO_ACTION_ICONS.blocking : NEO_ACTION_ICONS.warning}</span>
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
        })}

        {actionableIssues.length === 0 ? (
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
