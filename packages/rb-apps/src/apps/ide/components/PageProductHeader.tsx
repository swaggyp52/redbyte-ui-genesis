import React from 'react';
import { getProductSpineDefinition, getProductSpineProgress, type ProductSpinePageKey } from '../productDefinition';
import { IdeButton, IdeStatusPill } from './IdePrimitives';

export interface PageProductHeaderState {
  statusLabel?: string;
  statusTone?: 'idle' | 'ok' | 'warn' | 'error';
  detail?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  recoveryLabel?: string;
  onRecovery?: () => void;
  recoveryDisabled?: boolean;
  doneLabel?: string;
  blockedLabel?: string;
}

export interface PageProductHeaderProps {
  mode: ProductSpinePageKey;
  state?: PageProductHeaderState | null;
}

export const PageProductHeader: React.FC<PageProductHeaderProps> = ({ mode, state }) => {
  const definition = getProductSpineDefinition(mode);
  const statusTone = state?.statusTone ?? 'idle';
  const statusLabel = state?.statusLabel ?? definition.shortLabel;
  const detail = state?.detail ?? definition.nextAction;
  const primaryLabel = state?.primaryLabel ?? definition.nextAction.replace(/^What do I do next\?\s*/u, '');
  const recoveryLabel = state?.recoveryLabel ?? 'Recovery';
  const doneLabel = state?.doneLabel ?? definition.doneCondition;
  const blockedLabel = state?.blockedLabel ?? definition.blockedState;

  return (
    <section
      className="ide-product-spine"
      data-testid={`ide-next-step-guide-${mode}`}
      data-product-spine-mode={mode}
      aria-label={`${definition.label} page product spine`}
    >
      <article className="ide-product-spine-card" data-testid={`ide-product-spine-${mode}`}>
        <div className="ide-product-spine__stage" data-testid={`ide-product-spine-stage-${mode}`}>
          <span className="ide-product-spine__progress">{getProductSpineProgress(mode)}</span>
          <span className="ide-product-spine__label">{definition.label}</span>
        </div>

        <div className="ide-product-spine__main">
          <div className="ide-product-spine__title-row">
            <span className="ide-product-spine__prompt">What do I do next?</span>
            <IdeStatusPill tone={statusTone} testId={`ide-product-spine-status-${mode}`}>
              {statusLabel}
            </IdeStatusPill>
          </div>
          <p className="ide-product-spine__job" data-testid={`ide-product-spine-job-${mode}`}>
            {definition.job}
          </p>
          <p className="ide-product-spine__detail" data-testid={`ide-product-spine-next-${mode}`}>
            {detail}
          </p>
        </div>

        <details
          className="ide-product-spine__details"
          data-testid={`ide-product-spine-details-${mode}`}
          open={mode === 'project'}
        >
          <summary>Details</summary>
          <dl className="ide-product-spine__facts" aria-label={`${definition.label} done and recovery conditions`}>
            <div>
              <dt>Done</dt>
              <dd data-testid={`ide-product-spine-done-${mode}`}>{doneLabel}</dd>
            </div>
            <div>
              <dt>Blocked</dt>
              <dd data-testid={`ide-product-spine-blocked-${mode}`}>{blockedLabel}</dd>
            </div>
            <div>
              <dt>Recover</dt>
              <dd data-testid={`ide-product-spine-recover-${mode}`}>{definition.recovery}</dd>
            </div>
            <div>
              <dt>Boundary</dt>
              <dd data-testid={`ide-product-spine-boundary-${mode}`}>{definition.proofBoundary}</dd>
            </div>
          </dl>
        </details>

        <div className="ide-product-spine__actions">
          {state?.onPrimary ? (
            <IdeButton
              tone="primary"
              onClick={state.onPrimary}
              disabled={state.primaryDisabled}
              testId={`ide-product-spine-primary-${mode}`}
            >
              {primaryLabel}
            </IdeButton>
          ) : (
            <span className="ide-product-spine__action-copy" data-testid={`ide-product-spine-primary-${mode}`}>
              {primaryLabel}
            </span>
          )}
          {state?.onRecovery ? (
            <IdeButton
              tone="secondary"
              onClick={state.onRecovery}
              disabled={state.recoveryDisabled}
              testId={`ide-product-spine-recovery-${mode}`}
            >
              {recoveryLabel}
            </IdeButton>
          ) : (
            <span className="ide-product-spine__recovery-copy" data-testid={`ide-product-spine-recovery-${mode}`}>
              {state?.recoveryLabel ?? definition.recovery}
            </span>
          )}
        </div>
      </article>
    </section>
  );
};
