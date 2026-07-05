export const PRODUCT_UI_STANDARDS = {
  actionHierarchy: {
    primaryPerPageState: 'Use one primary action for the visible page state.',
    secondaryActions: 'Keep alternate paths visible but visually secondary.',
    noRepeatedPrimaryCtas: 'Do not repeat the same primary CTA in the same first viewport.',
  },
  statusHierarchy: {
    commandRegionLimit: 'Keep dominant command-region status pills to three or fewer.',
    proofIsSecondary: 'Proof status stays visible, but the student task stays dominant.',
    failureTone: 'Failure must be clear and actionable without theatrical presentation.',
  },
  emptyStates: {
    nextAction: 'Empty states name the next useful student action.',
    noInactiveWorkbenchDominance: 'Do not make inactive boards, file browsers, or diagnostics the dominant object.',
    noFakePackage: 'Blocked Export states must not look like a valid package is ready.',
  },
  workObjectDominance: {
    project: 'Project chooses the work path.',
    design: 'Design canvas and logical I/O are the work object.',
    verify: 'Verify test cases and expected outputs are the work object before evidence.',
    hardware: 'Map Pins owns signal to board resource to package pin binding.',
    export: 'Export file review dominates only when a package is meaningful.',
    import: 'Import is a utility: choose source, inspect, review, then apply explicitly.',
  },
  visualTone: {
    fewerChips: 'Prefer plain labels over stacked chips.',
    noDebugChrome: 'Move developer state to details or diagnostics.',
    calmColor: 'Use color to clarify state, not to decorate every control.',
  },
} as const;

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
