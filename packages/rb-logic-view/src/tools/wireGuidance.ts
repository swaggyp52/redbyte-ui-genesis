// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Node, PortRef } from '@redbyte/rb-logic-core';
import type { ChipMetadata } from '../components/NodeView';
import { isInputPort } from './wireValidation';

type ChipMetadataResolver = (nodeType: string, node?: Node) => ChipMetadata | undefined;

function getPortName(port: PortRef): string {
  return port.portName ?? (port as { port?: string }).port ?? 'port';
}

function findPortLabel(metadata: ChipMetadata | undefined, portName: string): string {
  const input = metadata?.inputs.find((entry) => entry.id === portName);
  if (input?.name) return input.name;
  const output = metadata?.outputs.find((entry) => entry.id === portName);
  if (output?.name) return output.name;
  return portName;
}

function nodeDisplayName(node: Node | undefined, metadata: ChipMetadata | undefined): string {
  const label = typeof node?.label === 'string' ? node.label.trim() : '';
  if (label.length > 0) return label;
  if (metadata?.name) return metadata.name;
  return node?.type ?? 'Unknown node';
}

export function describePortRefForStudents(
  circuit: Circuit,
  port: PortRef | null | undefined,
  getChipMetadata?: ChipMetadataResolver
): string {
  if (!port) return 'No source';

  const node = circuit.nodes.find((entry) => entry.id === port.nodeId);
  const metadata = node ? getChipMetadata?.(node.type, node) : undefined;
  const portName = getPortName(port);
  return `${nodeDisplayName(node, metadata)} ${findPortLabel(metadata, portName)}`;
}

export function describeWireSourceCue(
  circuit: Circuit,
  source: PortRef | null | undefined,
  getChipMetadata?: ChipMetadataResolver
): string {
  if (!source) return 'Click any port to start a wire.';

  const portName = getPortName(source);
  const direction = isInputPort(source.nodeId, portName, circuit, getChipMetadata) ? 'input' : 'output';
  return `Source: ${describePortRefForStudents(circuit, source, getChipMetadata)} (${direction}). Click a green target port; Esc cancels.`;
}

export function wireRejectionMessage(reason: string): string {
  if (reason === 'Cannot connect node to itself') return 'A gate cannot connect to itself.';
  if (reason === 'Connection already exists') return 'That wire already exists.';
  if (reason === 'Cannot connect input to input') return 'Inputs cannot be wired directly to each other.';
  if (reason === 'Cannot connect output to output') return 'Outputs cannot be wired directly to each other.';
  return 'That connection is not allowed here.';
}

export function describeWireRejectionForStudents(
  circuit: Circuit,
  reason: string,
  source: PortRef | null | undefined,
  target: PortRef | null | undefined,
  getChipMetadata?: ChipMetadataResolver
): string {
  const sourceLabel = describePortRefForStudents(circuit, source, getChipMetadata);
  const targetLabel = describePortRefForStudents(circuit, target, getChipMetadata);
  return `${wireRejectionMessage(reason)} Source kept: ${sourceLabel}. ${targetLabel} is not a compatible target; click a green target or press Esc.`;
}

export function wirePortState(
  source: PortRef | null | undefined,
  nodeId: string,
  portName: string,
  validTargets: Set<string> | null | undefined
): 'idle' | 'source' | 'valid-target' | 'invalid-target' {
  if (!source) return 'idle';
  if (source.nodeId === nodeId && getPortName(source) === portName) return 'source';
  if (validTargets?.has(`${nodeId}:${portName}`)) return 'valid-target';
  return 'invalid-target';
}
