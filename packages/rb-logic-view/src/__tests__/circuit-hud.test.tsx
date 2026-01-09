// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, act } from '@testing-library/react';
import { TickEngine } from '@redbyte/rb-logic-core';
import { LogicCanvas } from '../LogicCanvas';

// Mock @redbyte/rb-utils to prevent useUiTickStore infinite update loops
vi.mock('@redbyte/rb-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@redbyte/rb-utils')>();
  const mockUiTickState = { uiTick: 0, running: false, start: vi.fn(), stop: vi.fn() };
  return {
    ...actual,
    useUiTickStore: (selector?: (state: typeof mockUiTickState) => unknown) =>
      selector ? selector(mockUiTickState) : mockUiTickState,
    trackRender: vi.fn(),
  };
});

// Mock useLogicViewStore to prevent infinite loops from selection state changes
vi.mock('../useLogicViewStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../useLogicViewStore')>();
  // All mock state must be inside factory due to vi.mock hoisting
  const mockSelection = { nodes: new Set<string>(), wires: new Set<string>() };
  const mockCamera = { x: 0, y: 0, zoom: 1 };
  const mockEditingState = { isDragging: false };
  const mockState = {
    camera: mockCamera,
    setCamera: vi.fn(),
    pan: vi.fn(),
    zoom: vi.fn(),
    selection: mockSelection,
    selectNode: vi.fn(),
    selectWire: vi.fn(),
    clearSelection: vi.fn(),
    selectMultipleNodes: vi.fn(),
    toolMode: 'select' as const,
    setToolMode: vi.fn(),
    editingState: mockEditingState,
    setEditingState: vi.fn(),
    startWire: vi.fn(),
    endWire: vi.fn(),
    snapToGrid: true,
    toggleSnapToGrid: vi.fn(),
    gridSize: 16,
  };
  return {
    ...actual,
    useLogicViewStore: (selector?: (state: typeof mockState) => unknown) =>
      selector ? selector(mockState) : mockState,
    getGlobalViewStateStore: () => null,
  };
});

describe('circuit HUD', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('auto-hides after inactivity', () => {
    const engine = new TickEngine({ nodes: [], connections: [] }, { tickRate: 1 });

    render(
      <LogicCanvas
        engine={engine}
        width={400}
        height={300}
        showToolbar={false}
        showHints={false}
      />
    );

    expect(screen.queryByTestId('circuit-hud')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(screen.queryByTestId('circuit-hud')).toBeNull();
  });
});
