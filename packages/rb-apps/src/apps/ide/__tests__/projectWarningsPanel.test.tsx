// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ProjectWarningsPanel } from '../components/ProjectWarningsPanel';
import type { ProjectHealthIssue } from '../projectHealth';

function makeIssue(
  code: string,
  message: string,
  mode?: ProjectHealthIssue['fixPath'] extends infer T
    ? T extends { mode: infer M }
      ? M
      : never
    : never,
  actionLabel?: string,
): ProjectHealthIssue {
  return {
    code,
    message,
    fixPath: mode ? { mode, actionLabel: actionLabel ?? 'Open' } : undefined,
  };
}

describe('ProjectWarningsPanel', () => {
  it('renders nothing when there are no issues', () => {
    const { container } = render(
      <ProjectWarningsPanel issues={[]} onNavigateFix={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a pluralized title when multiple issues exist', () => {
    const { getByTestId } = render(
      <ProjectWarningsPanel
        issues={[
          makeIssue('RBP1000', 'No circuit yet.', 'design', 'Open Design'),
          makeIssue('RBP1001', 'Mappings missing.', 'project', 'Fix Mapping'),
        ]}
        onNavigateFix={() => {}}
      />,
    );
    expect(getByTestId('ide-project-warnings-title').textContent).toBe('2 things to resolve');
  });

  it('renders a singular title when exactly one issue exists', () => {
    const { getByTestId } = render(
      <ProjectWarningsPanel
        issues={[makeIssue('RBP1000', 'No circuit yet.', 'design', 'Open Design')]}
        onNavigateFix={() => {}}
      />,
    );
    expect(getByTestId('ide-project-warnings-title').textContent).toBe('1 thing to resolve');
  });

  it('renders each issue with its message and code', () => {
    const { getByTestId } = render(
      <ProjectWarningsPanel
        issues={[
          makeIssue('RBP1000', 'No circuit yet.', 'design', 'Open Design'),
          makeIssue('RBP2002', 'Project changed since last export.', 'export', 'Build Submission Package'),
        ]}
        onNavigateFix={() => {}}
      />,
    );
    const first = getByTestId('ide-project-warnings-item-RBP1000');
    expect(first.textContent).toContain('No circuit yet.');
    expect(first.textContent).toContain('RBP1000');
    const second = getByTestId('ide-project-warnings-item-RBP2002');
    expect(second.textContent).toContain('Project changed since last export.');
    expect(second.textContent).toContain('Build Submission Package');
  });

  it('dispatches the fix-path mode when the fix button is clicked', () => {
    const onNavigateFix = vi.fn();
    const { getByTestId } = render(
      <ProjectWarningsPanel
        issues={[
          makeIssue('RBP1000', 'No circuit yet.', 'design', 'Open Design'),
          makeIssue('RBP2002', 'Stale bundle.', 'export', 'Build Submission Package'),
        ]}
        onNavigateFix={onNavigateFix}
      />,
    );
    fireEvent.click(getByTestId('ide-project-warnings-fix-RBP1000'));
    fireEvent.click(getByTestId('ide-project-warnings-fix-RBP2002'));
    expect(onNavigateFix).toHaveBeenNthCalledWith(1, 'design');
    expect(onNavigateFix).toHaveBeenNthCalledWith(2, 'export');
  });

  it('caps visible issues at three and surfaces an overflow line', () => {
    const { getByTestId, queryByTestId } = render(
      <ProjectWarningsPanel
        issues={[
          makeIssue('RBP1000', 'First', 'design', 'Open'),
          makeIssue('RBP1001', 'Second', 'verify', 'Run'),
          makeIssue('RBP1002', 'Third', 'export', 'Build'),
          makeIssue('RBP1003', 'Fourth', 'hardware', 'Map'),
        ]}
        onNavigateFix={() => {}}
      />,
    );
    expect(getByTestId('ide-project-warnings-item-RBP1000')).toBeTruthy();
    expect(getByTestId('ide-project-warnings-item-RBP1001')).toBeTruthy();
    expect(getByTestId('ide-project-warnings-item-RBP1002')).toBeTruthy();
    expect(queryByTestId('ide-project-warnings-item-RBP1003')).toBeNull();
    expect(getByTestId('ide-project-warnings-overflow').textContent).toContain('...and 1 more');
  });

  it('omits the fix button when an issue has no fixPath', () => {
    const { queryByTestId, getByTestId } = render(
      <ProjectWarningsPanel
        issues={[makeIssue('RBP9999', 'Mystery issue.')]}
        onNavigateFix={() => {}}
      />,
    );
    expect(getByTestId('ide-project-warnings-item-RBP9999').textContent).toContain(
      'Mystery issue.',
    );
    expect(queryByTestId('ide-project-warnings-fix-RBP9999')).toBeNull();
  });
});
