// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ImportSurface } from '../surfaces/ImportSurface';

describe('ImportSurface first look', () => {
  it('leads with one clear starting action and keeps replacement as a review step', () => {
    const { getByTestId } = render(
      <ImportSurface onImportProject={vi.fn()} />
    );

    expect(getByTestId('ide-import-start-hero').textContent).toContain('Start with a Vivado ZIP or paste HDL');
    expect(getByTestId('ide-import-start-primary').textContent).toContain('Select Vivado ZIP');
    expect(getByTestId('ide-import-start-secondary').textContent).toContain('Paste HDL');
    expect(getByTestId('ide-import-replace-project').textContent).toContain('Review Import');
    expect(getByTestId('ide-import-secondary-tools').textContent).toContain('Secondary tools');
  });
});

