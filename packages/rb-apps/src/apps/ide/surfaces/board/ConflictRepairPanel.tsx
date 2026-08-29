import React from 'react';
import { IdeButton, IdeCallout } from '../../components/IdePrimitives';
import { SurfacePanel } from '../../components/SurfaceLayoutPrimitives';

/**
 * Conflict repair panel — strictly presentational. It renders only the facts
 * passed in and forwards repair intents to the caller; it holds no mapping
 * state and performs no mutation of its own.
 *
 * Capability truthfulness: each repair action is enabled only when the caller
 * wires the corresponding callback. A missing callback renders the action
 * disabled with the reason in its tooltip — the panel never pretends an
 * authority exists.
 */

export interface PinConflictFacts {
  /** Board resource alias at the center of the conflict (e.g. SW3). */
  resource: string;
  /** Package pin of that resource; null when not resolved by the authority. */
  packagePin?: string | null;
  /** Logical signal currently holding the resource. */
  currentOwner: string;
  /** Logical signal that asked for the resource. */
  requestedOwner: string;
  /** Authority-provided explanation of why this is a conflict. */
  reason: string;
}

export interface ConflictRepairPanelProps {
  conflict: PinConflictFacts;
  /** Swap the resource between current and requested owner. */
  onSwap?: () => void;
  /** Clear the current owner's assignment, freeing the resource. */
  onClear?: () => void;
  /** Move the requested owner to the next compatible free resource. */
  onNextCompatible?: () => void;
  /** Dismiss without changing any assignment. */
  onCancel?: () => void;
  testId?: string;
}

const NO_AUTHORITY_REASON =
  'Not available: no mapping authority is connected for this action.';

export const ConflictRepairPanel: React.FC<ConflictRepairPanelProps> = ({
  conflict,
  onSwap,
  onClear,
  onNextCompatible,
  onCancel,
  testId = 'rb-pin-conflict-repair',
}) => {
  return (
    <SurfacePanel testId={testId} hierarchyRole="conflict-repair">
      <p className="ide-surface-block-label">Conflict repair</p>
      <IdeCallout
        tone="error"
        title={`${conflict.resource} is claimed twice`}
        testId={`${testId}-reason`}
      >
        {conflict.reason}
      </IdeCallout>
      <dl data-testid={`${testId}-facts`}>
        <div>
          <dt>Board resource</dt>
          <dd data-testid={`${testId}-fact-resource`}>
            {conflict.resource}
            {conflict.packagePin ? ` · pin ${conflict.packagePin}` : ''}
          </dd>
        </div>
        <div>
          <dt>Currently assigned to</dt>
          <dd data-testid={`${testId}-fact-current-owner`}>{conflict.currentOwner}</dd>
        </div>
        <div>
          <dt>Requested by</dt>
          <dd data-testid={`${testId}-fact-requested-owner`}>{conflict.requestedOwner}</dd>
        </div>
      </dl>
      <div className="ide-hw-v3__editor-actions">
        <IdeButton
          tone="secondary"
          onClick={onSwap}
          disabled={!onSwap}
          title={onSwap ? undefined : NO_AUTHORITY_REASON}
          testId={`${testId}-swap`}
        >
          Swap owners
        </IdeButton>
        <IdeButton
          tone="secondary"
          onClick={onClear}
          disabled={!onClear}
          title={onClear ? undefined : NO_AUTHORITY_REASON}
          testId={`${testId}-clear`}
        >
          Clear {conflict.currentOwner}
        </IdeButton>
        <IdeButton
          tone="secondary"
          onClick={onNextCompatible}
          disabled={!onNextCompatible}
          title={onNextCompatible ? undefined : NO_AUTHORITY_REASON}
          testId={`${testId}-next-compatible`}
        >
          Use next compatible
        </IdeButton>
        <IdeButton
          tone="ghost"
          onClick={onCancel}
          disabled={!onCancel}
          title={onCancel ? undefined : NO_AUTHORITY_REASON}
          testId={`${testId}-cancel`}
        >
          Cancel
        </IdeButton>
      </div>
    </SurfacePanel>
  );
};
