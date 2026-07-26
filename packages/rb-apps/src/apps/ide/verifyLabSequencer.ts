import type { VerifyAuthorVector } from './surfaces/ScenarioBuilderPanel';
import type { VerifyScenarioStep } from './verifyScenarioSteps';

export type LabSequencerStepKind =
  | 'set_input'
  | 'set_bit'
  | 'set_slice'
  | 'set_bus'
  | 'apply_reset'
  | 'pulse_step'
  | 'observe_assert_output'
  | 'observe'
  | 'assert_scalar'
  | 'assert_bus'
  | 'inspect_register'
  | 'inspect_state_bank';

export interface LabSequencerStep {
  id: string;
  tick: number;
  kind: LabSequencerStepKind;
  title: string;
  detail: string;
}

export type LabSequencerSignalRoles = Record<string, 'clock' | 'reset' | 'input' | 'output'>;

export interface StateObservationSummary {
  registerSignalCount: number;
  stateBankSignalCount: number;
  totalObservedSignals: number;
}

export function buildLabSequencerSteps(
  vectors: VerifyAuthorVector[],
  roles: LabSequencerSignalRoles
): LabSequencerStep[] {
  const sortedVectors = [...vectors].sort((left, right) => left.tick - right.tick);
  const steps: LabSequencerStep[] = [];

  for (let index = 0; index < sortedVectors.length; index += 1) {
    const current = sortedVectors[index];
    const previous = index > 0 ? sortedVectors[index - 1] : null;

    const resetSignals = Object.keys(current.inputs).filter(
      (signal) => roles[signal] === 'reset' && current.inputs[signal] === 1
    );
    if (resetSignals.length > 0) {
      const resetLabels = resetSignals.map(formatLabSignalLabel);
      const isSecurityLockReset =
        resetSignals.length === 1 && isSecurityLockResetSignal(resetSignals[0] ?? '');
      steps.push({
        id: `${current.id}:reset`,
        tick: current.tick,
        kind: 'apply_reset',
        title: `${isSecurityLockReset ? 'Clear state' : 'Apply reset'} · t${current.tick}`,
        detail: isSecurityLockReset
          ? `${resetLabels[0]} clears the stored bits before the next ENTER pulse.`
          : resetLabels.join(', '),
      });
    }

    const changedInputs = Object.keys(current.inputs).filter((signal) => {
      if (roles[signal] !== 'input') return false;
      const previousValue = previous?.inputs[signal];
      return previousValue === undefined || previousValue !== current.inputs[signal];
    });
    if (changedInputs.length > 0) {
      const changedInputLabels = changedInputs.map(formatLabSignalLabel);
      const isSecurityLockBitStep =
        changedInputs.length === 1 && isSecurityLockDataSignal(changedInputs[0] ?? '');
      const detail = changedInputs
        .map((signal, signalIndex) => `${changedInputLabels[signalIndex] ?? signal}=${current.inputs[signal]}`)
        .join(', ');
      steps.push({
        id: `${current.id}:set`,
        tick: current.tick,
        kind: 'set_input',
        title: `${isSecurityLockBitStep ? 'Set next input bit' : 'Set inputs'} · t${current.tick}`,
        detail: isSecurityLockBitStep
          ? `${detail}. This is the bit the next ENTER pulse should clock into the design.`
          : detail,
      });
    }

    const clockSignals = Object.keys(current.inputs).filter((signal) => roles[signal] === 'clock');
    const pulsedClock = clockSignals.find((signal) => {
      const previousValue = previous?.inputs[signal] ?? 0;
      return previousValue === 0 && current.inputs[signal] === 1;
    });
    if (pulsedClock) {
      const pulsedClockLabel = formatLabSignalLabel(pulsedClock);
      const isSecurityLockStep = isSecurityLockClockSignal(pulsedClock);
      steps.push({
        id: `${current.id}:pulse`,
        tick: current.tick,
        kind: 'pulse_step',
        title: `${isSecurityLockStep ? 'Pulse ENTER' : 'Pulse step'} · t${current.tick}`,
        detail: isSecurityLockStep
          ? `${pulsedClockLabel} advances the bridge one manual step.`
          : `${pulsedClockLabel} rising edge`,
      });
    }

    const expected = current.expected ?? {};
    const assertedOutputs = Object.keys(expected);
    if (assertedOutputs.length > 0) {
      const isSecurityLockProof =
        assertedOutputs.length === 1 && isSecurityLockOutputSignal(assertedOutputs[0] ?? '');
      const securityLockSignal = assertedOutputs[0] ?? '';
      const securityLockLabel = formatLabSignalLabel(securityLockSignal);
      const securityLockExpected = expected[securityLockSignal];
      const detail = assertedOutputs
        .map((signal) => `${formatLabSignalLabel(signal)}=${expected[signal]}`)
        .join(', ');
      steps.push({
        id: `${current.id}:assert`,
        tick: current.tick,
        kind: 'observe_assert_output',
        title: isSecurityLockProof
          ? `${securityLockExpected === 1 ? 'Check LOCK opens here' : 'Check LOCK stays low'} · t${current.tick}`
          : `Capture / assert · t${current.tick}`,
        detail: isSecurityLockProof
          ? securityLockExpected === 1
            ? `${securityLockLabel} should become 1 only after the fourth valid 3-bit group finishes.`
            : `${securityLockLabel} should still be 0 after this step.`
          : detail,
      });
    }
  }

  return steps;
}

