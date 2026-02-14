// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Launcher } from '../Launcher';
import type { RedByteApp } from '../types';

const sampleApps = [
  { id: 'terminal', name: 'Terminal' },
  { id: 'files', name: 'Files' },
];

describe('Launcher component', () => {
  it('renders app entries and calls onLaunch when clicked', () => {
    const onLaunch = vi.fn();

    render(<Launcher apps={sampleApps} onLaunch={onLaunch} />);

    expect(screen.getByRole('option', { name: 'Terminal' })).toHaveFocus();
    expect(screen.getByText('Terminal')).toBeTruthy();
    expect(screen.getByText('Files')).toBeTruthy();

    fireEvent.click(screen.getByRole('option', { name: 'Terminal' }));
    expect(onLaunch).toHaveBeenCalledWith('terminal');
  });

  it('renders Open Settings action only when settings app exists', () => {
    const onLaunch = vi.fn();

    const { rerender } = render(
      <Launcher apps={[...sampleApps, { id: 'settings', name: 'Settings' }]} onLaunch={onLaunch} />
    );

    expect(screen.getByText('Open Settings')).toBeTruthy();

    rerender(<Launcher apps={sampleApps} onLaunch={onLaunch} />);

    expect(screen.queryByText('Open Settings')).toBeNull();
  });

  it('launches settings with Ctrl+, and closes when available', () => {
    const onLaunch = vi.fn();
    const onClose = vi.fn();

    render(
      <Launcher
        apps={[...sampleApps, { id: 'settings', name: 'Settings' }]}
        onLaunch={onLaunch}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /app launcher/i });
    fireEvent.keyDown(dialog, { key: ',', ctrlKey: true });

    expect(onLaunch).toHaveBeenCalledWith('settings');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Settings shortcut when Shift or Alt is held', () => {
    const onLaunch = vi.fn();
    const onClose = vi.fn();

    render(
      <Launcher
        apps={[...sampleApps, { id: 'settings', name: 'Settings' }]}
        onLaunch={onLaunch}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /app launcher/i });
    fireEvent.keyDown(dialog, { key: ',', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(dialog, { key: ',', ctrlKey: true, altKey: true });
    fireEvent.keyDown(dialog, { key: ',', metaKey: true, shiftKey: true });

    expect(onLaunch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not launch settings with Ctrl+, when typing in editable target', () => {
    const onLaunch = vi.fn();
    const onClose = vi.fn();

    render(
      <Launcher
        apps={[...sampleApps, { id: 'settings', name: 'Settings' }]}
        onLaunch={onLaunch}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /app launcher/i });
    const input = document.createElement('input');
    dialog.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: ',', ctrlKey: true });

    expect(onLaunch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('auto-closes after launching when onClose is provided', () => {
    const onLaunch = vi.fn();
    const onClose = vi.fn();

    render(<Launcher apps={sampleApps} onLaunch={onLaunch} onClose={onClose} />);

    fireEvent.click(screen.getByRole('option', { name: 'Terminal' }));

    expect(onLaunch).toHaveBeenCalledWith('terminal');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toggles help overlay with question mark key', () => {
    const onLaunch = vi.fn();
    const onClose = vi.fn();

    render(<Launcher apps={sampleApps} onLaunch={onLaunch} onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: /app launcher/i });

    expect(screen.queryByText('Help')).toBeNull();

    fireEvent.keyDown(dialog, { key: '?' });
    expect(screen.getByText('Help')).toBeTruthy();

    fireEvent.keyDown(dialog, { key: '?' });
    expect(screen.queryByText('Help')).toBeNull();
    expect(onLaunch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders recent apps section and launches from it', () => {
    const onLaunch = vi.fn();

    render(
      <Launcher
        apps={sampleApps}
        recentApps={[{ id: 'files', name: 'Files' }]}
        onLaunch={onLaunch}
      />
    );

    const recentHeading = screen.getByRole('heading', { name: 'Recent' });
    const recentSection = recentHeading.parentElement;
    expect(recentSection).toBeTruthy();

    const recentButton = within(recentSection as HTMLElement).getByRole('option', { name: 'Files' });
    expect(recentButton).toHaveFocus();

    fireEvent.click(recentButton);
    expect(onLaunch).toHaveBeenCalledWith('files');
  });

  it('renders pinned apps and toggles pin without launching', () => {
    const onLaunch = vi.fn();
    const onTogglePin = vi.fn();
    const onClose = vi.fn();

    render(
      <Launcher
        apps={sampleApps}
        pinnedApps={[{ id: 'terminal', name: 'Terminal' }]}
        onLaunch={onLaunch}
        onTogglePin={onTogglePin}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Pinned')).toBeTruthy();
    expect(screen.getAllByText('Terminal')).toHaveLength(1);
    const unpinButton = screen.getByRole('button', { name: 'Unpin Terminal' });

    fireEvent.click(unpinButton);
    expect(onTogglePin).toHaveBeenCalledWith('terminal');
    expect(onLaunch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows running indicator for running apps', () => {
    render(<Launcher apps={sampleApps} runningAppIds={['terminal']} />);

    expect(screen.getByText('(Running)')).toBeTruthy();
  });

  it('supports keyboard navigation and launch', () => {
    const onLaunch = vi.fn();

    render(<Launcher apps={sampleApps} onLaunch={onLaunch} />);

    const dialog = screen.getByRole('dialog', { name: /app launcher/i });
    const firstButton = screen.getByRole('option', { name: 'Terminal' });
    const secondButton = screen.getByRole('option', { name: 'Files' });

    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    expect(secondButton).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Enter' });

    expect(onLaunch).toHaveBeenCalledWith('files');
  });

  it('filters by keyboard input and launches selection', () => {
    const onLaunch = vi.fn();

    render(
      <Launcher
        apps={[
          { id: 'terminal', name: 'Terminal' },
          { id: 'files', name: 'Files' },
          { id: 'settings', name: 'Settings' },
        ]}
        onLaunch={onLaunch}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /app launcher/i });

    fireEvent.keyDown(dialog, { key: 't' });
    fireEvent.keyDown(dialog, { key: 'e' });

    expect(screen.getByText('Search: te')).toBeTruthy();
    expect(screen.getByText('Terminal')).toBeTruthy();
    expect(screen.queryByText('Files')).toBeNull();
    expect(screen.queryByText('Settings')).toBeNull();

    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(onLaunch).toHaveBeenCalledWith('terminal');
  });

  it('clears query with Escape without closing when query exists', () => {
    const onClose = vi.fn();

    render(
      <Launcher
        apps={[
          { id: 'terminal', name: 'Terminal' },
          { id: 'files', name: 'Files' },
        ]}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /app launcher/i });

    fireEvent.keyDown(dialog, { key: 't' });
    expect(screen.getByText('Search: t')).toBeTruthy();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByText('Search: t')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handles empty results and backspace restore', () => {
    const onLaunch = vi.fn();

    render(
      <Launcher
        apps={[
          { id: 'terminal', name: 'Terminal' },
          { id: 'files', name: 'Files' },
        ]}
        onLaunch={onLaunch}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /app launcher/i });

    fireEvent.keyDown(dialog, { key: 'z' });
    fireEvent.keyDown(dialog, { key: 'z' });

    expect(screen.getByText('No matches')).toBeTruthy();

    fireEvent.keyDown(dialog, { key: 'Backspace' });
    fireEvent.keyDown(dialog, { key: 'Backspace' });

    expect(screen.queryByText('No matches')).toBeNull();
    expect(screen.getByText('Terminal')).toBeTruthy();
    expect(screen.getByText('Files')).toBeTruthy();
  });

  it('calls onClose when Escape is pressed with empty query', () => {
    const onClose = vi.fn();

    render(<Launcher apps={sampleApps} onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: /app launcher/i });

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Launcher data', () => {
  it('applies strict student launcher whitelist in student mode', async () => {
    vi.resetModules();
    const { useCapabilitiesStore } = await import('../stores/capabilitiesStore');
    useCapabilitiesStore.getState().setStudentMode(true);
    const { registerApp } = await import('../AppRegistry');
    const { getAppsForLauncher } = await import('../launcherData');

    const StubComponent: React.FC = () => null;
    registerApp({
      manifest: {
        id: 'home',
        name: 'Studio Dashboard',
        iconId: 'neon-wave',
        category: 'system',
      },
      component: StubComponent,
    });
    registerApp({
      manifest: {
        id: 'lab-workspace',
        name: 'Studio',
        iconId: 'cpu',
        category: 'logic',
      },
      component: StubComponent,
    });
    registerApp({
      manifest: {
        id: 'terminal',
        name: 'Terminal',
        iconId: 'terminal',
        category: 'system',
      },
      component: StubComponent,
    });
    registerApp({
      manifest: {
        id: 'files',
        name: 'Files',
        iconId: 'files',
        category: 'system',
      },
      component: StubComponent,
    });
    registerApp({
      manifest: {
        id: 'logic-playground',
        name: 'Playground',
        iconId: 'cpu',
        category: 'logic',
      },
      component: StubComponent,
    });
    registerApp({
      manifest: {
        id: 'settings',
        name: 'Settings',
        iconId: 'settings',
        category: 'system',
      },
      component: StubComponent,
    });

    const apps = await getAppsForLauncher();
    const ids = apps.map((app) => app.id).sort();
    expect(ids).toEqual(['files', 'home', 'lab-workspace', 'logic-playground', 'settings']);
    expect(ids).not.toContain('terminal');
  });

  it('keeps launcher curated in non-student mode', async () => {
    vi.resetModules();
    const { useCapabilitiesStore } = await import('../stores/capabilitiesStore');
    useCapabilitiesStore.getState().setStudentMode(false);
    const { registerApp } = await import('../AppRegistry');
    const { getAppsForLauncher } = await import('../launcherData');

    const StubComponent: React.FC = () => null;
    registerApp({
      manifest: {
        id: 'home',
        name: 'Studio Dashboard',
        iconId: 'neon-wave',
        category: 'system',
      },
      component: StubComponent,
    });
    registerApp({
      manifest: {
        id: 'lab-workspace',
        name: 'Studio',
        iconId: 'cpu',
        category: 'logic',
      },
      component: StubComponent,
    });
    registerApp({
      manifest: {
        id: 'terminal',
        name: 'Terminal',
        iconId: 'terminal',
        category: 'system',
      },
      component: StubComponent,
    });
    registerApp({
      manifest: {
        id: 'files',
        name: 'Files',
        iconId: 'files',
        category: 'system',
      },
      component: StubComponent,
    });

    const apps = await getAppsForLauncher();
    const ids = apps.map((app) => app.id);
    expect(ids).toContain('home');
    expect(ids).toContain('lab-workspace');
    expect(ids).not.toContain('files');
    expect(ids).not.toContain('terminal');
  });

  it('keeps launcher curated for ta mode in non-student mode', async () => {
    vi.resetModules();
    const { useCapabilitiesStore } = await import('../stores/capabilitiesStore');
    useCapabilitiesStore.getState().setStudentMode(false);
    window.localStorage.setItem('rb:mode:v1', 'ta');
    const { registerApp } = await import('../AppRegistry');
    const { getAppsForLauncher } = await import('../launcherData');

    const StubComponent: React.FC = () => null;
    registerApp({
      manifest: {
        id: 'terminal',
        name: 'Terminal',
        iconId: 'terminal',
        category: 'system',
      },
      component: StubComponent,
    });

    const apps = await getAppsForLauncher();
    const ids = apps.map((app) => app.id);
    expect(ids).not.toContain('terminal');
  });

  it('derives curated launcher list from registry and excludes launcher itself', async () => {
    vi.resetModules();
    const { useCapabilitiesStore } = await import('../stores/capabilitiesStore');
    useCapabilitiesStore.getState().setStudentMode(false);
    window.localStorage.setItem('rb:mode:v1', 'ta');
    const { registerApp } = await import('../AppRegistry');
    const { getAppsForLauncher } = await import('../launcherData');

    const StubComponent: React.FC = () => null;
    const launcherApp: RedByteApp = {
      manifest: {
        id: 'launcher',
        name: 'Launcher',
        iconId: 'browser',
        category: 'system',
        singleton: true,
        defaultSize: { width: 640, height: 480 },
        minSize: { width: 320, height: 240 },
      },
      component: StubComponent,
    };

    const terminalApp: RedByteApp = {
      manifest: {
        id: 'terminal',
        name: 'Terminal',
        iconId: 'terminal',
        category: 'system',
        singleton: true,
        defaultSize: { width: 640, height: 480 },
        minSize: { width: 320, height: 240 },
      },
      component: StubComponent,
    };

    const filesApp: RedByteApp = {
      manifest: {
        id: 'files',
        name: 'Files',
        iconId: 'files',
        category: 'system',
        singleton: true,
        defaultSize: { width: 640, height: 480 },
        minSize: { width: 320, height: 240 },
      },
      component: StubComponent,
    };

    registerApp(launcherApp);
    registerApp(terminalApp);
    registerApp(filesApp);
    registerApp({
      manifest: {
        id: 'home',
        name: 'Studio Dashboard',
        iconId: 'neon-wave',
        category: 'system',
      },
      component: StubComponent,
    });
    registerApp({
      manifest: {
        id: 'lab-workspace',
        name: 'Studio',
        iconId: 'cpu',
        category: 'logic',
      },
      component: StubComponent,
    });

    const apps = await getAppsForLauncher();
    const ids = apps.map((app) => app.id);

    expect(ids).toContain('home');
    expect(ids).toContain('lab-workspace');
    expect(ids).not.toContain('files');
    expect(ids).not.toContain('terminal');
    expect(ids).not.toContain('launcher');
  });
});
