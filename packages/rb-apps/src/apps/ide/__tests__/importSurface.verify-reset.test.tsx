// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { ImportSurface } from '../surfaces/ImportSurface';
import { useProjectRuntime } from '../projectRuntime';

const MATCHING_PROJECT_IO_ROWS = [
  { id: 'in_a', nodeId: 'in_a_node', port: 'in_a', label: 'in_a', direction: 'in', pin: '', required: true },
  { id: 'in_b', nodeId: 'in_b_node', port: 'in_b', label: 'in_b', direction: 'in', pin: '', required: true },
  { id: 'out_y', nodeId: 'out_y_node', port: 'out_y', label: 'out_y', direction: 'out', pin: '', required: true },
] as const;

beforeEach(() => {
  localStorage.clear();
  useProjectRuntime.getState().resetToActiveExample();
  useProjectRuntime.setState((state) => ({
    verifyLastRun: undefined,
    verifyRunHistory: [],
    projectHealthCore: {
      ...state.projectHealthCore,
      lastVerify: undefined,
      lastExport: undefined,
      dirtySinceVerify: false,
      dirtySinceExport: false,
    },
  }));
});

describe('ImportSurface verify reset notice', () => {
  it('clears verify state on import and tells the student to rerun verification', async () => {
    useProjectRuntime.getState().runVerification({
      scenarioId: 'pre-import-verify',
      scenarioName: 'Pre-import verify',
      deterministicHash: 'verify-before-import',
      rows: [
        { tick: 0, signal: 'ld0', expected: '1', actual: '1' },
      ],
      ranAtIso: '2026-03-08T00:00:00.000Z',
    });

    const { getByTestId } = render(
      <ImportSurface
        projectIoRows={[...MATCHING_PROJECT_IO_ROWS]}
        onImportProject={(project) => {
          useProjectRuntime.getState().loadFromProject(project);
        }}
        onGoToVerify={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('ide-import-load-sample-and-gate'));

    await waitFor(() => {
      expect(getByTestId('ide-import-stage-summary')).toBeTruthy();
    });

    fireEvent.click(getByTestId('ide-import-parse-xdc'));

    expect(useProjectRuntime.getState().verifyLastRun).toBeDefined();

    await waitFor(() => {
      expect((getByTestId('ide-import-replace-project') as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(getByTestId('ide-import-replace-project'));

    await waitFor(() => {
      expect(getByTestId('ide-import-commit-preview')).toBeTruthy();
    });

    fireEvent.click(getByTestId('ide-import-apply-confirm'));

    await waitFor(() => {
      const notice = getByTestId('ide-import-verify-reset-notice');
      expect(notice.textContent).toContain('Verification results are not restored during import.');
      expect(notice.textContent).toContain('Open Test');
    });

    expect(useProjectRuntime.getState().verifyLastRun).toBeUndefined();
    expect(useProjectRuntime.getState().verifyRunHistory).toEqual([]);
  });
});
