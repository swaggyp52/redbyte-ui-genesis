// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { IdeStatusBar } from '../components/IdeStatusBar';

describe('IdeStatusBar', () => {
  it('shows workspace status without becoming a workflow authority for non-Design modes', () => {
    const view = render(
      <IdeStatusBar mode="verify" determinismHash="abc123def456" gateStatus="warn" />
    );

    expect(view.getByTestId('ide-status-bar').textContent).toContain('Verify workspace');
    expect(view.getByTestId('ide-status-bar').textContent).not.toContain('Project Hash:');
    expect(view.getByTestId('ide-status-bar').textContent).not.toContain('Workflow Review');
    expect(view.getByTestId('ide-status-bar').textContent).toContain('Needs review');
  });

  it('demotes the Design footer to workspace status only', () => {
    const view = render(
      <IdeStatusBar mode="design" determinismHash="abc123def456" gateStatus="fail" />
    );

    expect(view.getByTestId('ide-status-bar').textContent).not.toContain('Mode: design');
    expect(view.getByTestId('ide-status-bar').textContent).not.toContain('Project Hash:');
    expect(view.getByTestId('ide-status-bar').textContent).not.toContain('Workflow Blocked');
    expect(view.getByTestId('ide-status-bar').textContent).toContain('Design workspace');
    expect(view.getByTestId('ide-status-bar').textContent).toContain('Issue flagged');
  });
});
