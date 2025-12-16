// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Shell } from '../Shell';
import { useWindowStore } from '@redbyte/rb-windowing';

describe('Shell window lifecycle', () => {
  beforeEach(() => {
    useWindowStore.setState((state) => ({
      ...state,
      windows: [],
      nextZIndex: 1,
      snapToGrid: false,
      gridSize: 20,
    }));

    localStorage.clear();
    localStorage.setItem('rb:shell:booted', '1');
  });

  afterEach(() => {
    cleanup();
  });

  it('reuses a singleton window and restores it when relaunched', () => {
    render(<Shell />);

    const settingsButton = screen.getByLabelText('Settings');

    fireEvent.click(settingsButton);

    const firstState = useWindowStore.getState();
    expect(firstState.windows).toHaveLength(1);
    const windowId = firstState.windows[0].id;

    firstState.toggleMinimize(windowId);
    expect(useWindowStore.getState().windows[0].mode).toBe('minimized');

    fireEvent.click(settingsButton);

    const secondState = useWindowStore.getState();
    expect(secondState.windows).toHaveLength(1);
    const windowState = secondState.windows[0];
    expect(windowState.id).toBe(windowId);
    expect(windowState.mode).toBe('normal');
    expect(windowState.focused).toBe(true);
  });

  it('creates independent instances for multi-window apps', () => {
    render(<Shell />);

    const filesButton = screen.getByLabelText('Files');

    fireEvent.click(filesButton);
    fireEvent.click(filesButton);

    const { windows, getFocusedWindow } = useWindowStore.getState();
    expect(windows).toHaveLength(2);
    expect(windows.every((w) => w.contentId === 'files')).toBe(true);
    expect(getFocusedWindow()?.id).toBe(windows[1].id);
  });
});
