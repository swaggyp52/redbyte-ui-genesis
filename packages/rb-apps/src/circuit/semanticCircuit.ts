import type { Circuit, Connection } from '@redbyte/rb-logic-core';

interface PortRef {
  nodeId: string;
  portName: string;
}

interface NormalizedConnection {
  from: PortRef;
  to: PortRef;
}

interface DlatchReplacement {
  removedNodeIds: Set<string>;
  replacementNode: Circuit['nodes'][number];
  replacementConnections: Connection[];
}

interface DlatchMatchInput {
  qNodeId: string;
  qInvNodeId: string;
  qExternal: NormalizedConnection;
  qInvExternal: NormalizedConnection;
  nodeById: Map<string, Circuit['nodes'][number]>;
  incomingByNode: Map<string, NormalizedConnection[]>;
  outgoingByNode: Map<string, NormalizedConnection[]>;
}

export function canonicalizeSemanticCircuit(circuit: Circuit): Circuit {
  if (!Array.isArray(circuit.nodes) || circuit.nodes.length === 0) return circuit;
  if (!Array.isArray(circuit.connections) || circuit.connections.length === 0) return circuit;

  const nodeById = new Map(circuit.nodes.map((node) => [node.id, node] as const));
  const normalizedConnections = circuit.connections
    .map(normalizeConnection)
    .filter((entry): entry is NormalizedConnection => entry !== null);

  if (normalizedConnections.length === 0) return circuit;

  const incomingByNode = new Map<string, NormalizedConnection[]>();
  const outgoingByNode = new Map<string, NormalizedConnection[]>();
  for (const connection of normalizedConnections) {
    const incoming = incomingByNode.get(connection.to.nodeId) ?? [];
    incoming.push(connection);
    incomingByNode.set(connection.to.nodeId, incoming);

    const outgoing = outgoingByNode.get(connection.from.nodeId) ?? [];
    outgoing.push(connection);
    outgoingByNode.set(connection.from.nodeId, outgoing);
  }

  const nandNodeIds = circuit.nodes
    .filter((node) => node.type === 'NAND')
    .map((node) => node.id)
    .sort(compareText);

  const replacements: DlatchReplacement[] = [];
  const consumedNodeIds = new Set<string>();

  for (let leftIndex = 0; leftIndex < nandNodeIds.length; leftIndex += 1) {
    const leftId = nandNodeIds[leftIndex];
    if (consumedNodeIds.has(leftId)) continue;

    for (let rightIndex = leftIndex + 1; rightIndex < nandNodeIds.length; rightIndex += 1) {
      const rightId = nandNodeIds[rightIndex];
      if (consumedNodeIds.has(rightId)) continue;
      if (!isCrossCoupledPair(leftId, rightId, outgoingByNode)) continue;

      const leftExternal = getSingleExternalInput(leftId, rightId, incomingByNode);
      const rightExternal = getSingleExternalInput(rightId, leftId, incomingByNode);
      if (!leftExternal || !rightExternal) continue;

      const match =
        tryMatchFourNandDlatch({
          qNodeId: leftId,
          qInvNodeId: rightId,
          qExternal: leftExternal,
          qInvExternal: rightExternal,
          nodeById,
          incomingByNode,
          outgoingByNode,
        }) ??
        tryMatchFourNandDlatch({
          qNodeId: rightId,
          qInvNodeId: leftId,
          qExternal: rightExternal,
          qInvExternal: leftExternal,
          nodeById,
          incomingByNode,
          outgoingByNode,
        });

      if (!match) continue;

      replacements.push(match);
      for (const nodeId of match.removedNodeIds) {
        consumedNodeIds.add(nodeId);
      }
      break;
    }
  }

  if (replacements.length === 0) return circuit;

  const removedNodeIds = new Set<string>();
  for (const replacement of replacements) {
    for (const nodeId of replacement.removedNodeIds) {
      removedNodeIds.add(nodeId);
    }
  }

  const nextNodes = [
    ...circuit.nodes
      .filter((node) => !removedNodeIds.has(node.id))
      .map(cloneNode),
    ...replacements
      .map((replacement) => cloneNode(replacement.replacementNode))
      .sort((left, right) => compareText(left.id, right.id)),
  ];

  const nextConnections = [
    ...circuit.connections.filter((connection) => {
      const normalized = normalizeConnection(connection);
      if (!normalized) return true;
      return (
        !removedNodeIds.has(normalized.from.nodeId) &&
        !removedNodeIds.has(normalized.to.nodeId)
      );
    }).map(cloneConnection),
    ...replacements.flatMap((replacement) =>
      replacement.replacementConnections.map(cloneConnection)
    ),
  ].sort(compareConnection);

  return {
    ...circuit,
    nodes: nextNodes,
    connections: nextConnections,
  };
}

