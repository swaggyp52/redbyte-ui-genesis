// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { ImportSurface } from '../surfaces/ImportSurface';

describe('ImportSurface workstation redesign', () => {
  it('shows a workflow rail, promotes schematic review, and surfaces board detection after XDC parse', async () => {
    const view = render(<ImportSurface onImportProject={vi.fn()} />);

    const workflowRail = view.getByTestId('ide-import-workflow-rail');
    expect(within(workflowRail).getByText('Upload ZIP')).toBeTruthy();
    expect(within(workflowRail).getByText('Parse HDL')).toBeTruthy();
    expect(within(workflowRail).getByText('Map ports')).toBeTruthy();
    expect(within(workflowRail).getByText('Review schematic')).toBeTruthy();
    expect(within(workflowRail).getByText('Apply import')).toBeTruthy();

    fireEvent.click(view.getByTestId('ide-import-load-sample-and-gate'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-review-shell')).toBeTruthy();
    });

    expect(view.getByTestId('ide-import-ports-table').textContent).toContain('Entity Port');
    expect(view.getByTestId('ide-import-ports-table').textContent).toContain('Board Pin');
    expect(view.getByTestId('ide-import-schematic-preview').textContent).toContain('top');

    fireEvent.click(view.getByTestId('ide-import-parse-xdc'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-board-detection').textContent).toContain('Basys3');
    });

    expect(view.getByTestId('ide-import-board-detection').textContent).toContain('High');
  });

  it('keeps the ports-only rescue path wired through to Export', async () => {
    const onGoToExport = vi.fn();
    const view = render(<ImportSurface onImportProject={vi.fn()} onGoToExport={onGoToExport} />);

    fireEvent.click(view.getByTestId('ide-import-toggle-behavioral-samples'));
    fireEvent.click(view.getByTestId('ide-import-load-sample-edge-detect'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-ports-only-warning')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-import-go-to-export'));
    expect(onGoToExport).toHaveBeenCalledTimes(1);
  });
});
