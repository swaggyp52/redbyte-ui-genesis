import type { Circuit } from '@redbyte/rb-logic-core';
import type { HardwareBoardResourceType, HardwareTimingRole, TestVector } from '@redbyte/rb-utils';
import { BASYS3_CLOCK_PIN } from '../../fpga/boards/basys3/basys3Pins';
import { resolveBasys3SignalBinding } from '../../fpga/boards/basys3/basys3SignalSemantics';
import { getClockHelperValueForTick } from './clockAuthority';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';

export type VerifyClockSourceType =
  | 'board-clock'
  | 'explicit-clock-component'
  | 'manual'
  | 'inferred';

export type VerifyClockOverrideMode = 'auto' | 'manual-pulses' | 'custom-pattern';
export type VerifyClockExecutionModel =
  | 'external-input-auto-toggle'
  | 'component-oscillator'
  | 'manual';

export interface VerifyClockPolicyIoRow {
  id: string;
  label: string;
  direction: 'in' | 'out';
  pin?: string;
  nodeId?: string;
  timingRole?: HardwareTimingRole;
  boardResourceType?: HardwareBoardResourceType;
}

export interface VerifyClockPolicy {
  signalId?: string;
  signalLabel: string;
  sourceType: VerifyClockSourceType;
  executionModel: VerifyClockExecutionModel;
  overrideMode: VerifyClockOverrideMode;
  autoRunEnabled: boolean;
  activeEdge: 'rising' | 'falling';
  startLevel: 0 | 1;
  dutyCycle: number;
  runCycles: number;
  frequencyMHz?: number;
  periodNs?: number;
  periodTicks?: number;
  boardAlias?: string;
  packagePin?: string;
  resetSignalName?: string;
  resetBehavior: 'none' | 'auto-sequence' | 'custom';
  manualWarning?: string;
}

interface DetectVerifyClockPolicyInput {
  circuit?: Pick<Circuit, 'nodes'> | null;
  ioRows: readonly VerifyClockPolicyIoRow[];
  scheduleContract?: VerifyScheduleContract | null;
}

const DEFAULT_AUTO_RUN_CYCLES = 8;
const SIM_CLOCK_IMPORT_WARNING =
  'Sim Clock components are import-only in this release. Replace the component with the CLK100MHZ board resource before trusting auto Verify or Export.';
const DEFAULT_MANUAL_WARNING =
  'Manual clock source — use this only if your hardware design really clocks from a switch or button.';

