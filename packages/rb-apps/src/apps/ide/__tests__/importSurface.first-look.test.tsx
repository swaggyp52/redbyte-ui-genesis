// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { ImportSurface } from '../surfaces/ImportSurface';

describe('ImportSurface first look', () => {
  it('leads with one clear starting action and keeps replacement as a review step', () => {
    const { getByTestId, queryByTestId } = render(
      <ImportSurface onImportProject={vi.fn()} />
    );

    expect(getByTestId('ide-import-command-strip').textContent).toContain('Import');
    expect(getByTestId('ide-import-start-shell')).toBeTruthy();
    expect(getByTestId('ide-import-start-hero').textContent).toContain('Start with a Vivado ZIP');
    expect(getByTestId('ide-import-start-primary').textContent).toContain('Select Vivado ZIP');
    expect(getByTestId('ide-import-start-other-options').textContent).toContain('Other ways to start');
    expect(getByTestId('ide-import-start-secondary').textContent).toContain('Paste HDL');
    expect(getByTestId('ide-import-start-guidance-review').textContent).toContain('Nothing is overwritten yet');
    expect(queryByTestId('ide-import-workbench')).toBeNull();
    expect(queryByTestId('ide-import-secondary-tools')).toBeNull();
    expect(queryByTestId('ide-import-replace-project')).toBeNull();
  });

  it('offers quick sample demos from first look, including blocked behavioral examples', async () => {
    const view = render(<ImportSurface onImportProject={vi.fn()} />);

    fireEvent.click(view.getByTestId('ide-import-toggle-behavioral-samples'));

    await waitFor(() => {
      expect(view.queryByTestId('ide-import-load-sample-edge-detect')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-import-load-sample-edge-detect'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-ports-only-warning')).toBeTruthy();
    });
  });

  it('loads a structural sample directly from first look without opening secondary tools', async () => {
    const view = render(<ImportSurface onImportProject={vi.fn()} />);

    fireEvent.click(view.getByTestId('ide-import-load-sample-and-gate'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-recon-full')).toBeTruthy();
    });
  });

  it('describes manual path guidance without hiding first-look quick demos', () => {
    const { getByTestId } = render(
      <ImportSurface onImportProject={vi.fn()} />
    );

    expect(getByTestId('ide-import-start-guidance-hdl').textContent).toContain('quick demos');
  });
});
