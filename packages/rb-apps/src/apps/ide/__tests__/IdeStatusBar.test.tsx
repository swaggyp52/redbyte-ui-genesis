// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { IdeStatusBar } from '../components/IdeStatusBar';

describe('IdeStatusBar', () => {
  it('shows mode label and gate status for non-Design modes', () => {
    const view = render(
      <IdeStatusBar mode="verify" determinismHash="abc123def456" gateStatus="warn" />
    );

    expect(view.getByTestId('ide-status-bar').textContent).toContain('Mode: verify');
    expect(view.getByTestId('ide-status-bar').textContent).not.toContain('Project Hash:');
    expect(view.getByTestId('ide-status-bar').textContent).toContain('Workflow Review');
  });

  it('demotes the Design footer to the readiness pill only', () => {
    const view = render(
      <IdeStatusBar mode="design" determinismHash="abc123def456" gateStatus="fail" />
    );

    expect(view.getByTestId('ide-status-bar').textContent).not.toContain('Mode: design');
    expect(view.getByTestId('ide-status-bar').textContent).not.toContain('Project Hash:');
    expect(view.getByTestId('ide-status-bar').textContent).toContain('Workflow Blocked');
  });
});
