import React, { useEffect, useMemo, useState } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { RBProject } from '../../../../export/projectFormat';
import type { RuntimeVerifyRun } from '../../projectRuntime';
import type { ExportDiagnosticView, ExportViewModel } from '../../viewmodels/buildExportViewModel';
import type { ProjectHealthExportResult } from '../../projectHealth';
import type { WorkbenchDocument } from '../../workbenchDocuments';
import type { EngineeringObjectRef } from '../../engineeringSelection';
import { getBasys3BoardResource } from '../../../../fpga/boards/basys3/basys3Pins';
import { ArchitecturePreview } from '../project/ArchitecturePreview';
import { Basys3BoardView } from '../../components/Basys3BoardView';
import { HandoffWaveformFigure } from './HandoffWaveformFigure';

export interface HandoffOverviewDocumentProps {
  readonly project: RBProject;
  readonly projectName: string;
  readonly boardLabel: string;
  readonly fpgaPart: string;
  readonly topName: string;
  readonly viewModel: ExportViewModel;
  readonly lastRun: RuntimeVerifyRun | null | undefined;
  /** The Simulate determinism hash — a fallback only when no export hash exists. */
  readonly packageHash: string;
  readonly stateTitle: string;
  readonly stateReason: string;
  /** Simulation evidence is stale: the design, stimulus or mapping changed after the last run. */
  readonly isStale: boolean;
  readonly activeConstraintSetName: string | null;
  /** Constraint-set id the Board document opens on. */
  readonly boardConstraintSetId?: string | null;
  /** The last download receipt that is still current for this design, if any. */
  readonly downloadEvidence?: ProjectHealthExportResult | null;
  /** The merged, visible diagnostics (package validation + evidence). */
  readonly diagnostics?: readonly ExportDiagnosticView[];
  readonly onOpenFiles?: () => void;
  readonly onOpenDocument?: (doc: WorkbenchDocument) => void;
  readonly onSelect?: (ref: EngineeringObjectRef) => void;
  readonly onOpenProblems?: () => void;
}

const PRESENT_CLASS = 'rb-presenting';

/** Enter or Space activates a row that acts as a link. */
const rowKeyHandler = (activate: () => void) => (event: React.KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    activate();
  }
};

/**
 * Handoff Overview — the engineering dossier derived entirely from canonical
 * project evidence: target, architecture, simulation evidence, board mapping,
 * constraints, artifact manifest, package identity, and an explicit proof
 * boundary. Every figure and row opens the object it describes. It is an
 * in-app document; nothing here is added to the canonical package.
 */