function tryMatchFourNandDlatch(input: DlatchMatchInput): DlatchReplacement | null {
  const {
    qNodeId,
    qInvNodeId,
    qExternal,
    qInvExternal,
    nodeById,
    incomingByNode,
    outgoingByNode,
  } = input;

  const setGateId = qExternal.from.nodeId;
  const holdGateId = qInvExternal.from.nodeId;
  if (setGateId === holdGateId) return null;

  const setGate = nodeById.get(setGateId);
  const holdGate = nodeById.get(holdGateId);
  if (setGate?.type !== 'NAND' || holdGate?.type !== 'NAND') return null;

  const removedNodeIds = new Set([qNodeId, qInvNodeId, setGateId, holdGateId]);
  const holdGateInputs = incomingByNode.get(holdGateId) ?? [];
  if (holdGateInputs.length !== 2) return null;

  const holdGateFromSet = holdGateInputs.filter((edge) => edge.from.nodeId === setGateId);
  const holdGateExternal = holdGateInputs.filter((edge) => edge.from.nodeId !== setGateId);
  if (holdGateFromSet.length !== 1 || holdGateExternal.length !== 1) return null;

  const setGateInputs = incomingByNode.get(setGateId) ?? [];
  if (setGateInputs.length !== 2) return null;

  const enableEdge = setGateInputs.find((edge) =>
    sameSource(edge, holdGateExternal[0])
  );
  if (!enableEdge) return null;

  const dataEdge = setGateInputs.find((edge) => !sameSource(edge, enableEdge));
  if (!dataEdge) return null;

  if (
    removedNodeIds.has(enableEdge.from.nodeId) ||
    removedNodeIds.has(dataEdge.from.nodeId)
  ) {
    return null;
  }

  if (hasExternalConsumers(setGateId, removedNodeIds, outgoingByNode)) return null;
  if (hasExternalConsumers(holdGateId, removedNodeIds, outgoingByNode)) return null;

  const qConsumers = (outgoingByNode.get(qNodeId) ?? []).filter(
    (edge) => !removedNodeIds.has(edge.to.nodeId)
  );
  const qInvConsumers = (outgoingByNode.get(qInvNodeId) ?? []).filter(
    (edge) => !removedNodeIds.has(edge.to.nodeId)
  );

  const replacementNodeId = buildSemanticNodeId(
    'dlatch',
    [qNodeId, qInvNodeId, setGateId, holdGateId]
  );
  const replacementNode: Circuit['nodes'][number] = {
    id: replacementNodeId,
    type: 'DLatch',
    position: averagePosition([qNodeId, qInvNodeId, setGateId, holdGateId], nodeById),
    rotation: 0,
    config: {},
    state: {},
  };

  const replacementConnections: Connection[] = [
    makeConnection(dataEdge.from.nodeId, dataEdge.from.portName, replacementNodeId, 'D'),
    makeConnection(enableEdge.from.nodeId, enableEdge.from.portName, replacementNodeId, 'EN'),
    ...qConsumers.map((edge) =>
      makeConnection(replacementNodeId, 'Q', edge.to.nodeId, edge.to.portName)
    ),
    ...qInvConsumers.map((edge) =>
      makeConnection(replacementNodeId, 'Q_inv', edge.to.nodeId, edge.to.portName)
    ),
  ];

  return {
    removedNodeIds,
    replacementNode,
    replacementConnections,
  };
}

function getSingleExternalInput(
  nodeId: string,
  feedbackNodeId: string,
  incomingByNode: Map<string, NormalizedConnection[]>
): NormalizedConnection | null {
  const incoming = incomingByNode.get(nodeId) ?? [];
  if (incoming.length !== 2) return null;

  const feedbackEdges = incoming.filter((edge) => edge.from.nodeId === feedbackNodeId);
  const externalEdges = incoming.filter((edge) => edge.from.nodeId !== feedbackNodeId);
  if (feedbackEdges.length !== 1 || externalEdges.length !== 1) return null;

  return externalEdges[0];
}

