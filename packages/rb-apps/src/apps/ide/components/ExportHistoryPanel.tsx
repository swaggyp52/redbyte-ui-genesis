import React, { useMemo, useState } from 'react';
import type { ProjectHealthExportResult } from '../projectHealth';
import {
  buildExportHistoryViews,
  compareExportEntries,
  shortHash,
  type ExportHistoryEntryView,
} from '../exportHistoryModel';

/**
 * Package history — a read-only projection of the store's export ledger
 * (`exportHistory`). It lists each generation/download event newest-first with
 * its provenance (kind, verification trust, content hashes), lets the engineer
 * select any package to inspect, and compares the selection against the package
 * before it so it is clear exactly which artifacts changed. Build & Export
 * remains the authority for generating packages.
 */

export interface ExportHistoryPanelProps {
  readonly history: ProjectHealthExportResult[];
}

function kindLabel(view: ExportHistoryEntryView): string {
  if (view.kind === 'project') return 'Project package';
  if (view.kind === 'kit') return 'Vivado kit';
  return 'Package';
}

function trustLabel(view: ExportHistoryEntryView): string {
  if (view.trust === 'trusted') return 'verified';
  if (view.trust === 'unverified') return 'unverified';
  if (view.trust === 'draft') return 'draft';
  return 'unknown';
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const delta = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (delta < 45) return 'just now';
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86400)}d ago`;
}

const FIELD_LABEL: Record<string, string> = {
  package: 'ZIP bytes',
  bundle: 'bundle',
  manifest: 'manifest',
  source: 'generated source',
};

export const ExportHistoryPanel: React.FC<ExportHistoryPanelProps> = ({ history }) => {
  const views = useMemo(() => buildExportHistoryViews(history), [history]);
  const [selectedOrdinal, setSelectedOrdinal] = useState<number | null>(null);

  const selected = useMemo(() => {
    if (views.length === 0) return null;
    return views.find((view) => view.ordinal === selectedOrdinal) ?? views[0];
  }, [views, selectedOrdinal]);

  // The package immediately before the selection (chronologically), for compare.
  const previous = useMemo(() => {
    if (!selected) return null;
    return views.find((view) => view.ordinal === selected.ordinal - 1) ?? null;
  }, [views, selected]);

  const comparison = useMemo(
    () => (selected && previous ? compareExportEntries(previous, selected) : null),
    [selected, previous]
  );

  return (
    <section className="ide-export-history" data-testid="ide-export-history" aria-label="Package history">
      <header className="ide-export-history-head">
        <span>Package history</span>
        <strong data-testid="ide-export-history-count">
          {views.length === 0 ? 'None yet' : `${views.length} package${views.length === 1 ? '' : 's'}`}
        </strong>
      </header>

      {views.length === 0 ? (
        <p className="ide-export-history-empty" data-testid="ide-export-history-empty">
          Generate or download a package to record it here. Each entry keeps its
          provenance so you can compare successive packages.
        </p>
      ) : (
        <>
          <ol className="ide-export-history-list">
            {views.map((view) => {
              const isSelected = selected?.ordinal === view.ordinal;
              return (
                <li key={view.ordinal}>
                  <button
                    type="button"
                    className={`ide-export-history-entry${isSelected ? ' is-selected' : ''} is-${view.status}`}
                    data-testid={`ide-export-history-entry-${view.ordinal}`}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedOrdinal(view.ordinal)}
                  >
                    <span className="ide-export-history-ordinal">#{view.ordinal}</span>
                    <span className="ide-export-history-kind">{kindLabel(view)}</span>
                    <span className={`ide-export-history-trust is-${view.trust}`}>{trustLabel(view)}</span>
                    <code className="ide-export-history-hash">{shortHash(view.packageHash)}</code>
                    <span className="ide-export-history-time">{formatTime(view.atIso)}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {selected ? (
            <div className="ide-export-provenance" data-testid="ide-export-provenance">
              <p className="ide-export-provenance-title">
                Provenance · package #{selected.ordinal} ({kindLabel(selected)}, {trustLabel(selected)})
              </p>
              <dl className="ide-export-provenance-grid">
                <div><dt>ZIP bytes</dt><dd><code>{shortHash(selected.packageHash)}</code></dd></div>
                <div><dt>Bundle</dt><dd><code>{shortHash(selected.bundleHash)}</code></dd></div>
                <div><dt>Manifest</dt><dd><code>{shortHash(selected.manifestHash)}</code></dd></div>
                <div><dt>Generated source</dt><dd><code>{shortHash(selected.sourceHash)}</code></dd></div>
              </dl>
            </div>
          ) : null}

          {comparison ? (
            <div className="ide-export-comparison" data-testid="ide-export-comparison">
              <p className="ide-export-comparison-title">
                vs package #{previous?.ordinal}
              </p>
              {comparison.identical ? (
                <p className="ide-export-comparison-identical" data-testid="ide-export-comparison-identical">
                  Byte-identical to the previous package — nothing changed.
                </p>
              ) : (
                <ul className="ide-export-comparison-list">
                  {comparison.changes.map((change) => (
                    <li
                      key={change.field}
                      className="ide-export-comparison-change"
                      data-testid={`ide-export-comparison-change-${change.field}`}
                    >
                      <span className="ide-export-comparison-field">{FIELD_LABEL[change.field]}</span>
                      <code>{shortHash(change.from)}</code>
                      <span aria-hidden="true">→</span>
                      <code>{shortHash(change.to)}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            selected ? (
              <p className="ide-export-comparison-none" data-testid="ide-export-comparison-none">
                First recorded package — no earlier package to compare against.
              </p>
            ) : null
          )}
        </>
      )}
    </section>
  );
};
