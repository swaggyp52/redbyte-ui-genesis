import type { Signal } from '@redbyte/rb-logic-core';
import type { Object3D } from 'three';

/** Keep the real engine's scalar, bus, unknown and high-impedance values. */
export function copySceneSignals(signals: ReadonlyMap<string, Signal>): Map<string, Signal> {
  return new Map(signals);
}

/** Only known HIGH emits active particles; X/Z are never coerced into HIGH. */
export function isSceneSignalHigh(value: Signal | undefined): boolean {
  return value === 1;
}

export function buildSelectionMap(nodes: ReadonlyArray<{ id: string }>, selected: ReadonlySet<string>) {
  return new Map(nodes.map(node => [node.id, selected.has(node.id)]));
}

export const NET_HIGHLIGHT_COLOR = '#fbbf24';
export function mergeWireProbeColorsForNetHighlight(colors: string[] | undefined, highlighted: boolean) {
  if (!highlighted) return colors;
  if (!colors) return [NET_HIGHLIGHT_COLOR];
  return colors.includes(NET_HIGHLIGHT_COLOR) ? colors : [...colors, NET_HIGHLIGHT_COLOR];
}

/** Native TransformControls target; userData is a runtime boundary. */
export function readSceneNodeMove(target: Pick<Object3D, 'position' | 'userData'> | undefined) {
  const nodeId: unknown = target?.userData.nodeId;
  if (!target || typeof nodeId !== 'string') return null;
  return { nodeId, position: { x: target.position.x * 20, y: target.position.z * 20 } };
}
