// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// RC-P4: CanvasInputController state machine unit tests

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasInput } from '../useCanvasInput';

function makeOptions(overrides: Partial<Parameters<typeof useCanvasInput>[0]> = {}) {
  return {
    svgRef: { current: null } as React.RefObject<SVGSVGElement | null>,
    camera: { x: 0, y: 0, zoom: 1 },
    circuitNodes: [
      { id: 'node-1', position: { x: 100, y: 200 } },
      { id: 'node-2', position: { x: 300, y: 400 } },
    ],
    selectedNodeIds: new Set<string>(),
    onNodeMoveEnd: vi.fn(),
    onNodeSelect: vi.fn(),
    onPan: vi.fn(),
    onClearSelection: vi.fn(),
    onWireCancel: vi.fn(),
    isSpacePressed: false,
    isReplayMode: false,
    interactionMode: 'idle',
    setInteractionMode: vi.fn(),
    snapEnabled: false,
    gridSize: 16,
    ...overrides,
  };
}

// Minimal PointerEvent mock for testing
function makePointerEvent(
  type: string,
  opts: {
    button?: number;
    clientX?: number;
    clientY?: number;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    target?: Element;
    currentTarget?: any;
  } = {},
): React.PointerEvent<SVGSVGElement> {
  const captured = { hasCaptured: false };
  return {
    type,
    button: opts.button ?? 0,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    shiftKey: opts.shiftKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    pointerId: 1,
    target: opts.target ?? document.createElement('div'),
    currentTarget: opts.currentTarget ?? {
      setPointerCapture: vi.fn(() => { captured.hasCaptured = true; }),
      hasPointerCapture: vi.fn(() => captured.hasCaptured),
      releasePointerCapture: vi.fn(),
    },
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    nativeEvent: new Event(type),
  } as unknown as React.PointerEvent<SVGSVGElement>;
}

