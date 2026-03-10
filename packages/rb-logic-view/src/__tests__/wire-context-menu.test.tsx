// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { Connection, Node } from '@redbyte/rb-logic-core';
import { WireView } from '../components/WireView';

describe('WireView context menu hook', () => {
  it('emits the selected wire id on right click', () => {
    const onContextMenu = vi.fn();
    const nodes: Node[] = [
      {
        id: 'sw0_node',
        type: 'INPUT',
        position: { x: 0, y: 0 },
        rotation: 0,
        config: {},
        state: { isOn: 1 },
      },
      {
        id: 'ld0_node',
        type: 'OUTPUT',
        position: { x: 160, y: 0 },
        rotation: 0,
        config: {},
        state: {},
      },
    ];
    const connection: Connection = {
      from: { nodeId: 'sw0_node', portName: 'out' },
      to: { nodeId: 'ld0_node', portName: 'in' },
    };

    const view = render(
      <svg>
        <WireView
          connection={connection}
          nodes={nodes}
          camera={{ x: 0, y: 0, zoom: 1 }}
          isSelected={false}
          onSelect={vi.fn()}
          onContextMenu={onContextMenu}
        />
      </svg>
    );

    fireEvent.contextMenu(view.container.querySelector('[data-wire-id]') as Element);

    expect(onContextMenu).toHaveBeenCalledTimes(1);
    expect(onContextMenu.mock.calls[0]?.[0]).toBe('sw0_node.out-ld0_node.in');
  });
});
