// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Metadata registry for node types
 * Single authority for detecting sequential logic, clock ports, and reset ports
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
  DLatch: {
    isSequential: true,
    clockPort: "EN",
    note: "level-sensitive D latch; transparent when EN=1, holds when EN=0",
  },
  TFlipFlop: {
    isSequential: true,
    clockPort: "CLK",
    resetPort: "CLR",
    note: "clocked_macro v2 - rising-edge T flip-flop with active-high clear",
  },
  JKFlipFlop: {
    isSequential: true,
    clockPort: "CLK",
    resetPort: "CLR",
    note: "clocked_macro v2 - rising-edge JK flip-flop with active-high clear",
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
  // Combinational elements (explicitly marked as NOT sequential)
  AND: { isSequential: false },
  OR: { isSequential: false },
  NOT: { isSequential: false },
  NAND: { isSequential: false },
  NOR: { isSequential: false },
  XOR: { isSequential: false },
  XNOR: { isSequential: false },
  FullAdder: { isSequential: false },
  Lamp: { isSequential: false },
  Switch: { isSequential: false },
};

/**
 * Get metadata for a node type
 * Returns empty object (defaults to non-sequential) if type not found
 */
export function getNodeMeta(typeString: string): NodeMeta {
  return META_BY_TYPE[typeString] ?? {};
}

/**
 * Check if a node type is sequential
 */
export function isSequentialNodeType(typeString: string): boolean {
  const meta = getNodeMeta(typeString);
  return meta.isSequential === true;
}

/**
 * Get clock port name for a sequential node type
 */
export function getClockPortName(typeString: string): string | undefined {
  const meta = getNodeMeta(typeString);
  return meta.clockPort;
}

/**
 * Get reset port name for a sequential node type (if any)
 */
export function getResetPortName(typeString: string): string | undefined {
  const meta = getNodeMeta(typeString);
  return meta.resetPort;
}
