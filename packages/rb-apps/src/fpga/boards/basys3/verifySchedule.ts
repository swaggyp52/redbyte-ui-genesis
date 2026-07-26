import {
  buildSimulationModel,
  elaborateCircuit,
  getClockPortName,
  isSequentialNodeType,
  type Circuit,
  type CircuitIR,
  type SequentialAnalysis,
  type SimulationModel,
} from '@redbyte/rb-logic-core';
import type { IoMapping, VerifySchedule } from '@redbyte/rb-utils';
import type { ToolchainProjectInput } from '../../toolchainBackend';
import { canonicalizeSemanticCircuit } from '../../../circuit/semanticCircuit';
import { resolveBasys3SignalBinding } from './basys3SignalSemantics';

export type { VerifySchedule } from '@redbyte/rb-utils';
export { CLOCKED_MACRO_SEQUENCE } from '@redbyte/rb-utils';

export const INTERNAL_SIM_CLOCK_NAME = '__sim_clk__';

export interface TemporalIssue {
  code:
    | 'unsupported-falling-edge'
    | 'multi-clock-domain'
    | 'active-low-reset'
    | 'unsupported-register-family'
    | 'unsupported-register-config';
  message: string;
}

export interface VerifyResetHint {
  signalName: string;
  activeLevel: 1;
}

export interface VerifyScheduleContract {
  schedule: VerifySchedule;
  timingMode?: 'synchronous_board_clock' | 'manual_event_driven_lab' | 'combinational';
  reason: 'combinational' | 'circuit-sequential' | 'hdl-sequential';
  analysis: SequentialAnalysis;
  needsSimClockInjection: boolean;
  clockSignalName?: string;
  samplePoint: 'steady-state' | 'post-rising-edge';
  tick0Meaning: 'initial-state' | null;
  resetHint?: VerifyResetHint;
  hasUnsupportedTemporal: boolean;
  temporalIssues: TemporalIssue[];
  /**
   * Legacy run metadata retained for persisted-record compatibility. Current
   * schedule derivation and generated HDL do not consume this field; assertions
   * come directly from the current authored vectors.
   */
  assertionMask?: Record<string, boolean>;
}

export interface DeterministicVerifyContext {
  ir: CircuitIR;
  simModel: SimulationModel;
  schedule: VerifyScheduleContract;
}

export function buildDeterministicVerifyContext(
  circuit: Circuit,
  ioMapping?: IoMapping,
  hdl?: ToolchainProjectInput
): DeterministicVerifyContext {
  const semanticCircuit = canonicalizeSemanticCircuit(circuit);
  const ir = elaborateCircuit(semanticCircuit).ir;
  const simModel = buildSimulationModel(ir);
  return {
    ir,
    simModel,
    schedule: deriveVerifyScheduleFromStructure(ir, simModel, ioMapping, hdl, semanticCircuit),
  };
}

export function deriveVerifySchedule(
  circuit: Circuit,
  ioMapping?: IoMapping,
  hdl?: ToolchainProjectInput
): VerifyScheduleContract {
  return buildDeterministicVerifyContext(circuit, ioMapping, hdl).schedule;
}

export function deriveVerifyScheduleFromStructure(
  ir: CircuitIR,
  simModel: SimulationModel,
  ioMapping?: IoMapping,
  hdl?: ToolchainProjectInput,
  circuit?: Circuit
): VerifyScheduleContract {
  const analysis = buildSequentialAnalysisFromStructure(ir, simModel, ioMapping);
  const hdlSequentialHint = hasHdlSequentialHint(hdl);
  const hasClockedBehavior = analysis.hasClockedMacros || hdlSequentialHint;
  const schedule: VerifySchedule = hasClockedBehavior ? 'clocked_macro' : 'combinational';
  const reason: VerifyScheduleContract['reason'] = analysis.hasClockedMacros
    ? 'circuit-sequential'
    : hdlSequentialHint
      ? 'hdl-sequential'
      : 'combinational';
  const needsSimClockInjection =
    schedule === 'clocked_macro' && analysis.hasClockedMacros && !analysis.hasClockNet;
  const resolvedClockSignalName = resolveClockSignalNameFromStructure(
    simModel,
    analysis,
    ioMapping,
    hdl
  );
  const clockSignalName = needsSimClockInjection
    ? INTERNAL_SIM_CLOCK_NAME
    : resolvedClockSignalName;
  const temporalIssues = collectTemporalIssuesFromStructure(simModel, ioMapping, hdl, circuit);
  const timingMode =
    schedule === 'combinational'
      ? 'combinational'
      : analysis.hasClockNet
        ? 'synchronous_board_clock'
        : 'manual_event_driven_lab';

  return {
    schedule,
    timingMode,
    reason,
    analysis,
    needsSimClockInjection,
    clockSignalName,
    samplePoint: schedule === 'clocked_macro' ? 'post-rising-edge' : 'steady-state',
    tick0Meaning: schedule === 'clocked_macro' ? 'initial-state' : null,
    resetHint: resolveResetHintFromStructure(simModel, ioMapping),
    hasUnsupportedTemporal: temporalIssues.length > 0,
    temporalIssues,
  };
}

