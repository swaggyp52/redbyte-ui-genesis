// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ProjectOverviewPanel } from '../components/ProjectOverviewPanel';
import type { ProjectOutlineSummary } from '../projectOutline';

function makeOutline(overrides: Partial<ProjectOutlineSummary> = {}): ProjectOutlineSummary {
  return {
    nodeCount: 12,
    connectionCount: 18,
    boundaryInputCount: 3,
    boundaryOutputCount: 2,
    nodeTypeBreakdown: [
      { type: 'AND', count: 4 },
      { type: 'OR', count: 3 },
      { type: 'DFF', count: 2 },
    ],
    macros: [
      { id: 'm1', name: 'Adder4', description: 'Ripple-carry adder', ioSummary: '2 in · 1 out' },
    ],
    customComponents: [
      { name: 'ALU', description: 'Arithmetic logic unit', ioSummary: '3 in · 2 out' },
    ],
    inputIoRows: [
      { id: 'a', label: 'A', pin: 'SW0', required: true },
      { id: 'b', label: 'B', pin: null, required: true },
    ],
    outputIoRows: [
      { id: 'y', label: 'Y', pin: 'LD0', required: false },
    ],
    ...overrides,
  };
}

describe('ProjectOverviewPanel', () => {
  it('renders stats with mapping hints derived from IO rows', () => {
    const { getByTestId } = render(<ProjectOverviewPanel outline={makeOutline()} />);
    expect(getByTestId('ide-project-overview-stat-nodes').textContent).toContain('12');
    expect(getByTestId('ide-project-overview-stat-connections').textContent).toContain('18');
    expect(getByTestId('ide-project-overview-stat-inputs').textContent).toContain('3');
    expect(getByTestId('ide-project-overview-stat-inputs-hint').textContent).toBe('1/2 mapped');
    expect(getByTestId('ide-project-overview-stat-outputs-hint').textContent).toBe('1/1 mapped');
  });

  it('renders node type chips with friendly labels', () => {
    const { getByTestId } = render(<ProjectOverviewPanel outline={makeOutline()} />);
    expect(getByTestId('ide-project-overview-type-AND').textContent).toBe('AND · 4');
    expect(getByTestId('ide-project-overview-type-DFF').textContent).toBe('D Flip-Flop · 2');
  });

  it('lists macros with IO summary', () => {
    const { getByTestId } = render(<ProjectOverviewPanel outline={makeOutline()} />);
    const macro = getByTestId('ide-project-overview-macro-m1');
    expect(macro.textContent).toContain('Adder4');
    expect(macro.textContent).toContain('2 in · 1 out');
    expect(macro.textContent).toContain('Ripple-carry adder');
  });

  it('lists custom components with IO summary', () => {
    const { getByTestId } = render(<ProjectOverviewPanel outline={makeOutline()} />);
    const comp = getByTestId('ide-project-overview-custom-ALU');
    expect(comp.textContent).toContain('ALU');
    expect(comp.textContent).toContain('3 in · 2 out');
  });

  it('shows friendly empty states when no macros or components exist', () => {
    const { getByTestId } = render(
      <ProjectOverviewPanel
        outline={makeOutline({ macros: [], customComponents: [] })}
      />,
    );
    expect(getByTestId('ide-project-overview-macros').textContent).toContain('No saved macros yet');
    expect(getByTestId('ide-project-overview-custom-components').textContent).toContain(
      'No custom composite components',
    );
  });

  it('shows empty-project title when the design is empty', () => {
    const { getByTestId } = render(
      <ProjectOverviewPanel
        outline={makeOutline({
          nodeCount: 0,
          connectionCount: 0,
          boundaryInputCount: 0,
          boundaryOutputCount: 0,
          nodeTypeBreakdown: [],
          macros: [],
          customComponents: [],
          inputIoRows: [],
          outputIoRows: [],
        })}
      />,
    );
    expect(getByTestId('ide-project-overview-title').textContent).toBe('Empty project');
  });

  it('fires onOpenDesign when the Open Design button is clicked', () => {
    const handler = vi.fn();
    const { getByTestId } = render(
      <ProjectOverviewPanel outline={makeOutline()} onOpenDesign={handler} />,
    );
    fireEvent.click(getByTestId('ide-project-overview-open-design'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('omits the Open Design button when no handler is provided', () => {
    const { queryByTestId } = render(<ProjectOverviewPanel outline={makeOutline()} />);
    expect(queryByTestId('ide-project-overview-open-design')).toBeNull();
  });

  it('renders macros as clickable buttons when onFocusMacro is provided', () => {
    const handler = vi.fn();
    const { getByTestId } = render(
      <ProjectOverviewPanel outline={makeOutline()} onFocusMacro={handler} />,
    );
    const action = getByTestId('ide-project-overview-macro-m1-action');
    expect(action.tagName).toBe('BUTTON');
    fireEvent.click(action);
    expect(handler).toHaveBeenCalledWith('m1', 'Adder4');
  });

  it('renders custom components as clickable buttons when onFocusCustomComponent is provided', () => {
    const handler = vi.fn();
    const { getByTestId } = render(
      <ProjectOverviewPanel outline={makeOutline()} onFocusCustomComponent={handler} />,
    );
    const action = getByTestId('ide-project-overview-custom-ALU-action');
    expect(action.tagName).toBe('BUTTON');
    fireEvent.click(action);
    expect(handler).toHaveBeenCalledWith('ALU');
  });

  it('keeps macro rows non-interactive when no onFocusMacro is provided', () => {
    const { queryByTestId } = render(<ProjectOverviewPanel outline={makeOutline()} />);
    expect(queryByTestId('ide-project-overview-macro-m1-action')).toBeNull();
  });

  it('keeps custom component rows non-interactive when no onFocusCustomComponent is provided', () => {
    const { queryByTestId } = render(<ProjectOverviewPanel outline={makeOutline()} />);
    expect(queryByTestId('ide-project-overview-custom-ALU-action')).toBeNull();
  });

  it('collapses large type lists and shows a "+N more" indicator', () => {
    const outline = makeOutline({
      nodeTypeBreakdown: Array.from({ length: 10 }, (_, i) => ({
        type: `T${i}`,
        count: 10 - i,
      })),
    });
    const { getByTestId } = render(<ProjectOverviewPanel outline={outline} />);
    const types = getByTestId('ide-project-overview-types');
    expect(types.textContent).toContain('+4 more');
  });
});
