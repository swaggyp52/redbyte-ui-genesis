import type { FirstRunStepId } from './firstRunState';

export interface FirstRunStepDefinition {
  id: FirstRunStepId;
  title: string;
  description: string;
  fixAction: string;
}

export const FIRST_RUN_STEPS: FirstRunStepDefinition[] = [
  {
    id: 'bridge_check',
    title: 'Bridge check',
    description: 'Confirm local FPGA bridge is reachable and responsive.',
    fixAction: 'Start bridge service (pnpm bridge:start) and retry.',
  },
  {
    id: 'board_detect',
    title: 'Board detect',
    description: 'Find connected Basys3 board through bridge + probe.',
    fixAction: 'Reconnect USB cable, power cycle Basys3, then retry detect.',
  },
  {
    id: 'programmer_check',
    title: 'Programmer check',
    description: 'Verify openFPGALoader is installed and executable.',
    fixAction: 'Install openFPGALoader and make sure it is on PATH.',
  },
  {
    id: 'known_good_program',
    title: 'Program known-good bitstream',
    description: 'Program a known-good bitstream to confirm end-to-end flashing works.',
    fixAction: 'Provide known-good bitstream and ensure board is not busy.',
  },
  {
    id: 'sample_capture',
    title: 'Capture sample trace',
    description: 'Start a short hardware run and collect at least one trace sample.',
    fixAction: 'Check wrapper bitstream/runtime stream and retry capture.',
  },
  {
    id: 'doctor_export',
    title: 'Export doctor report',
    description: 'Build and export Doctor Report V2 for support + evidence.',
    fixAction: 'Retry diagnostics collection and export JSON bundle.',
  },
  {
    id: 'done',
    title: 'Done',
    description: 'Wizard complete. Studio can now open normally.',
    fixAction: 'Open Studio and continue lab workflow.',
  },
];

export function getCurrentWizardStepId(stepStatuses: Record<FirstRunStepId, { status: string }>): FirstRunStepId {
  for (const step of FIRST_RUN_STEPS) {
    if (step.id === 'done') continue;
    const status = stepStatuses[step.id]?.status;
    if (status !== 'pass') return step.id;
  }
  return 'done';
}

export function getNextStepId(stepId: FirstRunStepId): FirstRunStepId {
  const index = FIRST_RUN_STEPS.findIndex((step) => step.id === stepId);
  if (index < 0 || index >= FIRST_RUN_STEPS.length - 1) return 'done';
  return FIRST_RUN_STEPS[index + 1].id;
}
