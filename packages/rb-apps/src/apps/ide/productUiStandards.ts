export const PRODUCT_UI_STANDARDS = {
  actionHierarchy: {
    maximumPrimaryActions: 1,
    primaryPerPageState: 'Use exactly one primary action for the visible page state.',
    secondaryActions: 'Keep alternate paths visible but visually secondary.',
    noRepeatedPrimaryCtas: 'Do not repeat the same primary CTA in the same first viewport.',
    destructiveActions: 'Name destructive consequences explicitly without making danger styling routine.',
  },
  statusHierarchy: {
    maximumDominantIndicators: 2,
    commandRegionLimit: 'Keep dominant command-region status indicators to two or fewer.',
    plainLanguageFirst: 'Use plain status text before adding another badge or pill.',
    proofIsSecondary: 'Proof status stays visible, but the student task stays dominant.',
    failureTone: 'Failure must be clear and actionable without theatrical presentation.',
    semanticColor: {
      success: 'Green means current success only.',
      attention: 'Amber means attention, stale evidence, or an honest draft state.',
      failure: 'Red means an actual blocking failure or mismatch.',
      information: 'Blue or neutral means active navigation or information.',
    },
  },
  emptyStates: {
    explainWhy: 'Explain why the work object cannot begin yet.',
    nextAction: 'Empty states name the next useful student action.',
    maximumRecoveryActions: 1,
    noInactiveWorkbenchDominance: 'Do not make inactive boards, file browsers, or diagnostics the dominant object.',
    noFakePackage: 'Blocked Export states must not look like a valid package is ready.',
  },
  blockedStates: {
    nameBlocker: 'Name the blocker and the surface that owns the repair.',
    oneRepairAction: 'Expose one direct repair action.',
    noReadinessImplyingChrome: 'Do not render ready-looking package, board, or proof chrome around a blocker.',
  },
  workObjectDominance: {
    project: 'Project makes the current or starting action dominant.',
    design: 'Design makes the circuit canvas dominant.',
    verifyBeforeRun: 'Verify makes testbench cases and expected outputs dominant before a run.',
    verifyAfterRun: 'Verify keeps result and repair beside the authored testbench after a run.',
    hardware: 'Map Pins keeps the mapping table and board visible together.',
    export: 'Export makes the readiness and submission decision dominant before package contents.',
    import: 'Import is a utility with one Upload, Review, Apply sequence.',
  },
  visualTone: {
    fewerChips: 'Prefer plain labels over stacked chips.',
    noDebugChrome: 'Move developer state to details or diagnostics.',
    calmColor: 'Use color to clarify state, not to decorate every control.',
    noGlow: 'Do not use neon, glow, or pulsing as routine decoration.',
    bodyTextMinimumPx: 14,
    secondaryTextMinimumPx: 13,
    routineControlMinimumPx: 36,
    primaryControlMinimumPx: 40,
    visibleBorderNestingLimit: 2,
  },
} as const;

export type ProductUiStandard = typeof PRODUCT_UI_STANDARDS;

export const PROFESSIONAL_CLASSROOM_COPY = {
  projectFirstLaunchDetail:
    'Start with a course lab, or choose a secondary path when the assignment asks for it.',
  designBlankAction:
    'Add inputs and outputs, place a part, then wire ports.',
  exportBlockedTitle: 'No handoff package yet',
  exportBlockedBody:
    'Resolve the blocker first. Generated file previews appear after the design, Verify state, and mapping support a meaningful handoff.',
  hardwareNoSignals:
    'Add logical inputs and outputs in Design first. Map Pins will list those signals here for Basys3 binding.',
  importUtility:
    'Import is for recovery and restore. It never replaces current work until review and confirmation.',
} as const;
