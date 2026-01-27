// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { ShellWindow } from '../ShellWindow';
import type { WindowState } from '@redbyte/rb-windowing';

const createWindowState = (overrides: Partial<WindowState> = {}): WindowState => ({
  id: 'win-1',
  title: 'Test Window',
  bounds: { x: 100, y: 100, width: 400, height: 300 },
  mode: 'normal',
  zIndex: 1,
  focused: true,
  resizable: true,
  minimizable: true,
  maximizable: true,
  contentId: 'test-app',
  ...overrides,
});

describe('ShellWindow snap preview', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = (snapAssistMode: 'off' | 'manual' | 'auto') => {
    const onSnap = vi.fn();
    const onSnapPreviewChange = vi.fn();
    const onMove = vi.fn();
    const onResize = vi.fn();
    const onFocus = vi.fn();

    const utils = render(
      <ShellWindow
        state={createWindowState()}
        minSize={{ width: 320, height: 240 }}
        snapAssistMode={snapAssistMode}
        onClose={vi.fn()}
        onFocus={onFocus}
        onMove={onMove}
        onResize={onResize}
        onMinimize={vi.fn()}
        onMaximize={vi.fn()}
        onRestore={vi.fn()}
        onSnap={onSnap}
        onSnapPreviewChange={onSnapPreviewChange}
      />
    );

    const titleBar = utils.getByTestId('window-title-bar');
    const root = utils.container.firstChild as HTMLElement;

    return { ...utils, titleBar, root, onSnap, onSnapPreviewChange };
  };

  it('does not snap without modifier in manual mode', () => {
    const { titleBar, root, onSnap, onSnapPreviewChange } = setup('manual');

    fireEvent.mouseDown(titleBar, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(root, { clientX: 5, clientY: 200 });
    fireEvent.mouseUp(root, { clientX: 5, clientY: 200 });

    expect(onSnap).not.toHaveBeenCalled();
    expect(onSnapPreviewChange).not.toHaveBeenCalled();
  });

  it('shows preview and snaps on release when Shift is held', () => {
    const { titleBar, root, onSnap, onSnapPreviewChange } = setup('manual');

    fireEvent.mouseDown(titleBar, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(root, { clientX: 5, clientY: 200, shiftKey: true });

    expect(onSnapPreviewChange).toHaveBeenCalledWith('win-1', 'left');

    fireEvent.mouseUp(root, { clientX: 5, clientY: 200, shiftKey: true });

    expect(onSnap).toHaveBeenCalledWith('win-1', 'left');
  });

  it('keeps preview active within hysteresis exit zone', () => {
    const { titleBar, root, onSnapPreviewChange } = setup('manual');

    fireEvent.mouseDown(titleBar, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(root, { clientX: 5, clientY: 200, shiftKey: true });

    expect(onSnapPreviewChange).toHaveBeenCalledWith('win-1', 'left');

    const callsAfterEnter = onSnapPreviewChange.mock.calls.length;

    fireEvent.mouseMove(root, { clientX: 40, clientY: 200, shiftKey: true });

    expect(onSnapPreviewChange.mock.calls.length).toBe(callsAfterEnter);

    fireEvent.mouseMove(root, { clientX: 80, clientY: 200, shiftKey: true });

    expect(onSnapPreviewChange).toHaveBeenLastCalledWith('win-1', null);
  });

  it('requires hover delay in auto mode', () => {
    vi.useFakeTimers();
    const { titleBar, root, onSnapPreviewChange } = setup('auto');

    fireEvent.mouseDown(titleBar, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(root, { clientX: 5, clientY: 200 });

    expect(onSnapPreviewChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onSnapPreviewChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(onSnapPreviewChange).toHaveBeenCalledWith('win-1', 'left');
  });
});
