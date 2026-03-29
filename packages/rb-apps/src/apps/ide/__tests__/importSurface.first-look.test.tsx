// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ImportSurface } from '../surfaces/ImportSurface';

describe('ImportSurface first look', () => {
  it('leads with one clear starting action and keeps replacement as a review step', () => {
    const { getByTestId, queryByTestId } = render(
      <ImportSurface onImportProject={vi.fn()} />
    );

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
});