function buildSequentialAnalysisFromStructure(
  ir: CircuitIR,
  simModel: SimulationModel,
  ioMapping?: IoMapping
): SequentialAnalysis {
  const sequentialNodes = ir.primitives
    .filter((primitive) => isSequentialNodeType(primitive.type))
    .map((primitive) => ({
      id: primitive.sourceNodeId,
      type: primitive.type,
      clockPort: getClockPortName(primitive.type),
    }));

  const hasClockedMacros = sequentialNodes.length > 0;
  const ioMappedClockName = resolveIoMappedClockName(ioMapping);
  const structuralClockNames = uniqueStrings([
    ...simModel.clocks.map((port) => port.canonicalName),
    ...simModel.clockBindings.map(
      (binding) => binding.canonicalName ?? binding.netName ?? binding.boundarySourceNodeId
    ),
    ...ir.features.clockNetNames,
  ]);

  let clockSource: 'ioMapping' | 'circuit' | undefined;
  let clockNetName: string | undefined;

  if (ioMappedClockName) {
    clockSource = 'ioMapping';
    clockNetName = ioMappedClockName;
  } else if (structuralClockNames.length > 0) {
    clockSource = 'circuit';
    clockNetName = structuralClockNames[0];
  }

  return {
    hasClockedMacros,
    hasClockNet: Boolean(ioMappedClockName) || structuralClockNames.length > 0,
    sequentialNodes,
    clockSource,
    clockNetName,
  };
}

function collectTemporalIssuesFromStructure(
  simModel: SimulationModel,
  ioMapping: IoMapping | undefined,
  hdl: ToolchainProjectInput | undefined,
  circuit: Circuit | undefined
): TemporalIssue[] {
  const issues: TemporalIssue[] = [];
  collectFallingEdgeIssues(hdl, issues);
  collectMultiClockDomainIssuesFromStructure(simModel, issues);
  collectActiveLowResetIssuesFromStructure(simModel, ioMapping, issues);
  collectRegisterConfigurationIssues(circuit, issues);
  return issues;
}

