// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsApp } from '../apps/SettingsApp';
import { useSettingsStore } from '@redbyte/rb-utils';

const SettingsComponent = SettingsApp.component;

describe('Settings app lifecycle', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      themeVariant: 'redbyte-dark',
      wallpaperId: 'default',
      accentColor: 'cyan',
      tickRate: 20,
      reduceMotion: false,
      density: 'comfortable',
    });
  });

  it('renders sidebar with Appearance and System sections', () => {
    render(<SettingsComponent />);

    expect(screen.getByRole('button', { name: /Appearance/ })).toBeTruthy();
    // System section exists in sidebar - there are multiple elements with "System", verify at least one exists
    expect(screen.getAllByRole('button', { name: /System/ }).length).toBeGreaterThan(0);
  });

  it('renders theme options in Appearance panel', () => {
    render(<SettingsComponent />);

    expect(screen.getByRole('button', { name: /RedByte Dark/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Instrument/i })).toBeTruthy();
  });

  it('changes theme when button is clicked', () => {
    render(<SettingsComponent />);

    const instrumentButton = screen.getByRole('button', { name: /Instrument/i });
    fireEvent.click(instrumentButton);

    const state = useSettingsStore.getState();
    expect(state.themeVariant).toBe('instrument');
  });

  it('changes wallpaper when selector is changed', () => {
    render(<SettingsComponent />);

    const neonCircuitButton = screen.getByRole('button', { name: /Neon Circuit/i });
    fireEvent.click(neonCircuitButton);

    const state = useSettingsStore.getState();
    expect(state.wallpaperId).toBe('neon-circuit');
  });

  it('switches to System section when clicked', () => {
    render(<SettingsComponent />);

    // Find the System sidebar button (not the theme button) - it's in a button with specific styling
    const systemButtons = screen.getAllByRole('button', { name: /System/ });
    // The sidebar button is the one that will navigate to System section - click the first one
    fireEvent.click(systemButtons[0]);

    expect(screen.getByText(/Simulation Timing/i)).toBeTruthy();
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
    expect(SettingsApp.manifest.defaultSize).toEqual({ width: 800, height: 600 });
    expect(SettingsApp.manifest.minSize).toEqual({ width: 600, height: 500 });
  });
});

describe('Settings persistence', () => {
  it('persists theme changes to localStorage', () => {
    render(<SettingsComponent />);

    const instrumentButton = screen.getByRole('button', { name: /Instrument/i });
    fireEvent.click(instrumentButton);

    const stored = localStorage.getItem('rb.shell.settings');
    expect(stored).toBeTruthy();

    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.themeVariant).toBe('instrument');
    }
  });

  it('persists wallpaper changes to localStorage', () => {
    render(<SettingsComponent />);

    const frostGridButton = screen.getByRole('button', { name: /Frost Grid/i });
    fireEvent.click(frostGridButton);

    const stored = localStorage.getItem('rb.shell.settings');
    expect(stored).toBeTruthy();

    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.wallpaperId).toBe('frost-grid');
    }
  });
});
