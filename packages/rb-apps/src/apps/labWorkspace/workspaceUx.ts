import type { LabDefinition } from '../../labs/labDefinitions';

export const LAB_WORKSPACE_MODES = ['build', 'simulate', 'hardware', 'submit'] as const;
export type LabWorkspaceMode = (typeof LAB_WORKSPACE_MODES)[number];

export const LAB_WORKSPACE_MODE_LABELS: Record<LabWorkspaceMode, string> = {
  build: 'Design',
  simulate: 'Simulate',
  hardware: 'Hardware',
  submit: 'Package',
};

export const LAB_WORKSPACE_MODE_HINTS: Record<LabWorkspaceMode, string> = {
  build: 'Design HDL and configure top module + constraints.',
  simulate: 'Compare simulation outputs and inspect traces.',
  hardware: 'Capture Basys3 behavior and program bitstream when ready.',
  submit: 'Package deterministic submission evidence for grading.',
};

export function getWorkspaceModeIndex(mode: LabWorkspaceMode | string): number {
  const index = LAB_WORKSPACE_MODES.indexOf(mode as LabWorkspaceMode);
  return index >= 0 ? index : 0;
}

export function buildWorkspaceChecklist(definition: LabDefinition | null): string[] {
  if (!definition) {
    return [
      'Build your HDL design.',
      'Run synthesis and capture logs.',
      'Optional Basys3 hardware validation.',
      'Generate submission bundle.',
    ];
  }

  return [
    ...(definition.buildSteps.length > 0 ? [definition.buildSteps[0]] : ['Complete build requirements.']),
    ...(definition.simulateChecks.length > 0 ? [definition.simulateChecks[0]] : ['Run simulation checks.']),
    ...(definition.hardwareSteps.length > 0 ? [definition.hardwareSteps[0]] : ['Optional Basys3 hardware validation.']),
    ...(definition.submitEvidence.length > 0 ? [definition.submitEvidence[0]] : ['Generate submission bundle.']),
  ];
}