function collectRegisterConfigurationIssues(
  circuit: Circuit | undefined,
  issues: TemporalIssue[]
): void {
  for (const node of circuit?.nodes ?? []) {
    if (node.type === 'RegisterBus' || node.type === 'StateBank') {
      issues.push({
        code: 'unsupported-register-family',
        message: `Unsupported sequential component: ${node.type} "${node.label ?? node.id}" is simulated in RedByte but is not supported by the scalar VHDL export path. Use Register1 primitives or flatten the state into supported scalar registers.`,
      });
      continue;
    }
    if (node.type !== 'Register1') continue;

    const config = node.config ?? {};
    const label = node.label ?? node.id;
    const clockPolarity = String(config.clockPolarity ?? 'rising_edge').toLowerCase();
    const resetKind = String(config.resetKind ?? 'none').toLowerCase();
    const resetPolarity = String(config.resetPolarity ?? 'active_high').toLowerCase();
    const hasEnable = config.hasEnable === true;
    const enablePolarity = String(config.enablePolarity ?? 'active_high').toLowerCase();
    const width = Number(config.width ?? 1);

    if (clockPolarity === 'falling_edge') {
      issues.push({
        code: 'unsupported-falling-edge',
        message: `Unsupported Register1 configuration on "${label}": falling-edge capture is not supported by VHDL export. Select rising-edge capture.`,
      });
    }
    if (resetKind === 'async_preset') {
      issues.push({
        code: 'unsupported-register-config',
        message: `Unsupported Register1 configuration on "${label}": asynchronous preset is not supported. Use active-high asynchronous clear or no reset.`,
      });
    } else if (resetKind === 'sync_reset' || resetKind === 'sync_set') {
      issues.push({
        code: 'unsupported-register-config',
        message: `Unsupported Register1 configuration on "${label}": synchronous reset/set is not supported. Use active-high asynchronous clear or no reset.`,
      });
    }
    if (resetKind !== 'none' && resetPolarity === 'active_low') {
      issues.push({
        code: 'unsupported-register-config',
        message: `Unsupported Register1 configuration on "${label}": active-low reset is not supported. Select active-high reset.`,
      });
    }
    if (hasEnable && enablePolarity === 'active_low') {
      issues.push({
        code: 'unsupported-register-config',
        message: `Unsupported Register1 configuration on "${label}": active-low enable is not supported. Select active-high enable.`,
      });
    }
    if (!Number.isFinite(width) || Math.floor(width) !== 1) {
      issues.push({
        code: 'unsupported-register-config',
        message: `Unsupported Register1 configuration on "${label}": width must be 1 for scalar VHDL export. Use Register1 with width 1.`,
      });
    }
  }
}

function collectFallingEdgeIssues(
  hdl: ToolchainProjectInput | undefined,
  issues: TemporalIssue[]
): void {
  if (!hdl?.sources) return;
  for (const source of hdl.sources) {
    if (/falling_edge\s*\(/i.test(source.text ?? '')) {
      issues.push({
        code: 'unsupported-falling-edge',
        message:
          'Unsupported temporal construct: falling_edge(). RedByte v1 only supports rising-edge-triggered sequential logic.',
      });
      return;
    }
  }
}

function collectMultiClockDomainIssuesFromStructure(
  simModel: SimulationModel,
  issues: TemporalIssue[]
): void {
  const clockSources = uniqueStrings(
    simModel.clockBindings.map(
      (binding) => binding.canonicalName ?? binding.netName ?? binding.boundarySourceNodeId
    )
  );
  if (clockSources.length > 1) {
    issues.push({
      code: 'multi-clock-domain',
      message: `Unsupported topology: ${clockSources.length} distinct clock inputs detected. RedByte v1 requires a single clock domain.`,
    });
  }
}

const ACTIVE_LOW_RESET_PATTERN = /^(reset_n|rst_n|nreset|nrst)$/i;

function collectActiveLowResetIssuesFromStructure(
  simModel: SimulationModel,
  ioMapping: IoMapping | undefined,
  issues: TemporalIssue[]
): void {
  for (const signalName of collectResetSignalNames(simModel, ioMapping)) {
    if (ACTIVE_LOW_RESET_PATTERN.test(signalName)) {
      issues.push({
        code: 'active-low-reset',
        message: `Unsupported reset convention: "${signalName}" suggests active-low reset. RedByte v1 only supports active-high reset signals.`,
      });
      return;
    }
  }
}

function resolveResetHintFromStructure(
  simModel: SimulationModel,
  ioMapping: IoMapping | undefined
): VerifyResetHint | undefined {
  for (const signalName of collectResetSignalNames(simModel, ioMapping)) {
    if (!ACTIVE_LOW_RESET_PATTERN.test(signalName)) {
      return {
        signalName,
        activeLevel: 1,
      };
    }
  }
  return undefined;
}

function collectResetSignalNames(
  simModel: SimulationModel,
  ioMapping: IoMapping | undefined
): string[] {
  return uniqueStrings(
    simModel.resetBindings.map((binding) => {
      const mappedLabel = binding.boundarySourceNodeId
        ? resolveIoMappingLabel(ioMapping, binding.boundarySourceNodeId)
        : undefined;
      return mappedLabel ?? binding.canonicalName ?? binding.boundarySourceNodeId ?? binding.netName;
    })
  );
}

function resolveIoMappingLabel(
  ioMapping: IoMapping | undefined,
  nodeId: string
): string | undefined {
  return ioMapping?.inputs?.find(
    (entry) => entry.nodeId === nodeId || entry.id === nodeId
  )?.label;
}

function resolveClockSignalNameFromStructure(
  simModel: SimulationModel,
  analysis: SequentialAnalysis,
  ioMapping: IoMapping | undefined,
  hdl?: ToolchainProjectInput
): string | undefined {
  if (analysis.clockNetName && analysis.clockNetName.length > 0) {
    return analysis.clockNetName;
  }

  const ioMappedClockName = resolveIoMappedClockName(ioMapping);
  if (ioMappedClockName) {
    return ioMappedClockName;
  }

  const structuralClockName = uniqueStrings([
    ...simModel.clocks.map((port) => port.canonicalName),
    ...simModel.clockBindings.map(
      (binding) => binding.canonicalName ?? binding.netName ?? binding.boundarySourceNodeId
    ),
  ])[0];
  if (structuralClockName) {
    return structuralClockName;
  }

  return findClockSignalHintFromHdl(hdl);
}

function resolveIoMappedClockName(ioMapping: IoMapping | undefined): string | undefined {
  for (const entry of ioMapping?.inputs ?? []) {
    const boardBinding = resolveBasys3SignalBinding({
      id: entry.id,
      label: entry.label,
      pin: entry.pin,
      direction: 'in',
    });
    if (boardBinding?.role === 'clock') {
      return entry.label?.trim() || entry.id.trim() || boardBinding.alias;
    }

    const namedCandidates = [entry.label, entry.id, entry.pin];
    if (namedCandidates.some((candidate) => candidate === 'CLK100MHZ')) {
      return entry.label?.trim() || entry.id.trim() || 'CLK100MHZ';
    }
    const clockLike = namedCandidates.find((candidate) => isClockLike(candidate ?? ''));
    if (clockLike) {
      return entry.label?.trim() || entry.id.trim() || clockLike;
    }
  }
  return undefined;
}

function hasHdlSequentialHint(hdl?: ToolchainProjectInput): boolean {
  if (!hdl?.sources || hdl.sources.length === 0) return false;
  return hdl.sources.some((source) => sourceLooksSequential(source.text ?? ''));
}

function sourceLooksSequential(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('rising_edge(') ||
    lower.includes('falling_edge(') ||
    /\balways_ff\b/i.test(text) ||
    /\balways\s*@\s*\([^)]*(posedge|negedge)/i.test(text) ||
    /\bif\b[\s\S]*?'\s*event\b[\s\S]*?=\s*'1'/i.test(text) ||
    /\bif\b[\s\S]*?'\s*event\b[\s\S]*?=\s*'0'/i.test(text)
  );
}

