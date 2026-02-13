import React from 'react';
import type { SubmissionGateIssue } from '../labs/submissionGates';
import { resolveSubmissionGateFixIntent, type SubmissionGateFixIntent } from '../apps/labWorkspace/fixIntentMap';
import type { LabWorkspaceMode } from '../apps/labWorkspace/workspaceUx';
import { LAB_WORKSPACE_MODE_HINTS } from '../apps/labWorkspace/workspaceUx';
import { NEO_LABELS } from '../ui/neoGlossary';
import { NEO_ACTION_ICONS } from '../ui/neoIcons';
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
  readinessLabel: string;
  saveLabel: string;
  statusLabel: string;
  stageAccent?: string;
  onFixIntent: (intent: SubmissionGateFixIntent) => void;
}

const CHECKLIST_STAGE_LABELS = ['Build', 'Simulate', 'Hardware', 'Submit'] as const;

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
  readinessLabel,
  saveLabel,
  statusLabel,
  stageAccent,
  onFixIntent,
}) => {
  const prioritizedIssues = [...issues].sort((left, right) => {
    if (left.severity === right.severity) return 0;
    return left.severity === 'block' ? -1 : 1;
  });
  const actionableIssues = prioritizedIssues.slice(0, 4);
  const blockingIssues = actionableIssues.filter((issue) => issue.severity === 'block');
  const warningIssues = actionableIssues.filter((issue) => issue.severity === 'warn');

  return (
    <div data-testid="workspace-right-sidebar" className={styles.root} style={{ ['--rb-stage-accent' as string]: stageAccent ?? 'var(--rb-accent-build)' }}>
      <div data-testid="workspace-status-pills" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
          <ul style={{ margin: '4px 0 0 16px', padding: 0, display: 'grid', gap: 4 }}>
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
          <ul style={{ margin: '4px 0 0 16px', padding: 0, display: 'grid', gap: 4 }}>
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

      <div data-testid="workspace-right-sidebar-checklist" className={styles.block}>
        <div className={styles.title} style={{ marginBottom: 8 }}>Checklist</div>
        <ul style={{ margin: 0, paddingLeft: 16, display: 'grid', gap: 8 }}>
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
        <div className={styles.title}>Current Stage</div>
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
          <div className={styles.title}>Lab Goals</div>
          <div className={styles.muted} style={{ marginTop: 4, fontSize: 12 }}>{labGoal}</div>
        </div>
      )}

      <div data-testid="workspace-right-sidebar-fixes" style={{ display: 'grid', gap: 8 }}>
        <div className={styles.title}>{NEO_LABELS.ISSUES}</div>

        <div data-testid="workspace-issues-blocking" style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rb-text, #e4e4e7)' }}>{NEO_LABELS.BLOCKING}</div>
          {blockingIssues.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--rb-text-3, #71717a)' }}>{NEO_LABELS.NO_BLOCKING}</div>
          ) : null}
        </div>

        <div data-testid="workspace-issues-warnings" style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rb-text, #e4e4e7)' }}>{NEO_LABELS.WARNINGS}</div>
          {warningIssues.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--rb-text-3, #71717a)' }}>{NEO_LABELS.NO_WARNINGS}</div>
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
          <div data-testid="workspace-right-sidebar-fixes-empty" style={{ fontSize: 11, color: 'var(--rb-text-3, #71717a)' }}>
            No blocking fixes for this stage.
          </div>
        ) : null}
      </div>

      {labGoal ? null : (
        <div style={{ fontSize: 11, color: 'var(--rb-text-3, #71717a)' }}>
          Continue through the workspace stages to complete this lab.
        </div>
      )}
    </div>
  );
};
