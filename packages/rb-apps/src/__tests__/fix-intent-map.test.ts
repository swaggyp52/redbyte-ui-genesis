import { describe, expect, it } from 'vitest';
import { resolveSubmissionGateFixIntent } from '../apps/labWorkspace/fixIntentMap';
import type { SubmissionGateIssue } from '../labs/submissionGates';

function createIssue(partial: Partial<SubmissionGateIssue> & Pick<SubmissionGateIssue, 'code' | 'severity' | 'title' | 'message'>): SubmissionGateIssue {
  return {
    code: partial.code,
    severity: partial.severity,
    title: partial.title,
    message: partial.message,
    fixHint: partial.fixHint,
    cta: partial.cta,
    evidence: partial.evidence,
  };
}

describe('resolveSubmissionGateFixIntent', () => {
  it('uses cta tab when provided by gate engine', () => {
    const issue = createIssue({
      code: 'simulate_not_run',
      severity: 'warn',
      title: 'Simulate tab was not run',
      message: 'No simulation evidence detected.',
      cta: { label: 'Open Simulate', action: 'openTab', tab: 'simulate' },
    });

    const intent = resolveSubmissionGateFixIntent(issue);
    expect(intent.targetTab).toBe('simulate');
    expect(intent.label).toMatch(/simulate/i);
  });

  it('maps known hardware issue codes even without cta', () => {
    const issue = createIssue({
      code: 'hardware_evidence_missing',
      severity: 'warn',
      title: 'Hardware evidence not observed',
      message: 'No hardware session evidence detected.',
    });

    const intent = resolveSubmissionGateFixIntent(issue);
    expect(intent.targetTab).toBe('hardware');
    expect(intent.label).toMatch(/hardware/i);
  });

  it('falls back to build for unknown issue code', () => {
    const issue = createIssue({
      code: 'unknown_issue',
      severity: 'warn',
      title: 'Unknown issue',
      message: 'Unknown issue message',
    });

    const intent = resolveSubmissionGateFixIntent(issue);
    expect(intent.targetTab).toBe('build');
  });
});
