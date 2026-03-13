// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
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

  it('marks compact layout mode when the viewport is below 1280px', async () => {
    const { getByTestId } = render(
      <IdeWorkbenchShell
        mode="project"
        workspace={<div>Workspace</div>}
        leftDock={<div>Dock</div>}
        rightDock={<div>Inspector</div>}
      />
    );

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
});
