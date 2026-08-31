import { describe, expect, it } from 'vitest';
import { buildImportReviewPlan, summarizeImportReview } from '../importReview';

describe('buildImportReviewPlan', () => {
  it('creates a new project when nothing is loaded and requires no confirmation', () => {
    const plan = buildImportReviewPlan({
      hasCurrentProject: false,
      sources: [{ path: 'rtl/top.vhd', reconstruction: 'full' }],
    });
    expect(plan.applyKind).toBe('create-new');
    expect(plan.willReplaceExisting).toBe(false);
    expect(plan.requiresConfirmation).toBe(false);
    expect(plan.canApply).toBe(true);
  });

  it('always requires confirmation before replacing an existing project (no silent replace)', () => {
    const plan = buildImportReviewPlan({
      hasCurrentProject: true,
      sources: [{ path: 'rtl/top.vhd', reconstruction: 'full' }],
    });
    expect(plan.applyKind).toBe('replace-current');
    expect(plan.requiresConfirmation).toBe(true);
  });

  it('classifies each source into a fileset + tier + action', () => {
    const plan = buildImportReviewPlan({
      hasCurrentProject: false,
      sources: [
        { path: 'rtl/top.vhd', reconstruction: 'full' },
        { path: 'top.xdc' },
        { path: 'build.tcl' },
        { path: 'notes.md' },
        { path: 'rtl/opaque.vhd', reconstruction: 'empty' },
      ],
    });
    const byPath = Object.fromEntries(plan.sources.map((s) => [s.path, s]));
    expect(byPath['rtl/top.vhd']).toMatchObject({ fileset: 'design', tier: 'structural-subset', action: 'add' });
    expect(byPath['top.xdc']).toMatchObject({ fileset: 'constraint', tier: 'read-only', action: 'add' });
    expect(byPath['build.tcl']).toMatchObject({ fileset: 'utility', action: 'add', neverExecuted: true });
    expect(byPath['notes.md']).toMatchObject({ tier: 'unsupported', action: 'preserve-opaque' });
    // HDL that did not reconstruct is preserved opaquely, not silently dropped
    expect(byPath['rtl/opaque.vhd']).toMatchObject({ action: 'preserve-opaque' });
  });

  it('blocks apply and forces confirmation when blockers are present', () => {
    const plan = buildImportReviewPlan({
      hasCurrentProject: false,
      sources: [{ path: 'rtl/top.vhd', reconstruction: 'empty' }],
      blockers: ['This design uses behavioral HDL RedByte cannot import.'],
    });
    expect(plan.canApply).toBe(false);
    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.blockers).toHaveLength(1);
  });

  it('holds the never-execute and never-mutate invariants structurally', () => {
    const plan = buildImportReviewPlan({ hasCurrentProject: false, sources: [{ path: 'build.tcl' }] });
    expect(plan.executesTcl).toBe(false);
    expect(plan.mutatesInspectedSource).toBe(false);
  });

  it('summarizes the plan for the review header', () => {
    const plan = buildImportReviewPlan({
      hasCurrentProject: true,
      sources: [{ path: 'a.vhd', reconstruction: 'full' }, { path: 'b.md' }],
    });
    expect(summarizeImportReview(plan)).toContain('Replace current project');
    expect(summarizeImportReview(plan)).toContain('1 source added');
    expect(summarizeImportReview(plan)).toContain('1 preserved');
  });
});
