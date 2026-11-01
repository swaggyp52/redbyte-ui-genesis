// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { Connection, Node } from '@redbyte/rb-logic-core';
import { WireView } from '../components/WireView';

describe('wire rendering with incomplete node coordinates', () => {
  it.each<Connection>([
    { from: { nodeId: 'source', portName: 'out' }, to: { nodeId: 'lamp', portName: 'in' } },
    { from: 'source', fromPin: 'out', to: 'lamp', toPin: 'in' },
  ])('keeps a selectable finite wire and preserves source nodes', (connection) => {
    const nodes: Node[] = [{ id: 'source', type: 'INPUT' }, { id: 'lamp', type: 'OUTPUT', position: { x: 160, y: 0 } }];
    const before = JSON.stringify(nodes);
    const onSelect = vi.fn();
    const view = render(<svg><WireView connection={connection} nodes={nodes} camera={{ x: 0, y: 0, zoom: 1 }} isSelected={false} onSelect={onSelect} signal="X" /></svg>);
    const wire = view.container.querySelector('[data-wire-id]');
    expect(wire).not.toBeNull();
    const path = wire?.querySelector('path')?.getAttribute('d');
    expect(path).toContain('M 24 0');
    expect(path).not.toMatch(/NaN|undefined/);
    if (!wire) throw new Error('Expected a selectable wire');
    fireEvent.click(wire);
    expect(onSelect).toHaveBeenCalledWith('source.out-lamp.in', false);
    expect(JSON.stringify(nodes)).toBe(before);
    expect(wire.querySelector('animateMotion')).toBeNull();
  });
});
