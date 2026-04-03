// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.

import type { VerifyWaveSample } from '../../verifyReport';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal circuit graph for causal analysis. */
export interface ExplainerCircuitGraph {
  readonly nodes: ReadonlyArray<{
    readonly id: string;
    readonly type: string;
    readonly label?: string;
    readonly config?: Record<string, unknown>;
  }>;
  readonly connections: ReadonlyArray<{
    readonly from: { readonly nodeId: string; readonly portName: string };
    readonly to: { readonly nodeId: string; readonly portName: string };
  }>;
}

/** Maps boundary signal names to their circuit node IDs and direction. */
export interface ExplainerSignalMapping {
  readonly signalName: string;
  readonly nodeId: string;
  readonly direction: 'in' | 'out';
  readonly pin?: string;
}

export type ExplanationKind =
  | 'input'
  | 'combinational'
  | 'sequential'
  | 'unchanged'
  | 'partial';

export interface ExplanationStep {
  readonly description: string;
  /** Node type involved in this step, if any (e.g. 'AND', 'DFlipFlop'). */
  readonly nodeType?: string;
  /** Node label if available (e.g. "U1"). */
  readonly nodeLabel?: string;
  /** Port name if relevant (e.g. 'Q', 'D'). */
  readonly port?: string;
}

export interface SignalExplanation {
  readonly selectedSignal: string;
  readonly tick: number;
  readonly currentValue: string;
  readonly previousValue: string | null;
  readonly changed: boolean;
  readonly explanationKind: ExplanationKind;
  readonly summary: string;
  readonly steps: readonly ExplanationStep[];
  readonly sourceNodeIds: readonly string[];
  readonly relevantClockEdge?: {
    readonly clockSignal: string;
    readonly edgeTick: number;
    readonly edgeDirection: 'rising' | 'falling';
  };
  readonly relevantPriorState?: {
    readonly signal: string;
    readonly value: string;
    readonly tick: number;
  };
}

