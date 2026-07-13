// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../components/IdeWorkbenchShell', () => ({
  IdeWorkbenchShell: ({ workspace }: { workspace: React.ReactNode }) => (
    <div data-testid="workbench-shell-mock">{workspace}</div>
  ),
}));

import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';

describe('IdeSurfaceLayout command hierarchy', () => {
  it('renders the page-owned workspace without injecting a second product header', () => {
    const view = render(
      <IdeSurfaceLayout
        mode="verify"
        inspector={<aside>Inspector</aside>}
        productSpine={{
          statusLabel: 'Ready',
          primaryLabel: 'Run Verify',
          onPrimary: vi.fn(),
        }}
      >
        <section data-testid="page-owned-header">Verify workspace</section>
      </IdeSurfaceLayout>
    );

    expect(view.getByTestId('page-owned-header')).toBeDefined();
    expect(view.queryByTestId('ide-product-spine-verify')).toBeNull();
    expect(view.queryByTestId('ide-next-step-guide-verify')).toBeNull();
  });
});
