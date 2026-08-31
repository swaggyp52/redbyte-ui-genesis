import React from 'react';
import type { ImportReviewPlan } from '../importReview';
import { summarizeImportReview } from '../importReview';

/**
 * Import review panel — a read-only projection of an {@link ImportReviewPlan}.
 * It shows what applying an import *would* do before anything is applied: the
 * apply kind (create vs replace), each source's fileset + capability tier +
 * action, any blockers, and the standing invariants (Tcl is never executed,
 * inspected source is never mutated). It renders nothing when there is no plan
 * to review.
 */

export interface ImportReviewPanelProps {
  readonly plan: ImportReviewPlan | null;
}

const TIER_LABEL: Record<string, string> = {
  'structural-subset': 'reconstructable',
  'ports-only': 'ports only',
  'read-only': 'read-only',
  'opaque-preserved': 'preserved',
  unsupported: 'unsupported',
};

const ACTION_LABEL: Record<string, string> = {
  add: 'add',
  'preserve-opaque': 'preserve',
  skip: 'skip',
};

export const ImportReviewPanel: React.FC<ImportReviewPanelProps> = ({ plan }) => {
  if (!plan || plan.sources.length === 0) return null;

  return (
    <section className="ide-import-review" data-testid="ide-import-review" aria-label="Import review">
      <header className="ide-import-review-head">
        <span>Import review</span>
        <strong data-testid="ide-import-review-summary">{summarizeImportReview(plan)}</strong>
      </header>

      <p
        className={`ide-import-review-apply is-${plan.applyKind}`}
        data-testid="ide-import-review-apply-kind"
      >
        {plan.willReplaceExisting
          ? 'This will replace the current project — confirmation required.'
          : 'This will create a new project.'}
      </p>

      {plan.blockers.length > 0 ? (
        <ul className="ide-import-review-blockers" data-testid="ide-import-review-blockers">
          {plan.blockers.map((blocker, index) => (
            <li key={index} data-testid={`ide-import-review-blocker-${index}`}>
              {blocker}
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="ide-import-review-sources">
        {plan.sources.map((source, index) => (
          <li
            key={source.path}
            className="ide-import-review-source"
            data-testid={`ide-import-review-source-${index}`}
            data-action={source.action}
          >
            <span className="ide-import-review-source-path"><code>{source.path}</code></span>
            <span className="ide-import-review-source-fileset">{source.fileset}</span>
            <span className="ide-import-review-source-tier">{TIER_LABEL[source.tier] ?? source.tier}</span>
            <span className="ide-import-review-source-action">{ACTION_LABEL[source.action] ?? source.action}</span>
            {source.neverExecuted ? (
              <span className="ide-import-review-source-note" title="RedByte never executes imported Tcl">
                never executed
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="ide-import-review-invariants" data-testid="ide-import-review-invariants">
        Review before apply · Tcl is never executed · source is never modified while you inspect it.
      </p>
    </section>
  );
};
