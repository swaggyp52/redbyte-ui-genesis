import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ECELabSubmissionBundleAction } from '../components/ECELabSubmissionBundleAction';

describe('ECELabSubmissionBundleAction', () => {
  it('renders the submission bundle action and triggers generation', () => {
    const onGenerate = vi.fn();

    render(
      <ECELabSubmissionBundleAction
        disabled={false}
        isGenerating={false}
        status={{
          schema_version: 'rb_submission_bundle_status_v1',
          bundleId: 'bundle-demo',
          filename: 'rb-submission-bundle-demo.zip',
          reproducibilityStatus: 'pass',
        }}
        onGenerate={onGenerate}
      />,
    );

    fireEvent.click(screen.getByTestId('ece-lab-generate-submission-bundle'));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ece-lab-submission-bundle-status').textContent).toContain(
      'rb-submission-bundle-demo.zip',
    );
  });
});
