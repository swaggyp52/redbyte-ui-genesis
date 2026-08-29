// @vitest-environment jsdom

import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  isCanvasPlacementBlocked,
  useDesignPlacementController,
  type DesignPlacementControllerParams,
} from '../surfaces/useDesignPlacementController';

const EMPTY_CIRCUIT: Circuit = { nodes: [], connections: [] } as unknown as Circuit;

function createParams(
  overrides: Partial<DesignPlacementControllerParams> = {}
): DesignPlacementControllerParams {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return {
    canvasHostRef: { current: host },
    camera: { x: 0, y: 0, zoom: 1 },
    canvasSize: { width: 800, height: 600 },
    circuit: EMPTY_CIRCUIT,
    interactionMode: 'idle',
    setInteractionMode: vi.fn(),
    isMacroArmActive: false,
    clearMacroArm: vi.fn(),
    onMacroCanvasClick: vi.fn(),
    isWireStartActive: false,
    endWire: vi.fn(),
    toolMode: 'select',
    setSelectToolMode: vi.fn(),
    clearWireFeedback: vi.fn(),
    findExistingBoardNode: vi.fn(() => undefined),
    selectNodes: vi.fn(),
    notify: vi.fn(),
    nodeTypeLabel: (nodeType: string) => nodeType.toLowerCase(),
    predictNextNodeIds: vi.fn(() => ['node-next']),
    fallbackAddNode: vi.fn(),
    emitCircuitMutation: vi.fn(),
    markReplayStale: vi.fn(),
    ...overrides,
  };
}

function clickEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    target: document.createElement('div'),
    clientX: 120,
    clientY: 90,
    shiftKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as React.MouseEvent<HTMLDivElement>;
}