export const HandoffOverviewDocument: React.FC<HandoffOverviewDocumentProps> = ({
  project,
  projectName,
  boardLabel,
  fpgaPart,
  topName,
  viewModel,
  lastRun,
  packageHash,
  stateTitle,
  stateReason,
  isStale,
  activeConstraintSetName,
  boardConstraintSetId,
  downloadEvidence,
  diagnostics,
  onOpenFiles,
  onOpenDocument,
  onSelect,
  onOpenProblems,
}) => {
  const circuit = (project.circuit ?? null) as unknown as Circuit | null;
  const ioLabelByNodeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of circuit?.nodes ?? []) {
      if (node.type === 'INPUT' || node.type === 'OUTPUT') map.set(node.id, String((node as { label?: string }).label ?? node.id));
    }
    return map;
  }, [circuit]);
  const moduleNameByNodeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of circuit?.nodes ?? []) {
      const config = (node as { config?: Record<string, unknown> }).config;
      const name = config && typeof config.moduleDefinitionId === 'string' ? String(config.instanceName ?? node.type) : null;
      if (name) map.set(node.id, String(node.type));
    }
    return map;
  }, [circuit]);

  const mapped = viewModel.pinTable.filter((row) => row.status === 'mapped').length;
  const required = viewModel.pinTable.filter((row) => row.required).length;
  const reportRows = lastRun?.report.rows ?? [];
  const checksPassed = reportRows.filter((row) => row.status === 'pass').length;
  const checksFailed = reportRows.filter((row) => row.status === 'fail').length;
  const artifactBytes = viewModel.artifacts.reduce((sum, artifact) => sum + artifact.content.length, 0);
  const runIsCompare = lastRun ? lastRun.runKind !== 'trace' && lastRun.assertionStatus !== 'not-configured' : false;
  const scenarioId = lastRun?.scenarioId ?? null;
  const isSequentialRun = lastRun?.schedule === 'clocked_macro';
  const evidenceDocument: WorkbenchDocument | null = scenarioId ? { kind: isSequentialRun ? 'timing' : 'cases', scenarioId } : null;
  const waveformDocument: WorkbenchDocument | null = scenarioId ? { kind: 'waveform', scenarioId } : null;
  const boardDocument: WorkbenchDocument = { kind: 'board-io', constraintSetId: boardConstraintSetId ?? 'default' };
  const mappedAliases = useMemo(
    () => new Set(viewModel.pinTable.map((row) => (row.packagePin ?? row.pin) ? getBasys3BoardResource(row.packagePin ?? row.pin ?? '')?.alias : null).filter((alias): alias is string => Boolean(alias))),
    [viewModel.pinTable]
  );
  const rowByAlias = useMemo(() => {
    const map = new Map<string, (typeof viewModel.pinTable)[number]>();
    for (const row of viewModel.pinTable) {
      const alias = getBasys3BoardResource(row.packagePin ?? row.pin ?? '')?.alias;
      if (alias) map.set(alias, row);
    }
    return map;
  }, [viewModel.pinTable]);
  const visibleDiagnostics = diagnostics ?? [...viewModel.errors, ...viewModel.warnings];
  const errorCount = visibleDiagnostics.filter((entry) => entry.severity === 'error').length;
  const warningCount = visibleDiagnostics.length - errorCount;
  // Constraint facts come from the generated artifact itself, never from arithmetic.
  const xdcArtifact = viewModel.artifacts.find((artifact) => artifact.path.toLowerCase().endsWith('.xdc')) ?? null;
  const xdcLineCount = xdcArtifact ? xdcArtifact.content.split(/\r?\n/).filter((line) => line.trim().length > 0).length : null;
  const packageShaText = downloadEvidence?.packageHash ?? (downloadEvidence ? 'downloaded · legacy receipt, hash unavailable' : 'not downloaded yet');

  // Figures and tables are numbered in render order; only what renders counts.
  const hasArchitecture = Boolean(circuit && circuit.nodes.length > 0);
  const hasWaveform = Boolean(lastRun && (lastRun.waveform?.length ?? 0) > 0);
  const figArchitecture = hasArchitecture ? 1 : 0;
  const figWaveform = hasWaveform ? figArchitecture + 1 : 0;
  const figBoard = Math.max(figArchitecture, figWaveform) + 1;
  const tableChecks = reportRows.length > 0 ? 1 : 0;
  const tableMapping = tableChecks + 1;
  const tableManifest = tableMapping + 1;

  // Presentation mode: the same page without workbench chrome, on screen. Escape ends it.
  const [presenting, setPresenting] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (presenting) root.classList.add(PRESENT_CLASS);
    else root.classList.remove(PRESENT_CLASS);
    if (!presenting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPresenting(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      root.classList.remove(PRESENT_CLASS);
    };
  }, [presenting]);

  const openSignalRow = (row: (typeof viewModel.pinTable)[number]) => {
    onOpenDocument?.(boardDocument);
    const fieldId = row.rowId ?? row.logicalSignalId ?? null;
    if (fieldId) onSelect?.({ kind: 'signal', fieldId, runSignal: null });
  };
  const openCase = (tick: number) => {
    if (!evidenceDocument || !scenarioId) return;
    onOpenDocument?.(evidenceDocument);
    onSelect?.({ kind: 'case-tick', scenarioId, tick });
  };
  const openWaveformTick = (tick: number) => {
    if (!waveformDocument || !scenarioId) return;
    onOpenDocument?.(waveformDocument);
    onSelect?.({ kind: 'case-tick', scenarioId, tick });
  };
  const openArtifacts = () => {
    onOpenFiles?.();
    onOpenDocument?.({ kind: 'package-artifact' });
  };
  const linkable = Boolean(onOpenDocument);
  const linkRowProps = (activate: () => void) =>
    linkable
      ? { role: 'button' as const, tabIndex: 0, onClick: activate, onKeyDown: rowKeyHandler(activate) }
      : {};

  return (
    <article
      className={`rb-doc rb-handoff${presenting ? ' is-presenting' : ''}`}
      data-testid="ide-package-handoff-document"
      aria-label="Handoff overview"
    >
      <header className="rb-doc-header">
        <h2 className="rb-doc-title">Handoff</h2>
        <span className="rb-doc-header-sep" aria-hidden="true" />
        <code className="rb-doc-header-code">{projectName}</code>
        <span className="wb-toolbar-meta">{boardLabel} · {fpgaPart} · top {topName}</span>
        <span className="wb-toolbar-spacer" />
        <span className={`rb-handoff-state${isStale ? ' is-stale' : viewModel.status === 'ok' ? ' is-ok' : ' is-blocked'}`} data-testid="ide-package-handoff-state">
          {stateTitle}
        </span>
        {onOpenFiles ? (
          <button type="button" className="wb-btn" onClick={onOpenFiles} data-testid="ide-package-handoff-open-files">
            Files
          </button>
        ) : null}
        <button
          type="button"
          className="wb-btn wb-btn--ghost"
          onClick={() => setPresenting((value) => !value)}
          aria-pressed={presenting}
          data-testid="ide-package-handoff-present"
          title={presenting ? 'Leave presentation (Esc)' : 'Show this overview without workbench chrome'}
        >
          {presenting ? 'Exit' : 'Present'}
        </button>
        <button type="button" className="wb-btn wb-btn--ghost" onClick={() => window.print()} data-testid="ide-package-handoff-print" title="Print or save this overview as PDF">
          Print
        </button>
      </header>

      <dl className="rb-facts" data-testid="ide-package-handoff-facts">
        <div className="rb-fact">
          <dt>Export source hash</dt>
          <dd className="is-mono" title="Deterministic hash written into the generated sources">{viewModel.exportHash ?? packageHash}</dd>
        </div>
        <div className="rb-fact" data-tone={downloadEvidence?.packageHash ? 'ok' : undefined}>
          <dt>Package SHA-256</dt>
          <dd className="is-mono" title="SHA-256 of the exact ZIP bytes of the last download that still matches this design" data-testid="ide-package-handoff-package-sha">
            {packageShaText}
          </dd>
        </div>
        <div className="rb-fact" data-tone={isStale ? 'warn' : undefined}><dt>State</dt><dd>{stateReason}</dd></div>
        <div className="rb-fact"><dt>Files</dt><dd className="is-mono">{viewModel.artifacts.length} · {artifactBytes.toLocaleString()} bytes</dd></div>
        <div className="rb-fact" data-tone={required > mapped ? 'warn' : 'ok'}>
          <dt>Mapping</dt>
          <dd className="is-mono">{mapped}/{required} required</dd>
        </div>
        <div className="rb-fact" data-tone={lastRun ? (runIsCompare ? (lastRun.status === 'pass' ? 'ok' : 'error') : undefined) : undefined}>
          <dt>Simulation</dt>
          <dd className="is-mono">
            {lastRun
              ? runIsCompare
                ? `${lastRun.status.toUpperCase()} · ${checksPassed} passed · ${checksFailed} failed`
                : `observed only · ${lastRun.waveform?.length ?? 0} ticks · no checks compared`
              : 'not run'}
          </dd>
        </div>
        <div className="rb-fact">
          <dt>Constraints</dt>
          <dd>
            {activeConstraintSetName ?? 'Live mapping'}
            {xdcArtifact && xdcLineCount != null ? ` · ${xdcLineCount} lines in ${xdcArtifact.path}` : ''}
          </dd>
        </div>
      </dl>

      <div className="rb-handoff-body">
        <section className="rb-doc-section rb-handoff-arch" aria-label="Architecture">
          <header className="rb-doc-section-header">
            <span>Architecture</span>
            <code>{topName}</code>
            <span className="wb-toolbar-spacer" />
            <span className="wb-toolbar-meta">{circuit ? `${circuit.nodes.length} components · ${circuit.connections.length} nets` : 'no circuit'}</span>
            {linkable ? (
              <button type="button" className="wb-btn wb-btn--ghost" onClick={() => onOpenDocument?.({ kind: 'schematic', moduleId: 'top' })} data-testid="ide-package-handoff-open-design">
                Open schematic
              </button>
            ) : null}
          </header>
          {hasArchitecture && circuit ? (
            <figure className="rb-handoff-figure">
              <ArchitecturePreview
                circuit={circuit}
                ioLabelByNodeId={ioLabelByNodeId}
                moduleNameByNodeId={moduleNameByNodeId}
                onSelectNode={linkable ? (nodeId) => {
                  onOpenDocument?.({ kind: 'schematic', moduleId: 'top' });
                  onSelect?.({ kind: 'node', moduleId: 'top', nodeId });
                } : undefined}
              />
              <figcaption>
                Figure {figArchitecture} — Architecture of {topName}: boundary signals, module instances and the nets between them.
                {linkable ? <span className="rb-handoff-click"> Click a block to open it in Design.</span> : null}
              </figcaption>
            </figure>
          ) : (
            <div className="wb-empty">No circuit.</div>
          )}
        </section>

        <section className="rb-doc-section" aria-label="Simulation evidence" data-testid="ide-package-handoff-evidence">
          <header className="rb-doc-section-header">
            <span>Simulation evidence</span>
            {lastRun ? <code>{lastRun.scenarioName}</code> : null}
            <span className="wb-toolbar-spacer" />
            <span className="wb-toolbar-meta">
              {lastRun ? (runIsCompare ? `compare · ${reportRows.length} checks` : 'observe · no checks') : 'no run recorded'}
              {isStale && lastRun ? ' · stale' : ''}
            </span>
            {lastRun && linkable && evidenceDocument ? (
              <button type="button" className="wb-btn wb-btn--ghost" onClick={() => onOpenDocument?.(evidenceDocument)} data-testid="ide-package-handoff-open-cases">
                Open {isSequentialRun ? 'timing' : 'cases'}
              </button>
            ) : null}
            {lastRun && linkable && waveformDocument ? (
              <button type="button" className="wb-btn wb-btn--ghost" onClick={() => onOpenDocument?.(waveformDocument)} data-testid="ide-package-handoff-open-waveform">
                Open waveform
              </button>
            ) : null}
          </header>
          {lastRun ? (
            <>
              {hasWaveform ? <HandoffWaveformFigure run={lastRun} figureNumber={figWaveform} onSelectTick={linkable ? openWaveformTick : undefined} /> : null}
              {reportRows.length > 0 ? (
                <div className="wb-table-frame">
                  <table className="wb-table" data-testid="ide-package-handoff-checks">
                    <thead>
                      <tr><th scope="col">Signal</th><th scope="col">Tick</th><th scope="col">Expected</th><th scope="col">Observed</th><th scope="col">Result</th></tr>
                    </thead>
                    <tbody>
                      {reportRows.slice(0, 32).map((row, index) => (
                        <tr
                          key={`${row.signal}-${row.tick}-${index}`}
                          className={`${row.status === 'fail' ? 'is-fail' : ''}${linkable ? ' is-link' : ''}`}
                          {...linkRowProps(() => openCase(row.tick))}
                        >
                          <td className="is-mono">{row.signal}</td>
                          <td className="is-mono">t{row.tick}</td>
                          <td className="is-mono">{row.expected}</td>
                          <td className="is-mono">{row.actual}</td>
                          <td className="is-mono" data-tone={row.status === 'pass' ? 'ok' : row.status === 'fail' ? 'error' : undefined}>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="wb-toolbar-meta">
                    Table {tableChecks} — {reportRows.length > 32 ? `32 of ${reportRows.length} checks compared by the browser simulation; the Cases document lists them all.` : 'Checks compared by the browser simulation.'}
                    {linkable ? <span className="rb-handoff-click"> A row opens its case.</span> : null}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="wb-empty">No simulation run has been recorded for this design.</div>
          )}
        </section>

        <section className="rb-doc-section" aria-label="Board mapping">
          <header className="rb-doc-section-header">
            <span>Board mapping</span>
            <span className="wb-toolbar-spacer" />
            <span className="wb-toolbar-meta">{viewModel.pinTable.length} ports · {boardLabel} · {activeConstraintSetName ?? 'live mapping'}</span>
            {linkable ? (
              <button type="button" className="wb-btn wb-btn--ghost" onClick={() => onOpenDocument?.(boardDocument)} data-testid="ide-package-handoff-open-board">
                Open board
              </button>
            ) : null}
          </header>
          <figure className="rb-handoff-figure rb-handoff-board" data-testid="ide-package-handoff-board-figure">
            <Basys3BoardView
              mappedAliases={mappedAliases}
              onSelectAlias={(alias) => {
                const row = rowByAlias.get(alias);
                if (row) openSignalRow(row);
                else onOpenDocument?.(boardDocument);
              }}
            />
            <figcaption>
              Figure {figBoard} — {boardLabel} with the {mapped} mapped resources highlighted.
              {linkable ? <span className="rb-handoff-click"> Click a resource to open its signal in Board & Constraints.</span> : null}
            </figcaption>
          </figure>
          <div className="wb-table-frame">
            <table className="wb-table" data-testid="ide-package-handoff-mapping">
              <thead>
                <tr><th scope="col">Signal</th><th scope="col">Dir</th><th scope="col">Artifact port</th><th scope="col">Resource</th><th scope="col">Pin</th><th scope="col">Status</th></tr>
              </thead>
              <tbody>
                {viewModel.pinTable.map((row) => (
                  <tr
                    key={row.rowId ?? row.port}
                    className={`${row.status === 'missing' ? 'is-stale' : ''}${linkable ? ' is-link' : ''}`}
                    {...linkRowProps(() => openSignalRow(row))}
                  >
                    <td className="is-mono">{row.logicalLabel ?? row.port}</td>
                    <td className="is-mono">{row.direction}</td>
                    <td className="is-mono">{row.artifactPortName ?? row.port}</td>
                    <td>{row.boardResourceLabel ?? '—'}</td>
                    <td className="is-mono">{row.packagePin ?? row.pin ?? (row.required ? 'unmapped' : '—')}</td>
                    <td className="is-mono" data-tone={row.status === 'mapped' ? 'ok' : row.status === 'missing' ? 'error' : undefined}>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="wb-toolbar-meta">
              Table {tableMapping} — Logical signals, their artifact ports and package pins.
              {linkable ? <span className="rb-handoff-click"> A row opens the signal in Board & Constraints.</span> : null}
            </p>
          </div>
        </section>

        <section className="rb-doc-section" aria-label="Artifact manifest">
          <header className="rb-doc-section-header">
            <span>Artifact manifest</span>
            <span className="wb-toolbar-spacer" />
            <span className="wb-toolbar-meta">generated by RedByte · deterministic</span>
          </header>
          <div className="wb-table-frame">
            <table className="wb-table" data-testid="ide-package-handoff-manifest">
              <thead>
                <tr><th scope="col">File</th><th scope="col">Kind</th><th scope="col">Role</th><th scope="col">Bytes</th><th scope="col">Status</th></tr>
              </thead>
              <tbody>
                {viewModel.artifacts.map((artifact) => (
                  <tr
                    key={artifact.path}
                    className={linkable ? 'is-link' : undefined}
                    data-testid={`ide-package-handoff-artifact-${artifact.path.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
                    {...linkRowProps(openArtifacts)}
                  >
                    <td className="is-mono">{artifact.path}</td>
                    <td className="is-mono">{artifact.kind}</td>
                    <td>{artifact.category.replace('-', ' ')}</td>
                    <td className="is-mono">{artifact.content.length.toLocaleString()}</td>
                    <td className="is-mono" data-tone={artifact.status === 'ready' ? 'ok' : artifact.status === 'blocked' ? 'error' : 'warn'}>{artifact.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="wb-toolbar-meta">
              Table {tableManifest} — Every file of the package with its role.
              {linkable ? <span className="rb-handoff-click"> A row opens the artifact document.</span> : null}
            </p>
          </div>
        </section>

        {visibleDiagnostics.length > 0 ? (
          <section className="rb-doc-section" aria-label="Warnings" data-testid="ide-package-handoff-warnings">
            <header className="rb-doc-section-header">
              <span>Warnings</span>
              <span className="wb-toolbar-spacer" />
              <span className="wb-toolbar-meta">{errorCount} errors · {warningCount} warnings</span>
              {onOpenProblems ? (
                <button type="button" className="wb-btn wb-btn--ghost" onClick={onOpenProblems} data-testid="ide-package-handoff-open-problems">
                  Open Problems
                </button>
              ) : null}
            </header>
            <ul className="rb-problem-list">
              {visibleDiagnostics.map((entry, index) => (
                <li key={`${entry.code ?? 'diag'}-${index}`} className="wb-panel-line" data-tone={entry.severity === 'error' ? 'error' : 'warn'}>
                  <span aria-hidden="true">{entry.severity === 'error' ? '✕' : '▲'}</span>
                  <span>{entry.title ?? entry.message}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rb-doc-section rb-handoff-boundary" aria-label="Proof boundary" data-testid="ide-package-handoff-boundary">
          <header className="rb-doc-section-header"><span>Proof boundary</span></header>
          <dl className="rb-handoff-boundary-grid">
            <div>
              <dt>Proven in RedByte</dt>
              <dd>
                Package structure generated deterministically;{' '}
                {lastRun
                  ? runIsCompare
                    ? `browser simulation ${lastRun.status.toUpperCase()} on scenario ${lastRun.scenarioName} (${checksPassed} checks passed, ${checksFailed} failed)`
                    : `browser simulation observed scenario ${lastRun.scenarioName} without checks`
                  : 'no simulation run recorded'}
                ; {mapped}/{required} required ports mapped
                {downloadEvidence ? '; the last download matches this design' : '; no current download'}.
              </dd>
            </div>
            <div>
              <dt>Not run here</dt>
              <dd>Vivado synthesis, implementation, timing analysis, bitstream generation, board programming and physical observation. RedByte generated this package; none of those steps have evidence unless an imported provider snapshot says so.</dd>
            </div>
          </dl>
        </section>
      </div>
    </article>
  );
};
