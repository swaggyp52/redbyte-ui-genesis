// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * IR Elaborator — Circuit → CircuitIR
 *
 * Transforms a raw Circuit graph into a validated, typed, net-named CircuitIR.
 * Elaboration always succeeds structurally: invalid circuits are represented
 * and diagnosed, not rejected at construction. All passes run in order and
 * accumulate diagnostics.
 *
 * Pass order:
 *  1.  Primitive resolution      — classify nodes as ports or primitives; IR001
 *  2-3. Net construction         — build named nets with multi-driver merging; IR002
 *  4.  Floating output check     — IR003
 *  5.  Clock binding             — sequential primitives get clockBinding; IR004
 *  6.  Reset binding             — sequential primitives get resetBinding (non-blocking)
 *  7.  Disconnected input check  — IR005 (warning, not blocking)
 *  8.  Combinational loop detect — sets features.hasCombinationalLoop
 *  9.  Features summary          — IRFeatures
 *  10. isValid / blocking count
 *  11. irHash                    — deterministic, timestamp-excluded
 */

import type { Circuit, Connection, Node, PortRef } from '../types';
import {
  isSequentialNodeType,
  getClockPortName,
  getResetPortName,
} from '../analysis/nodeMetaRegistry';
import type {
  CircuitIR,
  ElaborationResult,
  IRDiagnostic,
  IRFeatures,
  IRNet,
  IRNetEndpoint,
  IRPort,
  IRPortKind,
  IRPrimitive,
  IRPrimitiveType,
} from './circuitIR';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Full set of known primitive types (must match IRPrimitiveType union). */
const VALID_PRIMITIVE_TYPES = new Set<string>([
  'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR',
  'AND3', 'OR3', 'NAND3', 'NOR3', 'XOR3',
  'FullAdder', 'MUX4',
  'DFlipFlop', 'Register1', 'RegisterBus', 'StateBank', 'DLatch', 'TFlipFlop', 'JKFlipFlop', 'Counter4Bit', 'Delay',
  'INPUT', 'OUTPUT', 'Switch', 'Clock', 'PowerSource', 'Ground', 'Lamp',
  'Wire',
]);

/** Node types that become IRPorts (design-level I/O boundary). */
const BOUNDARY_TYPES = new Set<string>(['INPUT', 'OUTPUT', 'Switch', 'Clock', 'Lamp', 'Wire']);

const PORT_KIND_MAP: Partial<Record<string, IRPortKind>> = {
  INPUT:  'input',
  Switch: 'input',
  Wire:   'input',
  OUTPUT: 'output',
  Lamp:   'output',
  Clock:  'clock',
};

/**
 * Required input ports per internal primitive type.
 * Used for IR005 (disconnected required input) check.
 * Clock and reset ports are included here so we can skip them in IR005
 * (IR004 already covers missing clock; reset is optional).
 * Boundary types (INPUT/OUTPUT/Switch/Clock/Lamp) are excluded — they are
 * IRPorts, not IRPrimitives.
 */
const PRIMITIVE_REQUIRED_INPUTS: Partial<Record<string, string[]>> = {
  AND:         ['a', 'b'],
  OR:          ['a', 'b'],
  NOT:         ['in'],
  NAND:        ['a', 'b'],
  NOR:         ['a', 'b'],
  XOR:         ['a', 'b'],
  XNOR:        ['a', 'b'],
  AND3:        ['a', 'b', 'c'],
  OR3:         ['a', 'b', 'c'],
  NAND3:       ['a', 'b', 'c'],
  NOR3:        ['a', 'b', 'c'],
  XOR3:        ['a', 'b', 'c'],
  FullAdder:   ['a', 'b', 'cin'],
  MUX4:        ['i0', 'i1', 'i2', 'i3', 's0', 's1'],
  DFlipFlop:   ['D', 'CLK'],
  Register1:   ['D', 'CLK'],
  RegisterBus: ['D', 'CLK'],
  StateBank:   ['D', 'CLK'],
  DLatch:      ['D', 'EN'],
  TFlipFlop:   ['T', 'CLK'],
  JKFlipFlop:  ['J', 'K', 'CLK'],
  Counter4Bit: ['CLK'],
  Delay:       ['in'],
  PowerSource: [],
  Ground:      [],
  UNKNOWN:     [],
};