export function detectVerifyClockPolicy(
  input: DetectVerifyClockPolicyInput
): VerifyClockPolicy | null {
  const scheduleContract = input.scheduleContract;
  if (!scheduleContract || scheduleContract.schedule !== 'clocked_macro') {
    return null;
  }

  const inputRows = input.ioRows.filter((row) => row.direction === 'in');
  const resetSignalName = resolveResetSignalName(inputRows, scheduleContract);
  const boardClockRow = inputRows.find(
    (row) => isAuthoritativeBoardClockRow(row) && !isRowBackedBySimOnlyClock(row, input.circuit)
  );
  if (boardClockRow) {
    const binding = resolveBasys3SignalBinding(boardClockRow);
    return {
      signalId: boardClockRow.id,
      signalLabel: readSignalLabel(boardClockRow),
      sourceType: 'board-clock',
      executionModel: 'external-input-auto-toggle',
      overrideMode: 'auto',
      autoRunEnabled: true,
      activeEdge: 'rising',
      startLevel: 0,
      dutyCycle: 0.5,
      runCycles: DEFAULT_AUTO_RUN_CYCLES,
      frequencyMHz: 100,
      periodNs: 10,
      boardAlias: binding?.alias ?? 'CLK100MHZ',
      packagePin: binding?.packagePin ?? BASYS3_CLOCK_PIN,
      resetSignalName,
      resetBehavior: resetSignalName ? 'auto-sequence' : 'none',
    };
  }

  const manualClockRow = inputRows.find(
    (row) => !isRowBackedBySimOnlyClock(row, input.circuit) && isManualClockRow(row, scheduleContract)
  );
  if (manualClockRow) {
    return {
      signalId: manualClockRow.id,
      signalLabel: readSignalLabel(manualClockRow),
      sourceType: 'manual',
      executionModel: 'manual',
      overrideMode: 'manual-pulses',
      autoRunEnabled: false,
      activeEdge: 'rising',
      startLevel: 0,
      dutyCycle: 0.5,
      runCycles: DEFAULT_AUTO_RUN_CYCLES,
      packagePin: manualClockRow.pin?.trim() || undefined,
      resetSignalName,
      resetBehavior: 'custom',
      manualWarning: DEFAULT_MANUAL_WARNING,
    };
  }

  const explicitClockNode = findExplicitClockComponent(input.circuit);
  if (explicitClockNode) {
    const signalLabel = readNodeLabel(explicitClockNode);
    return {
      signalId: signalLabel,
      signalLabel,
      sourceType: 'explicit-clock-component',
      executionModel: 'component-oscillator',
      overrideMode: 'manual-pulses',
      autoRunEnabled: false,
      activeEdge: 'rising',
      startLevel: 0,
      dutyCycle: 0.5,
      runCycles: DEFAULT_AUTO_RUN_CYCLES,
      periodTicks: readPeriodTicks(explicitClockNode.config),
      resetSignalName,
      resetBehavior: resetSignalName ? 'custom' : 'none',
      manualWarning: SIM_CLOCK_IMPORT_WARNING,
    };
  }

  const inferredRow = findClockLikeInputRow(
    inputRows.filter((row) => !isRowBackedBySimOnlyClock(row, input.circuit)),
    scheduleContract.clockSignalName
  );
  if (inferredRow) {
    const manualLike =
      scheduleContract.timingMode === 'manual_event_driven_lab' ||
      inferredRow.timingRole === 'manual_step';
    return {
      signalId: inferredRow.id,
      signalLabel: readSignalLabel(inferredRow),
      sourceType: manualLike ? 'manual' : 'inferred',
      executionModel: manualLike ? 'manual' : 'external-input-auto-toggle',
      overrideMode: manualLike ? 'manual-pulses' : 'auto',
      autoRunEnabled: !manualLike,
      activeEdge: 'rising',
      startLevel: 0,
      dutyCycle: 0.5,
      runCycles: DEFAULT_AUTO_RUN_CYCLES,
      resetSignalName,
      resetBehavior:
        resetSignalName && !manualLike ? 'auto-sequence' : 'none',
      manualWarning: manualLike ? DEFAULT_MANUAL_WARNING : undefined,
    };
  }

  const signalLabel = normalizeSignalName(scheduleContract.clockSignalName);
  if (!signalLabel) {
    return null;
  }

  return {
    signalId: signalLabel,
    signalLabel,
    sourceType:
      scheduleContract.timingMode === 'manual_event_driven_lab' ? 'manual' : 'inferred',
    executionModel:
      scheduleContract.timingMode === 'manual_event_driven_lab'
        ? 'manual'
        : 'external-input-auto-toggle',
    overrideMode:
      scheduleContract.timingMode === 'manual_event_driven_lab' ? 'manual-pulses' : 'auto',
    autoRunEnabled: scheduleContract.timingMode !== 'manual_event_driven_lab',
    activeEdge: 'rising',
    startLevel: 0,
    dutyCycle: 0.5,
    runCycles: DEFAULT_AUTO_RUN_CYCLES,
    resetSignalName,
    resetBehavior:
      resetSignalName && scheduleContract.timingMode !== 'manual_event_driven_lab'
        ? 'auto-sequence'
        : 'none',
    manualWarning:
      scheduleContract.timingMode === 'manual_event_driven_lab'
        ? DEFAULT_MANUAL_WARNING
        : undefined,
  };
}

