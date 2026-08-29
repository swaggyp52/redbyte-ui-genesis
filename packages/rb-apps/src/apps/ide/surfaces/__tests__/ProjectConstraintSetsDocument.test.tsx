// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import {
  ProjectConstraintSetsDocument,
  type ProjectConstraintSetsDocumentProps,
  type ProjectConstraintSignalRow,
} from '../ProjectConstraintSetsDocument';

function makeRows(): ProjectConstraintSignalRow[] {
  return [
    {
      id: 'row-sw0',
      label: 'SW0',
      port: 'SW0',
      direction: 'in',
      pin: 'V17',
      required: true,
      boardResourceType: 'switch',
    },
    {
      id: 'row-ld0',
      label: 'LD0',
      port: 'LD0',
      direction: 'out',
      pin: '',
      required: true,
      boardResourceType: 'led',
    },
    {
      id: 'row-clk',
      label: 'CLK100MHZ',
      port: 'CLK100MHZ',
      direction: 'in',
      pin: 'W5',
      required: true,
      timingRole: 'clock',
      boardResourceType: 'clock_pin',
    },
  ];
}

function makeProps(
  overrides: Partial<ProjectConstraintSetsDocumentProps> = {}
): ProjectConstraintSetsDocumentProps {
  return {
    board: 'Basys3',
    rows: makeRows(),
    onOpenBoard: vi.fn(),
    onOpenXdc: vi.fn(),
    ...overrides,
  };
}

describe('ProjectConstraintSetsDocument', () => {
  it('renders the single canonical set with board, counts, and unmapped problems', () => {
    const { getByTestId } = render(<ProjectConstraintSetsDocument {...makeProps()} />);
    getByTestId('ide-project-constraint-sets');
    expect(getByTestId('ide-project-constrsets-set-name').textContent).toBe('constrs_1');
    getByTestId('ide-project-constrsets-active-chip');
    expect(getByTestId('ide-project-constrsets-board').textContent).toBe('Basys3');
    expect(getByTestId('ide-project-constrsets-mapped').textContent).toBe(
      '2/3 required signals mapped'
    );
    expect(getByTestId('ide-project-constrsets-problem-row-ld0').textContent).toBe('LD0 (LD0)');
    expect(getByTestId('ide-project-constrsets-problems').textContent).toContain(
      '1 unmapped required signal'
    );
  });

  it('renders the mapped clock row with the Basys3 note only for pin W5', () => {
    const { getByTestId } = render(<ProjectConstraintSetsDocument {...makeProps()} />);
    const clock = getByTestId('ide-project-constrsets-clock').textContent ?? '';
    expect(clock).toContain('CLK100MHZ');
    expect(clock).toContain('W5');
    expect(clock).toContain('100 MHz');
  });

  it('does not claim board clock metadata for a non-canonical pin', () => {
    const rows = makeRows().map((row) =>
      row.id === 'row-clk' ? { ...row, pin: 'U18' } : row
    );
    const { getByTestId } = render(<ProjectConstraintSetsDocument {...makeProps({ rows })} />);
    const clock = getByTestId('ide-project-constrsets-clock').textContent ?? '';
    expect(clock).toContain('U18');
    expect(clock).not.toContain('100 MHz');
  });

  it('describes a combinational design and an unassigned clock honestly', () => {
    const noClock = makeRows().filter((row) => row.id !== 'row-clk');
    const view = render(<ProjectConstraintSetsDocument {...makeProps({ rows: noClock })} />);
    expect(view.getByTestId('ide-project-constrsets-clock').textContent).toBe(
      'No clock signal — combinational design.'
    );
    view.unmount();

    const unassigned = makeRows().map((row) =>
      row.id === 'row-clk' ? { ...row, pin: '' } : row
    );
    const unassignedView = render(
      <ProjectConstraintSetsDocument {...makeProps({ rows: unassigned })} />
    );
    expect(unassignedView.getByTestId('ide-project-constrsets-clock').textContent).toContain(
      'not assigned yet'
    );
  });

  it('reports fully-mapped and empty-design states without inventing problems', () => {
    const mapped = makeRows().map((row) => (row.pin ? row : { ...row, pin: 'U16' }));
    const view = render(<ProjectConstraintSetsDocument {...makeProps({ rows: mapped })} />);
    expect(view.getByTestId('ide-project-constrsets-mapped').textContent).toBe(
      '3/3 required signals mapped'
    );
    expect(view.getByTestId('ide-project-constrsets-problems').textContent).toBe(
      'No unmapped required signals.'
    );
    view.unmount();

    const emptyView = render(<ProjectConstraintSetsDocument {...makeProps({ rows: [] })} />);
    emptyView.getByTestId('ide-project-constrsets-empty');
    expect(emptyView.getByTestId('ide-project-constrsets-mapped').textContent).toBe(
      '0/0 required signals mapped'
    );
  });

  it('shows the generated-XDC source line from the real artifact when provided', () => {
    const withArtifact = makeProps({
      xdcArtifact: { path: 'top.xdc', status: 'ready' },
    });
    const view = render(<ProjectConstraintSetsDocument {...withArtifact} />);
    expect(view.getByTestId('ide-project-constrsets-source').textContent).toBe(
      'top.xdc · generated'
    );
    view.unmount();

    const withoutArtifact = render(<ProjectConstraintSetsDocument {...makeProps()} />);
    expect(withoutArtifact.getByTestId('ide-project-constrsets-source').textContent).toBe(
      'top.xdc — generated at export time'
    );
  });

  it('routes board and XDC actions through callbacks and disables them truthfully when absent', () => {
    const props = makeProps();
    const view = render(<ProjectConstraintSetsDocument {...props} />);
    fireEvent.click(view.getByTestId('ide-project-constrsets-open-board'));
    expect(props.onOpenBoard).toHaveBeenCalledTimes(1);
    fireEvent.click(view.getByTestId('ide-project-constrsets-open-xdc'));
    expect(props.onOpenXdc).toHaveBeenCalledTimes(1);
    view.unmount();

    const bare = render(
      <ProjectConstraintSetsDocument {...makeProps({ onOpenBoard: undefined, onOpenXdc: undefined })} />
    );
    for (const testId of ['ide-project-constrsets-open-board', 'ide-project-constrsets-open-xdc']) {
      const button = bare.getByTestId(testId) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.title).toBe('Not available from this surface yet.');
    }
  });

  it('offers no constraint-set create/duplicate/switch affordances', () => {
    const { getByTestId, queryByTestId, container } = render(
      <ProjectConstraintSetsDocument {...makeProps()} />
    );
    expect(queryByTestId('ide-project-constrsets-create')).toBeNull();
    expect(queryByTestId('ide-project-constrsets-duplicate')).toBeNull();
    const note = getByTestId('ide-project-constrsets-single-note').textContent ?? '';
    expect(note).toContain('exactly one constraint set');
    const buttonLabels = Array.from(container.querySelectorAll('button')).map(
      (button) => button.textContent ?? ''
    );
    for (const label of buttonLabels) {
      expect(label).not.toMatch(/create|duplicate|new set/i);
    }
  });
});
