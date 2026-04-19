// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { IdeWorkbenchShell } from '../components/IdeWorkbenchShell';

describe('IdeWorkbenchShell', () => {
  const nativeWidth = window.innerWidth;
  const nativeRaf = window.requestAnimationFrame;
  const nativeCancelRaf = window.cancelAnimationFrame;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1180,
    });
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = vi.fn() as typeof window.cancelAnimationFrame;
    window.localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: nativeWidth,
    });
    window.requestAnimationFrame = nativeRaf;
    window.cancelAnimationFrame = nativeCancelRaf;
    window.localStorage.clear();
  });

  function renderShell(
    overrides: Partial<React.ComponentProps<typeof IdeWorkbenchShell>> = {}
  ) {
    return render(
      <IdeWorkbenchShell
        mode="project"
        workspace={<div>Workspace</div>}
        leftDock={<div>Dock</div>}
        rightDock={<div>Inspector</div>}
        console={<div>Console</div>}
        {...overrides}
      />
    );
  }

  it('marks compact layout mode when the viewport is below 1280px', async () => {
    const { getByTestId } = renderShell();

    await waitFor(() => {
      expect(getByTestId('ide-mode-project')).toHaveAttribute('data-layout-mode', 'compact');
    });
  });

  it('resets dock and workspace scroll positions when the mode changes', async () => {
    const { getByTestId, rerender } = render(
      <IdeWorkbenchShell
        mode="project"
        workspace={
          <div style={{ height: 1200 }}>
            <div style={{ height: 1200 }}>Workspace</div>
          </div>
        }
        leftDock={<div style={{ height: 1200 }}>Left</div>}
        rightDock={<div style={{ height: 1200 }}>Right</div>}
        console={<div style={{ height: 1200 }}>Console</div>}
        consoleHasEntries
      />
    );

    const leftDock = getByTestId('ide-left-dock');
    const workspace = getByTestId('ide-mode-body');
    const inspector = getByTestId('ide-inspector');
    const console = getByTestId('ide-workbench-console');

    leftDock.scrollTop = 120;
    workspace.scrollTop = 96;
    inspector.scrollTop = 72;
    console.scrollTop = 48;

    rerender(
      <IdeWorkbenchShell
        mode="verify"
        workspace={
          <div style={{ height: 1200 }}>
            <div style={{ height: 1200 }}>Workspace</div>
          </div>
        }
        leftDock={<div style={{ height: 1200 }}>Left</div>}
        rightDock={<div style={{ height: 1200 }}>Right</div>}
        console={<div style={{ height: 1200 }}>Console</div>}
        consoleHasEntries
      />
    );

    await waitFor(() => {
      expect(leftDock.scrollTop).toBe(0);
      expect(workspace.scrollTop).toBe(0);
      expect(inspector.scrollTop).toBe(0);
      expect(console.scrollTop).toBe(0);
    });
  });

  it('restores scroll positions when returning to a previously visited surface', async () => {
    const { getByTestId, rerender } = render(
      <IdeWorkbenchShell
        mode="project"
        workspace={
          <div style={{ height: 1200 }}>
            <div style={{ height: 1200 }}>Workspace</div>
          </div>
        }
        leftDock={<div style={{ height: 1200 }}>Left</div>}
        rightDock={<div style={{ height: 1200 }}>Right</div>}
        console={<div style={{ height: 1200 }}>Console</div>}
        consoleHasEntries
      />
    );

    const inspector = getByTestId('ide-inspector');

    // Simulate scrolling: set scrollTop then dispatch scroll event to trigger capture
    inspector.scrollTop = 72;
    inspector.dispatchEvent(new Event('scroll', { bubbles: false }));

    // Switch away to verify
    rerender(
      <IdeWorkbenchShell
        mode="verify"
        workspace={<div style={{ height: 1200 }}>Workspace</div>}
        leftDock={<div style={{ height: 1200 }}>Left</div>}
        rightDock={<div style={{ height: 1200 }}>Right</div>}
        console={<div style={{ height: 1200 }}>Console</div>}
        consoleHasEntries
      />
    );

    await waitFor(() => {
      expect(inspector.scrollTop).toBe(0); // first visit to verify
    });

    // Switch back to project
    rerender(
      <IdeWorkbenchShell
        mode="project"
        workspace={<div style={{ height: 1200 }}>Workspace</div>}
        leftDock={<div style={{ height: 1200 }}>Left</div>}
        rightDock={<div style={{ height: 1200 }}>Right</div>}
        console={<div style={{ height: 1200 }}>Console</div>}
        consoleHasEntries
      />
    );

    await waitFor(() => {
      expect(inspector.scrollTop).toBe(72); // restored from saved state
    });
  });

  it('shows a left restore rail when the left dock is collapsed and restores the dock on click', async () => {
    const { queryByTestId, getByTestId } = renderShell({
      leftDockMode: 'collapsed',
    });

    expect(queryByTestId('ide-left-dock')).toBeNull();
    expect(getByTestId('ide-mode-project').style.getPropertyValue('--ide-workbench-left-slot-width')).toBe('38px');
    const restoreRail = getByTestId('ide-workbench-dock-toggle-left');
    expect(restoreRail.textContent).toContain('Library');

    fireEvent.click(restoreRail);

    await waitFor(() => {
      expect(getByTestId('ide-left-dock')).toBeTruthy();
    });
    expect(getByTestId('ide-workbench-dock-collapse-left')).toBeTruthy();
  });

  it('emits explicit dock state markers for shared layout styling', () => {
    const { getByTestId } = renderShell({
      leftDockMode: 'collapsed',
      rightDockMode: 'visible',
    });

    const shell = getByTestId('ide-mode-project');
    expect(shell).toHaveAttribute('data-left-dock-state', 'collapsed');
    expect(shell).toHaveAttribute('data-right-dock-state', 'visible');
  });

  it('removes both left dock and restore rail when the left dock is hidden', () => {
    const { container, queryByTestId } = renderShell({
      leftDockMode: 'hidden',
    });

    expect(queryByTestId('ide-left-dock')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    const spacer = container.querySelector('.ide-workbench-slot-spacer') as HTMLDivElement | null;
    expect(spacer).toBeTruthy();
    expect(spacer?.style.pointerEvents).toBe('none');
  });

  it('marks the workbench grid when the right dock is fully hidden', () => {
    const { getByTestId, queryByTestId } = renderShell({
      rightDockMode: 'hidden',
    });

    expect(queryByTestId('ide-inspector')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
    expect(getByTestId('ide-surface-grid').className).toContain('hide-right-dock');
    expect(getByTestId('ide-mode-project')).toHaveAttribute('data-right-dock-state', 'hidden');
  });

  it('keeps visible design docks fixed open when collapse affordances are disabled', () => {
    const { getByTestId, queryByTestId } = render(
      <IdeWorkbenchShell
        mode="design"
        workspace={<div>Workspace</div>}
        leftDock={<div>Library</div>}
        rightDock={<div>Inspector</div>}
        leftDockMode="visible"
        rightDockMode="visible"
      />
    );

    expect(getByTestId('ide-left-dock')).toBeTruthy();
    expect(getByTestId('ide-inspector')).toBeTruthy();
    expect(queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-collapse-right')).toBeNull();
  });

  it('preserves the existing collapsed right dock restore flow', async () => {
    const { queryByTestId, getByTestId } = renderShell({
      rightDockMode: 'collapsed',
    });

    expect(queryByTestId('ide-inspector')).toBeNull();

    fireEvent.click(getByTestId('ide-workbench-dock-toggle-right'));

    await waitFor(() => {
      expect(getByTestId('ide-inspector')).toBeTruthy();
    });
    expect(getByTestId('ide-workbench-dock-collapse-right')).toBeTruthy();
  });

  it('lets a visible right dock collapse into a restore rail when manual collapse is enabled', async () => {
    const view = render(
      <IdeWorkbenchShell
        {...({
          mode: 'project',
          workspace: <div>Workspace</div>,
          leftDock: <div>Dock</div>,
          rightDock: <div>Inspector</div>,
          console: <div>Console</div>,
          rightDockMode: 'visible',
          rightDockCanCollapse: true,
          rightDockRevealKey: 'selection:ld0',
        } as any)}
      />
    );

    expect(view.getByTestId('ide-inspector')).toBeTruthy();
    expect(view.getByTestId('ide-workbench-dock-collapse-right')).toBeTruthy();

    fireEvent.click(view.getByTestId('ide-workbench-dock-collapse-right'));

    await waitFor(() => {
      expect(view.queryByTestId('ide-inspector')).toBeNull();
    });
    expect(view.getByTestId('ide-workbench-dock-toggle-right')).toBeTruthy();

    view.rerender(
      <IdeWorkbenchShell
        {...({
          mode: 'project',
          workspace: <div>Workspace</div>,
          leftDock: <div>Dock</div>,
          rightDock: <div>Inspector</div>,
          console: <div>Console</div>,
          rightDockMode: 'visible',
          rightDockCanCollapse: true,
          rightDockRevealKey: 'selection:ld0',
        } as any)}
      />
    );

    expect(view.queryByTestId('ide-inspector')).toBeNull();

    view.rerender(
      <IdeWorkbenchShell
        {...({
          mode: 'project',
          workspace: <div>Workspace</div>,
          leftDock: <div>Dock</div>,
          rightDock: <div>Inspector</div>,
          console: <div>Console</div>,
          rightDockMode: 'visible',
          rightDockCanCollapse: true,
          rightDockRevealKey: 'selection:q1',
        } as any)}
      />
    );

    await waitFor(() => {
      expect(view.getByTestId('ide-inspector')).toBeTruthy();
    });
  });

  it('starts collapsed when consoleMode is collapsed even when entries exist', () => {
    const { getByTestId } = renderShell({
      consoleHasEntries: true,
      consoleMode: 'collapsed',
    });

    expect(getByTestId('ide-workbench-console')).toHaveAttribute('data-console-state', 'collapsed');
  });

  it('starts expanded when consoleMode is expanded', () => {
    const { getByTestId } = renderShell({
      consoleMode: 'expanded',
    });

    expect(getByTestId('ide-workbench-console')).toHaveAttribute('data-console-state', 'expanded');
  });

  it('removes the console when consoleMode is hidden', () => {
    const { queryByTestId } = renderShell({
      consoleMode: 'hidden',
    });

    expect(queryByTestId('ide-workbench-console')).toBeNull();
    expect(queryByTestId('ide-workbench-resize-bottom')).toBeNull();
  });

  it('emits shell density and surface frame markers', () => {
    const { getByTestId } = renderShell({
      shellDensity: 'immersive',
      surfaceFrame: 'edge-to-edge',
    });

    expect(getByTestId('ide-mode-project')).toHaveAttribute('data-shell-density', 'immersive');
    expect(getByTestId('ide-mode-project')).toHaveAttribute('data-surface-frame', 'edge-to-edge');
  });

  it('defaults project surfaces to workbench layout intent', () => {
    const { getByTestId } = renderShell();

    expect(getByTestId('ide-mode-project')).toHaveAttribute('data-layout-intent', 'workbench');
  });

  it('allows readable layout intent to be set explicitly', () => {
    const { getByTestId } = renderShell({
      layoutIntent: 'readable',
    });

    expect(getByTestId('ide-mode-project')).toHaveAttribute('data-layout-intent', 'readable');
  });

  it('keeps hideRightDock compatibility by forcing the right dock hidden', () => {
    const { queryByTestId } = renderShell({
      hideRightDock: true,
      rightDockMode: 'visible',
    });

    expect(queryByTestId('ide-inspector')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
  });

  it('keeps default shell behavior unchanged when no policy props are supplied', () => {
    const { getByTestId } = renderShell({
      consoleHasEntries: true,
    });

    expect(getByTestId('ide-left-dock')).toBeTruthy();
    expect(getByTestId('ide-inspector')).toBeTruthy();
    expect(getByTestId('ide-workbench-console')).toHaveAttribute('data-console-state', 'expanded');
  });

  it('does not render a global Focus toggle or focus-mode shell marker', () => {
    const { getByTestId, queryByTestId } = renderShell({
      consoleHasEntries: true,
    });

    expect(queryByTestId('ide-workbench-focus-toggle')).toBeNull();
    expect(getByTestId('ide-mode-project')).not.toHaveAttribute('data-focus-mode');
  });
});