describe('useCanvasInput — state machine', () => {
  it('starts in idle with no drag state', () => {
    const { result } = renderHook(() => useCanvasInput(makeOptions()));
    expect(result.current.dragState.isDragging).toBe(false);
    expect(result.current.dragState.dragNodeId).toBe(null);
    expect(result.current.dragState.dragPosition).toBe(null);
  });

  it('middle mouse starts panning', () => {
    const setInteractionMode = vi.fn();
    const { result } = renderHook(() =>
      useCanvasInput(makeOptions({ setInteractionMode })),
    );

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown', { button: 1 }));
    });

    expect(setInteractionMode).toHaveBeenCalledWith('panning');
  });

  it('space + left click starts panning', () => {
    const setInteractionMode = vi.fn();
    const { result } = renderHook(() =>
      useCanvasInput(makeOptions({ setInteractionMode, isSpacePressed: true })),
    );

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown', { button: 0 }));
    });

    expect(setInteractionMode).toHaveBeenCalledWith('panning');
  });

  it('left click on background clears selection', () => {
    const onClearSelection = vi.fn();
    const { result } = renderHook(() =>
      useCanvasInput(makeOptions({ onClearSelection })),
    );

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown', { button: 0 }));
      result.current.onPointerUp(makePointerEvent('pointerup', { button: 0 }));
    });

    expect(onClearSelection).toHaveBeenCalled();
  });

  it('left click on wire does not enter background box-select flow', () => {
    const onClearSelection = vi.fn();
    const setInteractionMode = vi.fn();

    const wireEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    wireEl.setAttribute('data-wire-id', 'from.out-to.in');
    const target = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    wireEl.appendChild(target);

    const { result } = renderHook(() =>
      useCanvasInput(makeOptions({ onClearSelection, setInteractionMode })),
    );

    act(() => {
      result.current.onPointerDown(
        makePointerEvent('pointerdown', { button: 0, target }),
      );
      result.current.onPointerUp(
        makePointerEvent('pointerup', { button: 0, target }),
      );
    });

    expect(onClearSelection).not.toHaveBeenCalled();
    expect(setInteractionMode).not.toHaveBeenCalledWith('boxSelecting');
  });

  it('left click on node selects it', () => {
    const onNodeSelect = vi.fn();
    // Create a mock element with closest() that finds a node
    const nodeEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeEl.setAttribute('data-node-id', 'node-1');
    const target = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    nodeEl.appendChild(target);

    const { result } = renderHook(() =>
      useCanvasInput(makeOptions({ onNodeSelect })),
    );

    act(() => {
      result.current.onPointerDown(
        makePointerEvent('pointerdown', { button: 0, target }),
      );
    });

    expect(onNodeSelect).toHaveBeenCalledWith('node-1', false);
  });

  it('ctrl/cmd click on node adds it to the current selection', () => {
    const onNodeSelect = vi.fn();
    const nodeEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeEl.setAttribute('data-node-id', 'node-1');
    const target = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    nodeEl.appendChild(target);

    const { result } = renderHook(() =>
      useCanvasInput(makeOptions({ onNodeSelect })),
    );

    act(() => {
      result.current.onPointerDown(
        makePointerEvent('pointerdown', { button: 0, ctrlKey: true, target }),
      );
    });

    expect(onNodeSelect).toHaveBeenCalledWith('node-1', true);
  });

  it('does not start drag until 3px threshold exceeded', () => {
    const setInteractionMode = vi.fn();
    const onNodeSelect = vi.fn();

    const nodeEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeEl.setAttribute('data-node-id', 'node-1');
    const target = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    nodeEl.appendChild(target);

    const { result } = renderHook(() =>
      useCanvasInput(makeOptions({ onNodeSelect, setInteractionMode })),
    );

    // Pointer down on node
    act(() => {
      result.current.onPointerDown(
        makePointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 200, target }),
      );
    });

    // Move 2px — should NOT start drag
    act(() => {
      result.current.onPointerMove(
        makePointerEvent('pointermove', { clientX: 102, clientY: 200, target }),
      );
    });
    expect(setInteractionMode).not.toHaveBeenCalledWith('draggingNode');

    // Move 4px — should start drag
    act(() => {
      result.current.onPointerMove(
        makePointerEvent('pointermove', { clientX: 104, clientY: 200, target }),
      );
    });
    expect(setInteractionMode).toHaveBeenCalledWith('draggingNode');
  });

  it('background drag enters boxSelecting and commits node selection', () => {
    const setInteractionMode = vi.fn();
    const onMarqueeChange = vi.fn();
    const onMarqueeCommit = vi.fn();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      toJSON: () => ({}),
    } as DOMRect);

    const { result } = renderHook(() =>
      useCanvasInput(
        makeOptions({
          svgRef: { current: svg } as React.RefObject<SVGSVGElement | null>,
          setInteractionMode,
          onMarqueeChange,
          onMarqueeCommit,
        }),
      ),
    );

    act(() => {
      result.current.onPointerDown(
        makePointerEvent('pointerdown', { button: 0, clientX: 80, clientY: 180 }),
      );
    });

    act(() => {
      result.current.onPointerMove(
        makePointerEvent('pointermove', { clientX: 120, clientY: 240 }),
      );
    });

    expect(setInteractionMode).toHaveBeenCalledWith('boxSelecting');
    expect(onMarqueeChange).toHaveBeenCalled();

    act(() => {
      result.current.onPointerUp(
        makePointerEvent('pointerup', { clientX: 120, clientY: 240 }),
      );
    });

    expect(onMarqueeCommit).toHaveBeenCalledWith(expect.arrayContaining(['node-1']), false);
    expect(setInteractionMode).toHaveBeenLastCalledWith('idle');
  });

  it('pointer up resets to idle', () => {
    const setInteractionMode = vi.fn();
    const { result } = renderHook(() =>
      useCanvasInput(makeOptions({ setInteractionMode })),
    );

    // Start panning
    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown', { button: 1 }));
    });

    // Release
    act(() => {
      result.current.onPointerUp(makePointerEvent('pointerup'));
    });

    expect(setInteractionMode).toHaveBeenLastCalledWith('idle');
  });

  it('does nothing in replay mode', () => {
    const onNodeSelect = vi.fn();
    const onClearSelection = vi.fn();
    const { result } = renderHook(() =>
      useCanvasInput(makeOptions({ isReplayMode: true, onNodeSelect, onClearSelection })),
    );

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown', { button: 0 }));
    });

    expect(onNodeSelect).not.toHaveBeenCalled();
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it('right click during wiring cancels wire', () => {
    const onWireCancel = vi.fn();
    const { result } = renderHook(() =>
      useCanvasInput(makeOptions({ interactionMode: 'wiring', onWireCancel })),
    );

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown', { button: 2 }));
    });

    expect(onWireCancel).toHaveBeenCalled();
  });

  it('cannot start new interactions while dragging', () => {
    const onClearSelection = vi.fn();
    const { result } = renderHook(() =>
      useCanvasInput(makeOptions({ interactionMode: 'draggingNode', onClearSelection })),
    );

    act(() => {
      result.current.onPointerDown(makePointerEvent('pointerdown', { button: 0 }));
    });

    expect(onClearSelection).not.toHaveBeenCalled();
  });
});
