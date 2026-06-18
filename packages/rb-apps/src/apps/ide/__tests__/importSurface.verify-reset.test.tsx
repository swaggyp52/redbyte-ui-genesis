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

function enterImportWorkbench(view: ReturnType<typeof render>) {
  fireEvent.click(view.getByTestId('ide-import-start-secondary'));
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
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
  it('keeps nonessential import chrome hidden by default so the import workspace stays central', () => {
    const { queryByTestId } = render(
      <ImportSurface
        projectIoRows={[...MATCHING_PROJECT_IO_ROWS]}
        onImportProject={vi.fn()}
        onGoToVerify={vi.fn()}
      />
    );

    expect(queryByTestId('ide-inspector')).toBeNull();
    expect(queryByTestId('ide-workbench-dock-toggle-right')).toBeNull();
    expect(queryByTestId('ide-workbench-console')).toBeNull();
  });

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

    const view = render(
      <ImportSurface
        projectIoRows={[...MATCHING_PROJECT_IO_ROWS]}
        onImportProject={(project) => {
          useProjectRuntime.getState().loadFromProject(project);
        }}
        onGoToVerify={vi.fn()}
      />
    );

    enterImportWorkbench(view);
    fireEvent.click(view.getByTestId('ide-import-load-sample-and-gate'));

    fireEvent.click(view.getByTestId('ide-import-parse-xdc'));

    expect(useProjectRuntime.getState().verifyLastRun).toBeDefined();

    await waitFor(() => {
      expect((view.getByTestId('ide-import-replace-project') as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(view.getByTestId('ide-import-replace-project'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-commit-preview')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-import-apply-confirm'));

    await waitFor(() => {
      const notice = view.getByTestId('ide-import-verify-reset-notice');
      expect(notice.textContent).toContain('Verification results are not restored during import.');
      expect(notice.textContent).toContain('Open Verify');
    });

    expect(useProjectRuntime.getState().verifyLastRun).toBeUndefined();
    expect(useProjectRuntime.getState().verifyRunHistory).toEqual([]);
  });
});
