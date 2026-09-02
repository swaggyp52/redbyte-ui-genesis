import React from 'react';
import {
  documentKey,
  documentMode,
  fallbackDocumentLabel,
  type WorkbenchDocument,
} from '../workbenchDocuments';

export type WorkbenchDocumentMark = 'dirty' | 'stale' | 'failing' | null;

export interface WorkbenchDocumentTabStripProps {
  readonly open: readonly WorkbenchDocument[];
  readonly activeKey: string;
  /** Live display name from the document's authority; fallback label otherwise. */
  readonly labelFor?: (doc: WorkbenchDocument) => string | null;
  /** Compact state mark per document (dirty / stale / failing), or null. */
  readonly markFor?: (doc: WorkbenchDocument) => WorkbenchDocumentMark;
  readonly onActivate: (key: string) => void;
  readonly onClose: (key: string) => void;
  /** Engineering-location history. Rendered only when a handler is supplied. */
  readonly history?: {
    readonly canBack: boolean;
    readonly canForward: boolean;
    readonly onBack: () => void;
    readonly onForward: () => void;
  };
  /**
   * Module drill trail for the active schematic document (Top › u_fa2 › …).
   * Rendered only when the trail has a parent to return to; each non-current
   * segment is a real navigation to that module.
   */
  readonly trail?: readonly { readonly key: string; readonly label: string; readonly onSelect?: () => void }[];
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** 12px document-kind glyphs: the kind reads at a glance without an abbreviation. */
const KIND_ICON: Record<WorkbenchDocument['kind'], React.ReactNode> = {
  'project-overview': <svg viewBox="0 0 12 12" {...stroke}><rect x="1.5" y="1.5" width="9" height="9" rx="1" /><path d="M1.5 4.5h9M4.5 4.5v6" /></svg>,
  sources: <svg viewBox="0 0 12 12" {...stroke}><path d="M2 2.5v7M2 4h3M2 7h3" /><rect x="6" y="3" width="4.5" height="2" rx="0.5" /><rect x="6" y="6.5" width="4.5" height="2" rx="0.5" /></svg>,
  architecture: <svg viewBox="0 0 12 12" {...stroke}><rect x="1.5" y="1.5" width="4" height="3" rx="0.5" /><rect x="6.5" y="7.5" width="4" height="3" rx="0.5" /><rect x="6.5" y="1.5" width="4" height="3" rx="0.5" /><path d="M5.5 3h1M3.5 4.5v4.5h3" /></svg>,
  runs: <svg viewBox="0 0 12 12" {...stroke}><path d="M1.5 3h9M1.5 6h9M1.5 9h6" /><path d="M9.5 8l1 1 1.5-2" /></svg>,
  'source-file': <svg viewBox="0 0 12 12" {...stroke}><path d="M3 1.5h4l2.5 2.5v6.5h-6.5z" /><path d="M7 1.5V4h2.5" /></svg>,
  'compile-order': <svg viewBox="0 0 12 12" {...stroke}><path d="M3 2.5h7M3 6h7M3 9.5h7" /><path d="M1.5 2.5h.01M1.5 6h.01M1.5 9.5h.01" strokeWidth="2" /></svg>,
  schematic: <svg viewBox="0 0 12 12" {...stroke}><path d="M3.5 2.5h2.5a3.5 3.5 0 0 1 0 7H3.5z" /><path d="M1 4.5h2.5M1 7.5h2.5M9.5 6H11" /></svg>,
  cases: <svg viewBox="0 0 12 12" {...stroke}><rect x="1.5" y="2" width="9" height="8" rx="0.5" /><path d="M1.5 5h9M1.5 7.5h9M5 2v8" /></svg>,
  timing: <svg viewBox="0 0 12 12" {...stroke}><path d="M1 9h2V3h2v6h2V3h2v6h2" /></svg>,
  waveform: <svg viewBox="0 0 12 12" {...stroke}><path d="M1 8h1.5V4h2v4h2V4h2v4H11" /><path d="M1 2.5h10" strokeDasharray="1 1.5" /></svg>,
  'board-io': <svg viewBox="0 0 12 12" {...stroke}><rect x="3.5" y="3.5" width="5" height="5" rx="0.5" /><path d="M5 3.5V1.5M7 3.5V1.5M5 10.5V8.5M7 10.5V8.5M3.5 5H1.5M3.5 7H1.5M10.5 5H8.5M10.5 7H8.5" /></svg>,
  'package-artifact': <svg viewBox="0 0 12 12" {...stroke}><path d="M1.5 4.5h9v5.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5z" /><path d="M1.5 4.5l1-2h7l1 2M5 7h2" /></svg>,
};

/**
 * The workbench's single document tab row. Tabs are typed references into
 * canonical authorities — activating one activates its workspace. Compact:
 * kind tag + label + state mark + close. Back / Forward live at the left edge
 * because they navigate the same engineering locations the tabs represent.
 */
export const WorkbenchDocumentTabStrip: React.FC<WorkbenchDocumentTabStripProps> = ({
  open,
  activeKey,
  labelFor,
  markFor,
  onActivate,
  onClose,
  history,
  trail,
}) => {
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('.wb-doctab.is-active');
    if (active && typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeKey, open.length]);

  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const nextIndex =
      event.key === 'Home' ? 0 : event.key === 'End' ? open.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : open.length - 1)) % open.length;
    const next = open[nextIndex];
    if (next) {
      onActivate(documentKey(next));
      listRef.current?.querySelector<HTMLButtonElement>(`[data-doc-key="${documentKey(next)}"]`)?.focus();
    }
  };

  const showTrail = Boolean(trail && trail.length > 1);

  return (
    <div className="wb-doctabs" data-testid="ide-doc-tabstrip">
      {history ? (
        <div className="wb-doctabs-history" role="group" aria-label="History">
          <button
            type="button"
            className="wb-btn wb-btn--ghost wb-btn--icon"
            data-testid="ide-location-back"
            onClick={history.onBack}
            disabled={!history.canBack}
            title="Back"
            aria-label="Back"
          >
            ‹
          </button>
          <button
            type="button"
            className="wb-btn wb-btn--ghost wb-btn--icon"
            data-testid="ide-location-forward"
            onClick={history.onForward}
            disabled={!history.canForward}
            title="Forward"
            aria-label="Forward"
          >
            ›
          </button>
        </div>
      ) : null}
      <div ref={listRef} className="wb-doctabs-list" role="tablist" aria-label="Open documents">
        {open.map((doc, index) => {
          const key = documentKey(doc);
          const isActive = key === activeKey;
          const label = labelFor?.(doc) ?? fallbackDocumentLabel(doc);
          const mark = markFor?.(doc) ?? null;
          const closable = doc.kind !== 'project-overview';
          return (
            <span
              key={key}
              className={`wb-doctab${isActive ? ' is-active' : ''}`}
              data-doc-mode={documentMode(doc)}
              data-doc-kind={doc.kind}
              onAuxClick={(event) => {
                if (event.button === 1 && closable) onClose(key);
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className="wb-doctab-activate"
                data-doc-key={key}
                data-testid={`ide-doc-tab-${key}`}
                title={label}
                onClick={() => onActivate(key)}
                onKeyDown={(event) => onTabKey(event, index)}
              >
                <span className="wb-doctab-kind" aria-hidden="true">{KIND_ICON[doc.kind]}</span>
                <span>{label}</span>
                {mark ? <span className="wb-doctab-mark" data-state={mark} aria-label={mark} /> : null}
              </button>
              {closable ? (
                <button
                  type="button"
                  className="wb-doctab-close"
                  aria-label={`Close ${label}`}
                  data-testid={`ide-doc-close-${key}`}
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(key);
                  }}
                >
                  ×
                </button>
              ) : null}
            </span>
          );
        })}
      </div>
      {showTrail && trail ? (
        <nav className="wb-doctabs-trail" aria-label="Module path" data-testid="ide-location-path">
          {trail.map((segment, index) => {
            const isLast = index === trail.length - 1;
            return (
              <React.Fragment key={segment.key}>
                {segment.onSelect && !isLast ? (
                  <button type="button" onClick={segment.onSelect} data-testid={`ide-location-segment-btn-${index}`}>
                    {segment.label}
                  </button>
                ) : (
                  <code data-testid={`ide-location-segment-${index}`}>{segment.label}</code>
                )}
                {!isLast ? <span className="wb-sep" aria-hidden="true">›</span> : null}
              </React.Fragment>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
};
