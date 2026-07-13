// @vitest-environment jsdom
// Contract tests for IdeLeftRail stage grammar:
// - exactly 5 workflow buttons: project, design, verify, hardware, export
// - Import is a separate utility action, not a workflow stage
// - no program navigation button (Program is an external handoff, not a stage)
// - no HQ navigation button in the course-product IDE

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { IdeLeftRail } from '../components/IdeLeftRail';
import { STUDENT_WORKFLOW_SPINE } from '../workflowStages';

afterEach(() => cleanup());

describe('IdeLeftRail stage grammar', () => {
  it('renders the Project navigation button', () => {
    const { getByTestId } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(getByTestId('mode-button-project')).toBeDefined();
  });

  it('does NOT render an HQ utility button', () => {
    const { queryByTestId } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(queryByTestId('mode-button-hq')).toBeNull();
  });

  it('renders all four workflow stage buttons: design, verify, hardware, export', () => {
    const { getByTestId } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(getByTestId('mode-button-design')).toBeDefined();
    expect(getByTestId('mode-button-verify')).toBeDefined();
    expect(getByTestId('mode-button-hardware')).toBeDefined();
    expect(getByTestId('mode-button-export')).toBeDefined();
  });

  it('renders Import as a separate utility action', () => {
    const { getByTestId, container } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(getByTestId('mode-button-import')).toBeDefined();
    expect(container.querySelector('.ide-left-rail-nav [data-testid="mode-button-import"]')).toBeNull();
    expect(container.querySelector('.ide-left-rail-utility [data-testid="mode-button-import"]')).not.toBeNull();
  });

  it('does NOT render a Program navigation button', () => {
    const { queryByTestId } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(queryByTestId('mode-button-program')).toBeNull();
  });

  it('renders five workflow stages plus one Import utility', () => {
    const { container } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(container.querySelectorAll('.ide-left-rail-nav [data-testid^="mode-button-"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-testid^="mode-button-"]')).toHaveLength(6);
  });

  it('does NOT render the legacy bottom-left rail expander', () => {
    const { queryByTestId } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(queryByTestId('ide-rail-collapse-toggle')).toBeNull();
  });

  it('shows only current, complete, and blocked workflow state labels', () => {
    const { getByTestId } = render(
      <IdeLeftRail
        currentMode="verify"
        onModeChange={vi.fn()}
        stepsCompleted={{ project: true, design: true }}
        stepsBlocked={{ hardware: true, export: true }}
      />
    );

    expect(getByTestId('mode-button-project').textContent).toContain('Complete');
    expect(getByTestId('mode-button-verify').textContent).toContain('Current');
    expect(getByTestId('mode-button-hardware').textContent).toContain('Blocked');
    expect(getByTestId('mode-button-export').textContent).toContain('Blocked');
  });

  it('does not render a second lab-step progress authority', () => {
    const { queryByTestId } = render(
      <IdeLeftRail
        currentMode="design"
        onModeChange={vi.fn()}
        labStepCurrent={2}
        labStepTotal={5}
      />
    );

    expect(queryByTestId('ide-rail-lab-progress')).toBeNull();
  });
});

describe('STUDENT_WORKFLOW_SPINE stage grammar', () => {
  it('has exactly 4 stages: Design, Verify, Map Pins, Export', () => {
    expect(STUDENT_WORKFLOW_SPINE).toHaveLength(4);
    expect(STUDENT_WORKFLOW_SPINE[0]).toBe('Design');
    expect(STUDENT_WORKFLOW_SPINE[1]).toBe('Verify');
    expect(STUDENT_WORKFLOW_SPINE[2]).toBe('Map Pins');
    expect(STUDENT_WORKFLOW_SPINE[3]).toBe('Export');
  });

  it('does NOT include Program in the student workflow spine', () => {
    expect(STUDENT_WORKFLOW_SPINE).not.toContain('Program');
  });

  it('does NOT include Import in the student workflow spine', () => {
    expect(STUDENT_WORKFLOW_SPINE).not.toContain('Import');
  });

  it('does NOT include HQ in the student workflow spine', () => {
    expect(STUDENT_WORKFLOW_SPINE).not.toContain('HQ');
  });
});
