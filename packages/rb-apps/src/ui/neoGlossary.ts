export const NEO_STATUS = {
  READY: 'READY',
  NOT_READY: 'NOT READY',
  RUNNING: 'RUNNING',
  DONE: 'DONE',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
} as const;

export const NEO_LABELS = {
  OPEN_STAGE: 'OPEN STAGE',
  OPEN_EDITOR: 'OPEN EDITOR',
  RUN_SIMULATION: 'RUN SIMULATION',
  PROGRAM_BOARD: 'PROGRAM BOARD',
  DETECT_BOARD: 'DETECT BOARD',
  GENERATE_BUNDLE: 'GENERATE BUNDLE',
  FIX_BLOCKERS: 'FIX BLOCKERS',
  BEGINNER_ON: 'BEGINNER DONE',
  BEGINNER_OFF: 'BEGINNER NOT READY',
  NEXT_ACTION: 'Next Action',
  PASS_LOOKS_LIKE: 'What Success Looks Like',
  COMMON_MISTAKES: 'Common Mistakes',
  ISSUES: 'Issues',
  BLOCKING: 'Blocking Issues',
  WARNINGS: 'Warnings',
  NO_BLOCKING: 'No blocking issues.',
  NO_WARNINGS: 'No warnings.',
} as const;

export type NeoStatusLabel = (typeof NEO_STATUS)[keyof typeof NEO_STATUS];