export function buildLabSequencerStepsFromScenarioSteps(
  scenarioSteps: VerifyScenarioStep[] | undefined
): LabSequencerStep[] {
  if (!scenarioSteps || scenarioSteps.length === 0) return [];
  const sorted = [...scenarioSteps].sort((left, right) => left.order - right.order);
  const steps: LabSequencerStep[] = [];
  let tick = 0;

  for (const step of sorted) {
    const kind = toLabStepKind(step.kind);
    const detailParts: string[] = [];
    if (step.targetRef) detailParts.push(step.targetRef);
    if (typeof step.value === 'number') detailParts.push(`value=${step.value}`);
    if (typeof step.expectedValue === 'number') detailParts.push(`expect=${step.expectedValue}`);
    if (step.label) detailParts.push(step.label);
    if (step.notes) detailParts.push(step.notes);

    steps.push({
      id: step.id,
      tick,
      kind,
      title: `${kind.replaceAll('_', ' ')} · t${tick}`,
      detail: detailParts.length > 0 ? detailParts.join(' · ') : 'No additional detail',
    });

    if (step.kind === 'pulse_step') {
      const duration = Math.max(1, Math.floor(step.durationTicks ?? 1));
      tick += step.pulseBehavior === 'high' || step.pulseBehavior === 'low' ? duration : duration + 1;
      continue;
    }
    tick += Math.max(1, Math.floor(step.durationTicks ?? 1));
  }

  return steps;
}

export function summarizeStateObservation(
  sampleSignals: Record<string, string> | null | undefined,
  candidateSignalNames: string[]
): StateObservationSummary {
  if (!sampleSignals) {
    return {
      registerSignalCount: 0,
      stateBankSignalCount: 0,
      totalObservedSignals: 0,
    };
  }

  const normalizedSample = new Set(
    Object.keys(sampleSignals).map((signalName) => signalName.trim().toLowerCase())
  );
  let registerSignalCount = 0;
  let stateBankSignalCount = 0;

  for (const signalName of candidateSignalNames) {
    const normalized = signalName.trim().toLowerCase();
    if (!normalizedSample.has(normalized)) continue;
    if (normalized.startsWith('reg_') || normalized.includes('register')) {
      registerSignalCount += 1;
      continue;
    }
    if (normalized.startsWith('state_bank') || normalized.includes('statebank')) {
      stateBankSignalCount += 1;
    }
  }

  return {
    registerSignalCount,
    stateBankSignalCount,
    totalObservedSignals: Object.keys(sampleSignals).length,
  };
}

function toLabStepKind(kind: VerifyScenarioStep['kind']): LabSequencerStepKind {
  switch (kind) {
    case 'assert_scalar':
    case 'assert_bus':
      return kind;
    case 'observe':
      return kind;
    case 'inspect_register':
    case 'inspect_state_bank':
      return kind;
    case 'set_input':
    case 'set_bit':
    case 'set_slice':
    case 'set_bus':
      return kind;
    case 'apply_reset':
    case 'pulse_step':
      return kind;
    default:
      return 'observe_assert_output';
  }
}

function formatLabSignalLabel(signal: string): string {
  const normalized = signal.trim().toLowerCase();
  if (isSecurityLockClockSignal(normalized)) return 'ENTER';
  if (isSecurityLockResetSignal(normalized)) return 'RESET';
  if (isSecurityLockOutputSignal(normalized)) return 'LOCK';

  const inMatch = /(?:^|_)(in\d+)/i.exec(signal);
  if (inMatch?.[1]) return inMatch[1].toUpperCase();

  return signal;
}

function isSecurityLockDataSignal(signal: string): boolean {
  const normalized = signal.trim().toLowerCase();
  return normalized.includes('in0') || normalized.includes('serial');
}

function isSecurityLockClockSignal(signal: string): boolean {
  return signal.trim().toLowerCase().includes('enter');
}

function isSecurityLockResetSignal(signal: string): boolean {
  const normalized = signal.trim().toLowerCase();
  return normalized === 'rst' || normalized.includes('reset');
}

function isSecurityLockOutputSignal(signal: string): boolean {
  const normalized = signal.trim().toLowerCase();
  return normalized.includes('lock') || normalized.includes('open');
}
