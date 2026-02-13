export const NEO_TYPO = {
  stagePrefix: 'STAGE',
  of: 'OF',
  quickstart: 'Quickstart',
  verifySetup: 'Verify Setup',
  openSubmissionBundle: 'Open Submission Bundle',
} as const;

export function toStatusCaps(value: string): string {
  return value.trim().toUpperCase();
}
