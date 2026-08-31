import React, { useMemo, useState } from 'react';
import {
  crossProbeQualityLabel,
  linksForModule,
  linksForSource,
  type CrossProbeIndex,
  type CrossProbeLink,
  type CrossProbeQuality,
} from '../sourceCrossProbe';
import { qualityForLinks, type CrossProbeDesignModule } from '../crossProbeBuilder';

/**
 * Source ↔ visual cross-probe panel.
 *
 * Two panes over one {@link CrossProbeIndex}: DESIGN → SOURCE (every module,
 * port and instance with its honest link quality and source location) and
 * SOURCE → DESIGN (every source file's links back to the design). Selecting an
 * element on either side highlights its counterpart on the other — the same
 * bidirectional probe, driven by a single stable design key. Quality is always
 * shown so a coarse or missing link is never mistaken for a precise one.
 */

export interface CrossProbePanelProps {
  readonly modules: readonly CrossProbeDesignModule[];
  readonly index: CrossProbeIndex;
  /** sourceId → human path, for labeling source rows. */
  readonly sourceLabels: Record<string, string>;
}

/** Stable key shared by a design element and the link that backs it. */
function keyOf(kind: string, moduleId: string | undefined, elementKey: string | undefined): string {
  return `${kind}:${moduleId ?? ''}:${elementKey ?? ''}`;
}

function linkKey(link: CrossProbeLink): string {
  return keyOf(link.kind, link.moduleId, link.elementKey);
}

const QUALITY_TIERS: readonly CrossProbeQuality[] = ['exact', 'partial', 'ambiguous', 'stale', 'unavailable'];

