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
    const restoreRail = getByTestId('ide-workbench-dock-toggle-left');
    expect(restoreRail.textContent).toContain('Library');

    fireEvent.click(restoreRail);

    await waitFor(() => {
      expect(getByTestId('ide-left-dock')).toBeTruthy();
    });
    expect(getByTestId('ide-workbench-dock-collapse-left')).toBeTruthy();
  });

  it('removes both left dock and restore rail when the left dock is hidden', () => {
    const { queryByTestId } = renderShell({
      leftDockMode: 'hidden',
    });

    expect(queryByTestId('ide-left-dock')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-left')).toBeNull();
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
});