// ---------------------------------------------------------------------------
// Optional pin mapping type (no cross-package dependency)
// ---------------------------------------------------------------------------

/**
 * Optional physical pin assignments for boundary ports.
 * nodeId → physical pin string (e.g., "V17" for Basys3 SW0).
 */
export interface PinMapping {
  pins?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Connection normalization
// ---------------------------------------------------------------------------

/** Local normalizer — same resolution logic as CircuitEngine.normalizeConnection(). */
function normalizeConn(conn: Connection): { from: PortRef; to: PortRef } | null {
  try {
    const fromIsString = typeof conn.from === 'string';
    const toIsString   = typeof conn.to   === 'string';

    const fromNodeId = fromIsString
      ? (conn.from as string)
      : (conn.from as PortRef).nodeId;
    const toNodeId = toIsString
      ? (conn.to as string)
      : (conn.to as PortRef).nodeId;

    if (!fromNodeId || !toNodeId) return null;

    const fromPortName = fromIsString
      ? ((conn as any).fromPin ?? (conn as any).fromPort ?? 'out')
      : ((conn.from as PortRef).portName ??
         (conn.from as PortRef).port ??
         (conn as any).fromPin ??
         (conn as any).fromPort ??
         'out');

    const toPortName = toIsString
      ? ((conn as any).toPin ?? (conn as any).toPort ?? 'in')
      : ((conn.to as PortRef).portName ??
         (conn.to as PortRef).port ??
         (conn as any).toPin ??
         (conn as any).toPort ??
         'in');

    return {
      from: { nodeId: fromNodeId, portName: fromPortName },
      to:   { nodeId: toNodeId,   portName: toPortName   },
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hashing (djb2 variant, deterministic, no crypto dependency)
// ---------------------------------------------------------------------------

function djb2Hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Compute a topology-stable irHash.
 * Input ordering is normalized: primitives and nets are sorted, endpoints
 * within each net are sorted. Timestamps and positions are excluded.
 */
function computeIrHash(primitives: IRPrimitive[], nets: IRNet[]): string {
  const primPart = [...primitives]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(p => `${p.id}:${p.type}`);

  const netPart = [...nets]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(n => {
      const drivers = [...n.drivers]
        .sort((a, b) => `${a.nodeId}.${a.port}`.localeCompare(`${b.nodeId}.${b.port}`))
        .map(d => `${d.nodeId}.${d.port}`);
      const sinks = [...n.sinks]
        .sort((a, b) => `${a.nodeId}.${a.port}`.localeCompare(`${b.nodeId}.${b.port}`))
        .map(s => `${s.nodeId}.${s.port}`);
      return `${n.name}[${drivers.join(',')}→${sinks.join(',')}]`;
    });

  return djb2Hash(JSON.stringify({ prims: primPart, nets: netPart }));
}

// ---------------------------------------------------------------------------
// Net name derivation
// ---------------------------------------------------------------------------

/**
 * Derive a stable net name from the driver endpoint.
 *
 * Priority:
 *  1. Boundary port (INPUT/Switch/Clock/Lamp) with a non-empty label → use label
 *  2. Boundary port without label → use node id
 *  3. Internal primitive → deterministic hash of driver key
 */
function deriveNetName(driver: IRNetEndpoint, nodeMap: Map<string, Node>): string {
  const node = nodeMap.get(driver.nodeId);
  if (node && BOUNDARY_TYPES.has(node.type)) {
    const label = node.label?.trim();
    if (label && label.length > 0) return label;
    return node.id;
  }
  return `net_${djb2Hash(`${driver.nodeId}.${driver.port}`)}`;
}

// ---------------------------------------------------------------------------
// Combinational loop detection
// ---------------------------------------------------------------------------

interface CombinationalLoopResult {
  hasLoop: boolean;
  /** Node IDs participating in the first detected cycle (empty when no loop). */
  cycleNodeIds: string[];
}

/**
 * Detect cycles in the combinational subgraph.
 * Sequential primitives break cycle traversal at their state boundary.
 * Returns the node IDs in the first detected cycle for diagnostic localization.
 */
function detectCombinationalLoop(
  nodes: Node[],
  normedConns: Array<{ from: PortRef; to: PortRef }>,
): CombinationalLoopResult {
  // Only traverse combinational nodes
  const combNodeIds = new Set<string>(
    nodes.filter(n => !isSequentialNodeType(n.type)).map(n => n.id)
  );

  // Build combinational-only adjacency
  const adj = new Map<string, Set<string>>();
  for (const id of combNodeIds) adj.set(id, new Set());

  for (const conn of normedConns) {
    const { from, to } = conn;
    if (combNodeIds.has(from.nodeId) && combNodeIds.has(to.nodeId)) {
      adj.get(from.nodeId)!.add(to.nodeId);
    }
  }

  // DFS cycle detection with path tracking
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): string[] | null {
    if (inStack.has(nodeId)) {
      // Extract cycle from path
      const cycleStart = path.indexOf(nodeId);
      return cycleStart >= 0 ? path.slice(cycleStart) : [nodeId];
    }
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);
    for (const next of (adj.get(nodeId) ?? [])) {
      const cycle = dfs(next);
      if (cycle) return cycle;
    }
    path.pop();
    inStack.delete(nodeId);
    return null;
  }

  for (const id of combNodeIds) {
    if (!visited.has(id)) {
      const cycle = dfs(id);
      if (cycle) return { hasLoop: true, cycleNodeIds: cycle };
    }
  }
  return { hasLoop: false, cycleNodeIds: [] };
}

// ---------------------------------------------------------------------------
// Net construction with multi-driver merging
// ---------------------------------------------------------------------------

interface MultiDriverRecord {
  netName: string;
  sinkKey: string;
  drivers: IRNetEndpoint[];
}

interface NetBuildResult {
  nets: IRNet[];
  multiDriverRecords: MultiDriverRecord[];
}

/**
 * Build IRNets from normalized connections.
 *
 * Algorithm:
 *  - One net per unique driver endpoint (handles fanout naturally).
 *  - Sinks with multiple drivers are detected; their nets are merged into
 *    a single conflict net with drivers.length >= 2 (IR002 shape).
 *  - Union-find groups overlapping conflicts so chained multi-driver sinks
 *    are merged into one net.
 */
function buildNets(
  normedConns: Array<{ from: PortRef; to: PortRef }>,
  nodeMap: Map<string, Node>,
): NetBuildResult {
  // Phase 1: collect by driver and by sink
  const byDriver = new Map<
    string,
    { driver: IRNetEndpoint; sinks: IRNetEndpoint[] }
  >();
  const bySink = new Map<string, string[]>();   // sinkKey → driverKeys[]

  for (const conn of normedConns) {
    const dk = `${conn.from.nodeId}.${conn.from.portName}`;
    const sk = `${conn.to.nodeId}.${conn.to.portName}`;

    if (!byDriver.has(dk)) {
      byDriver.set(dk, {
        driver: { nodeId: conn.from.nodeId, port: conn.from.portName },
        sinks: [],
      });
    }
    const entry = byDriver.get(dk)!;
    if (!entry.sinks.some(s => s.nodeId === conn.to.nodeId && s.port === conn.to.portName)) {
      entry.sinks.push({ nodeId: conn.to.nodeId, port: conn.to.portName });
    }

    if (!bySink.has(sk)) bySink.set(sk, []);
    const sinkDrivers = bySink.get(sk)!;
    if (!sinkDrivers.includes(dk)) sinkDrivers.push(dk);
  }

  // Phase 2: union-find over conflicting driver groups
  const parent = new Map<string, string>();
  const ufFind = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, ufFind(parent.get(x)!));
    return parent.get(x)!;
  };
  const ufUnion = (a: string, b: string): void => {
    const ra = ufFind(a), rb = ufFind(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const conflictedDriverKeys = new Set<string>();
  for (const [, drivers] of bySink) {
    if (drivers.length > 1) {
      for (let i = 1; i < drivers.length; i++) ufUnion(drivers[0], drivers[i]);
      for (const dk of drivers) conflictedDriverKeys.add(dk);
    }
  }

  // Phase 3: group conflicted drivers by union-find root
  const mergeGroups = new Map<string, string[]>();
  for (const dk of conflictedDriverKeys) {
    const root = ufFind(dk);
    if (!mergeGroups.has(root)) mergeGroups.set(root, []);
    mergeGroups.get(root)!.push(dk);
  }

  // Phase 4: build final nets
  const nets: IRNet[] = [];
  const multiDriverRecords: MultiDriverRecord[] = [];
  const addedConflictNetNames = new Set<string>();

  for (const [, driverKeys] of mergeGroups) {
    const sortedKeys = [...driverKeys].sort();
    const netName = `net_conflict_${djb2Hash(sortedKeys.join('|'))}`;
    if (addedConflictNetNames.has(netName)) continue;
    addedConflictNetNames.add(netName);

    const mergedDrivers: IRNetEndpoint[] = sortedKeys
      .map(dk => byDriver.get(dk)!.driver)
      .sort((a, b) => `${a.nodeId}.${a.port}`.localeCompare(`${b.nodeId}.${b.port}`));

    const mergedSinksMap = new Map<string, IRNetEndpoint>();
    for (const dk of driverKeys) {
      for (const sink of byDriver.get(dk)!.sinks) {
        mergedSinksMap.set(`${sink.nodeId}.${sink.port}`, sink);
      }
    }

    nets.push({
      name: netName,
      signalType: { width: 1 },
      drivers: mergedDrivers,
      sinks: Array.from(mergedSinksMap.values()),
    });

    // Record each multi-driver sink for IR002 diagnostics
    for (const [sinkKey, drivers] of bySink) {
      if (drivers.length > 1 && drivers.some(dk => driverKeys.includes(dk))) {
        // Avoid duplicate records for the same sink
        if (!multiDriverRecords.some(r => r.sinkKey === sinkKey)) {
          multiDriverRecords.push({ netName, sinkKey, drivers: mergedDrivers });
        }
      }
    }
  }

  // Normal (non-conflicted) nets
  for (const [driverKey, { driver, sinks }] of byDriver) {
    if (conflictedDriverKeys.has(driverKey)) continue;
    nets.push({
      name: deriveNetName(driver, nodeMap),
      signalType: { width: 1 },
      drivers: [driver],
      sinks: [...sinks],
    });
  }

  return { nets, multiDriverRecords };
}

// ---------------------------------------------------------------------------
// Main elaboration function
// ---------------------------------------------------------------------------

/**
 * Elaborate a raw Circuit into a validated CircuitIR.
 *
 * Always returns a structurally complete ElaborationResult.
 * Invalid circuits are represented and diagnosed via ir.diagnostics.
 */
export function elaborateCircuit(
  circuit: Circuit,
  pinMapping?: PinMapping,
): ElaborationResult {
  const diagnostics: IRDiagnostic[] = [];

  const nodes       = Array.isArray(circuit?.nodes)       ? circuit.nodes       : [];
  const connections = Array.isArray(circuit?.connections) ? circuit.connections : [];

  // Build fast-lookup maps
  const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]));

  // Normalize connections (skip malformed ones silently)
  const normedConns: Array<{ from: PortRef; to: PortRef }> = [];
  for (const conn of connections) {
    const n = normalizeConn(conn);
    if (n) normedConns.push(n);
  }

  // ─── Pass 1: Primitive resolution ─────────────────────────────────────────

  const ports: IRPort[] = [];
  const primitives: IRPrimitive[] = [];

  for (const node of nodes) {
    if (node.type === 'Clock' && node.config?.role === 'sim') {
      // Sim-only clock (role:'sim'): browser oscillator with no hardware counterpart.
      // Treated as an internal primitive so it drives DFFs in simulation, but is NOT
      // promoted to an IRPort → does not become a VHDL top-level entity port.
      // Students who want board synthesis must replace this with CLK100MHZ (role:'board').
      primitives.push({
        id: node.id,
        sourceNodeId: node.id,
        type: 'Clock',
        label: node.label,
      });
    } else if (BOUNDARY_TYPES.has(node.type)) {
      // Boundary port → IRPort
      const kind: IRPortKind = PORT_KIND_MAP[node.type] ?? 'input';
      const name = node.label?.trim() || node.id;
      ports.push({
        id: node.id,
        sourceNodeId: node.id,
        name,
        kind,
        signalType: { width: 1 },
        physicalPin: pinMapping?.pins?.[node.id],
      });
    } else {
      // Internal element → IRPrimitive
      const isKnown = VALID_PRIMITIVE_TYPES.has(node.type);
      if (!isKnown) {
        diagnostics.push({
          code: 'IR001',
          severity: 'error',
          message: `Unknown primitive type '${node.type}' on node '${node.id}'`,
          nodeId: node.id,
        });
      }
      const primType: IRPrimitiveType = isKnown
        ? (node.type as IRPrimitiveType)
        : 'UNKNOWN';
      primitives.push({
        id: node.id,
        sourceNodeId: node.id,
        type: primType,
        label: node.label,
      });
    }
  }

  // ─── Pass 2–3: Net construction ────────────────────────────────────────────

  const { nets, multiDriverRecords } = buildNets(normedConns, nodeMap);

  // IR002: emit one diagnostic per conflicted sink
  for (const record of multiDriverRecords) {
    diagnostics.push({
      code: 'IR002',
      severity: 'error',
      message: `Multiple drivers on net '${record.netName}' (sink: ${record.sinkKey})`,
      netName: record.netName,
    });
  }

  // ─── Pass 4: Floating output check (IR003) ─────────────────────────────────

  // Build set of all sink keys that have at least one driver
  const drivenSinks = new Set<string>(
    normedConns.map(c => `${c.to.nodeId}.${c.to.portName}`)
  );

  const outputPorts = ports.filter(p => p.kind === 'output');
  for (const port of outputPorts) {
    const sinkKey = `${port.sourceNodeId}.in`;
    if (!drivenSinks.has(sinkKey)) {
      diagnostics.push({
        code: 'IR003',
        severity: 'warning',
        message: `Output port '${port.name}' (node '${port.sourceNodeId}') has no driver`,
        nodeId: port.sourceNodeId,
        port: 'in',
      });
    }
  }

  // ─── Pass 5: Clock binding (IR004) ────────────────────────────────────────

  for (const prim of primitives) {
    if (!isSequentialNodeType(prim.type)) continue;
    const clockPort = getClockPortName(prim.type);
    if (!clockPort) continue; // e.g., RSLatch has no dedicated clock port

    const clockSinkKey = `${prim.id}.${clockPort}`;
    if (!drivenSinks.has(clockSinkKey)) {
      diagnostics.push({
        code: 'IR004',
        severity: 'error',
        message: `Sequential primitive '${prim.id}' (${prim.type}) is missing a clock driver on port '${clockPort}'`,
        nodeId: prim.id,
        port: clockPort,
      });
    } else {
      // Find the net that drives this clock port and set clockBinding
      for (const net of nets) {
        if (net.sinks.some(s => s.nodeId === prim.id && s.port === clockPort)) {
          prim.clockBinding = net.name;
          break;
        }
      }
    }
  }

  // ─── Pass 6: Reset binding (non-blocking) ─────────────────────────────────

  for (const prim of primitives) {
    if (!isSequentialNodeType(prim.type)) continue;
    const resetPort = getResetPortName(prim.type);
    if (!resetPort) continue;

    const resetSinkKey = `${prim.id}.${resetPort}`;
    if (drivenSinks.has(resetSinkKey)) {
      for (const net of nets) {
        if (net.sinks.some(s => s.nodeId === prim.id && s.port === resetPort)) {
          prim.resetBinding = net.name;
          break;
        }
      }
    }
  }

  // ─── Pass 7: Disconnected required input check (IR005, warning) ────────────

  for (const prim of primitives) {
    const requiredInputs = PRIMITIVE_REQUIRED_INPUTS[prim.type] ?? [];
    const clockPort = getClockPortName(prim.type);
    const resetPort = getResetPortName(prim.type);

    for (const reqPort of requiredInputs) {
      // Skip clock/reset ports — IR004 covers clock; reset is optional
      if (reqPort === clockPort || reqPort === resetPort) continue;

      const sinkKey = `${prim.id}.${reqPort}`;
      if (!drivenSinks.has(sinkKey)) {
        diagnostics.push({
          code: 'IR005',
          severity: 'warning',
          message: `Primitive '${prim.id}' (${prim.type}) has unconnected required input port '${reqPort}'`,
          nodeId: prim.id,
          port: reqPort,
        });
      }
    }
  }

  // ─── Pass 8: Combinational loop detection ─────────────────────────────────

  const loopResult = detectCombinationalLoop(nodes, normedConns);
  const hasCombinationalLoop = loopResult.hasLoop;

  // IR006: combinational loop detected
  if (hasCombinationalLoop) {
    const cycleLabels = loopResult.cycleNodeIds
      .map(id => nodeMap.get(id)?.label || id)
      .join(' → ');
    diagnostics.push({
      code: 'IR006',
      severity: 'error',
      message: `Combinational feedback loop detected: ${cycleLabels}. Use a DFlipFlop, DLatch, or RSLatch to break the loop.`,
      nodeId: loopResult.cycleNodeIds[0],
    });
  }

  // ─── Pass 9: Features summary ──────────────────────────────────────────────

  const clockNets = nets.filter(n =>
    n.sinks.some(s => {
      const node = nodeMap.get(s.nodeId);
      return node && isSequentialNodeType(node.type) && getClockPortName(node.type) === s.port;
    })
  );
  const resetNets = nets.filter(n =>
    n.sinks.some(s => {
      const node = nodeMap.get(s.nodeId);
      return node && isSequentialNodeType(node.type) && getResetPortName(node.type) === s.port;
    })
  );

  // Also include Clock-port IRPorts as clock nets (the nets driven by Clock boundary nodes)
  const clockPortDriverNets = nets.filter(n =>
    n.drivers.some(d => {
      const node = nodeMap.get(d.nodeId);
      return node && node.type === 'Clock';
    })
  );
  const allClockNetNames = Array.from(
    new Set([...clockNets.map(n => n.name), ...clockPortDriverNets.map(n => n.name)])
  );

  const features: IRFeatures = {
    hasSequentialLogic:  primitives.some(p => isSequentialNodeType(p.type)),
    hasCombinationalLoop,
    hasMultipleDrivers:  multiDriverRecords.length > 0,
    hasFloatingOutputs:  outputPorts.some(p => !drivenSinks.has(`${p.sourceNodeId}.in`)),
    clockNetNames:       allClockNetNames,
    resetNetNames:       resetNets.map(n => n.name),
  };

  // ─── Pass 10: isValid / blockingDiagnosticCount ───────────────────────────

  const blockingDiagnosticCount = diagnostics.filter(d => d.severity === 'error').length;
  const isValid = blockingDiagnosticCount === 0;

  // ─── Pass 11: irHash ──────────────────────────────────────────────────────

  const irHash = computeIrHash(primitives, nets);

  // ─── Assemble final IR ────────────────────────────────────────────────────

  const inputs  = ports.filter(p => p.kind === 'input');
  const outputs = ports.filter(p => p.kind === 'output');
  const clocks  = ports.filter(p => p.kind === 'clock');
  const resets  = ports.filter(p => p.kind === 'reset');

  const ir: CircuitIR = {
    schemaVersion: 'rb.circuit-ir.v2',
    irHash,
    ports,
    inputs,
    outputs,
    clocks,
    resets,
    primitives,
    nets,
    diagnostics,
    blockingDiagnosticCount,
    features,
    isValid,
  };

  return { ir, diagnostics, elaboratedAt: new Date().toISOString() };
}
