import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import type { Node } from '@redbyte/rb-logic-core';
import { NodeView, type ChipMetadata } from '../NodeView';

const CHIP: ChipMetadata = {
  name: 'XOR',
  inputs: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
  ],
  outputs: [{ id: 'out', name: 'Out' }],
  layer: 1,
};

const NODE: Node = {
  id: 'xor1_node',
  type: 'XOR',
  label: 'XOR1 (A⊕B)',
  position: { x: 100, y: 100 },
  state: {},
  config: {},
};

function renderAtZoom(zoom: number, presentationZoomMode: 'dense' | 'classroom' = 'classroom') {
  return render(
    <svg>
      <NodeView
        node={NODE}
        camera={{ x: 0, y: 0, zoom }}
        presentationZoomMode={presentationZoomMode}
        isSelected={false}
        onSelect={() => {}}
        onMove={() => {}}
        onPortClick={() => {}}
        signals={null}
        chipMetadata={CHIP}
      />
    </svg>
  );
}

function numericAttribute(element: Element, name: string): number {
  const value = Number(element.getAttribute(name));
  expect(Number.isFinite(value)).toBe(true);
  return value;
}

describe('NodeView logical-name hierarchy', () => {
  it('keeps the authored instance name outside the narrow status header at 100%', () => {
    const { container } = renderAtZoom(1);

    const root = container.querySelector('[data-node-id="xor1_node"]');
    const header = container.querySelector('.logic-node-header');
    const identity = container.querySelector('[data-label-role="logical-name"]');
    const plate = container.querySelector('[data-testid="logic-node-identity-plate-xor1_node"]');
    const logicalName = identity?.querySelector('.logic-node-label');
    const metadata = container.querySelector('[data-label-role="type-layer"]');

    expect(root).toHaveAttribute('data-lod', 'full');
    expect(identity).toHaveAttribute('data-full-label', 'XOR1 (A⊕B)');
    expect(logicalName).toHaveTextContent('XOR1 (A⊕B)');
    expect(metadata).toHaveTextContent('XOR · L1');

    const plateBottom = numericAttribute(plate!, 'y') + numericAttribute(plate!, 'height');
    const headerTop = numericAttribute(header!, 'y');
    expect(plateBottom).toBeLessThan(headerTop);

    const headerBottom = headerTop + numericAttribute(header!, 'height');
    const metadataY = numericAttribute(metadata!, 'y');
    expect(metadataY).toBeGreaterThan(headerBottom);
    expect(numericAttribute(logicalName!, 'font-size')).toBeGreaterThanOrEqual(9);
    expect(numericAttribute(metadata!, 'font-size')).toBeGreaterThanOrEqual(8);
  });

  it('retains distinct logical-name and type/layer labels at the supported 50% preset', () => {
    const { container } = renderAtZoom(0.5);

    const root = container.querySelector('[data-node-id="xor1_node"]');
    const body = container.querySelector('.logic-node-body');
    const plate = container.querySelector('[data-testid="logic-node-identity-plate-xor1_node"]');
    const logicalName = container.querySelector('[data-label-role="logical-name"] .logic-node-label');
    const metadata = container.querySelector('[data-label-role="type-layer"]');

    expect(root).toHaveAttribute('data-lod', 'compact');
    expect(logicalName).toHaveTextContent('XOR1 (A⊕B)');
    expect(metadata).toHaveTextContent('XOR · L1');
    expect(numericAttribute(logicalName!, 'font-size')).toBeGreaterThanOrEqual(9);
    expect(numericAttribute(metadata!, 'font-size')).toBeGreaterThanOrEqual(8);
    expect(numericAttribute(plate!, 'width')).toBeGreaterThan(numericAttribute(body!, 'width'));
  });

  it('uses minimal LOD only below the supported 50% preset', () => {
    const { container } = renderAtZoom(0.49);

    expect(container.querySelector('[data-node-id="xor1_node"]')).toHaveAttribute('data-lod', 'minimal');
    expect(container.querySelector('[data-label-role="logical-name"]')).toBeNull();
    expect(container.querySelector('[data-label-role="type-layer"]')).toBeNull();
  });

  it('refreshes the primary logical name when an authored rename is committed', () => {
    const sharedProps = {
      camera: { x: 0, y: 0, zoom: 1 },
      isSelected: false,
      onSelect: () => {},
      onMove: () => {},
      onPortClick: () => {},
      signals: null,
      chipMetadata: CHIP,
    };
    const { container, rerender } = render(
      <svg>
        <NodeView node={NODE} {...sharedProps} />
      </svg>
    );

    rerender(
      <svg>
        <NodeView node={{ ...NODE, label: 'SUM stage' }} {...sharedProps} />
      </svg>
    );

    expect(container.querySelector('[data-label-role="logical-name"] .logic-node-label')).toHaveTextContent(
      'SUM stage'
    );
    expect(container.querySelector('[data-label-role="type-layer"]')).toHaveTextContent('XOR · L1');
  });
});
