import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping, VerifySchedule } from '@redbyte/rb-utils';
import type { ToolchainProjectInput } from '../../toolchainBackend';
import type { SequentialAnalysis } from './sequentialAnalysis';
import { analyzeSequentialLogic } from './sequentialAnalysis';

export type { VerifySchedule } from '@redbyte/rb-utils';
export { CLOCKED_MACRO_SEQUENCE } from '@redbyte/rb-utils';

export interface VerifyScheduleContract {
  schedule: VerifySchedule;
  reason: 'combinational' | 'circuit-sequential' | 'hdl-sequential';
  analysis: SequentialAnalysis;
  needsSimClockInjection: boolean;
  clockSignalName?: string;
}

export function deriveVerifySchedule(
  circuit: Circuit,
  ioMapping?: IoMapping,
  hdl?: ToolchainProjectInput
): VerifyScheduleContract {
  const analysis = analyzeSequentialLogic(circuit, ioMapping);
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

  const clockSignalName = resolveClockSignalName(circuit, analysis, hdl);

  return {
    schedule,
    reason,
    analysis,
    needsSimClockInjection,
    clockSignalName,
  };
}

function resolveClockSignalName(
  circuit: Circuit,
  analysis: SequentialAnalysis,
  hdl?: ToolchainProjectInput
): string | undefined {
  if (analysis.clockNetName && analysis.clockNetName.length > 0) {
    return analysis.clockNetName;
  }

  const clockNode = circuit.nodes.find((node) => isClockLike(node.label ?? '') || isClockLike(node.id));
  if (clockNode) {
    return clockNode.label && clockNode.label.length > 0 ? clockNode.label : clockNode.id;
  }

  const hdlClockHint = findClockSignalHintFromHdl(hdl);
  if (hdlClockHint) {
    return hdlClockHint;
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
    /\bprocess\s*\(/i.test(text) ||
    /\balways\s*@/i.test(text) ||
    /\balways_ff\b/i.test(text)
  );
}

function findClockSignalHintFromHdl(hdl?: ToolchainProjectInput): string | undefined {
  if (!hdl?.sources || hdl.sources.length === 0) return undefined;

  for (const source of hdl.sources) {
    const text = source.text ?? '';

    // VHDL entity port block heuristic
    const vhdlPortMatch = text.match(/entity\s+\w+\s+is[\s\S]*?port\s*\(([\s\S]*?)\)\s*;/i);
    if (vhdlPortMatch?.[1]) {
      const candidate = findClockNameInPortBlock(vhdlPortMatch[1]);
      if (candidate) return candidate;
    }

    // Verilog module port block heuristic
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
