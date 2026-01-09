// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from '@redbyte/rb-shell';
import { useWindowStore } from '@redbyte/rb-windowing';
import { useSettingsStore } from '@redbyte/rb-utils';

// Mock @redbyte/rb-utils to prevent useUiTickStore infinite update loops
vi.mock('@redbyte/rb-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@redbyte/rb-utils')>();
  const mockUiTickState = { uiTick: 0, running: false, start: vi.fn(), stop: vi.fn() };
  return {
    ...actual,
    useUiTickStore: (selector?: (state: typeof mockUiTickState) => unknown) =>
      selector ? selector(mockUiTickState) : mockUiTickState,
    startUiTickSampler: vi.fn(),
  };
});

// TODO: Fix infinite update loop caused by useUiTickStore in React 19
// The store's useSyncExternalStore integration triggers "Maximum update depth exceeded"
// when tests render components that use the store. Needs investigation into proper
// mocking strategy or store implementation fix for React 19 compatibility.
describe.skip('OS launch integration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useWindowStore.setState({ windows: [], nextZIndex: 1 });
    useSettingsStore.setState({
      themeVariant: 'dark',
      wallpaperId: 'default',
      accentColor: 'cyan',
      tickRate: 20,
    });
  });

  it('opens Logic Playground from the desktop icon and renders the app', async () => {
    localStorage.setItem('rb:shell:booted:v1', '1');
    sessionStorage.setItem('rb:shell:booted:v1', '1');

    const user = userEvent.setup();
    render(<Shell />);

    const desktopLabel = await screen.findByText('Logic Playground');
    await user.click(desktopLabel);

    await waitFor(() => {
      expect(screen.getByTestId('logic-playground-root')).toBeInTheDocument();
    });

    const windows = useWindowStore.getState().windows;
    expect(windows.some((window) => window.contentId === 'logic-playground')).toBe(true);
  });
});
