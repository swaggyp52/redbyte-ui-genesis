// @vitest-environment jsdom

/**
 * Import honesty tests.
 *
 * Verifies that ports-only and partial reconstruction are never
 * presented as full success, and that the student gets explicit
 * guidance about what was and was not recovered.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { ImportSurface } from '../surfaces/ImportSurface';

describe('Import honesty — ports-only', () => {
  it('shows explicit ports-only message when behavioral HDL is loaded', async () => {
    const view = render(<ImportSurface onImportProject={vi.fn()} />);

    fireEvent.click(view.getByTestId('ide-import-toggle-behavioral-samples'));
    fireEvent.click(view.getByTestId('ide-import-load-sample-edge-detect'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-ports-only-warning')).toBeTruthy();
    });

    const warning = view.getByTestId('ide-import-ports-only-warning');
    expect(warning.textContent).toContain('Ports only');
    expect(warning.textContent).toContain('no circuit reconstructed');
  });

  it('ports-only warning explains what was not recovered', async () => {
    const view = render(<ImportSurface onImportProject={vi.fn()} />);

    fireEvent.click(view.getByTestId('ide-import-toggle-behavioral-samples'));
    fireEvent.click(view.getByTestId('ide-import-load-sample-edge-detect'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-ports-only-warning')).toBeTruthy();
    });

    const warning = view.getByTestId('ide-import-ports-only-warning');
    expect(warning.textContent).toContain('Internal logic was not reconstructed');
    expect(warning.textContent).toContain('circuit is empty');
  });

  it('ports-only warning includes next-step guidance', async () => {
    const view = render(<ImportSurface onImportProject={vi.fn()} />);

    fireEvent.click(view.getByTestId('ide-import-toggle-behavioral-samples'));
    fireEvent.click(view.getByTestId('ide-import-load-sample-edge-detect'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-ports-only-warning')).toBeTruthy();
    });

    const warning = view.getByTestId('ide-import-ports-only-warning');
    expect(warning.textContent).toContain('Rebuild');
  });

  it('does not use the same success language for ports-only as for full reconstruction', async () => {
    const portsOnlyView = render(
      <ImportSurface key="ports-only" onImportProject={vi.fn()} />
    );

    fireEvent.click(portsOnlyView.getByTestId('ide-import-toggle-behavioral-samples'));
    fireEvent.click(portsOnlyView.getByTestId('ide-import-load-sample-edge-detect'));

    await waitFor(() => {
      expect(portsOnlyView.getByTestId('ide-import-ports-only-warning')).toBeTruthy();
    });

    // Should NOT say "Circuit reconstructed with gates and connections"
    expect(portsOnlyView.queryByTestId('ide-import-recon-full')).toBeNull();
    // Should NOT say "RedByte project restored"
    expect(portsOnlyView.queryByTestId('ide-import-recon-manifest')).toBeNull();
  });
});

describe('Import honesty — full structural reconstruction', () => {
  it('shows positive message for structural HDL import', async () => {
    const view = render(<ImportSurface onImportProject={vi.fn()} />);

    fireEvent.click(view.getByTestId('ide-import-load-sample-and-gate'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-recon-full')).toBeTruthy();
    });

    const notice = view.getByTestId('ide-import-recon-full');
    expect(notice.textContent).toContain('Structural HDL');
    expect(notice.textContent).toContain('gates and connections');
  });
});
