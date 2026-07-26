// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { ImportSurface } from '../surfaces/ImportSurface';

afterEach(() => {
  cleanup();
});

describe('ImportSurface workstation redesign', () => {
  it('shows the horizontal workflow, promotes schematic review, and surfaces board detection', async () => {
    const view = render(<ImportSurface onImportProject={vi.fn()} />);

    const workflow = view.getByTestId('ide-import-horizontal-stepper');
    expect(within(workflow).getByText('Upload')).toBeTruthy();
    expect(within(workflow).getByText('Review')).toBeTruthy();
    expect(within(workflow).getByText('Apply')).toBeTruthy();
    expect(workflow.querySelectorAll('li')).toHaveLength(3);
    expect(view.queryByTestId('ide-import-workflow-rail')).toBeNull();

    fireEvent.click(view.getByTestId('ide-import-load-sample-and-gate'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-review-shell')).toBeTruthy();
    });

    expect(view.getByTestId('ide-import-ports-table').textContent).toContain('Entity Port');
    expect(view.getByTestId('ide-import-ports-table').textContent).toContain('Board Pin');
    expect(view.getByTestId('ide-import-schematic-preview').textContent).toContain('top');

    await waitFor(() => {
      expect(view.getByTestId('ide-import-board-detection').textContent).toContain('Basys3');
    });

    expect(view.getByTestId('ide-import-board-detection').textContent).toContain('High');
  });

  it('keeps the ports-only rescue path wired through to Export', async () => {
    const onGoToExport = vi.fn();
    const view = render(<ImportSurface onImportProject={vi.fn()} onGoToExport={onGoToExport} />);

    fireEvent.click(view.getByTestId('ide-import-load-sample-edge-detect'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-ports-only-warning')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-import-go-to-export'));
    expect(onGoToExport).toHaveBeenCalledTimes(1);
  });

  it('gives keyboard users a visible Escape path out of the pasted HDL editor', async () => {
    const view = render(<ImportSurface onImportProject={vi.fn()} />);

    fireEvent.click(view.getByTestId('ide-import-start-secondary'));
    const editor = await view.findByTestId('ide-import-hdl-textarea');

    expect(view.getByTestId('ide-import-hdl-editor-keyboard-help').textContent).toContain(
      'Escape leaves the editor'
    );

    editor.focus();
    expect(document.activeElement).toBe(editor);
    fireEvent.keyDown(editor, { key: 'Escape' });

    expect(document.activeElement).toBe(view.getByTestId('ide-import-load-sample-and-gate'));
  });
});
