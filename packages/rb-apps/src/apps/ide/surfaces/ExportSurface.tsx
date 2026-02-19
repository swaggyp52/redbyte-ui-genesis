import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RBProject } from '../../../export/projectFormat';
import {
  buildExportViewModel,
  type ExportArtifactView,
  type ExportPinStatus,
} from '../viewmodels/buildExportViewModel';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';

export interface ExportSurfaceProps {
  project: RBProject;
  onExportBundle?: (artifacts: ExportArtifactView[]) => void;
}

export const ExportSurface: React.FC<ExportSurfaceProps> = ({
  project,
  onExportBundle,
}) => {
  const viewModel = useMemo(() => buildExportViewModel(project), [project]);
  const diagnosticsList = useMemo(
    () => [...viewModel.errors, ...viewModel.warnings],
    [viewModel.errors, viewModel.warnings]
  );
  const [pinOverrides, setPinOverrides] = useState<Record<string, string>>(() =>
    createPinOverrideMap(viewModel.pinTable)
  );
  const [highlightedPort, setHighlightedPort] = useState<string | null>(null);
  const [selectedArtifactPath, setSelectedArtifactPath] = useState<string>(() =>
    viewModel.artifacts[0]?.path ?? ''
  );
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const pinInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const highlightResetTimer = useRef<number | null>(null);

  useEffect(() => {
    setPinOverrides(createPinOverrideMap(viewModel.pinTable));
  }, [viewModel.pinTable]);

  useEffect(() => {
    if (viewModel.artifacts.length === 0) {
      setSelectedArtifactPath('');
      return;
    }
    const exists = viewModel.artifacts.some((artifact) => artifact.path === selectedArtifactPath);
    if (!exists) {
      setSelectedArtifactPath(viewModel.artifacts[0].path);
    }
  }, [viewModel.artifacts, selectedArtifactPath]);

  useEffect(() => {
    return () => {
      if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(highlightResetTimer.current);
      }
    };
  }, []);

  const mappingIndex = useMemo(() => {
    const index = new Map<string, (typeof viewModel.pinTable)[number]>();
    for (const row of viewModel.pinTable) {
      index.set(toPortKey(row.port), row);
    }
    return index;
  }, [viewModel.pinTable]);

  const hasBlockingErrors = viewModel.status === 'blocked';
  const mappedCount = viewModel.pinTable.filter((row) => {
    const key = toPortKey(row.port);
    const pinValue = (pinOverrides[key] ?? '').trim();
    return row.status !== 'unused' && pinValue.length > 0;
  }).length;
  const selectedArtifact =
    viewModel.artifacts.find((artifact) => artifact.path === selectedArtifactPath) ??
    viewModel.artifacts[0];

  const jumpToMapping = (portKey: string) => {
    const row = rowRefs.current[portKey];
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedPort(portKey);
    if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(highlightResetTimer.current);
    }
    if (typeof window !== 'undefined') {
      highlightResetTimer.current = window.setTimeout(() => {
        setHighlightedPort(null);
      }, 1200);
    }
    pinInputRefs.current[portKey]?.focus();
  };

  const applySuggestion = (portKey: string) => {
    const row = mappingIndex.get(portKey);
    if (!row?.suggestedPin) return;
    setPinOverrides((prev) => ({
      ...prev,
      [portKey]: row.suggestedPin ?? '',
    }));
    jumpToMapping(portKey);
  };

  const handleDownloadArtifact = (artifact: ExportArtifactView) => {
    if (typeof window === 'undefined' || artifact.preview.trim().length === 0) return;
    const blob = new Blob([artifact.preview], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = artifact.path;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBundle = () => {
    if (hasBlockingErrors) return;
    if (onExportBundle) {
      onExportBundle(viewModel.artifacts);
      return;
    }
    for (const artifact of viewModel.artifacts) {
      handleDownloadArtifact(artifact);
    }
  };

  return (
    <IdeSurfaceLayout
      mode="export"
      inspector={
        <>
          <IdeInspectorSection title="Export Context">
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Board</span>
                <span>Basys3</span>
              </div>
              <div className="ide-kv-row">
                <span>Export Hash</span>
                <span className="ide-status-mono">
                  {viewModel.exportHash ? viewModel.exportHash.slice(0, 16) : 'pending'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Blocking Errors</span>
                <span>{viewModel.errors.length}</span>
              </div>
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Artifact Checklist">
            <div className="ide-export-artifact-list">
              {viewModel.artifacts.map((artifact) => (
                <div key={artifact.path} className="ide-export-artifact-row">
                  <div>
                    <div className="ide-export-artifact-name">{artifact.path}</div>
                    <div className="ide-export-artifact-note">{artifact.note}</div>
                  </div>
                  <IdeStatusPill
                    tone={
                      artifact.status === 'ready'
                        ? 'ok'
                        : artifact.status === 'blocked'
                          ? 'error'
                          : 'warn'
                    }
                  >
                    {artifact.status === 'ready'
                      ? 'Ready'
                      : artifact.status === 'blocked'
                        ? 'Blocked'
                        : 'Pending'}
                  </IdeStatusPill>
                </div>
              ))}
            </div>
          </IdeInspectorSection>
        </>
      }
    >
        <IdePanel
          title="Export Compiler"
          description="Validate Basys3 readiness, resolve blockers, and package Vivado artifacts."
          actions={
            <>
              <IdeButton
                tone="primary"
                onClick={handleExportBundle}
                disabled={hasBlockingErrors}
                testId="ide-export-primary-cta"
              >
                Export Bundle
              </IdeButton>
              <IdeButton tone="ghost">Re-run Validation</IdeButton>
            </>
          }
          right={
            hasBlockingErrors ? (
              <IdeStatusPill tone="error">Blocked</IdeStatusPill>
            ) : (
              <IdeStatusPill tone="ok">Ready</IdeStatusPill>
            )
          }
          testId="ide-export-panel"
        >
          <div className="ide-export-sections">
            <section className="ide-export-section" data-testid="ide-export-build-output">
              <header className="ide-export-section-header">
                <h3>Build Output</h3>
                <span className="ide-export-section-meta">
                  {diagnosticsList.length} diagnostics
                </span>
              </header>

              {hasBlockingErrors && (
                <IdeCallout tone="error" title="Export blocked" testId="ide-export-blocked-reason">
                  Resolve blocking diagnostics below, then rerun export.
                </IdeCallout>
              )}

              {!hasBlockingErrors && diagnosticsList.length === 0 && (
                <IdeCallout tone="success" title="No blockers">
                  Export checks passed. Artifact generation is ready.
                </IdeCallout>
              )}

              <div className="ide-export-diagnostic-list">
                {diagnosticsList.map((entry, index) => {
                  const portKey = entry.port ? toPortKey(entry.port) : undefined;
                  const mappingRow = portKey ? mappingIndex.get(portKey) : undefined;
                  const hasSuggestion =
                    Boolean(mappingRow?.suggestedPin) &&
                    (pinOverrides[portKey ?? ''] ?? '').trim().length === 0;

                  return (
                    <article
                      key={`${entry.code}-${index}`}
                      className={`ide-export-diagnostic-row ${
                        entry.severity === 'error' ? 'is-error' : 'is-warning'
                      }`}
                    >
                      <div className="ide-export-diagnostic-meta">
                        <IdeStatusPill tone={entry.severity === 'error' ? 'error' : 'warn'}>
                          {entry.severity === 'error' ? 'ERROR' : 'WARN'}
                        </IdeStatusPill>
                        <code className="ide-export-diagnostic-code">{entry.code}</code>
                      </div>
                      <p className="ide-export-diagnostic-message">{entry.message}</p>
                      {entry.fix && <p className="ide-export-diagnostic-fix">{entry.fix}</p>}
                      <div className="ide-export-diagnostic-actions">
                        {mappingRow && portKey && (
                          <IdeButton tone="secondary" onClick={() => jumpToMapping(portKey)}>
                            Jump to mapping
                          </IdeButton>
                        )}
                        {mappingRow && portKey && hasSuggestion && (
                          <IdeButton tone="ghost" onClick={() => applySuggestion(portKey)}>
                            Auto-suggest pins
                          </IdeButton>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="ide-export-section" data-testid="ide-export-mapping-table">
              <header className="ide-export-section-header">
                <h3>I/O Mapping Table</h3>
                <span className="ide-export-section-meta">
                  {mappedCount}/{viewModel.pinTable.length} mapped
                </span>
              </header>
              <div className="ide-table-wrap ide-export-table-wrap">
                <table className="ide-table ide-export-table">
                  <thead>
                    <tr>
                      <th>Port</th>
                      <th>Direction</th>
                      <th>Bound Pin</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModel.pinTable.map((row) => {
                      const portKey = toPortKey(row.port);
                      const pinValue = pinOverrides[portKey] ?? '';
                      const status = resolveRowStatus(row.status, pinValue);
                      return (
                        <tr
                          key={row.port}
                          ref={(node) => {
                            rowRefs.current[portKey] = node;
                          }}
                          className={highlightedPort === portKey ? 'ide-export-row-highlight' : undefined}
                          data-testid={`ide-export-map-row-${portKey}`}
                        >
                          <td>
                            <div className="ide-export-port-cell">
                              <code>{row.port}</code>
                              {row.required && <span className="ide-export-required-tag">Required</span>}
                            </div>
                          </td>
                          <td>
                            <span className={`ide-export-direction ide-export-direction-${row.direction}`}>
                              {row.direction === 'in' ? 'IN' : row.direction === 'out' ? 'OUT' : 'INOUT'}
                            </span>
                          </td>
                          <td>
                            <input
                              ref={(node) => {
                                pinInputRefs.current[portKey] = node;
                              }}
                              className="ide-export-pin-input"
                              value={pinValue}
                              onChange={(event) =>
                                setPinOverrides((prev) => ({
                                  ...prev,
                                  [portKey]: event.target.value.toUpperCase(),
                                }))
                              }
                              placeholder={row.suggestedPin ?? 'PIN'}
                            />
                          </td>
                          <td>
                            <IdeStatusPill tone={statusTone(status)}>
                              {status === 'mapped'
                                ? 'Mapped'
                                : status === 'missing'
                                  ? 'Missing'
                                  : 'Unused'}
                            </IdeStatusPill>
                          </td>
                          <td className="ide-export-notes-cell">
                            {row.notes && <div>{row.notes}</div>}
                            {row.suggestedPin && (
                              <div className="ide-export-suggestion">Suggested: {row.suggestedPin}</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="ide-export-section" data-testid="ide-export-artifact-preview">
              <header className="ide-export-section-header">
                <h3>Artifact Preview</h3>
                <span className="ide-export-section-meta">
                  {viewModel.artifacts.length} files
                </span>
              </header>

              {viewModel.artifacts.length === 0 && (
                <IdeCallout tone="warn" title="No artifact data">
                  Artifact previews appear after a successful export build.
                </IdeCallout>
              )}

              {viewModel.artifacts.length > 0 && (
                <>
                  <div className="ide-export-artifact-tabs">
                    {viewModel.artifacts.map((artifact) => (
                      <button
                        key={artifact.path}
                        type="button"
                        className={`ide-export-artifact-tab ${
                          selectedArtifact?.path === artifact.path ? 'is-active' : ''
                        }`}
                        onClick={() => setSelectedArtifactPath(artifact.path)}
                      >
                        {artifact.path}
                      </button>
                    ))}
                  </div>
                  {selectedArtifact && (
                    <div className="ide-export-artifact-preview">
                      <div className="ide-export-artifact-preview-header">
                        <span>{selectedArtifact.path}</span>
                        <IdeButton
                          tone="secondary"
                          onClick={() => handleDownloadArtifact(selectedArtifact)}
                          disabled={selectedArtifact.preview.trim().length === 0}
                        >
                          Download
                        </IdeButton>
                      </div>
                      {selectedArtifact.preview.trim().length > 0 ? (
                        <pre className="ide-export-artifact-code">{selectedArtifact.preview}</pre>
                      ) : (
                        <p className="ide-export-artifact-empty">
                          Artifact content unavailable until export validation passes.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </IdePanel>
    </IdeSurfaceLayout>
  );
};

function createPinOverrideMap(
  rows: ReturnType<typeof buildExportViewModel>['pinTable']
): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const row of rows) {
    overrides[toPortKey(row.port)] = row.pin ?? '';
  }
  return overrides;
}

function toPortKey(value: string): string {
  return value.trim().toLowerCase();
}

function statusTone(status: ExportPinStatus): 'ok' | 'error' | 'warn' {
  if (status === 'mapped') return 'ok';
  if (status === 'missing') return 'error';
  return 'warn';
}

function resolveRowStatus(baseStatus: ExportPinStatus, pinValue: string): ExportPinStatus {
  if (baseStatus === 'unused') return 'unused';
  return pinValue.trim().length > 0 ? 'mapped' : 'missing';
}