export const CrossProbePanel: React.FC<CrossProbePanelProps> = ({ modules, index, sourceLabels }) => {
  const [selected, setSelected] = useState<string | null>(null);

  const sourceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const link of index.links) ids.add(link.sourceId);
    return [...ids].sort();
  }, [index]);

  const totalLinks = index.links.length;
  const sourceLabel = (id: string) => sourceLabels[id] ?? id;

  const rangeLabel = (link: CrossProbeLink) =>
    link.range ? `${sourceLabel(link.sourceId)}:${link.range.start.line}` : sourceLabel(link.sourceId);

  return (
    <section className="ide-crossprobe" data-testid="ide-crossprobe" aria-label="Source and visual cross-probe">
      <header className="ide-crossprobe-head">
        <span className="ide-crossprobe-title">Source ↔ visual cross-probe</span>
        <span className="ide-crossprobe-count" data-testid="ide-crossprobe-count">
          {totalLinks} link{totalLinks === 1 ? '' : 's'}
        </span>
      </header>

      <ul className="ide-crossprobe-legend" data-testid="ide-crossprobe-legend" aria-label="Link quality legend">
        {QUALITY_TIERS.map((tier) => (
          <li key={tier} className={`ide-crossprobe-legend-item is-${tier}`}>
            <span className={`ide-crossprobe-badge is-${tier}`}>{crossProbeQualityLabel(tier)}</span>
          </li>
        ))}
      </ul>

      {selected ? (
        <p className="ide-crossprobe-selection" data-testid="ide-crossprobe-selection">
          Probing <code>{selected.split(':').slice(2).join(':') || selected}</code> — highlighted on both sides.
          <button type="button" className="ide-crossprobe-clear" data-testid="ide-crossprobe-clear" onClick={() => setSelected(null)}>
            Clear
          </button>
        </p>
      ) : null}

      <div className="ide-crossprobe-panes">
        {/* ── DESIGN → SOURCE ── */}
        <section className="ide-crossprobe-pane" data-testid="ide-crossprobe-design" aria-label="Design to source">
          <header className="ide-crossprobe-pane-head">Design → Source</header>
          {modules.length === 0 ? (
            <p className="ide-crossprobe-empty" data-testid="ide-crossprobe-design-empty">No design modules.</p>
          ) : (
            <ul className="ide-crossprobe-list">
              {modules.map((module) => {
                const moduleLinks = linksForModule(index, module.id);
                const rows: Array<{
                  key: string;
                  kind: string;
                  name: string;
                  links: CrossProbeLink[];
                  depth: number;
                }> = [];
                rows.push({
                  key: keyOf('module', module.id, module.name),
                  kind: 'module',
                  name: module.name,
                  links: moduleLinks.filter((l) => l.kind === 'module'),
                  depth: 0,
                });
                for (const port of module.ports) {
                  rows.push({
                    key: keyOf('port', module.id, port.name),
                    kind: 'port',
                    name: port.name,
                    links: moduleLinks.filter((l) => l.kind === 'port' && l.elementKey === port.name),
                    depth: 1,
                  });
                }
                for (const instance of module.instances ?? []) {
                  rows.push({
                    key: keyOf('instance', module.id, instance.name),
                    kind: 'instance',
                    name: instance.name,
                    links: moduleLinks.filter((l) => l.kind === 'instance' && l.elementKey === instance.name),
                    depth: 1,
                  });
                }
                return rows.map((row) => {
                  const quality = qualityForLinks(row.links);
                  const link = row.links[0];
                  const isSelected = selected === row.key;
                  return (
                    <li
                      key={row.key}
                      className={`ide-crossprobe-row is-depth-${row.depth}${isSelected ? ' is-selected' : ''}`}
                      data-testid={`ide-crossprobe-design-${row.key}`}
                      data-quality={quality}
                    >
                      <button
                        type="button"
                        className="ide-crossprobe-row-btn"
                        onClick={() => setSelected(isSelected ? null : row.key)}
                        aria-pressed={isSelected}
                      >
                        <span className="ide-crossprobe-row-kind">{row.kind}</span>
                        <code className="ide-crossprobe-row-name">{row.name}</code>
                        <span
                          className={`ide-crossprobe-badge is-${quality}`}
                          data-testid={`ide-crossprobe-quality-${row.key}`}
                        >
                          {crossProbeQualityLabel(quality)}
                        </span>
                        <span className="ide-crossprobe-row-loc">
                          {link ? rangeLabel(link) : 'native only — no source'}
                        </span>
                      </button>
                    </li>
                  );
                });
              })}
            </ul>
          )}
        </section>

        {/* ── SOURCE → DESIGN ── */}
        <section className="ide-crossprobe-pane" data-testid="ide-crossprobe-source" aria-label="Source to design">
          <header className="ide-crossprobe-pane-head">Source → Design</header>
          {sourceIds.length === 0 ? (
            <p className="ide-crossprobe-empty" data-testid="ide-crossprobe-source-empty">
              No source-backed links yet.
            </p>
          ) : (
            <ul className="ide-crossprobe-list">
              {sourceIds.map((sourceId) => (
                <li key={sourceId} className="ide-crossprobe-source-group" data-testid={`ide-crossprobe-source-${sourceId}`}>
                  <div className="ide-crossprobe-source-name">
                    <code>{sourceLabel(sourceId)}</code>
                  </div>
                  <ul className="ide-crossprobe-list">
                    {linksForSource(index, sourceId).map((link, i) => {
                      const k = linkKey(link);
                      const isSelected = selected === k;
                      const quality = link.quality ?? 'partial';
                      return (
                        <li
                          key={`${k}-${i}`}
                          className={`ide-crossprobe-row is-depth-1${isSelected ? ' is-selected' : ''}`}
                          data-testid={`ide-crossprobe-link-${k}`}
                          data-quality={quality}
                        >
                          <button
                            type="button"
                            className="ide-crossprobe-row-btn"
                            onClick={() => setSelected(isSelected ? null : k)}
                            aria-pressed={isSelected}
                          >
                            <span className="ide-crossprobe-row-kind">{link.kind}</span>
                            <code className="ide-crossprobe-row-name">{link.label ?? link.elementKey}</code>
                            <span className={`ide-crossprobe-badge is-${quality}`}>
                              {crossProbeQualityLabel(quality)}
                            </span>
                            <span className="ide-crossprobe-row-loc">
                              {link.range ? `line ${link.range.start.line}` : 'no range'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
};
