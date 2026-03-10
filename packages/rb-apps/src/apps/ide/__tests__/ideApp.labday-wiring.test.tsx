// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { IdeApp } from '../../IdeApp';

function seedIdeRoute(mode: 'project' | 'import') {
  window.history.replaceState({}, '', `/os/?mode=${mode}`);
}

describe('IdeApp lab-day wiring', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    seedIdeRoute('project');
  });

  afterEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('routes the ports-only rescue CTA from Import to Export', async () => {
    seedIdeRoute('import');
    const view = render(<IdeApp />);

    fireEvent.click(await view.findByTestId('ide-import-toggle-behavioral-samples'));
    fireEvent.click(view.getByTestId('ide-import-load-sample-edge-detect'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-ports-only-warning')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-import-go-to-export'));

    await waitFor(() => {
      expect(view.getByTestId('ide-export-panel')).toBeTruthy();
    });
  });

  it('propagates Project top and part edits into the Export handoff summary', async () => {
    const view = render(<IdeApp />);

    fireEvent.change(await view.findByTestId('ide-project-fpga-top'), {
      target: { value: 'lab_day_top' },
    });
    fireEvent.change(view.getByTestId('ide-project-fpga-part'), {
      target: { value: 'xc7a100tcsg324-1' },
    });

    fireEvent.click(view.getByTestId('mode-button-export'));

    await waitFor(() => {
      expect(view.getByTestId('ide-export-panel')).toBeTruthy();
    });

    expect(view.getByTestId('ide-export-top-module').textContent).toBe('lab_day_top');
    expect(view.getByTestId('ide-export-part-number').textContent).toContain('xc7a100tcsg324-1');
  });
});
