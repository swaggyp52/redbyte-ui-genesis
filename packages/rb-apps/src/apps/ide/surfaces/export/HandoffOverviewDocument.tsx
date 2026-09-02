import React, { useMemo } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { RBProject } from '../../../../export/projectFormat';
import type { RuntimeVerifyRun } from '../../projectRuntime';
import type { ExportViewModel } from '../../viewmodels/buildExportViewModel';
import { ArchitecturePreview } from '../project/ArchitecturePreview';

export interface HandoffOverviewDocumentProps {
  readonly project: RBProject;
  readonly projectName: string;
  readonly boardLabel: string;
  readonly fpgaPart: string;
  readonly topName: string;
  readonly viewModel: ExportViewModel;
  readonly lastRun: RuntimeVerifyRun | null | undefined;
  readonly packageHash: string;
  readonly stateTitle: string;
  readonly stateReason: string;
  readonly isStale: boolean;
  readonly activeConstraintSetName: string | null;
  readonly onOpenFiles?: () => void;
}

/**
 * Handoff Overview — an engineering deliverable derived entirely from canonical
 * project evidence: target, architecture, simulation result, board mapping,
 * constraints, artifact manifest, package hash, and an explicit proof boundary.
 * It is an in-app document; nothing here is added to the canonical package.
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
  onOpenFiles,
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
  const checksPassed = lastRun?.report.rows.filter((row) => row.status === 'pass').length ?? 0;
  const checksFailed = lastRun?.report.rows.filter((row) => row.status === 'fail').length ?? 0;
  const artifactBytes = viewModel.artifacts.reduce((sum, artifact) => sum + artifact.content.length, 0);

  return (
    <article className="rb-doc rb-handoff" data-testid="ide-package-handoff-document" aria-label="Handoff overview">
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
        <button type="button" className="wb-btn wb-btn--ghost" onClick={() => window.print()} data-testid="ide-package-handoff-print" title="Print or save this overview as PDF">
          Print
        </button>
      </header>

      <dl className="rb-facts" data-testid="ide-package-handoff-facts">
        <div className="rb-fact"><dt>Package hash</dt><dd className="is-mono">{(viewModel.exportHash ?? packageHash).slice(0, 12)}</dd></div>
        <div className="rb-fact" data-tone={isStale ? 'warn' : undefined}><dt>State</dt><dd>{stateReason}</dd></div>
        <div className="rb-fact"><dt>Files</dt><dd className="is-mono">{viewModel.artifacts.length} · {artifactBytes.toLocaleString()} bytes</dd></div>
        <div className="rb-fact" data-tone={required > mapped ? 'warn' : 'ok'}><dt>Mapping</dt><dd className="is-mono">{mapped}/{required} required</dd></div>
        <div className="rb-fact" data-tone={lastRun ? (lastRun.status === 'pass' ? 'ok' : 'error') : undefined}>
          <dt>Simulation</dt>
          <dd className="is-mono">{lastRun ? `${lastRun.status.toUpperCase()} · ${checksPassed} passed · ${checksFailed} failed` : 'not run'}</dd>
        </div>
        <div className="rb-fact"><dt>Constraints</dt><dd>{activeConstraintSetName ?? 'Live mapping (implicit active set)'}</dd></div>
      </dl>

      <div className="rb-handoff-body">
        <section className="rb-doc-section rb-handoff-arch" aria-label="Architecture">
          <header className="rb-doc-section-header">
            <span>Architecture</span>
            <code>{topName}</code>
            <span className="wb-toolbar-spacer" />
            <span className="wb-toolbar-meta">{circuit ? `${circuit.nodes.length} components · ${circuit.connections.length} nets` : 'no circuit'}</span>
          </header>
          {circuit && circuit.nodes.length > 0 ? (
            <ArchitecturePreview circuit={circuit} ioLabelByNodeId={ioLabelByNodeId} moduleNameByNodeId={moduleNameByNodeId} />
          ) : (
            <div className="wb-empty">No circuit.</div>
          )}
        </section>

        <section className="rb-doc-section" aria-label="Board mapping">
          <header className="rb-doc-section-header">
            <span>Board mapping</span>
            <span className="wb-toolbar-spacer" />
            <span className="wb-toolbar-meta">{viewModel.pinTable.length} ports · {boardLabel}</span>
          </header>
          <div className="wb-table-frame">
            <table className="wb-table" data-testid="ide-package-handoff-mapping">
              <thead>
                <tr><th scope="col">Signal</th><th scope="col">Dir</th><th scope="col">Artifact port</th><th scope="col">Resource</th><th scope="col">Pin</th><th scope="col">Status</th></tr>
              </thead>
              <tbody>
                {viewModel.pinTable.map((row) => (
                  <tr key={row.rowId ?? row.port} className={row.status === 'missing' ? 'is-stale' : undefined}>
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
                  <tr key={artifact.path}>
                    <td className="is-mono">{artifact.path}</td>
                    <td className="is-mono">{artifact.kind}</td>
                    <td>{artifact.category.replace('-', ' ')}</td>
                    <td className="is-mono">{artifact.content.length.toLocaleString()}</td>
                    <td className="is-mono" data-tone={artifact.status === 'ready' ? 'ok' : artifact.status === 'blocked' ? 'error' : 'warn'}>{artifact.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {viewModel.errors.length + viewModel.warnings.length > 0 ? (
          <section className="rb-doc-section" aria-label="Warnings" data-testid="ide-package-handoff-warnings">
            <header className="rb-doc-section-header">
              <span>Warnings</span>
              <span className="wb-toolbar-spacer" />
              <span className="wb-toolbar-meta">{viewModel.errors.length} errors · {viewModel.warnings.length} warnings</span>
            </header>
            <ul className="rb-problem-list">
              {[...viewModel.errors, ...viewModel.warnings].map((entry, index) => (
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
            <div><dt>Proven in RedByte</dt><dd>Package structure generated deterministically; {lastRun ? `browser simulation ${lastRun.status.toUpperCase()} on scenario ${lastRun.scenarioName}` : 'no simulation run recorded'}; {mapped}/{required} required ports mapped.</dd></div>
            <div><dt>Not run here</dt><dd>Vivado synthesis, implementation, timing analysis, bitstream generation, board programming and physical observation. RedByte generated this package; none of those steps have evidence unless an imported provider snapshot says so.</dd></div>
          </dl>
        </section>
      </div>
    </article>
  );
};
