// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportReviewPanel } from '../components/ImportReviewPanel';
import { buildImportReviewPlan } from '../importReview';

describe('ImportReviewPanel', () => {
  it('renders nothing without a plan or with no sources', () => {
    const { container: a } = render(<ImportReviewPanel plan={null} />);
    expect(a.firstChild).toBeNull();
    const empty = buildImportReviewPlan({ hasCurrentProject: false, sources: [] });
    const { container: b } = render(<ImportReviewPanel plan={empty} />);
    expect(b.firstChild).toBeNull();
  });

  it('shows the plan: apply kind, per-source tiers/actions, blockers, and invariants', () => {
    const plan = buildImportReviewPlan({
      hasCurrentProject: true,
      sources: [
        { path: 'rtl/top.vhd', reconstruction: 'full' },
        { path: 'top.xdc' },
        { path: 'build.tcl' },
      ],
      blockers: ['Behavioral HDL cannot be imported.'],
    });
    render(<ImportReviewPanel plan={plan} />);

    expect(screen.getByTestId('ide-import-review-apply-kind').textContent).toContain('replace the current project');
    expect(screen.getByTestId('ide-import-review-blocker-0').textContent).toContain('Behavioral HDL');
    // sources rendered with tiers
    expect(screen.getByTestId('ide-import-review-source-0').textContent).toContain('reconstructable');
    // Tcl flagged never-executed
    const tcl = screen.getByText('build.tcl').closest('li');
    expect(tcl?.textContent).toContain('never executed');
    // standing invariants surfaced
    expect(screen.getByTestId('ide-import-review-invariants').textContent).toContain('never executed');
  });
});