export interface ExplainerInput {
  readonly selectedSignal: string;
  readonly tick: number;
  readonly waveform: readonly VerifyWaveSample[];
  readonly signalRoles: Readonly<Record<string, 'clock' | 'reset' | 'input' | 'output'>>;
  readonly signalMappings: readonly ExplainerSignalMapping[];
  readonly circuitGraph?: ExplainerCircuitGraph;
  readonly circuitKind?: 'sequential' | 'combinational';
  readonly clockSignalName?: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SEQUENTIAL_NODE_TYPES = new Set([
  'DFlipFlop',
  'DLatch',
  'TFlipFlop',
  'JKFlipFlop',
  'RSLatch',
  'Counter4Bit',
  'Delay',
]);

const GATE_DISPLAY_NAMES: Record<string, string> = {
  AND: 'AND gate',
  OR: 'OR gate',
  NOT: 'NOT gate (inverter)',
  NAND: 'NAND gate',
  NOR: 'NOR gate',
  XOR: 'XOR gate',
  XNOR: 'XNOR gate',
  Buffer: 'buffer',
  DFlipFlop: 'D flip-flop',
  DLatch: 'D latch',
  TFlipFlop: 'T flip-flop',
  JKFlipFlop: 'JK flip-flop',
  RSLatch: 'RS latch',
  Counter4Bit: '4-bit counter',
  Delay: 'delay element',
  Mux2: '2-to-1 multiplexer',
  Mux4: '4-to-1 multiplexer',
  Switch: 'switch',
  LED: 'LED',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDisplayName(nodeType: string): string {
  return GATE_DISPLAY_NAMES[nodeType] ?? nodeType;
}

function getLabelOrType(node: { type: string; label?: string }): string {
  return node.label ?? getDisplayName(node.type);
}

function signalValueAt(
  waveform: readonly VerifyWaveSample[],
  signal: string,
  tick: number,
): string | null {
  const sample = waveform.find((s) => s.tick === tick);
  if (!sample) return null;
  return sample.signals[signal] ?? null;
}

function findDriverConnections(
  graph: ExplainerCircuitGraph,
  nodeId: string,
): ReadonlyArray<{
  fromNodeId: string;
  fromPort: string;
  toPort: string;
}> {
  return graph.connections
    .filter((c) => c.to.nodeId === nodeId)
    .map((c) => ({
      fromNodeId: c.from.nodeId,
      fromPort: c.from.portName,
      toPort: c.to.portName,
    }));
}

function findNodeById(
  graph: ExplainerCircuitGraph,
  nodeId: string,
): ExplainerCircuitGraph['nodes'][number] | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

function isInputNode(nodeType: string): boolean {
  return nodeType === 'Switch' || nodeType === 'Clock' || nodeType === 'Input';
}

function isOutputNode(nodeType: string): boolean {
  return nodeType === 'LED' || nodeType === 'Output';
}

function findSignalNodeId(
  signal: string,
  mappings: readonly ExplainerSignalMapping[],
): string | null {
  const mapping = mappings.find((m) => m.signalName === signal);
  return mapping?.nodeId ?? null;
}

function detectClockEdge(
  waveform: readonly VerifyWaveSample[],
  clockSignal: string,
  tick: number,
): { edgeTick: number; edgeDirection: 'rising' | 'falling' } | null {
  // Check for rising edge at tick (0→1) or tick-1→tick
  const currentVal = signalValueAt(waveform, clockSignal, tick);
  const prevVal = signalValueAt(waveform, clockSignal, tick - 1);

  if (prevVal === '0' && currentVal === '1') {
    return { edgeTick: tick, edgeDirection: 'rising' };
  }
  if (prevVal === '1' && currentVal === '0') {
    return { edgeTick: tick, edgeDirection: 'falling' };
  }

  // Look back one more tick for edge at tick-1
  const prevPrevVal = signalValueAt(waveform, clockSignal, tick - 2);
  if (prevPrevVal === '0' && prevVal === '1') {
    return { edgeTick: tick - 1, edgeDirection: 'rising' };
  }
  if (prevPrevVal === '1' && prevVal === '0') {
    return { edgeTick: tick - 1, edgeDirection: 'falling' };
  }

  return null;
}

function findSignalValueForNode(
  nodeId: string,
  mappings: readonly ExplainerSignalMapping[],
  waveform: readonly VerifyWaveSample[],
  tick: number,
): { signalName: string; value: string } | null {
  const mapping = mappings.find((m) => m.nodeId === nodeId);
  if (!mapping) return null;
  const value = signalValueAt(waveform, mapping.signalName, tick);
  if (value === null) return null;
  return { signalName: mapping.signalName, value };
}

// ─── Core Explainer ──────────────────────────────────────────────────────────

function explainInput(
  input: ExplainerInput,
  currentValue: string,
  previousValue: string | null,
  changed: boolean,
): SignalExplanation {
  const steps: ExplanationStep[] = [
    {
      description: `${input.selectedSignal} is a circuit input with value ${currentValue} at tick ${input.tick}.`,
    },
  ];

  if (changed && previousValue !== null) {
    steps.push({
      description: `It changed from ${previousValue} to ${currentValue} at this tick.`,
    });
    steps.push({
      description: 'Input values are set by the test stimulus — they are not driven by the circuit.',
    });
  } else {
    steps.push({
      description: 'Input values are set by the test stimulus — they are not driven by the circuit.',
    });
  }

  const summary = changed
    ? `${input.selectedSignal} is an input that changed to ${currentValue} at tick ${input.tick}.`
    : `${input.selectedSignal} is an input held at ${currentValue}.`;

  return {
    selectedSignal: input.selectedSignal,
    tick: input.tick,
    currentValue,
    previousValue,
    changed,
    explanationKind: 'input',
    summary,
    steps,
    sourceNodeIds: [],
  };
}

function buildCombinationalExplanation(
  input: ExplainerInput,
  currentValue: string,
  previousValue: string | null,
  changed: boolean,
  graph: ExplainerCircuitGraph,
  signalNodeId: string,
): SignalExplanation {
  const steps: ExplanationStep[] = [];
  const sourceNodeIds: string[] = [];

  const signalNode = findNodeById(graph, signalNodeId);
  const outputNodeLabel = signalNode ? getLabelOrType(signalNode) : input.selectedSignal;

  steps.push({
    description: `${input.selectedSignal} is ${currentValue} at tick ${input.tick}.`,
    nodeType: signalNode?.type,
    nodeLabel: signalNode?.label,
  });

  if (changed && previousValue !== null) {
    steps.push({
      description: `It changed from ${previousValue} to ${currentValue}.`,
    });
  }

  // Walk backward through the graph from the output node
  const driverConns = findDriverConnections(graph, signalNodeId);

  if (driverConns.length === 0) {
    steps.push({
      description: `No upstream driver found for ${outputNodeLabel}.`,
    });
    return {
      selectedSignal: input.selectedSignal,
      tick: input.tick,
      currentValue,
      previousValue,
      changed,
      explanationKind: changed ? 'combinational' : 'unchanged',
      summary: `${input.selectedSignal} is ${currentValue} at tick ${input.tick}.`,
      steps,
      sourceNodeIds,
    };
  }

  // Trace one level of drivers
  for (const driver of driverConns) {
    const driverNode = findNodeById(graph, driver.fromNodeId);
    if (!driverNode) continue;

    sourceNodeIds.push(driver.fromNodeId);
    const driverLabel = getLabelOrType(driverNode);

    if (isInputNode(driverNode.type)) {
      const inputVal = findSignalValueForNode(
        driver.fromNodeId, input.signalMappings, input.waveform, input.tick,
      );
      steps.push({
        description: inputVal
          ? `Driven by input ${inputVal.signalName} = ${inputVal.value}.`
          : `Driven by input ${driverLabel}.`,
        nodeType: driverNode.type,
        nodeLabel: driverNode.label,
        port: driver.fromPort,
      });
    } else if (SEQUENTIAL_NODE_TYPES.has(driverNode.type)) {
      steps.push({
        description: `Driven by ${getDisplayName(driverNode.type)} (${driverLabel}), port ${driver.fromPort}.`,
        nodeType: driverNode.type,
        nodeLabel: driverNode.label,
        port: driver.fromPort,
      });
    } else {
      // Combinational gate — trace its inputs
      steps.push({
        description: `Driven by ${getDisplayName(driverNode.type)} (${driverLabel}).`,
        nodeType: driverNode.type,
        nodeLabel: driverNode.label,
        port: driver.fromPort,
      });

      // Go one more level: find what drives this gate
      const gateDrivers = findDriverConnections(graph, driver.fromNodeId);
      for (const gateDriver of gateDrivers) {
        const gateDriverNode = findNodeById(graph, gateDriver.fromNodeId);
        if (!gateDriverNode) continue;

        sourceNodeIds.push(gateDriver.fromNodeId);
        const gateInputVal = findSignalValueForNode(
          gateDriver.fromNodeId, input.signalMappings, input.waveform, input.tick,
        );

        if (gateInputVal) {
          steps.push({
            description: `  ${gateDriver.toPort} ← ${gateInputVal.signalName} = ${gateInputVal.value}.`,
            nodeType: gateDriverNode.type,
            nodeLabel: gateDriverNode.label,
          });
        } else {
          steps.push({
            description: `  ${gateDriver.toPort} ← ${getLabelOrType(gateDriverNode)}.`,
            nodeType: gateDriverNode.type,
            nodeLabel: gateDriverNode.label,
          });
        }
      }
    }
  }

  const summary = changed
    ? `${input.selectedSignal} changed to ${currentValue} at tick ${input.tick} based on its input values.`
    : `${input.selectedSignal} holds at ${currentValue} — its inputs have not changed.`;

  return {
    selectedSignal: input.selectedSignal,
    tick: input.tick,
    currentValue,
    previousValue,
    changed,
    explanationKind: changed ? 'combinational' : 'unchanged',
    summary,
    steps,
    sourceNodeIds,
  };
}

function buildSequentialExplanation(
  input: ExplainerInput,
  currentValue: string,
  previousValue: string | null,
  changed: boolean,
  graph: ExplainerCircuitGraph,
  signalNodeId: string,
  sequentialNodeId: string,
  sequentialNode: ExplainerCircuitGraph['nodes'][number],
): SignalExplanation {
  const steps: ExplanationStep[] = [];
  const sourceNodeIds: string[] = [sequentialNodeId];

  const ffLabel = getLabelOrType(sequentialNode);
  const ffDisplayName = getDisplayName(sequentialNode.type);

  steps.push({
    description: `${input.selectedSignal} is ${currentValue} at tick ${input.tick}.`,
  });

  if (changed && previousValue !== null) {
    steps.push({
      description: `It changed from ${previousValue} to ${currentValue}.`,
    });
  }

  steps.push({
    description: `${input.selectedSignal} is driven by the Q output of ${ffDisplayName} (${ffLabel}).`,
    nodeType: sequentialNode.type,
    nodeLabel: sequentialNode.label,
    port: 'Q',
  });

  // Look for clock edge
  let relevantClockEdge: SignalExplanation['relevantClockEdge'];
  let relevantPriorState: SignalExplanation['relevantPriorState'];
  const clockSignal = input.clockSignalName ?? null;

  if (clockSignal) {
    const edge = detectClockEdge(input.waveform, clockSignal, input.tick);
    if (edge) {
      relevantClockEdge = {
        clockSignal,
        edgeTick: edge.edgeTick,
        edgeDirection: edge.edgeDirection,
      };

      steps.push({
        description: `A ${edge.edgeDirection} clock edge occurred at tick ${edge.edgeTick} on ${clockSignal}.`,
      });

      // Find the D input to the flip-flop at the capture moment
      const dDrivers = findDriverConnections(graph, sequentialNodeId)
        .filter((c) => c.toPort === 'D' || c.toPort === 'd' || c.toPort === 'in');

      for (const dDriver of dDrivers) {
        const dDriverNode = findNodeById(graph, dDriver.fromNodeId);
        if (!dDriverNode) continue;
        sourceNodeIds.push(dDriver.fromNodeId);

        const capturedTick = edge.edgeTick > 0 ? edge.edgeTick - 1 : edge.edgeTick;
        const dValue = findSignalValueForNode(
          dDriver.fromNodeId, input.signalMappings, input.waveform, capturedTick,
        );

        if (dValue) {
          steps.push({
            description: `The D input was ${dValue.value} (from ${dValue.signalName}) at tick ${capturedTick}.`,
            nodeType: dDriverNode.type,
            nodeLabel: dDriverNode.label,
            port: 'D',
          });
        } else {
          steps.push({
            description: `The D input was driven by ${getLabelOrType(dDriverNode)} at tick ${capturedTick}.`,
            nodeType: dDriverNode.type,
            nodeLabel: dDriverNode.label,
            port: 'D',
          });
        }
      }

      if (changed) {
        steps.push({
          description: `The flip-flop captured its D input on the ${edge.edgeDirection} edge, updating Q to ${currentValue}.`,
        });
      } else {
        steps.push({
          description: `The flip-flop held its state — Q remained ${currentValue}.`,
        });
      }
    } else {
      steps.push({
        description: `No clock edge detected near tick ${input.tick}. The flip-flop holds its previous state.`,
      });
    }
  }

  // Prior state reference
  if (previousValue !== null) {
    relevantPriorState = {
      signal: input.selectedSignal,
      value: previousValue,
      tick: input.tick - 1,
    };
  }

  // Check for reset
  const resetConns = findDriverConnections(graph, sequentialNodeId)
    .filter((c) => c.toPort === 'RST' || c.toPort === 'rst' || c.toPort === 'reset' || c.toPort === 'R');

  for (const rstConn of resetConns) {
    const rstValue = findSignalValueForNode(
      rstConn.fromNodeId, input.signalMappings, input.waveform, input.tick,
    );
    if (rstValue && rstValue.value === '1') {
      steps.push({
        description: `Reset is active (${rstValue.signalName} = 1) — the flip-flop may be forced to 0.`,
      });
    }
  }

  const summary = changed
    ? `${input.selectedSignal} changed to ${currentValue} at tick ${input.tick} — the ${ffDisplayName} captured a new state on a clock edge.`
    : `${input.selectedSignal} holds at ${currentValue} — the ${ffDisplayName} state was not updated.`;

  return {
    selectedSignal: input.selectedSignal,
    tick: input.tick,
    currentValue,
    previousValue,
    changed,
    explanationKind: 'sequential',
    summary,
    steps,
    sourceNodeIds,
    relevantClockEdge,
    relevantPriorState,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Produce a causal explanation for why a signal has a given value at a given tick.
 *
 * Pure function — no side effects, no UI dependencies.
 */
export function explainSignal(input: ExplainerInput): SignalExplanation {
  const { selectedSignal, tick, waveform, signalRoles, signalMappings, circuitGraph } = input;

  // Resolve current and previous values
  const currentValue = signalValueAt(waveform, selectedSignal, tick) ?? '-';
  const previousValue = tick > 0 ? signalValueAt(waveform, selectedSignal, tick - 1) : null;
  const changed = previousValue !== null && previousValue !== currentValue && currentValue !== '-';

  // Check if this is an input signal
  const role = signalRoles[selectedSignal];
  if (role === 'input' || role === 'clock' || role === 'reset') {
    return explainInput(input, currentValue, previousValue, changed);
  }

  // No circuit graph — partial explanation only
  if (!circuitGraph || circuitGraph.nodes.length === 0) {
    const steps: ExplanationStep[] = [
      { description: `${selectedSignal} is ${currentValue} at tick ${tick}.` },
    ];
    if (changed && previousValue !== null) {
      steps.push({ description: `It changed from ${previousValue} to ${currentValue}.` });
    }
    if (role === 'output') {
      steps.push({ description: `${selectedSignal} is a circuit output.` });
    }
    steps.push({
      description: 'Full explanation unavailable — circuit structure not loaded.',
    });

    return {
      selectedSignal,
      tick,
      currentValue,
      previousValue,
      changed,
      explanationKind: 'partial',
      summary: `${selectedSignal} is ${currentValue} at tick ${tick}.`,
      steps,
      sourceNodeIds: [],
    };
  }

  // Find the circuit node for this signal
  const signalNodeId = findSignalNodeId(selectedSignal, signalMappings);
  if (!signalNodeId) {
    return {
      selectedSignal,
      tick,
      currentValue,
      previousValue,
      changed,
      explanationKind: 'partial',
      summary: `${selectedSignal} is ${currentValue} at tick ${tick}.`,
      steps: [
        { description: `${selectedSignal} is ${currentValue} at tick ${tick}.` },
        { description: 'Could not identify the circuit node for this signal.' },
      ],
      sourceNodeIds: [],
    };
  }

  // Walk backward from boundary node to find its driver
  const boundaryDrivers = findDriverConnections(circuitGraph, signalNodeId);

  // Check if any upstream node is sequential
  for (const driver of boundaryDrivers) {
    const driverNode = findNodeById(circuitGraph, driver.fromNodeId);
    if (driverNode && SEQUENTIAL_NODE_TYPES.has(driverNode.type)) {
      return buildSequentialExplanation(
        input, currentValue, previousValue, changed,
        circuitGraph, signalNodeId, driver.fromNodeId, driverNode,
      );
    }
  }

  // Check one more level deep for sequential nodes (output → buffer/gate → DFF)
  for (const driver of boundaryDrivers) {
    const midDrivers = findDriverConnections(circuitGraph, driver.fromNodeId);
    for (const midDriver of midDrivers) {
      const midNode = findNodeById(circuitGraph, midDriver.fromNodeId);
      if (midNode && SEQUENTIAL_NODE_TYPES.has(midNode.type)) {
        return buildSequentialExplanation(
          input, currentValue, previousValue, changed,
          circuitGraph, signalNodeId, midDriver.fromNodeId, midNode,
        );
      }
    }
  }

  // Pure combinational
  return buildCombinationalExplanation(
    input, currentValue, previousValue, changed,
    circuitGraph, signalNodeId,
  );
}
