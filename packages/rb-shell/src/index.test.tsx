import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Desktop, Dock, Notifications, Taskbar } from './index';
import { createWindowingStore } from '@rb/rb-windowing';
import { AppManifest } from '@rb/rb-apps';

const testApps: AppManifest[] = [
  { id: 'terminal', title: 'Terminal', description: 'Test terminal' },
  { id: 'settings', title: 'Settings' },
];

describe('Desktop shell components', () => {
  it('launches apps from the Dock and renders windows', () => {
    render(<Desktop apps={testApps} />);

    const terminalButton = screen.getByRole('menuitem', { name: /Terminal/i });
    fireEvent.click(terminalButton);

    const dialog = screen.getByRole('dialog', { name: /Terminal window/i });
    expect(dialog).toBeInTheDocument();
  });

  it('supports minimizing and restoring windows through the Taskbar', () => {
    const store = createWindowingStore();
    render(
      <Desktop apps={[]} store={store}>
        <Taskbar />
      </Desktop>,
    );

    store.getState().open({ id: 'one', title: 'Demo', bounds: { x: 0, y: 0, width: 320, height: 240 } });

    const taskbarButton = screen.getByRole('button', { name: /Demo/i });
    fireEvent.doubleClick(taskbarButton);

    expect(screen.queryByRole('dialog', { name: /Demo window/i })).not.toBeVisible();

    fireEvent.click(taskbarButton);
    expect(screen.getByRole('dialog', { name: /Demo window/i })).toBeVisible();
  });

  it('persists wallpaper choice', () => {
    render(<Desktop apps={testApps} storageKey="test-wallpaper" />);

    const select = screen.getByLabelText('Wallpaper chooser');
    fireEvent.change(select, { target: { value: 'frost-grid' } });

    expect(window.localStorage.getItem('test-wallpaper')).toBe('frost-grid');
  });
});

describe('Notifications', () => {
  it('dismisses items when requested', () => {
    const onDismiss = vi.fn();
    render(
      <Notifications
        items={[{ id: '1', title: 'Update', message: 'Complete' }]}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByLabelText('Dismiss Update'));
    expect(onDismiss).toHaveBeenCalledWith('1');
  });
});
