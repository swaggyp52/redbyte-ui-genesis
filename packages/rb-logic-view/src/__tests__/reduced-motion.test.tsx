// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import type { Connection, Node } from '@redbyte/rb-logic-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WireView } from '../components/WireView';

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

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reduced motion', () => {
  it('removes nonessential active-wire motion when reduction is requested', () => {
    mockReducedMotion(true);

    const view = render(
      <svg>
        <WireView
          connection={connection}
          nodes={nodes}
          camera={{ x: 0, y: 0, zoom: 1 }}
          isSelected={false}
          onSelect={vi.fn()}
          signal={1}
        />
      </svg>
    );

    expect(view.container.querySelectorAll('animateMotion')).toHaveLength(0);
  });

  it('keeps active-wire motion at the default preference', () => {
    mockReducedMotion(false);

    const view = render(
      <svg>
        <WireView
          connection={connection}
          nodes={nodes}
          camera={{ x: 0, y: 0, zoom: 1 }}
          isSelected={false}
          onSelect={vi.fn()}
          signal={1}
        />
      </svg>
    );

    expect(view.container.querySelectorAll('animateMotion')).toHaveLength(3);
  });
});
