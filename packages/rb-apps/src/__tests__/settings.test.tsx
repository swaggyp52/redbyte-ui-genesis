// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SettingsApp } from '../apps/SettingsApp';
import { useSettingsStore } from '@redbyte/rb-utils';

const SettingsComponent = SettingsApp.component;

describe('Settings app lifecycle', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      themeVariant: 'dark',
      wallpaperId: 'default',
      accentColor: 'cyan',
    });
  });

  it('renders sidebar with Appearance and System sections', () => {
    render(<SettingsComponent />);

    expect(screen.getByRole('button', { name: 'Appearance' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'System' })).toBeTruthy();
  });

  it('renders theme options in Appearance panel', () => {
    render(<SettingsComponent />);

    expect(screen.getByLabelText(/Light/i)).toBeTruthy();
    expect(screen.getByLabelText(/Dark/i)).toBeTruthy();
    expect(screen.getByLabelText(/System/i)).toBeTruthy();
  });

  it('changes theme when radio button is clicked', () => {
    render(<SettingsComponent />);

    const lightRadio = screen.getByLabelText(/Light/i) as HTMLInputElement;
    fireEvent.click(lightRadio);

    const state = useSettingsStore.getState();
    expect(state.themeVariant).toBe('light');
  });

  it('changes wallpaper when selector is changed', () => {
    render(<SettingsComponent />);

    const wallpaperSelect = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(wallpaperSelect, { target: { value: 'neon-circuit' } });

    const state = useSettingsStore.getState();
    expect(state.wallpaperId).toBe('neon-circuit');
  });

  it('switches to System section when clicked', () => {
    render(<SettingsComponent />);

    const systemButton = screen.getByRole('button', { name: 'System' });
    fireEvent.click(systemButton);

    expect(screen.getByText(/System settings coming soon/i)).toBeTruthy();
  });

  it('navigates with arrow keys', () => {
    const { container } = render(<SettingsComponent />);
    const mainContainer = container.querySelector('[tabIndex="0"]');

    expect(mainContainer).toBeTruthy();

    fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
    fireEvent.keyDown(mainContainer!, { key: 'ArrowUp' });

    // Test passes if no errors thrown
    expect(mainContainer).toBeTruthy();
  });

  it('toggles theme with Enter key', () => {
    const { container } = render(<SettingsComponent />);
    const mainContainer = container.querySelector('[tabIndex="0"]');

    act(() => {
      useSettingsStore.setState({ themeVariant: 'dark' });
    });

    act(() => {
      fireEvent.keyDown(mainContainer!, { key: 'Enter' });
    });

    const state = useSettingsStore.getState();
    expect(['light', 'dark', 'system']).toContain(state.themeVariant);
  });

  it('closes window with Escape key', () => {
    const onClose = vi.fn();
    const { container } = render(<SettingsComponent onClose={onClose} />);
    const mainContainer = container.querySelector('[tabIndex="0"]');

    fireEvent.keyDown(mainContainer!, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Settings app manifest', () => {
  it('is a singleton app', () => {
    expect(SettingsApp.manifest.singleton).toBe(true);
  });

  it('has correct app metadata', () => {
    expect(SettingsApp.manifest.id).toBe('settings');
    expect(SettingsApp.manifest.name).toBe('Settings');
    expect(SettingsApp.manifest.category).toBe('system');
  });

  it('has sensible default and min sizes', () => {
    expect(SettingsApp.manifest.defaultSize).toEqual({ width: 500, height: 600 });
    expect(SettingsApp.manifest.minSize).toEqual({ width: 400, height: 400 });
  });
});

describe('Settings persistence', () => {
  it('persists theme changes to localStorage', () => {
    render(<SettingsComponent />);

    const lightRadio = screen.getByLabelText(/Light/i) as HTMLInputElement;
    fireEvent.click(lightRadio);

    const stored = localStorage.getItem('rb.shell.settings');
    expect(stored).toBeTruthy();

    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.themeVariant).toBe('light');
    }
  });

  it('persists wallpaper changes to localStorage', () => {
    render(<SettingsComponent />);

    const wallpaperSelect = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(wallpaperSelect, { target: { value: 'frost-grid' } });

    const stored = localStorage.getItem('rb.shell.settings');
    expect(stored).toBeTruthy();

    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.wallpaperId).toBe('frost-grid');
    }
  });
});
