// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';

/**
 * Metadata for node types - single authority for sequential detection
 */
export interface NodeMeta {
  isSequential?: boolean;
  clockPort?: string;  // e.g., "clk", "CLK"
  resetPort?: string;  // e.g., "rst", "reset"
  note?: string;       // e.g., "clocked_macro v1"
}

const META_BY_TYPE: Record<string, NodeMeta> = {
  // Sequential/stateful elements
  DFlipFlop: {
    isSequential: true,
    clockPort: "CLK",
    note: "clocked_macro v2 - rising-edge D flip-flop",
  },
  JKFlipFlop: {
    isSequential: true,
    clockPort: "CLK",
    resetPort: "CLR",
    note: "clocked_macro v2 - rising-edge JK flip-flop with active-high clear",
  },
  TFlipFlop: {
    isSequential: true,
    clockPort: "CLK",
    resetPort: "CLR",
    note: "clocked_macro v2 - rising-edge T flip-flop with active-high clear",
  },
  DLatch: {
    isSequential: true,
    clockPort: "EN",
    note: "level-sensitive D latch; transparent when EN=1, holds when EN=0",
  },
  RSLatch: {
    isSequential: true,
    note: "clocked_macro v1 - asynchronous SR latch",
  },
  Counter4Bit: {
    isSequential: true,
    clockPort: "CLK",
    resetPort: "RST",
    note: "clocked_macro v1 - 4-bit counter",
  },
  Delay: {
    isSequential: true,
    note: "clocked_macro v1 - delay element",
  },
};

export function getNodeMeta(typeString: string): NodeMeta {
  return META_BY_TYPE[typeString] ?? {};
}

export function isSequentialNodeType(typeString: string): boolean {
  const meta = getNodeMeta(typeString);
  return meta.isSequential === true;
}

export function getClockPortName(typeString: string): string | undefined {
  const meta = getNodeMeta(typeString);
  return meta.clockPort;
}

export function getResetPortName(typeString: string): string | undefined {
  const meta = getNodeMeta(typeString);
  return meta.resetPort;
}

/**
 * Result of sequential logic analysis
 */
export interface SequentialAnalysis {
  hasClockedMacros: boolean;
  hasClockNet: boolean;
  sequentialNodes: Array<{
    id: string;
    type: string;
    clockPort?: string;
  }>;
  clockSource?: 'ioMapping' | 'circuit';
  clockNetName?: string;
}

/**
 * Detect sequential logic and clock presence
 */
export function analyzeSequentialLogic(
  circuit: Circuit,
  ioMapping?: IoMapping
): SequentialAnalysis {
  // Find all sequential nodes
  const sequentialNodes = circuit.nodes
    .filter((node) => isSequentialNodeType(node.type))
    .map((node) => ({
      id: node.id,
      type: node.type,
      clockPort: getClockPortName(node.type),
    }));

  const hasClockedMacros = sequentialNodes.length > 0;

  // Check 1: Does ioMapping have a clock mapping?
  const hasIoMappedClock =
    ioMapping &&
    (ioMapping.inputs?.some((entry) => entry.label === 'CLK100MHZ' || entry.id === 'CLK100MHZ') ||
      ioMapping.outputs?.some((entry) => entry.label === 'CLK100MHZ' || entry.id === 'CLK100MHZ'));

  // Check 2: Does circuit have a clock net?
  const clockDetection = detectCircuitClockNet(circuit, sequentialNodes);

  const hasClockNet = hasIoMappedClock || clockDetection.found;

  // Determine clock source priority
  let clockSource: 'ioMapping' | 'circuit' | undefined;
  let clockNetName: string | undefined;

  if (hasIoMappedClock) {
    clockSource = 'ioMapping';
    clockNetName = 'CLK100MHZ';
  } else if (clockDetection.found) {
    clockSource = 'circuit';
    clockNetName = clockDetection.netName;
  }

  return {
    hasClockedMacros,
    hasClockNet,
    sequentialNodes,
    clockSource,
    clockNetName,
  };
}

/**
 * Detect if circuit has a clock net by name and connectivity
 */
function detectCircuitClockNet(
  circuit: Circuit,
  sequentialNodes: Array<{
    id: string;
    type: string;
    clockPort?: string;
  }>
): { found: boolean; netName?: string } {
  if (sequentialNodes.length === 0) {
    return { found: false };
  }

  // Collect all clock ports from sequential nodes
  const clockPorts = new Set<string>();
  for (const node of sequentialNodes) {
    if (node.clockPort) {
      clockPorts.add(node.clockPort);
    }
  }

  if (clockPorts.size === 0) {
    return { found: false };
  }

  // Find connections to clock ports
  for (const conn of circuit.connections) {
    const to = typeof conn.to === 'string' ? null : (conn.to as any);
    const toNodeId = typeof conn.to === 'string' ? conn.to : (conn.to as any).nodeId;
    const toPort = to ? (to.portName || to.port) : (conn as any).toPort || (conn as any).toPin || 'in';

    const seqNode = sequentialNodes.find((n) => n.id === toNodeId);
    if (seqNode && seqNode.clockPort === toPort) {
      const fromNodeId = typeof conn.from === 'string' ? conn.from : (conn.from as any).nodeId;
      const sourceNode = circuit.nodes.find((n) => n.id === fromNodeId);

      if (sourceNode) {
        const label = sourceNode.label || sourceNode.id || '';
        const clockName = isClockName(label);
        if (clockName) {
          return { found: true, netName: label };
        }
      }
    }
  }

  return { found: false };
}

function isClockName(label: string): boolean {
  if (!label) return false;
  const lower = label.toLowerCase();
  return (
    lower === 'clk' ||
    lower === 'clock' ||
    lower === 'clk100mhz' ||
    lower.startsWith('clk_') ||
    lower.startsWith('clock_')
  );
}
