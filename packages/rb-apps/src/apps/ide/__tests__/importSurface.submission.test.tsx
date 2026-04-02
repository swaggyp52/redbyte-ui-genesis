// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { ImportSurface } from '../surfaces/ImportSurface';
import {
  parseIdeSubmissionZip,
  SubmissionIntegrityError,
} from '../../../export/parseIdeSubmission';

vi.mock('../../../export/parseIdeSubmission', async () => {
  const actual = await vi.importActual<typeof import('../../../export/parseIdeSubmission')>(
    '../../../export/parseIdeSubmission'
  );
  return {
    ...actual,
    parseIdeSubmissionZip: vi.fn(),
  };
});

const mockedParseIdeSubmissionZip = vi.mocked(parseIdeSubmissionZip);

describe('ImportSurface submission ZIP handling', () => {
  beforeEach(() => {
    mockedParseIdeSubmissionZip.mockReset();
  });

  it('renders exactly one ZIP input', () => {
    const { getAllByTestId } = render(
      <ImportSurface onImportSubmission={vi.fn()} />
    );

    expect(getAllByTestId('ide-import-zip-input')).toHaveLength(1);
  });

  it('keeps the ZIP input intrinsically hidden from layout', () => {
    const { getByTestId } = render(
      <ImportSurface onImportSubmission={vi.fn()} />
    );

    const zipInput = getByTestId('ide-import-zip-input') as HTMLInputElement;
    expect(zipInput.hasAttribute('hidden')).toBe(true);
  });

  it('shows an actionable integrity failure message for tampered submissions', async () => {
    mockedParseIdeSubmissionZip.mockRejectedValue(
      new SubmissionIntegrityError('hash mismatch for "project.rbproj.json"')
    );
    const onImportSubmission = vi.fn();
    const { getByTestId } = render(
      <ImportSurface onImportSubmission={onImportSubmission} />
    );

    const zipInput = getByTestId('ide-import-zip-input') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'tampered-submission.zip', {
      type: 'application/zip',
    });

    await act(async () => {
      fireEvent.change(zipInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(getByTestId('ide-import-submission-integrity-failed')).toBeTruthy();
    });
    expect(onImportSubmission).not.toHaveBeenCalled();
    expect(getByTestId('ide-import-submission-integrity-failed').textContent)
      .toContain('hash mismatch for "project.rbproj.json"');
  });
});
