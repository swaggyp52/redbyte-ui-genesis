// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { IdeStageNav } from '../components/IdeStageNav';
import { STUDENT_WORKFLOW_SPINE } from '../workflowStages';

afterEach(() => cleanup());

describe('IdeStageNav stage grammar', () => {
  it('renders one horizontal five-stage project workflow', () => {
    const view = render(<IdeStageNav currentMode="design" onModeChange={vi.fn()} />);

    expect(view.getByTestId('ide-stage-nav')).toBeTruthy();
    expect(view.getByRole('navigation', { name: 'Project workflow stages' })).toBeTruthy();
    expect(view.container.querySelectorAll('[data-testid^="mode-button-"]')).toHaveLength(5);
    expect(view.getByTestId('mode-button-project')).toBeTruthy();
    expect(view.getByTestId('mode-button-design')).toBeTruthy();
    expect(view.getByTestId('mode-button-verify')).toBeTruthy();
    expect(view.getByTestId('mode-button-hardware').textContent).toContain('Board & Constraints');
    expect(view.getByTestId('mode-button-export')).toBeTruthy();
  });

  it('keeps utilities and non-product routes out of the stage navigator', () => {
    const view = render(<IdeStageNav currentMode="design" onModeChange={vi.fn()} />);

    expect(view.queryByTestId('mode-button-import')).toBeNull();
    expect(view.queryByTestId('mode-button-program')).toBeNull();
    expect(view.queryByTestId('mode-button-hq')).toBeNull();
    expect(view.container.querySelector('.ide-left-rail')).toBeNull();
  });

  it('communicates current, complete, and blocked state without pill controls', () => {
    const view = render(
      <IdeStageNav
        currentMode="verify"
        onModeChange={vi.fn()}
        stepsCompleted={{ project: true, design: true }}
        stepsBlocked={{ hardware: true, export: true }}
      />
    );

    expect(view.getByTestId('mode-button-project')).toHaveAttribute('data-state', 'complete');
    expect(view.getByTestId('mode-button-verify')).toHaveAttribute('data-state', 'current');
    expect(view.getByTestId('mode-button-hardware')).toHaveAttribute('data-state', 'blocked');
    expect(view.getByTestId('mode-button-export')).toHaveAttribute('data-state', 'blocked');
  });
});

describe('STUDENT_WORKFLOW_SPINE stage grammar', () => {
  it('is exactly Project, Design, Simulate, Board & Constraints, Build & Export', () => {
    expect(STUDENT_WORKFLOW_SPINE).toEqual([
      'Project',
      'Design',
      'Simulate',
      'Board & Constraints',
      'Build & Export',
    ]);
    expect(STUDENT_WORKFLOW_SPINE).not.toContain('Program');
    expect(STUDENT_WORKFLOW_SPINE).not.toContain('Import');
  });
});
