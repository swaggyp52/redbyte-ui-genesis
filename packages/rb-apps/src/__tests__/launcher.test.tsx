// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    expect(screen.getByText('Terminal')).toBeTruthy();
    expect(screen.getByText('Files')).toBeTruthy();

    fireEvent.click(screen.getByText('Terminal'));
    expect(onLaunch).toHaveBeenCalledWith('terminal');
  });
});

describe('Launcher data', () => {
  it('derives launcher list from registry and excludes launcher itself', async () => {
    vi.resetModules();
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

    const apps = getAppsForLauncher();
    const ids = apps.map((app) => app.id);

    expect(ids).toContain('terminal');
    expect(ids).toContain('files');
    expect(ids).not.toContain('launcher');
  });
});