export function materializeVectorsForClockPolicy(input: {
  vectors: readonly TestVector[];
  ioRows: readonly VerifyClockPolicyIoRow[];
  policy?: VerifyClockPolicy | null;
}): TestVector[] {
  const policy = input.policy;
  if (!policy || policy.overrideMode !== 'auto' || !policy.autoRunEnabled) {
    return cloneVectors(input.vectors);
  }

  const inputRows = input.ioRows.filter((row) => row.direction === 'in');
  const editableInputRows = inputRows.filter((row) => !matchesClockSignal(row, policy));
  const editableInputKeys = editableInputRows.map((row) => row.id);
  const resetRow = policy.resetSignalName
    ? inputRows.find((row) => matchesSignalName(row, policy.resetSignalName ?? ''))
    : undefined;
  const sortedVectors = cloneVectors(input.vectors).sort((left, right) =>
    left.tick === right.tick ? compareText(left.id ?? '', right.id ?? '') : left.tick - right.tick
  );
  const cycleCount = Math.max(policy.runCycles, sortedVectors.length, 1);
  const vectors: TestVector[] = [];

  let fallbackInputs = buildDefaultInputMap(editableInputKeys);
  for (let cycleIndex = 0; cycleIndex < cycleCount; cycleIndex += 1) {
    const sourceVector = sortedVectors[Math.min(cycleIndex, Math.max(0, sortedVectors.length - 1))];
    const tick =
      cycleIndex < sortedVectors.length
        ? normalizeTick(sortedVectors[cycleIndex]?.tick, cycleIndex)
        : nextTickAfter(vectors);
    const inputs = { ...fallbackInputs };
    const expected =
      cycleIndex < sortedVectors.length
        ? normalizeBitRecord(sortedVectors[cycleIndex]?.expected)
        : {};

    if (sourceVector) {
      for (const [key, value] of Object.entries(sourceVector.inputs ?? {})) {
        const matchedRow = inputRows.find((row) => matchesSignalName(row, key));
        if (
          (policy.signalId && matchesSignalToken(key, policy.signalId)) ||
          (matchedRow && matchesClockSignal(matchedRow, policy))
        ) {
          continue;
        }
        if (matchedRow && matchedRow.direction === 'in') {
          clearSignalAliases(inputs, matchedRow);
          inputs[matchedRow.id] = normalizeBit(value);
          continue;
        }
        inputs[key] = normalizeBit(value);
      }
    }

    if (policy.signalId) {
      inputs[policy.signalId] = getClockHelperValueForTick(cycleIndex, 'alternating');
    }

    if (
      resetRow &&
      policy.resetBehavior === 'auto-sequence' &&
      !hasSignalInput(sourceVector?.inputs ?? {}, resetRow)
    ) {
      inputs[resetRow.id] = cycleIndex === 0 ? 1 : 0;
    }

    fallbackInputs = { ...inputs };
    vectors.push({
      id:
        cycleIndex < sortedVectors.length
          ? sortedVectors[cycleIndex]?.id
          : `auto-cycle-${String(cycleIndex).padStart(2, '0')}`,
      tick,
      inputs,
      expected,
    });
  }

  return vectors;
}

function resolveResetSignalName(
  inputRows: readonly VerifyClockPolicyIoRow[],
  scheduleContract: VerifyScheduleContract
): string | undefined {
  const hinted = scheduleContract.resetHint?.signalName?.trim();
  if (hinted) {
    return hinted;
  }
  const resetRow =
    inputRows.find((row) => row.timingRole === 'reset') ??
    inputRows.find((row) => isResetLike(readSignalLabel(row)) || isResetLike(row.id));
  return resetRow ? readSignalLabel(resetRow) : undefined;
}

function findExplicitClockComponent(
  circuit: Pick<Circuit, 'nodes'> | null | undefined
): Circuit['nodes'][number] | null {
  const nodes = circuit?.nodes ?? [];
  return (
    nodes.find(
      (node) =>
        node.type === 'Clock' &&
        readClockRole(node.config as Record<string, unknown> | undefined) === 'sim'
    ) ?? null
  );
}

function isRowBackedBySimOnlyClock(
  row: VerifyClockPolicyIoRow,
  circuit: Pick<Circuit, 'nodes'> | null | undefined
): boolean {
  const nodes = circuit?.nodes ?? [];
  const clockNodes = nodes.filter((node) => node.type === 'Clock');
  const exactNode = row.nodeId
    ? clockNodes.find((node) => matchesSignalToken(node.id, row.nodeId))
    : undefined;
  if (exactNode) {
    return readClockRole(exactNode.config as Record<string, unknown> | undefined) === 'sim';
  }
  return clockNodes.some(
    (node) =>
      readClockRole(node.config as Record<string, unknown> | undefined) === 'sim' &&
      matchesSignalToken(node.id, row.id)
  );
}

function readClockRole(config: Record<string, unknown> | undefined): string | undefined {
  const role = config?.role;
  return typeof role === 'string' ? role.toLowerCase().trim() : undefined;
}

function isAuthoritativeBoardClockRow(row: VerifyClockPolicyIoRow): boolean {
  const binding = resolveBasys3SignalBinding(row);
  return binding?.resource.category === 'clock' || normalizePin(row.pin) === BASYS3_CLOCK_PIN;
}

