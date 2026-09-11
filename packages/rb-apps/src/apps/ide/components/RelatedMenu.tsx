import React from 'react';
import {
  relatedDocumentsForSignal,
  type EngineeringSignalRelation,
} from '../engineeringRelationships';
import { useEngineeringSelection, type SelectionOrigin } from '../engineeringSelection';
import { openWorkbenchDocument } from '../workbenchNavigation';

export interface RelatedMenuProps {
  readonly relation: EngineeringSignalRelation;
  readonly activeScenarioId: string | null;
  readonly hasRun: boolean;
  /** Which document is asking, so the selection it publishes is attributed. */
  readonly origin: SelectionOrigin;
  readonly testId?: string;
  readonly label?: string;
}

/**
 * "Related…" — the plain-language way to follow one engineering object into
 * its other representations. Every entry is a real document the project has;
 * choosing one selects the same signal there and opens the document through
 * the workbench host. No jargon, no permanent rail: a compact menu.
 */
export const RelatedMenu: React.FC<RelatedMenuProps> = ({
  relation,
  activeScenarioId,
  hasRun,
  origin,
  testId = 'ide-related-menu',
  label = 'Related…',
}) => {
  const select = useEngineeringSelection((state) => state.select);
  const links = relatedDocumentsForSignal(relation, { activeScenarioId, hasRun });
  const detailsRef = React.useRef<HTMLDetailsElement | null>(null);
  const hostAvailable = true;

  return (
    <details
      className="wb-menu-details rb-related"
      ref={detailsRef}
      data-testid={testId}
      onToggle={(event) => {
        const details = event.currentTarget;
        if (!details.open) {
          details.removeAttribute('data-align');
          return;
        }
        const menu = details.querySelector<HTMLElement>('.wb-menu');
        const trigger = details.querySelector<HTMLElement>('summary');
        if (!menu || !trigger) return;
        // Measure from the trigger's left edge with the menu's natural width, so the
        // answer does not depend on which edge the menu currently hangs from.
        const rect = trigger.getBoundingClientRect();
        // The trigger often lives in a scrolling dock; a fixed menu escapes its overflow box.
        const alignEnd = rect.left + menu.offsetWidth > window.innerWidth - 8;
        details.setAttribute('data-align', alignEnd ? 'end' : 'start');
        menu.style.position = 'fixed';
        menu.style.top = `${Math.round(rect.bottom + 2)}px`;
        menu.style.left = alignEnd ? 'auto' : `${Math.round(rect.left)}px`;
        menu.style.right = alignEnd ? `${Math.round(window.innerWidth - rect.right)}px` : 'auto';
        menu.style.maxHeight = `${Math.max(160, window.innerHeight - rect.bottom - 12)}px`;
        menu.style.overflowY = 'auto';
      }}
    >
      <summary className="wb-btn wb-btn--ghost" data-testid={`${testId}-trigger`} title={`Follow ${relation.label} into its other representations`}>
        {label}
      </summary>
      <ul className="wb-menu rb-related-menu" role="menu" aria-label={`Related to ${relation.label}`}>
        <li className="rb-related-head" role="presentation">
          <code>{relation.label}</code>
          {relation.ambiguity.length > 0 ? (
            <span className="rb-related-ambiguous" title={relation.ambiguity.join('\n')}>
              ambiguous
            </span>
          ) : null}
        </li>
        {links.map((link) => (
          <li key={`${link.document.kind}:${link.label}`} role="none">
            <button
              type="button"
              role="menuitem"
              className="wb-menu-item"
              data-testid={`${testId}-${link.document.kind}`}
              title={link.detail}
              disabled={!hostAvailable}
              onClick={() => {
                select(
                  {
                    kind: 'signal',
                    fieldId: relation.fieldId,
                    runSignal: relation.run?.resolution.runSignal ?? null,
                    nodeId: relation.nodeId,
                  },
                  origin
                );
                openWorkbenchDocument(link.document);
                if (detailsRef.current) detailsRef.current.open = false;
              }}
            >
              <span className="wb-menu-item-check" aria-hidden="true" />
              <span className="wb-menu-item-label">{link.label}</span>
              <span className="wb-menu-item-key rb-related-detail">{link.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
};
