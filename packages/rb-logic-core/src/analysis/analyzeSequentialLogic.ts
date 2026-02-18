// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '../types';
import type { IoMapping } from '@redbyte/rb-utils';
import { isSequentialNodeType, getClockPortName } from './nodeMetaRegistry';

/**
 * Result of sequential logic analysis
 */
export interface SequentialAnalysis {
  hasClockedMacros: boolean;
  hasClockNet: boolean; // has clock from ioMapping or circuit
  sequentialNodes: Array<{
    id: string;
    type: string;
    clockPort?: string;
  }>;
  clockSource?: 'ioMapping' | 'circuit'; // where the clock comes from
  clockNetName?: string; // name of the clock net (from circuit or ioMapping)
}

/**
 * Detect sequential logic and clock presence in a circuit
 *
 * v1 Clock Detection Rule:
 * hasClockNet = true if EITHER:
 *   1. ioMapping declares a clock (CLK100MHZ)
 *   2. Circuit has a net named like a clock connected to sequential node
 *
 * Clock name patterns (v1): "clk", "CLK100MHZ", "clock", "CLK" (case-insensitive)
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
 * Returns { found: boolean, netName?: string }
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
    // Normalize connection to PortRef form
    const to = typeof conn.to === 'string' ? null : (conn.to as any);
    const toNodeId = typeof conn.to === 'string' ? conn.to : (conn.to as any).nodeId;
    const toPort = to ? (to.portName || to.port) : (conn as any).toPort || (conn as any).toPin || 'in';

    // Check if this connection targets a sequential node's clock port
    const seqNode = sequentialNodes.find((n) => n.id === toNodeId);
    if (seqNode && seqNode.clockPort === toPort) {
      // Found a clock connection; check the source node's label
      const fromNodeId = typeof conn.from === 'string' ? conn.from : (conn.from as any).nodeId;
      const sourceNode = circuit.nodes.find((n) => n.id === fromNodeId);

      if (sourceNode) {
        // Check if source node's label looks like a clock
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

/**
 * Check if a label/name looks like a clock signal (v1 pattern matching)
 * v1 patterns: "clk", "CLK100MHZ", "clock", "CLK" (case-insensitive)
 */
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
