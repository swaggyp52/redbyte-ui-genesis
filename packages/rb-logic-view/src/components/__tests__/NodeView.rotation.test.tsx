// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// REGRESSION TEST: Ensure SVG transform never produces rotate(undefined)

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { NodeView } from '../NodeView';
import type { Node } from '@redbyte/rb-logic-core';

describe('NodeView SVG Transform - Rotation Safety', () => {
  const mockCamera = {
    x: 0,
    y: 0,
    zoom: 1,
  };

  const createTestNode = (rotation?: number): Node => ({
    id: 'test-node-1',
    type: 'AND',
    position: { x: 100, y: 200 },
    rotation,
    state: {},
    config: {},
  });

  it('should default rotation to 0 when undefined', () => {
    const nodeWithoutRotation = createTestNode(); // rotation is undefined
    const { container } = render(
      <svg>
        <NodeView
          node={nodeWithoutRotation}
          camera={mockCamera}
          isSelected={false}
          onSelect={() => {}}
          onMove={() => {}}
          onPortClick={() => {}}
          signals={null}
          chipMetadata={null}
        />
      </svg>
    );

    const gElement = container.querySelector('g[transform]');
    expect(gElement).toBeTruthy();
    const transform = gElement?.getAttribute('transform');
    expect(transform).toBeTruthy();
    
    // CRITICAL: Must NOT contain "rotate(undefined)"
    expect(transform).not.toMatch(/rotate\(undefined\)/);
    
    // Should contain rotate(0) or omit rotate entirely
    expect(transform).toMatch(/translate\(\d+\.?\d*, \d+\.?\d*\)\s*rotate\(0\)/);
  });

  it('should preserve valid rotation values', () => {
    const nodeWithRotation = createTestNode(45);
    const { container } = render(
      <svg>
        <NodeView
          node={nodeWithRotation}
          camera={mockCamera}
          isSelected={false}
          onSelect={() => {}}
          onMove={() => {}}
          onPortClick={() => {}}
          signals={null}
          chipMetadata={null}
        />
      </svg>
    );

    const gElement = container.querySelector('g[transform]');
    const transform = gElement?.getAttribute('transform');
    expect(transform).toMatch(/rotate\(45\)/);
  });

  it('should handle rotation = 0 explicitly', () => {
    const nodeWithZero = createTestNode(0);
    const { container } = render(
      <svg>
        <NodeView
          node={nodeWithZero}
          camera={mockCamera}
          isSelected={false}
          onSelect={() => {}}
          onMove={() => {}}
          onPortClick={() => {}}
          signals={null}
          chipMetadata={null}
        />
      </svg>
    );

    const gElement = container.querySelector('g[transform]');
    const transform = gElement?.getAttribute('transform');
    expect(transform).toMatch(/rotate\(0\)/);
  });

  it('should handle NaN rotation as 0', () => {
    const nodeWithNaN = createTestNode(NaN);
    const { container } = render(
      <svg>
        <NodeView
          node={nodeWithNaN}
          camera={mockCamera}
          isSelected={false}
          onSelect={() => {}}
          onMove={() => {}}
          onPortClick={() => {}}
          signals={null}
          chipMetadata={null}
        />
      </svg>
    );

    const gElement = container.querySelector('g[transform]');
    const transform = gElement?.getAttribute('transform');
    
    // NaN should be treated as 0 (Number.isFinite(NaN) === false)
    expect(transform).not.toMatch(/rotate\(NaN\)/);
    expect(transform).toMatch(/rotate\(0\)/);
  });
});
