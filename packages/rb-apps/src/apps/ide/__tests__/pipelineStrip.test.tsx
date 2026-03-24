// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PipelineStrip } from '../components/PipelineStrip';

describe('PipelineStrip export availability semantics', () => {
  it('treats stale or missing verify as pending instead of blocked while export remains navigable', () => {
    const { getByTestId, queryByTestId } = render(
      <PipelineStrip
        currentMode="project"
        health={{
          lastVerify: undefined,
          lastExport: undefined,
          dirtySinceVerify: false,
          dirtySinceExport: true,
          blockingIssues: [
            {
              code: 'RBP1002',
              message: 'No verification vectors defined.',
              fixPath: { mode: 'verify', actionLabel: 'Add Test Vectors' },
            },
            {
              code: 'RBP2002',
              message: 'Project changed since last successful export.',
              fixPath: { mode: 'export', actionLabel: 'Build Submission Package' },
            },
          ],
        }}
        primaryCta={{ label: 'Verify', mode: 'verify', code: 'RBP1002' }}
        onNavigate={vi.fn()}
      />
    );

    expect(getByTestId('ide-pipeline-stage-verify').getAttribute('aria-label')).toBe('Verify — pending');
    expect(getByTestId('ide-pipeline-stage-export').getAttribute('aria-label')).toBe('Export — pending');
    expect(queryByTestId('ide-guided-blocker')).toBeNull();
    expect(getByTestId('ide-guided-primary-cta').textContent).toContain('Verify');
  });
});