function findClockSignalHintFromHdl(hdl?: ToolchainProjectInput): string | undefined {
  if (!hdl?.sources || hdl.sources.length === 0) return undefined;

  for (const source of hdl.sources) {
    const text = source.text ?? '';
    const vhdlPortMatch = text.match(/entity\s+\w+\s+is[\s\S]*?port\s*\(([\s\S]*?)\)\s*;/i);
    if (vhdlPortMatch?.[1]) {
      const candidate = findClockNameInPortBlock(vhdlPortMatch[1]);
      if (candidate) return candidate;
    }

    const verilogPortMatch = text.match(/module\s+\w+\s*\(([\s\S]*?)\)\s*;/i);
    if (verilogPortMatch?.[1]) {
      const candidate = findClockNameInPortBlock(verilogPortMatch[1]);
      if (candidate) return candidate;
    }
  }

  return undefined;
}

function findClockNameInPortBlock(portBlock: string): string | undefined {
  const tokens = portBlock
    .split(/[,\n;]/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const bare = token
      .replace(/\b(in|out|inout|input|output|wire|logic|std_logic|std_logic_vector)\b/gi, ' ')
      .replace(/[:()]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    for (const name of bare) {
      if (isClockLike(name)) {
        return name;
      }
    }
  }

  return undefined;
}

function isClockLike(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower === 'clk' ||
    lower === 'clock' ||
    lower === 'clk100mhz' ||
    lower.startsWith('clk_') ||
    lower.startsWith('clock_')
  );
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value && value.length > 0))
    )
  );
}
