// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Shell } from '@redbyte/rb-shell';
import { useWindowStore } from '@redbyte/rb-windowing';
import { useSettingsStore } from '@redbyte/rb-utils';

describe('OS launch integration', () => {
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
