import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Node } from '@redbyte/rb-logic-core';
import { NodeView, type ChipMetadata } from '../NodeView';

const CHIP: ChipMetadata = {
  name: 'AND',
  inputs: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
  ],
  outputs: [{ id: 'out', name: 'Out' }],
};

const NODE: Node = {
  id: 'and_node',
  type: 'AND',
  position: { x: 100, y: 100 },
  state: {},
  config: {},
};

function renderNode(options: {
  zoom: number;
  node?: Node;
  onPortClick?: (nodeId: string, portName: string) => void;
  onPortClusterClick?: (
    nodeId: string,
    side: 'input' | 'output',
    ports: Array<{ id: string; name: string }>,
    anchor: { x: number; y: number }
  ) => void;
  wireStartPort?: { nodeId: string; portName: string };
  validWireTargets?: Set<string>;
}) {
  return render(
    <svg>
      <NodeView
        node={options.node ?? NODE}
        camera={{ x: 0, y: 0, zoom: options.zoom }}
        isSelected={false}
        onSelect={() => {}}
        onMove={() => {}}
        onPortClick={options.onPortClick}
        onPortClusterClick={options.onPortClusterClick}
        signals={null}
        chipMetadata={CHIP}
        wireStartPort={options.wireStartPort}
        validWireTargets={options.validWireTargets}
      />
    </svg>
  );
}

function numericAttribute(element: Element, name: string): number {
  const value = Number(element.getAttribute(name));
  expect(Number.isFinite(value)).toBe(true);
  return value;
}

describe('NodeView port target authority', () => {
  it('uses an authored logical name as the primary chip label', () => {
    const { container } = renderNode({
      zoom: 1,
      node: { ...NODE, label: 'A XOR B' },
    });

    expect(container.querySelector('[data-node-label="1"]')?.textContent).toBe('A XOR B');
    expect(container.querySelector('title')?.textContent).toBe('A XOR B · AND');
  });

  it('uses one 32x36 dense input cluster and exposes click, Enter, and Space through one callback', () => {
    const onPortClick = vi.fn();
    const onPortClusterClick = vi.fn();
    const { container } = renderNode({
      zoom: 0.5,
      onPortClick,
      onPortClusterClick,
    });

    const cluster = container.querySelector('[data-testid="logic-port-cluster-and_node-input"]');
    expect(cluster).toBeTruthy();
    expect(cluster).toHaveAttribute('role', 'button');
    expect(cluster).toHaveAttribute('tabindex', '0');
    expect(cluster).toHaveAttribute('data-port-density', 'dense');
    expect(cluster).toHaveAttribute('data-port-ids', 'a b');
    expect(numericAttribute(cluster!, 'width')).toBe(32);
    expect(numericAttribute(cluster!, 'height')).toBe(36);

    const denseIndividualTargets = Array.from(
      container.querySelectorAll('[data-node-id="and_node"] rect[data-port-density="dense"]:not([data-port-cluster])')
    );
    expect(denseIndividualTargets).toHaveLength(2);
    for (const target of denseIndividualTargets) {
      expect(target).not.toHaveAttribute('data-port-id');
      expect(target).toHaveStyle({ pointerEvents: 'none' });
    }

    fireEvent.click(cluster!);
    fireEvent.keyDown(cluster!, { key: 'Enter' });
    fireEvent.keyDown(cluster!, { key: ' ' });

    expect(onPortClusterClick).toHaveBeenCalledTimes(3);
    for (const call of onPortClusterClick.mock.calls) {
      expect(call).toEqual([
        'and_node',
        'input',
        CHIP.inputs,
        { x: 26, y: 50 },
      ]);
    }
    expect(onPortClick).not.toHaveBeenCalled();

    const singleOutput = container.querySelector('[data-node-id="and_node"] [data-port-id="out"]');
    expect(singleOutput).toBeTruthy();
    expect(numericAttribute(singleOutput!, 'width')).toBe(32);
    expect(numericAttribute(singleOutput!, 'height')).toBe(32);
  });

  it('keeps sparse adjacent inputs as distinct 24px targets and a single output as a 32px target', () => {
    const onPortClick = vi.fn();
    const { container } = renderNode({ zoom: 1, onPortClick });

    expect(container.querySelector('[data-port-cluster]')).toBeNull();

    const inputA = container.querySelector('[data-node-id="and_node"] [data-port-id="a"]');
    const inputB = container.querySelector('[data-node-id="and_node"] [data-port-id="b"]');
    const output = container.querySelector('[data-node-id="and_node"] [data-port-id="out"]');
    expect(inputA).toBeTruthy();
    expect(inputB).toBeTruthy();
    expect(output).toBeTruthy();

    for (const input of [inputA!, inputB!]) {
      expect(input).toHaveAttribute('data-port-density', 'sparse');
      expect(numericAttribute(input, 'width')).toBe(24);
      expect(numericAttribute(input, 'height')).toBe(24);
    }
    expect(numericAttribute(output!, 'width')).toBe(32);
    expect(numericAttribute(output!, 'height')).toBe(32);

    const inputABottom = numericAttribute(inputA!, 'y') + numericAttribute(inputA!, 'height');
    const inputBTop = numericAttribute(inputB!, 'y');
    expect(inputABottom).toBeLessThanOrEqual(inputBTop);

    fireEvent.click(inputA!);
    expect(onPortClick).toHaveBeenCalledWith('and_node', 'a');
  });

  it('advertises compatible and incompatible dense sides while a source is armed', () => {
    const { container } = renderNode({
      zoom: 0.5,
      wireStartPort: { nodeId: 'source_node', portName: 'out' },
      validWireTargets: new Set(['and_node:a', 'and_node:b']),
    });

    const inputCluster = container.querySelector('[data-port-cluster="input"]');
    const outputTarget = container.querySelector(
      '[data-port-cluster="output"], [data-port-id="out"]'
    );
    expect(inputCluster).toHaveAttribute('data-wire-port-state', 'valid-target');
    expect(inputCluster?.getAttribute('aria-label')).toContain('compatible wire targets available');
    expect(outputTarget).toHaveAttribute('data-wire-port-state', 'invalid-target');
  });
});
