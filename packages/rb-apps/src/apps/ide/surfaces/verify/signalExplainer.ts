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
  /** Circuit port identity for internal recordings; distinct from a package pin. */
  readonly port?: string;
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
  'Register1',
  'RegisterBus',
  'StateBank',
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
  return ['switch', 'button', 'clock', 'input'].includes(nodeType.toLowerCase());
}

function isOutputNode(nodeType: string): boolean {
  return ['led', 'lamp', 'output'].includes(nodeType.toLowerCase());
}

function findSignalMapping(
  signal: string,
  mappings: readonly ExplainerSignalMapping[],
): ExplainerSignalMapping | null {
  const matches = mappings.filter((mapping) => mapping.signalName === signal);
  const endpoints = new Set(matches.map((mapping) => `${mapping.nodeId}:${mapping.port ?? ''}`));
  return endpoints.size === 1 ? matches[0] : null;
}

function sourcePortKey(nodeType: string, port: string): string {
  const key = port.toLowerCase();
  if (SEQUENTIAL_NODE_TYPES.has(nodeType)) {
    if (['q', 'out'].includes(key)) return 'q';
    if (['q_inv', 'qbar', 'qn', 'q_n', 'nq'].includes(key)) return 'q_inv';
  }
  return key;
}

/** Resolve an observed source endpoint, never another output of the same node. */
function findSignalForPort(
  input: Pick<ExplainerInput, 'waveform' | 'signalMappings'>,
  graph: ExplainerCircuitGraph,
  nodeId: string,
  port: string,
): string | null {
  const node = findNodeById(graph, nodeId);
  if (!node) return null;
  const observed = new Set(input.waveform.flatMap((sample) => Object.keys(sample.signals)));
  const candidates = new Set(input.signalMappings.filter((mapping) =>
    mapping.nodeId === nodeId && (
      mapping.port ? sourcePortKey(node.type, mapping.port) === sourcePortKey(node.type, port)
        : isInputNode(node.type) && port.toLowerCase() === 'out'
    ) && observed.has(mapping.signalName),
  ).map((mapping) => mapping.signalName));
  if (candidates.size === 1) return Array.from(candidates)[0];
  if (candidates.size > 1) return null;
  const endpoint = `${nodeId}.${port}`;
  return observed.has(endpoint) ? endpoint : null;
}

function detectClockEdge(
  waveform: readonly VerifyWaveSample[],
  clockSignal: string,
  tick: number,
): { edgeTick: number; edgeDirection: 'rising' | 'falling' } | null {
  // Sample ticks need not be consecutive. Report the latest observed rising transition;
  // a falling transition is valid stimulus but never a supported register capture.
  const samples = waveform.filter((sample) => sample.tick <= tick).sort((a, b) => a.tick - b.tick);
  for (let index = samples.length - 1; index > 0; index--) {
    if (samples[index - 1].signals[clockSignal] === '0' && samples[index].signals[clockSignal] === '1') {
      return { edgeTick: samples[index].tick, edgeDirection: 'rising' };
    }
  }
  return null;
}

