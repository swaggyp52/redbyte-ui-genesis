// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { IdeWorkbenchShell } from '../components/IdeWorkbenchShell';

afterEach(() => cleanup());

function renderShell(
  overrides: Partial<React.ComponentProps<typeof IdeWorkbenchShell>> = {}
) {
  return render(
    <IdeWorkbenchShell
      mode="design"
      workspace={<div data-testid="workspace">Canvas</div>}
      leftDock={<div data-testid="library">Library</div>}
      rightDock={<div data-testid="inspector">Inspector</div>}
      {...overrides}
    />
  );
}

describe('IdeWorkbenchShell Unified Workbench v3 contract', () => {
  it('keeps supplied Design library, canvas, and inspector visible together', () => {
    const view = renderShell();
    const shell = view.getByTestId('ide-mode-design');
    const leftDock = view.getByTestId('ide-left-dock');
    const workspace = view.getByTestId('ide-mode-body');
    const rightDock = view.getByTestId('ide-right-dock');

    expect(view.getByTestId('library')).toBeTruthy();
    expect(view.getByTestId('workspace')).toBeTruthy();
    expect(view.getByTestId('inspector')).toBeTruthy();
    expect(leftDock.nextElementSibling).toBe(workspace);
    expect(workspace.nextElementSibling).toBe(rightDock);
    expect(view.container.querySelectorAll('main')).toHaveLength(1);
    expect(workspace).toHaveAttribute('aria-label', 'design workspace');
    expect(shell).toHaveAttribute('data-left-dock-state', 'visible');
    expect(shell).toHaveAttribute('data-right-dock-state', 'visible');
    expect(shell).toHaveAttribute('data-support-dock-policy', 'stable');
  });

  it('treats legacy collapsed requests as stable visible regions', () => {
    const view = renderShell({ leftDockMode: 'collapsed', rightDockMode: 'collapsed', rightDockCanCollapse: true });

    expect(view.getByTestId('ide-left-dock')).toBeTruthy();
    expect(view.getByTestId('ide-right-dock')).toBeTruthy();
    expect(view.queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-collapse-left')).toBeNull();
    expect(view.queryByTestId('ide-workbench-dock-collapse-right')).toBeNull();
  });

  it('honors explicit hidden regions without rendering restore rails', () => {
    const view = renderShell({ leftDockMode: 'hidden', rightDockMode: 'hidden' });

    expect(view.queryByTestId('ide-left-dock')).toBeNull();
    expect(view.queryByTestId('ide-right-dock')).toBeNull();
    expect(view.getByTestId('ide-mode-body').tagName).toBe('MAIN');
    expect(view.getByTestId('ide-mode-body')).toHaveAttribute('aria-label', 'design workspace');
    expect(view.container.querySelector('[class*="dock-toggle-rail"]')).toBeNull();
  });

  it('shows the console only for blocking diagnostics or an explicitly expanded tool', () => {
    const quiet = renderShell({ console: <div>Quiet output</div>, consoleHasEntries: true, consoleMode: 'auto' });
    expect(quiet.queryByTestId('ide-workbench-console')).toBeNull();
    quiet.unmount();

    const blocking = renderShell({
      console: <div>Fix the disconnected output</div>,
      consoleHasBlocking: true,
      consoleMode: 'hidden',
    });
    expect(blocking.getByTestId('ide-workbench-console')).toHaveAttribute('data-console-state', 'blocking');
    expect(blocking.getByTestId('ide-workbench-console').textContent).toContain('disconnected output');
  });

  it('contains no student-facing panel visibility chrome', () => {
    const view = renderShell({ showDevChrome: true });

    expect(view.queryByTestId('ide-chrome-toggle-bar')).toBeNull();
    expect(view.queryByTestId('ide-workbench-focus-toggle')).toBeNull();
    expect(view.container.querySelectorAll('button')).toHaveLength(0);
  });
});
