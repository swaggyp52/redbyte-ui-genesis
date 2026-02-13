import type { SubmissionGateIssue, SubmissionGateCtaTab } from '../../labs/submissionGates';

export interface SubmissionGateFixIntent {
  stage: SubmissionGateCtaTab;
  targetTab: SubmissionGateCtaTab;
  label: string;
  scrollToTestId?: string;
  fallbackScrollToTestIds?: string[];
}

function getFallbackTargetsForTab(targetTab: SubmissionGateCtaTab): string[] {
  if (targetTab === 'simulate') {
    return [
      'lab-workspace-anchor-simulate-run',
      'lab-workspace-anchor-simulate-waveform',
      'lab-workspace-anchor-simulate-probes',
    ];
  }

  if (targetTab === 'hardware') {
    return [
      'lab-workspace-anchor-hardware-board-detect',
      'lab-workspace-anchor-hardware-program-bitstream',
      'lab-workspace-anchor-hardware-connection-help',
    ];
  }

  return [
    'lab-workspace-anchor-build-top-module',
    'lab-workspace-anchor-build-preset',
    'lab-workspace-anchor-build-syntax-errors',
  ];
}

function getScrollTargetForTab(targetTab: SubmissionGateCtaTab, issueCode?: string): string {
  const normalizedCode = issueCode?.trim().toLowerCase() ?? '';

  if (targetTab === 'simulate') {
    if (normalizedCode.includes('waveform')) return 'hdl-build-logs';
    if (normalizedCode.includes('probe')) return 'hdl-build-logs';
    return 'hdl-synth-button';
  }

  if (targetTab === 'hardware') {
    if (normalizedCode.includes('program') || normalizedCode.includes('bitstream')) {
      return 'hardware-program-button';
    }
    if (normalizedCode.includes('connection') || normalizedCode.includes('toolchain')) {
      return 'hardware-bridge-status';
    }
    return 'hardware-detect-board-button';
  }

  if (normalizedCode.includes('port') || normalizedCode.includes('top')) {
    return 'hdl-top-input';
  }
  if (normalizedCode.includes('preset') || normalizedCode.includes('profile')) {
    return 'hdl-xdc-preset-select';
  }
  if (normalizedCode.includes('syntax') || normalizedCode.includes('error') || normalizedCode.includes('build_path')) {
    return 'hdl-build-logs';
  }
  return 'hdl-top-input';
}

function mapIssueCodeToTab(code: string): SubmissionGateCtaTab {
  const normalized = code.trim().toLowerCase();

  if (
    normalized.includes('build')
    || normalized.includes('top')
    || normalized.includes('port')
    || normalized.includes('preset')
    || normalized.includes('profile')
  ) {
    return 'build';
  }

  if (normalized.includes('simulate') || normalized.includes('synth') || normalized.includes('waveform') || normalized.includes('probe')) {
    return 'simulate';
  }

  if (
    normalized.includes('hardware')
    || normalized.includes('toolchain')
    || normalized.includes('board')
    || normalized.includes('program')
    || normalized.includes('bitstream')
  ) {
    return 'hardware';
  }

  return 'build';
}

function buildDefaultLabel(targetTab: SubmissionGateCtaTab): string {
  if (targetTab === 'simulate') return 'Open Simulate';
  if (targetTab === 'hardware') return 'Open Hardware';
  return 'Open Build';
}

export function resolveSubmissionGateFixIntent(issue: SubmissionGateIssue): SubmissionGateFixIntent {
  if (issue.cta?.action === 'openTab') {
    const targetTab = issue.cta.tab;
    return {
      stage: targetTab,
      targetTab,
      label: issue.cta.label || buildDefaultLabel(targetTab),
      scrollToTestId: getScrollTargetForTab(targetTab, issue.code),
      fallbackScrollToTestIds: getFallbackTargetsForTab(targetTab),
    };
  }

  const targetTab = mapIssueCodeToTab(issue.code);
  return {
    stage: targetTab,
    targetTab,
    label: buildDefaultLabel(targetTab),
    scrollToTestId: getScrollTargetForTab(targetTab, issue.code),
    fallbackScrollToTestIds: getFallbackTargetsForTab(targetTab),
  };
}
