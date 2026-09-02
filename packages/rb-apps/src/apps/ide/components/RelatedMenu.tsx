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
    <details className="wb-menu-details rb-related" ref={detailsRef} data-testid={testId}>
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