describe('useDesignPlacementController', () => {
  it('arms a node placement and enters placing mode', () => {
    const params = createParams();
    const { result } = renderHook(() => useDesignPlacementController(params));
    act(() => result.current.beginNodePlacement('AND'));
    expect(result.current.pendingPlacement).toEqual({ kind: 'node', label: 'and', nodeType: 'AND' });
    expect(params.setInteractionMode).toHaveBeenCalledWith('placing');
  });

  it('cross-cancels an active wire start and macro arm when arming', () => {
    const params = createParams({ isWireStartActive: true, isMacroArmActive: true });
    const { result } = renderHook(() => useDesignPlacementController(params));
    act(() => result.current.beginNodePlacement('XOR'));
    expect(params.endWire).toHaveBeenCalled();
    expect(params.clearMacroArm).toHaveBeenCalled();
    expect(params.clearWireFeedback).toHaveBeenCalled();
  });

  it('switches a non-select tool back to select when arming without a wire start', () => {
    const params = createParams({ toolMode: 'wire' });
    const { result } = renderHook(() => useDesignPlacementController(params));
    act(() => result.current.beginNodePlacement('NOT'));
    expect(params.setSelectToolMode).toHaveBeenCalled();
    expect(params.endWire).not.toHaveBeenCalled();
  });

  it('selects the existing board node instead of arming a duplicate', () => {
    const params = createParams({
      findExistingBoardNode: vi.fn(() => ({ nodeId: 'node-7' })),
    });
    const { result } = renderHook(() => useDesignPlacementController(params));
    act(() => result.current.beginBoardIoPlacement({ alias: 'SW0', kind: 'switch', direction: 'in' }));
    expect(params.selectNodes).toHaveBeenCalledWith(['node-7'], false);
    expect(params.notify).toHaveBeenCalledWith('SW0 already exists on canvas.');
    expect(result.current.pendingPlacement).toBeNull();
  });

  it('commits a node through the runtime authority and stales replay', async () => {
    const params = createParams({ onRuntimeAddNode: vi.fn() });
    const { result } = renderHook(() => useDesignPlacementController(params));
    act(() => result.current.beginNodePlacement('AND'));
    await act(async () => result.current.commitPendingPlacement(200, 150));
    expect(params.markReplayStale).toHaveBeenCalled();
    expect(params.onRuntimeAddNode).toHaveBeenCalledWith('AND', expect.objectContaining({ x: expect.any(Number) }));
    expect(params.fallbackAddNode).not.toHaveBeenCalled();
    expect(params.emitCircuitMutation).not.toHaveBeenCalled();
    expect(result.current.pendingPlacement).toBeNull();
    expect(params.selectNodes).toHaveBeenCalledWith(['node-next'], false);
  });

  it('commits through the circuit-store fallback with an explicit mutation emit', async () => {
    const params = createParams();
    const { result } = renderHook(() => useDesignPlacementController(params));
    act(() => result.current.beginNodePlacement('OR'));
    await act(async () => result.current.commitPendingPlacement(200, 150));
    expect(params.fallbackAddNode).toHaveBeenCalledWith('OR', expect.any(Object), { skipHistory: true });
    expect(params.emitCircuitMutation).toHaveBeenCalledTimes(1);
    expect(params.markReplayStale).not.toHaveBeenCalled();
  });

  it('keeps the placement armed when committing with keepPlacing', async () => {
    const params = createParams({ onRuntimeAddNode: vi.fn() });
    const { result } = renderHook(() => useDesignPlacementController(params));
    act(() => result.current.beginNodePlacement('AND'));
    await act(async () => result.current.commitPendingPlacement(200, 150, { keepPlacing: true }));
    expect(result.current.pendingPlacement).not.toBeNull();
    expect(params.onRuntimeAddNode).toHaveBeenCalledTimes(1);
  });

  it('commits board IO through the board runtime authority', async () => {
    const params = createParams({ onRuntimeAddBoardIo: vi.fn() });
    const { result } = renderHook(() => useDesignPlacementController(params));
    act(() => result.current.beginBoardIoPlacement({ alias: 'LD3', kind: 'led', direction: 'out' }));
    await act(async () => result.current.commitPendingPlacement(240, 180));
    expect(params.onRuntimeAddBoardIo).toHaveBeenCalledWith(
      expect.objectContaining({ alias: 'LD3', direction: 'out', kind: 'led' })
    );
    expect(params.notify).toHaveBeenCalledWith('Added LD3 to canvas.');
  });

  it('cancels with the Esc-specific message and leaves placing mode', () => {
    const params = createParams({ interactionMode: 'placing' });
    const { result } = renderHook(() => useDesignPlacementController(params));
    act(() => result.current.beginNodePlacement('AND'));
    act(() => result.current.cancelPendingPlacement('escape'));
    expect(result.current.pendingPlacement).toBeNull();
    expect(params.setInteractionMode).toHaveBeenCalledWith('idle');
    expect(params.notify).toHaveBeenCalledWith('Cancelled placing and (Esc).');
  });

  it('delegates canvas clicks to the macro owner while a macro arm is active', () => {
    const params = createParams({ isMacroArmActive: true });
    const { result } = renderHook(() => useDesignPlacementController(params));
    const event = clickEvent();
    act(() => result.current.handleCanvasPlacementClick(event));
    expect(params.onMacroCanvasClick).toHaveBeenCalledWith(120, 90);
  });

  it('ignores clicks on placement-blocked targets', async () => {
    const params = createParams({ onRuntimeAddNode: vi.fn() });
    const { result } = renderHook(() => useDesignPlacementController(params));
    act(() => result.current.beginNodePlacement('AND'));
    const blockedHost = document.createElement('div');
    blockedHost.setAttribute('data-node-id', 'node-1');
    const inner = document.createElement('span');
    blockedHost.appendChild(inner);
    document.body.appendChild(blockedHost);
    await act(async () => result.current.handleCanvasPlacementClick(clickEvent({ target: inner })));
    expect(params.onRuntimeAddNode).not.toHaveBeenCalled();
    expect(result.current.pendingPlacement).not.toBeNull();
  });

  it('exposes silent clears for the macro cross-cancel path', () => {
    const params = createParams();
    const { result } = renderHook(() => useDesignPlacementController(params));
    act(() => result.current.beginNodePlacement('AND'));
    act(() => result.current.clearPending());
    expect(result.current.pendingPlacement).toBeNull();
    expect(params.notify).toHaveBeenCalledTimes(0);
  });
});

describe('isCanvasPlacementBlocked', () => {
  it('blocks node, port, wire, reconnect and explicitly opted-out targets', () => {
    const cases: Array<[string, string]> = [
      ['data-node-id', 'n1'],
      ['data-port-id', 'p1'],
      ['data-wire-id', 'w1'],
      ['data-blocks-canvas-placement', '1'],
      ['data-blocks-macro-placement', '1'],
    ];
    for (const [attribute, value] of cases) {
      const element = document.createElement('div');
      element.setAttribute(attribute, value);
      expect(isCanvasPlacementBlocked(element)).toBe(true);
    }
    const reconnect = document.createElement('div');
    reconnect.setAttribute('data-testid', 'logic-wire-reconnect-start');
    expect(isCanvasPlacementBlocked(reconnect)).toBe(true);
    expect(isCanvasPlacementBlocked(document.createElement('div'))).toBe(false);
    expect(isCanvasPlacementBlocked(null)).toBe(false);
  });
});
