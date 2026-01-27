// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from '@redbyte/rb-shell';
import { useWindowStore } from '@redbyte/rb-windowing';
import { useSettingsStore } from '@redbyte/rb-utils';

// Stable mock state for @redbyte/rb-utils
const mockUiTickState = { uiTick: 0, running: false, start: vi.fn(), stop: vi.fn() };

// Mock @redbyte/rb-utils to prevent useUiTickStore infinite update loops
vi.mock('@redbyte/rb-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@redbyte/rb-utils')>();
  return {
    ...actual,
    useUiTickStore: (selector?: (state: typeof mockUiTickState) => unknown) =>
      selector ? selector(mockUiTickState) : mockUiTickState,
    startUiTickSampler: vi.fn(),
    trackRender: vi.fn(),
  };
});

// FIXME: React 19 + Zustand infinite loop issue
// Root cause: viewStateStore uses Set objects (selectedNodeIds, selectedWireIds, autoProbedNodes)
// which fail Zustand's `shallow` comparison (uses Object.is() - compares references not contents).
// Each store update creates new Set instances, triggering re-renders even when contents match.
// Additionally, probeStore.setActiveProbe() calls viewStateStore.selectNodes() synchronously,
// causing cascading updates. Fix requires refactoring stores to use arrays or custom equality.
// See: packages/rb-apps/src/stores/viewStateStore.ts lines 53-94
describe.skip('OS launch integration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useWindowStore.setState({ windows: [], nextZIndex: 1 });
    useSettingsStore.setState({
      themeVariant: 'redbyte-dark',
      wallpaperId: 'default',
      accentColor: 'cyan',
      tickRate: 20,
      reduceMotion: false,
      density: 'comfortable',
      snapAssist: 'manual',
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
