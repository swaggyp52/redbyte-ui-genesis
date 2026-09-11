// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { IdeWorkbenchShell } from '../components/IdeWorkbenchShell';
import { workspacePreferencesStore } from '../workspacePreferences';

afterEach(() => cleanup());
beforeEach(() => workspacePreferencesStore.reset());

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
    expect(shell).toHaveAttribute('data-support-dock-policy', 'persistent-configurable');
    expect(view.getByTestId('ide-resize-left-dock')).toHaveAttribute('role', 'separator');
    expect(view.getByTestId('ide-resize-right-dock')).toHaveAttribute('role', 'separator');
  });

  it('treats collapsed requests as preference-governed, restorable regions', () => {
    workspacePreferencesStore.setDock('design', 'left', { visible: false });
    workspacePreferencesStore.setDock('design', 'right', { visible: false });
    const view = renderShell({ leftDockMode: 'collapsed', rightDockMode: 'collapsed', rightDockCanCollapse: true });

    expect(view.queryByTestId('ide-left-dock')).toBeNull();
    expect(view.queryByTestId('ide-right-dock')).toBeNull();
    expect(view.getByTestId('ide-show-left-dock').textContent).toContain('Show left');
    expect(view.getByTestId('ide-show-right-dock').textContent).toContain('Show right');

    fireEvent.click(view.getByTestId('ide-show-left-dock'));
    fireEvent.click(view.getByTestId('ide-show-right-dock'));
    expect(view.getByTestId('ide-left-dock')).toBeTruthy();
    expect(view.getByTestId('ide-right-dock')).toBeTruthy();
  });

  it('honors explicit hidden regions without rendering restore rails', () => {
    const view = renderShell({ leftDockMode: 'hidden', rightDockMode: 'hidden' });

    expect(view.queryByTestId('ide-left-dock')).toBeNull();
    expect(view.queryByTestId('ide-right-dock')).toBeNull();
    expect(view.queryByTestId('ide-show-left-dock')).toBeNull();
    expect(view.queryByTestId('ide-show-right-dock')).toBeNull();
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

  it('exposes keyboard-resizable, hideable panels through direct workbench controls', () => {
    const view = renderShell({ showDevChrome: true });
    const leakedArrowKey = vi.fn();
    window.addEventListener('keydown', leakedArrowKey);

    expect(view.queryByTestId('ide-chrome-toggle-bar')).toBeNull();
    expect(view.queryByTestId('ide-workbench-focus-toggle')).toBeNull();
    const shell = view.getByTestId('ide-mode-design');
    const leftResize = view.getByTestId('ide-resize-left-dock');
    // The contract is that the handle reports the dock's current size and that an arrow key
    // moves it by one step - not that Design's default happens to be a particular number.
    // Reading the default from the preference authority keeps this test about the behaviour.
    const defaultLeft = workspacePreferencesStore.getSnapshot().surfaces.design.docks.left.sizePx;
    expect(leftResize).toHaveAttribute('aria-valuenow', String(defaultLeft));
    expect(shell.style.getPropertyValue('--rb-workbench-pref-left-width')).toBe(`${defaultLeft}px`);
    fireEvent.keyDown(leftResize, { key: 'ArrowRight' });
    expect(view.getByTestId('ide-resize-left-dock')).toHaveAttribute('aria-valuenow', String(defaultLeft + 16));
    expect(shell.style.getPropertyValue('--rb-workbench-pref-left-width')).toBe(`${defaultLeft + 16}px`);
    expect(leakedArrowKey).not.toHaveBeenCalled();

    fireEvent.click(view.getByTestId('ide-hide-left-dock'));
    expect(view.queryByTestId('ide-left-dock')).toBeNull();
    fireEvent.click(view.getByTestId('ide-show-left-dock'));
    expect(view.getByTestId('ide-left-dock')).toBeTruthy();
    window.removeEventListener('keydown', leakedArrowKey);
  });

  it('opens each stage at the top without resetting workspace preferences', () => {
    const view = render(
      <div className="ide-surface-column" data-testid="surface-column">
        <IdeWorkbenchShell
          mode="design"
          workspace={<div className="ide-panel-body" data-testid="panel-body">Canvas</div>}
          leftDock={<div>Library</div>}
          rightDock={<div>Inspector</div>}
        />
      </div>
    );
    const surfaceColumn = view.getByTestId('surface-column');
    const modeBody = view.getByTestId('ide-mode-body');
    const panelBody = view.getByTestId('panel-body');
    surfaceColumn.scrollTop = 180;
    modeBody.scrollTop = 320;
    panelBody.scrollTop = 460;
    act(() => {
      workspacePreferencesStore.setDock('design', 'left', { sizePx: 284 });
    });

    view.rerender(
      <div className="ide-surface-column" data-testid="surface-column">
        <IdeWorkbenchShell
          mode="project"
          workspace={<div className="ide-panel-body" data-testid="panel-body">Project center</div>}
          leftDock={<div>Library</div>}
          rightDock={<div>Inspector</div>}
        />
      </div>
    );

    expect(view.getByTestId('surface-column').scrollTop).toBe(0);
    expect(view.getByTestId('ide-mode-body').scrollTop).toBe(0);
    expect(view.getByTestId('panel-body').scrollTop).toBe(0);
    expect(workspacePreferencesStore.getSnapshot().surfaces.design.docks.left.sizePx).toBe(284);
  });
});