function isCrossCoupledPair(
  leftNodeId: string,
  rightNodeId: string,
  outgoingByNode: Map<string, NormalizedConnection[]>
): boolean {
  const leftToRight = (outgoingByNode.get(leftNodeId) ?? []).some(
    (edge) => edge.to.nodeId === rightNodeId
  );
  const rightToLeft = (outgoingByNode.get(rightNodeId) ?? []).some(
    (edge) => edge.to.nodeId === leftNodeId
  );
  return leftToRight && rightToLeft;
}

function hasExternalConsumers(
  nodeId: string,
  removedNodeIds: Set<string>,
  outgoingByNode: Map<string, NormalizedConnection[]>
): boolean {
  return (outgoingByNode.get(nodeId) ?? []).some(
    (edge) => !removedNodeIds.has(edge.to.nodeId)
  );
}

function averagePosition(
  nodeIds: string[],
  nodeById: Map<string, Circuit['nodes'][number]>
): { x: number; y: number } {
  let count = 0;
  let totalX = 0;
  let totalY = 0;
  for (const nodeId of nodeIds) {
    const position = nodeById.get(nodeId)?.position;
    if (!position) continue;
    totalX += Number.isFinite(position.x) ? position.x : 0;
    totalY += Number.isFinite(position.y) ? position.y : 0;
    count += 1;
  }
  if (count === 0) return { x: 0, y: 0 };
  return {
    x: totalX / count,
    y: totalY / count,
  };
}

function buildSemanticNodeId(prefix: string, nodeIds: string[]): string {
  return `__semantic_${prefix}_${nodeIds.slice().sort(compareText).join('_')}`;
}

function sameSource(left: NormalizedConnection, right: NormalizedConnection): boolean {
  return left.from.nodeId === right.from.nodeId && left.from.portName === right.from.portName;
}

function normalizeConnection(connection: Connection): NormalizedConnection | null {
  const from = toPortRef(connection.from);
  const to = toPortRef(connection.to);
  if (!from || !to) return null;
  return { from, to };
}

function toPortRef(
  ref: Connection['from'] | Connection['to']
): PortRef | null {
  if (!ref || typeof ref === 'string') return null;
  const nodeId = typeof ref.nodeId === 'string' ? ref.nodeId.trim() : '';
  const portName =
    typeof ref.portName === 'string'
      ? ref.portName.trim()
      : typeof (ref as { port?: string }).port === 'string'
        ? ((ref as { port?: string }).port ?? '').trim()
        : '';
  if (!nodeId || !portName) return null;
  return { nodeId, portName };
}

function makeConnection(
  fromNodeId: string,
  fromPortName: string,
  toNodeId: string,
  toPortName: string
): Connection {
  return {
    from: { nodeId: fromNodeId, portName: fromPortName },
    to: { nodeId: toNodeId, portName: toPortName },
  };
}

function cloneNode(node: Circuit['nodes'][number]): Circuit['nodes'][number] {
  return {
    ...node,
    position: node.position ? { ...node.position } : node.position,
    config: node.config ? { ...node.config } : {},
    state: node.state ? { ...node.state } : {},
  };
}

function cloneConnection(connection: Connection): Connection {
  return {
    ...connection,
    from:
      typeof connection.from === 'string'
        ? connection.from
        : { ...connection.from },
    to:
      typeof connection.to === 'string'
        ? connection.to
        : { ...connection.to },
  };
}

function compareConnection(left: Connection, right: Connection): number {
  const leftNormalized = normalizeConnection(left);
  const rightNormalized = normalizeConnection(right);
  if (!leftNormalized || !rightNormalized) {
    return compareText(JSON.stringify(left), JSON.stringify(right));
  }
  return (
    compareText(leftNormalized.from.nodeId, rightNormalized.from.nodeId) ||
    compareText(leftNormalized.from.portName, rightNormalized.from.portName) ||
    compareText(leftNormalized.to.nodeId, rightNormalized.to.nodeId) ||
    compareText(leftNormalized.to.portName, rightNormalized.to.portName)
  );
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
