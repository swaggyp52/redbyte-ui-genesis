// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { ImportSurface } from '../surfaces/ImportSurface';

afterEach(() => {
  cleanup();
});

describe('ImportSurface first look', () => {
  it('leads with one ZIP choice and a concise horizontal Upload to Review to Apply flow', () => {
    const { getByTestId, queryByTestId } = render(
      <ImportSurface onImportProject={vi.fn()} />
    );

    expect(getByTestId('ide-import-workbench')).toBeTruthy();
    expect(getByTestId('ide-import-zip-dropzone')).toBeTruthy();
    expect(getByTestId('ide-import-zip-browse').textContent).toContain('Choose ZIP');
    expect(getByTestId('ide-import-start-secondary').textContent).toContain('Paste HDL');
    const steps = getByTestId('ide-import-horizontal-stepper');
    expect(steps.textContent).toContain('Upload');
    expect(steps.textContent).toContain('Review');
    expect(steps.textContent).toContain('Apply');
    expect(steps.querySelectorAll('li')).toHaveLength(3);
    expect(queryByTestId('ide-import-replace-project')).toBeNull();
    expect(queryByTestId('ide-import-workflow-rail')).toBeNull();
    expect(queryByTestId('ide-import-toggle-behavioral-samples')).toBeNull();
    expect(getByTestId('ide-import-workbench').querySelector('details, summary')).toBeNull();
  });

  it('offers the blocked behavioral example directly, without an unsupported-example toggle', async () => {
    const view = render(<ImportSurface onImportProject={vi.fn()} />);

    expect(view.queryByTestId('ide-import-toggle-behavioral-samples')).toBeNull();
    fireEvent.click(view.getByTestId('ide-import-load-sample-edge-detect'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-behavioral-warning')).toBeTruthy();
      expect(view.getByTestId('ide-import-ports-only-warning')).toBeTruthy();
    });
  });

  it('loads a structural sample directly and shows the reconstructed review workspace', async () => {
    const view = render(<ImportSurface onImportProject={vi.fn()} />);

    fireEvent.click(view.getByTestId('ide-import-load-sample-and-gate'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-recon-full')).toBeTruthy();
      expect(view.getByTestId('ide-import-review-shell')).toBeTruthy();
      expect(view.getByTestId('ide-import-ports-table')).toBeTruthy();
    });
  });

  it('names the current signals, not node connector directions, in the replacement summary', async () => {
    const view = render(
      <ImportSurface
        onImportProject={vi.fn()}
        projectIoRows={[
          { id: 'clk', nodeId: 'clk-node', label: 'CLK100MHZ', port: 'out', direction: 'in', pin: 'W5', required: true },
          { id: 'en', nodeId: 'en-node', label: 'EN', port: 'out', direction: 'in', pin: 'V17', required: true },
          { id: 'rst', nodeId: 'rst-node', label: 'RST', port: 'out', direction: 'in', pin: 'U18', required: true },
          { id: 'ld0', nodeId: 'ld0-node', label: 'LD0', port: 'in', direction: 'out', pin: 'U16', required: true },
          { id: 'ld1', nodeId: 'ld1-node', label: 'LD1', port: 'in', direction: 'out', pin: 'E19', required: true },
        ]}
      />
    );

    fireEvent.click(view.getByTestId('ide-import-load-sample-and-gate'));

    await waitFor(() => expect(view.getByTestId('ide-import-review-shell')).toBeTruthy());
    fireEvent.change(view.getByLabelText('import-map-in_a'), { target: { value: 'V17' } });
    fireEvent.change(view.getByLabelText('import-map-in_b'), { target: { value: 'W16' } });
    fireEvent.change(view.getByLabelText('import-map-out_y'), { target: { value: 'U16' } });

    await waitFor(() => expect(view.getByTestId('ide-import-replace-project').hasAttribute('disabled')).toBe(false));
    fireEvent.click(view.getByTestId('ide-import-replace-project'));

    const preview = await view.findByTestId('ide-import-commit-preview');
    expect(preview.textContent).toContain('CLK100MHZ, EN, RST, LD0, LD1');
    expect(preview.textContent).not.toContain('Removed portsout, out, out, in, in');
  });

  it('keeps the two sample recovery paths visible beside the ZIP path', () => {
    const { getByTestId } = render(<ImportSurface onImportProject={vi.fn()} />);

    expect(getByTestId('ide-import-load-sample-and-gate').textContent).toContain('structural');
    expect(getByTestId('ide-import-load-sample-edge-detect').textContent).toContain('behavioral');
  });
});