function isManualClockRow(
  row: VerifyClockPolicyIoRow,
  scheduleContract: VerifyScheduleContract
): boolean {
  if (scheduleContract.timingMode !== 'manual_event_driven_lab') {
    return row.timingRole === 'manual_step';
  }
  const binding = resolveBasys3SignalBinding(row);
  if (binding?.resource.category === 'clock') return false;
  if (row.timingRole === 'manual_step') return true;
  if (row.timingRole === 'clock') return true;
  return matchesSignalName(row, scheduleContract.clockSignalName ?? '');
}

function findClockLikeInputRow(
  rows: readonly VerifyClockPolicyIoRow[],
  clockSignalName: string | undefined
): VerifyClockPolicyIoRow | undefined {
  const normalizedClockSignal = normalizeSignalName(clockSignalName);
  if (normalizedClockSignal) {
    const exact = rows.find((row) => matchesSignalName(row, normalizedClockSignal));
    if (exact) return exact;
  }
  return rows.find((row) => isClockLike(readSignalLabel(row)) || isClockLike(row.id));
}

function readNodeLabel(node: Circuit['nodes'][number]): string {
  return normalizeSignalName(node.label) ?? normalizeSignalName(node.id) ?? 'clk';
}

function readPeriodTicks(config: Record<string, unknown> | undefined): number | undefined {
  const value = Number(config?.period);
  if (!Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value));
}

function readSignalLabel(row: VerifyClockPolicyIoRow): string {
  return normalizeSignalName(row.label) ?? normalizeSignalName(row.id) ?? 'clk';
}

function matchesSignalName(row: VerifyClockPolicyIoRow, signalName: string): boolean {
  return (
    matchesSignalToken(row.id, signalName) ||
    matchesSignalToken(row.label, signalName) ||
    matchesSignalToken(row.nodeId, signalName)
  );
}

function matchesClockSignal(row: VerifyClockPolicyIoRow, policy: VerifyClockPolicy): boolean {
  return (
    matchesSignalToken(row.id, policy.signalId ?? '') ||
    matchesSignalToken(row.label, policy.signalLabel)
  );
}

function matchesSignalToken(value: string | undefined, signalName: string): boolean {
  return normalizeToken(value) === normalizeToken(signalName);
}

function isClockLike(value: string | undefined): boolean {
  const normalized = normalizeToken(value);
  return (
    normalized === 'clk' ||
    normalized === 'clock' ||
    normalized === 'clk100mhz' ||
    normalized === 'sysclk' ||
    normalized.startsWith('clk_') ||
    normalized.startsWith('clock_')
  );
}

function isResetLike(value: string | undefined): boolean {
  const normalized = normalizeToken(value);
  return (
    normalized === 'rst' ||
    normalized === 'reset' ||
    normalized === 'clear' ||
    normalized === 'clr'
  );
}

function normalizeSignalName(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeToken(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '');
}

function normalizePin(value: string | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

function cloneVectors(vectors: readonly TestVector[]): TestVector[] {
  return vectors.map((vector, index) => ({
    id: vector.id ?? `vec-${String(index + 1).padStart(2, '0')}`,
    tick: normalizeTick(vector.tick, index),
    inputs: normalizeBitRecord(vector.inputs),
    expected: normalizeBitRecord(vector.expected),
  }));
}

function normalizeBitRecord(
  value: Record<string, unknown> | undefined
): Record<string, 0 | 1> {
  const next: Record<string, 0 | 1> = {};
  for (const [key, rawValue] of Object.entries(value ?? {})) {
    next[key] = normalizeBit(rawValue);
  }
  return next;
}

function buildDefaultInputMap(keys: readonly string[]): Record<string, 0 | 1> {
  const next: Record<string, 0 | 1> = {};
  for (const key of keys) {
    next[key] = 0;
  }
  return next;
}

function clearSignalAliases(
  inputs: Record<string, 0 | 1>,
  row: VerifyClockPolicyIoRow
): void {
  for (const key of Object.keys(inputs)) {
    if (matchesSignalName(row, key)) {
      delete inputs[key];
    }
  }
}

function hasSignalInput(
  inputs: Record<string, unknown>,
  row: VerifyClockPolicyIoRow
): boolean {
  return Object.keys(inputs).some((key) => matchesSignalName(row, key));
}

function nextTickAfter(vectors: readonly TestVector[]): number {
  const lastTick = vectors.at(-1)?.tick;
  return Number.isFinite(lastTick) ? Math.max(0, Math.floor(lastTick)) + 1 : 0;
}

function normalizeTick(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function normalizeBit(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1') return 1;
  return 0;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