function findSignalValueForNode(
  nodeId: string,
  mappings: readonly ExplainerSignalMapping[],
  waveform: readonly VerifyWaveSample[],
  tick: number,
  port: string,
  graph: ExplainerCircuitGraph,
): { signalName: string; value: string } | null {
  const signalName = findSignalForPort({ waveform, signalMappings: mappings }, graph, nodeId, port);
  if (!signalName) return null;
  const value = signalValueAt(waveform, signalName, tick);
  if (value === null) return null;
  return { signalName, value };
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
        driver.fromPort, graph,
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
          gateDriver.fromPort, graph,
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
    : `${input.selectedSignal} is ${currentValue} at tick ${input.tick}. The recorded output is unchanged; that does not imply its inputs were unchanged.`;

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
  sequentialPort: string,
  sequentialNodeId: string,
  sequentialNode: ExplainerCircuitGraph['nodes'][number],
): SignalExplanation {
  const steps: ExplanationStep[] = [];
  const sourceNodeIds: string[] = [sequentialNodeId];

  const ffLabel = getLabelOrType(sequentialNode);
  const ffDisplayName = getDisplayName(sequentialNode.type);
  const outputPort = sourcePortKey(sequentialNode.type, sequentialPort);
  const supportedCapture = sequentialNode.type === 'DFlipFlop' && ['q', 'q_inv'].includes(outputPort);

  steps.push({
    description: `${input.selectedSignal} is ${currentValue} at tick ${input.tick}.`,
  });

  if (changed && previousValue !== null) {
    steps.push({
      description: `It changed from ${previousValue} to ${currentValue}.`,
    });
  }

  steps.push({
    description: `${input.selectedSignal} is recorded from port ${sequentialPort} of ${ffDisplayName} (${ffLabel}).`,
    nodeType: sequentialNode.type,
    nodeLabel: sequentialNode.label,
    port: sequentialPort,
  });

  // Look for clock edge
  let relevantClockEdge: SignalExplanation['relevantClockEdge'];
  let relevantPriorState: SignalExplanation['relevantPriorState'];
  const clockDrivers = findDriverConnections(graph, sequentialNodeId)
    .filter((connection) => ['clk', 'clock', 'c'].includes(connection.toPort.toLowerCase()));
  const clockSignal = clockDrivers.length === 1
    ? findSignalForPort(input, graph, clockDrivers[0].fromNodeId, clockDrivers[0].fromPort)
    : null;

  if (supportedCapture && clockSignal) {
    sourceNodeIds.push(clockDrivers[0].fromNodeId);
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

      for (const dDriver of dDrivers.length === 1 ? dDrivers : []) {
        const dDriverNode = findNodeById(graph, dDriver.fromNodeId);
        if (!dDriverNode) continue;
        sourceNodeIds.push(dDriver.fromNodeId);

        const capturedTick = edge.edgeTick;
        const dValue = findSignalValueForNode(
          dDriver.fromNodeId, input.signalMappings, input.waveform, capturedTick,
          dDriver.fromPort, graph,
        );

        if (dValue) {
          steps.push({
            description: `The recorded D input is ${dValue.value} (from ${dValue.signalName}) at tick ${capturedTick}. Pre-capture setup history is not recorded.`,
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

      steps.push({ description: `This D flip-flop samples on rising edges. The recorded ${sequentialPort} value is ${currentValue}; this observation alone does not establish whether reset or enable affected the state.` });
    } else {
      steps.push({
        description: `No rising clock transition is available in the recording before tick ${input.tick}. Capture timing cannot be inferred from this trace.`,
      });
    }
  } else {
    steps.push({ description: supportedCapture
      ? 'No unique recorded driver of this flip-flop clock is available. Capture timing cannot be inferred from another clock signal.'
      : 'This stateful component is shown as structural context. Capture and reset behavior are not inferred for this component.' });
  }

  // Prior state reference
  if (previousValue !== null) {
    relevantPriorState = {
      signal: input.selectedSignal,
      value: previousValue,
      tick: input.waveform.filter((sample) => sample.tick < input.tick).sort((a, b) => b.tick - a.tick)[0]?.tick ?? input.tick,
    };
  }

  // Check for reset
  const resetConns = supportedCapture ? findDriverConnections(graph, sequentialNodeId)
    .filter((c) => ['rst', 'reset', 'clr'].includes(c.toPort.toLowerCase())) : [];

  for (const rstConn of resetConns.length === 1 ? resetConns : []) {
    const rstValue = findSignalValueForNode(
      rstConn.fromNodeId, input.signalMappings, input.waveform, input.tick,
      rstConn.fromPort, graph,
    );
    if (rstValue && rstValue.value === '1') {
      steps.push({
        description: `The reset driver ${rstValue.signalName} is recorded as 1 at tick ${input.tick}. This D flip-flop has an active-high clear on Q; ${sequentialPort} remains the selected recorded output.`,
      });
    }
  }

  const summary = changed
    ? `${input.selectedSignal} changed to ${currentValue} at tick ${input.tick}. Inspect the recorded clock and reset context below.`
    : `${input.selectedSignal} is ${currentValue} at tick ${input.tick}, driven by ${ffDisplayName}.`;

  return {
    selectedSignal: input.selectedSignal,
    tick: input.tick,
    currentValue,
    previousValue,
    changed,
    explanationKind: supportedCapture && clockSignal ? 'sequential' : 'partial',
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
  const previousSample = waveform.filter((sample) => sample.tick < tick).sort((a, b) => b.tick - a.tick)[0];
  const previousValue = previousSample?.signals[selectedSignal] ?? null;
  const changed = previousValue !== null && previousValue !== currentValue && currentValue !== '-';
  if (currentValue === '-') return {
    selectedSignal, tick, currentValue: 'Not recorded', previousValue: null, changed: false,
    explanationKind: 'partial', summary: `No observation of ${selectedSignal} is available at tick ${tick}.`,
    steps: [], sourceNodeIds: [],
  };

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
  const signalMapping = findSignalMapping(selectedSignal, signalMappings);
  if (!signalMapping) {
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
  const signalNodeId = signalMapping.nodeId;
  const signalNode = findNodeById(circuitGraph, signalNodeId);

  // An internal signal names the node's recorded output, not one of its inputs.
  if (signalNode && SEQUENTIAL_NODE_TYPES.has(signalNode.type) && signalMapping.port) {
    return buildSequentialExplanation(input, currentValue, previousValue, changed,
      circuitGraph, signalMapping.port, signalNode.id, signalNode);
  }

  // Walk backward from boundary node to find its driver
  const boundaryDrivers = findDriverConnections(circuitGraph, signalNodeId);

  // Only a unique direct connection to an output boundary preserves the selected
  // source value. A gate between a register and this signal may transform it.
  if (signalNode && isOutputNode(signalNode.type) && boundaryDrivers.length === 1) {
    const driver = boundaryDrivers[0];
    const driverNode = findNodeById(circuitGraph, driver.fromNodeId);
    if (driverNode && SEQUENTIAL_NODE_TYPES.has(driverNode.type)) {
      return buildSequentialExplanation(
        input, currentValue, previousValue, changed,
        circuitGraph, driver.fromPort, driver.fromNodeId, driverNode,
      );
    }
  }

  // Preserve every gate in the existing structural trace, but do not attribute
  // an indirect or competing driver to a register's captured value.
  let hasSequentialContext = false;
  for (const driver of boundaryDrivers) {
    const directNode = findNodeById(circuitGraph, driver.fromNodeId);
    if (directNode && SEQUENTIAL_NODE_TYPES.has(directNode.type)) hasSequentialContext = true;
    const midDrivers = findDriverConnections(circuitGraph, driver.fromNodeId);
    for (const midDriver of midDrivers) {
      const midNode = findNodeById(circuitGraph, midDriver.fromNodeId);
      if (midNode && SEQUENTIAL_NODE_TYPES.has(midNode.type)) hasSequentialContext = true;
    }
  }

  const structural = buildCombinationalExplanation(
    input, currentValue, previousValue, changed,
    circuitGraph, signalNodeId,
  );
  if (hasSequentialContext || boundaryDrivers.length > 1 && signalNode && isOutputNode(signalNode.type)) {
    return {
      ...structural,
      explanationKind: 'partial',
      summary: `${selectedSignal} is recorded as ${currentValue} at tick ${tick}. The upstream structure is shown below; capture timing and stored state are not inferred through this path.`,
      steps: [...structural.steps, { description: 'An indirect or ambiguous driver path cannot establish a direct register-output observation.' }],
    };
  }
  return structural;
}
