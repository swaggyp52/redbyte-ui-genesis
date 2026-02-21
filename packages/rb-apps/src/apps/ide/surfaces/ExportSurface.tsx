import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RBProject } from '../../../export/projectFormat';
import { stableStringify } from '../../../export/stableStringify';
import type { ProjectHealthExportResult, ProjectHealthVerifyResult } from '../projectHealth';
import { createDiagnosticId, type IdeDiagnostic } from '../diagnostics';
import { buildEvidenceCapsule, type EvidenceManifest } from '../evidenceCapsule';
import type { RuntimeVerifyRun } from '../projectRuntime';
import {
  buildExportViewModel,
  type ExportDiagnosticView,
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
  verifyResult?: ProjectHealthVerifyResult;
  verifyLastRun?: RuntimeVerifyRun;
  dirtySinceVerify?: boolean;
  determinismHash: string;
  onExportBundle?: (artifacts: ExportArtifactView[]) => void;
  onExportResult?: (result: ProjectHealthExportResult) => void;
  onDiagnosticAction?: (diagnostic: IdeDiagnostic) => void;
  onOpenVerify?: () => void;
}

export const ExportSurface: React.FC<ExportSurfaceProps> = ({
  project,
  verifyResult,
  verifyLastRun,
  dirtySinceVerify = false,
  determinismHash,
  onExportBundle,
  onExportResult,
  onDiagnosticAction,
  onOpenVerify,
}) => {
  const viewModel = useMemo(
    () => buildExportViewModel(project, verifyLastRun),
    [project, verifyLastRun]
  );
  const evidenceDiagnostics = useMemo(
    () => buildEvidenceDiagnostics(verifyResult, dirtySinceVerify),
    [dirtySinceVerify, verifyResult]
  );
  const diagnosticsList = useMemo(
    () => [...evidenceDiagnostics, ...viewModel.errors, ...viewModel.warnings],
    [evidenceDiagnostics, viewModel.errors, viewModel.warnings]
  );
  const [pinOverrides, setPinOverrides] = useState<Record<string, string>>(() =>
    createPinOverrideMap(viewModel.pinTable)
  );
  const [capsuleManifestHash, setCapsuleManifestHash] = useState<string>('pending');
  const [capsuleBundleHash, setCapsuleBundleHash] = useState<string>('pending');
  const [capsuleFileList, setCapsuleFileList] = useState<string[]>([]);
  const [capsuleBuildError, setCapsuleBuildError] = useState<string>('');
  const [capsuleBuildState, setCapsuleBuildState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [capsuleManifest, setCapsuleManifest] = useState<EvidenceManifest | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'command' | 'report' | 'error'>('idle');
  const [highlightedPort, setHighlightedPort] = useState<string | null>(null);
  const [selectedArtifactPath, setSelectedArtifactPath] = useState<string>(() => {
    const readme = viewModel.artifacts.find((artifact) => artifact.path.toLowerCase() === 'readme.txt');
    return readme?.path ?? viewModel.artifacts[0]?.path ?? '';
  });
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const pinInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const highlightResetTimer = useRef<number | null>(null);
  const copyResetTimer = useRef<number | null>(null);

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
      const readme = viewModel.artifacts.find((artifact) => artifact.path.toLowerCase() === 'readme.txt');
      setSelectedArtifactPath(readme?.path ?? viewModel.artifacts[0].path);
    }
  }, [viewModel.artifacts, selectedArtifactPath]);

  useEffect(() => {
    return () => {
      if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(highlightResetTimer.current);
      }
      if (copyResetTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(copyResetTimer.current);
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

  const hasBlockingErrors = diagnosticsList.some((entry) => entry.severity === 'error');
  const hasVerifyPass = verifyResult?.status === 'pass' && !dirtySinceVerify;
  const mappedCount = viewModel.pinTable.filter((row) => {
    const key = toPortKey(row.port);
    const pinValue = (pinOverrides[key] ?? '').trim();
    return row.status !== 'unused' && pinValue.length > 0;
  }).length;
  const selectedArtifact =
    viewModel.artifacts.find((artifact) => artifact.path === selectedArtifactPath) ??
    viewModel.artifacts[0];
  const readmeArtifact = viewModel.artifacts.find(
    (artifact) => artifact.path.toLowerCase() === 'readme.txt'
  );
  const readmePreview = (readmeArtifact?.preview ?? '').split('\n').slice(0, 20).join('\n').trim();
  const vivadoCommand =
    'vivado -mode batch -source vivado_import.tcl -notrace -nojournal -log vivado_import.log';
  const appEnv = (import.meta as ImportMeta & {
    env?: { VITE_APP_VERSION?: string; VITE_GIT_SHA?: string };
  }).env;
  const redbyteVersion = (appEnv?.VITE_APP_VERSION ?? 'dev').trim() || 'dev';
  const redbyteCommit = (appEnv?.VITE_GIT_SHA ?? 'local').trim() || 'local';
  const quickDebugReport = useMemo(() => {
    const mappingLines = [...viewModel.pinTable]
      .map((row) => {
        const portKey = toPortKey(row.port);
        const pinValue = (pinOverrides[portKey] ?? row.pin ?? '').trim();
        const resolvedPin = pinValue.length > 0 ? pinValue : 'UNMAPPED';
        const requiredTag = row.required ? ' required' : ' optional';
        return `${row.port} (${row.direction}, ${row.status}${requiredTag}) -> ${resolvedPin}`;
      })
      .sort((left, right) => left.localeCompare(right));

    const manifestBlock = capsuleManifest ? stableStringify(capsuleManifest) : 'pending';

    return [
      'RedByte Vivado Quick Debug Report',
      `project=${project.name}`,
      `board=basys3`,
      `redbyteVersion=${redbyteVersion}`,
      `redbyteCommit=${redbyteCommit}`,
      `exportHash=${viewModel.exportHash ?? 'pending'}`,
      `verifyHash=${verifyResult?.hash ?? 'pending'}`,
      `manifestHash=${capsuleManifestHash}`,
      `bundleHash=${capsuleBundleHash}`,
      '',
      'mapping:',
      ...mappingLines,
      '',
      'manifest:',
      manifestBlock,
    ].join('\n');
  }, [
    capsuleBundleHash,
    capsuleManifest,
    capsuleManifestHash,
    pinOverrides,
    project.name,
    redbyteCommit,
    redbyteVersion,
    verifyResult?.hash,
    viewModel.exportHash,
    viewModel.pinTable,
  ]);
  const exportReadinessLabel = hasBlockingErrors ? 'BLOCKED' : 'READY';
  const bringUpReliabilityText = hasVerifyPass
    ? 'Bring-up expected IO is derived from your latest PASS verification run.'
    : 'Bring-up will be generated from current sim state (less reliable).';

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
    if (typeof window === 'undefined' || artifact.content.trim().length === 0) return;
    const blob = new Blob([artifact.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = artifact.path;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleBuildEvidenceCapsule = async () => {
    const ranAtIso = new Date().toISOString();
    setCapsuleBuildError('');
    setCapsuleBuildState('running');
    setCapsuleManifest(null);
    if (hasBlockingErrors) {
      setCapsuleBuildError('Resolve blocking diagnostics before building an evidence capsule.');
      setCapsuleBuildState('error');
      onExportResult?.({
        status: 'blocked',
        hash: viewModel.exportHash,
        artifacts: viewModel.artifacts.map((artifact) => artifact.path),
        ranAtIso,
      });
      return;
    }
    if (!verifyResult || verifyResult.status !== 'pass' || dirtySinceVerify) {
      setCapsuleBuildError('Evidence Capsule requires a PASS verification with no pending design changes.');
      setCapsuleBuildState('error');
      onExportResult?.({
        status: 'blocked',
        hash: viewModel.exportHash,
        artifacts: viewModel.artifacts.map((artifact) => artifact.path),
        ranAtIso,
      });
      return;
    }

    try {
      const capsule = await buildEvidenceCapsule({
        project,
        exportViewModel: viewModel,
        verifyResult,
        deterministicHash: determinismHash,
        toolVersion: redbyteVersion,
        toolCommit: redbyteCommit,
        createdAtIso: ranAtIso,
      });
      if (typeof window !== 'undefined') {
        const blob = new Blob([capsule.zipBytes], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'redbyte-evidence-capsule.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      }

      setCapsuleManifestHash(capsule.manifest.manifestHash);
      setCapsuleBundleHash(capsule.bundleHash);
      setCapsuleFileList(capsule.filePaths);
      setCapsuleManifest(capsule.manifest);
      setCapsuleBuildState('done');
      onExportBundle?.(viewModel.artifacts);
      onExportResult?.({
        status: 'ok',
        hash: viewModel.exportHash,
        manifestHash: capsule.manifest.manifestHash,
        bundleHash: capsule.bundleHash,
        artifacts: capsule.filePaths,
        ranAtIso,
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : 'unknown build error';
      setCapsuleBuildError(
        `Evidence Capsule build failed: ${reason}. Check export diagnostics and artifact readiness.`
      );
      setCapsuleBuildState('error');
      onExportResult?.({
        status: 'blocked',
        hash: viewModel.exportHash,
        artifacts: viewModel.artifacts.map((artifact) => artifact.path),
        ranAtIso,
      });
    }
  };

  const copyToClipboard = async (payload: string, target: 'command' | 'report') => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopyState('error');
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setCopyState(target);
      if (copyResetTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(copyResetTimer.current);
      }
      if (typeof window !== 'undefined') {
        copyResetTimer.current = window.setTimeout(() => setCopyState('idle'), 1600);
      }
    } catch {
      setCopyState('error');
    }
  };

  return (
    <IdeSurfaceLayout
      mode="export"
      consoleHasBlocking={hasBlockingErrors}
      consoleHasEntries={
        diagnosticsList.length > 0 || capsuleBuildState === 'error' || capsuleBuildState === 'done'
      }
      dock={
        <section className="ide-export-file-tree" data-testid="ide-export-artifact-tree">
          <header className="ide-design-subheader">
            <h3>Artifacts</h3>
            <span className="ide-copy">{viewModel.artifacts.length}</span>
          </header>
          {viewModel.artifacts.length > 0 ? (
            <div className="ide-export-file-tree-list">
              {viewModel.artifacts.map((artifact) => {
                const selected = selectedArtifactPath === artifact.path;
                return (
                  <button
                    key={artifact.path}
                    type="button"
                    className={`ide-signal-row ${selected ? 'is-active' : ''}`}
                    data-selected={selected ? 'true' : 'false'}
                    data-testid={`ide-export-artifact-tree-item-${toArtifactTestId(artifact.path)}`}
                    onClick={() => setSelectedArtifactPath(artifact.path)}
                  >
                    <span>{artifact.path}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <IdeCallout tone="warn" title="No artifacts">
              Build output first to inspect generated files.
            </IdeCallout>
          )}
        </section>
      }
      inspector={
        <>
          <IdeInspectorSection title="Export Context" defaultOpen>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Board</span>
                <span>Basys3</span>
              </div>
              <div className="ide-kv-row">
                <span>Export Hash</span>
                <span className="ide-status-mono" data-testid="ide-export-context-export-hash">
                  {viewModel.exportHash ? viewModel.exportHash.slice(0, 16) : 'pending'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Verify Hash</span>
                <span className="ide-status-mono" data-testid="ide-export-context-verify-hash">
                  {verifyResult?.hash ? verifyResult.hash.slice(0, 16) : 'pending'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Manifest Hash</span>
                <span className="ide-status-mono" data-testid="ide-export-context-manifest-hash">
                  {capsuleManifestHash.slice(0, 16)}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Bundle Hash</span>
                <span className="ide-status-mono">{capsuleBundleHash.slice(0, 16)}</span>
              </div>
              <div className="ide-kv-row">
                <span>Blocking Errors</span>
                <span>{diagnosticsList.filter((entry) => entry.severity === 'error').length}</span>
              </div>
              <div className="ide-kv-row">
                <span>Capsule Files</span>
                <span>{capsuleFileList.length > 0 ? capsuleFileList.length : 'pending'}</span>
              </div>
              <div className="ide-kv-row" data-testid="ide-export-capsule-build-state">
                <span>Capsule State</span>
                <span>{capsuleBuildState.toUpperCase()}</span>
              </div>
              <div className="ide-kv-row ide-kv-row-hidden" data-testid="ide-export-capsule-files">
                <span>Capsule File List</span>
                <code>{capsuleFileList.join(',')}</code>
              </div>
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Artifact Checklist" defaultOpen={false}>
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
          title="Export"
          description="Compiler output in three steps: status, blockers, and deterministic Vivado-ready artifacts."
          actions={
            <>
              <span data-testid="ide-primary-cta">
                <IdeButton
                  tone="primary"
                  onClick={handleBuildEvidenceCapsule}
                  testId="ide-export-build-evidence-capsule"
                >
                  Download Vivado Pack (.zip)
                </IdeButton>
              </span>
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
          <div
            className={`ide-export-readiness-banner ${hasBlockingErrors ? 'is-blocked' : 'is-ready'}`}
            data-testid="ide-export-readiness-banner"
          >
            <span className="ide-export-readiness-label" data-testid="ide-export-readiness-label">
              {hasBlockingErrors ? 'BLOCKED' : 'READY TO EXPORT'}
            </span>
            <span className="ide-export-readiness-detail">
              {hasBlockingErrors
                ? `${diagnosticsList.filter((d) => d.severity === 'error').length} error${diagnosticsList.filter((d) => d.severity === 'error').length !== 1 ? 's' : ''} must be resolved`
                : `All checks passed · ${viewModel.artifacts.length} artifact${viewModel.artifacts.length !== 1 ? 's' : ''} ready`}
            </span>
          </div>
          <div className="ide-export-sections">
            <section className="ide-export-section" data-testid="ide-export-status-strip">
              <header className="ide-export-section-header">
                <h3>Status</h3>
                <span className="ide-export-section-meta">{exportReadinessLabel}</span>
              </header>
              <div className="ide-kv-list">
                <div className="ide-kv-row">
                  <span>Export</span>
                  <IdeStatusPill tone={hasBlockingErrors ? 'error' : 'ok'}>
                    {exportReadinessLabel}
                  </IdeStatusPill>
                </div>
                <div className="ide-kv-row">
                  <span>Export hash</span>
                  <code data-testid="ide-export-status-hash">
                    {viewModel.exportHash ? viewModel.exportHash.slice(0, 16) : 'pending'}
                  </code>
                </div>
                <div className="ide-kv-row">
                  <span>Verify state</span>
                  <IdeStatusPill tone={hasVerifyPass ? 'ok' : 'warn'}>
                    {hasVerifyPass ? 'PASS' : 'UNVERIFIED'}
                  </IdeStatusPill>
                </div>
              </div>
              <IdeCallout
                tone={hasVerifyPass ? 'success' : 'warn'}
                title={hasVerifyPass ? 'Bring-up reliability: verified' : 'Bring-up reliability: fallback'}
                testId="ide-export-bringup-reliability"
              >
                {bringUpReliabilityText}
              </IdeCallout>
              {!hasVerifyPass ? (
                <div className="ide-inline-actions">
                  <IdeButton
                    tone="secondary"
                    onClick={() => onOpenVerify?.()}
                    testId="ide-export-run-verify-first"
                  >
                    Run Verify first
                  </IdeButton>
                </div>
              ) : null}
            </section>

            <section className="ide-export-section" data-testid="ide-export-build-output">
              <header className="ide-export-section-header">
                <h3>Blockers</h3>
                <span className="ide-export-section-meta">
                  {diagnosticsList.length} diagnostics
                </span>
              </header>

              {hasBlockingErrors && (
                <IdeCallout
                  tone="error"
                  title="Evidence Capsule blocked"
                  testId="ide-export-blocked-reason"
                >
                  Resolve blocking diagnostics below, then build again.
                </IdeCallout>
              )}

              {capsuleBuildError.length > 0 && (
                <IdeCallout tone="error" title="Capsule Build Error" testId="ide-export-capsule-error">
                  {capsuleBuildError}
                </IdeCallout>
              )}

              {!hasBlockingErrors && diagnosticsList.length === 0 && (
                <IdeCallout tone="success" title="No blockers">
                  Export checks passed. Artifact generation is ready.
                </IdeCallout>
              )}

              <div className="ide-export-diagnostic-list" data-testid="ide-export-blockers-list">
                {diagnosticsList.map((entry) => {
                  const portKey = entry.port ? toPortKey(entry.port) : undefined;
                  const mappingRow = portKey ? mappingIndex.get(portKey) : undefined;
                  const hasSuggestion =
                    Boolean(mappingRow?.suggestedPin) &&
                    (pinOverrides[portKey ?? ''] ?? '').trim().length === 0;

                  return (
                    <article
                      key={entry.id}
                      className={`ide-export-diagnostic-row ${
                        entry.severity === 'error' ? 'is-error' : 'is-warning'
                      }`}
                      data-testid={`ide-export-diagnostic-${entry.id}`}
                    >
                      <div className="ide-export-diagnostic-meta">
                        <IdeStatusPill tone={entry.severity === 'error' ? 'error' : 'warn'}>
                          {entry.severity === 'error' ? 'ERROR' : 'WARN'}
                        </IdeStatusPill>
                        <code className="ide-export-diagnostic-code" data-diagnostic-code={entry.code}>
                          {entry.code}
                        </code>
                      </div>
                      <p className="ide-export-diagnostic-message">{entry.message}</p>
                      {entry.fix && <p className="ide-export-diagnostic-fix">{entry.fix}</p>}
                      <div className="ide-export-diagnostic-actions">
                        <IdeButton
                          tone="secondary"
                          onClick={() => {
                            if (onDiagnosticAction) {
                              onDiagnosticAction(entry.canonical);
                              return;
                            }
                            if (mappingRow && portKey) {
                              jumpToMapping(portKey);
                            }
                          }}
                          testId={`ide-export-diagnostic-action-${entry.id}`}
                        >
                          {onDiagnosticAction ? 'Show fix path' : 'Jump to mapping'}
                        </IdeButton>
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
                <h3>Outputs</h3>
                <span className="ide-export-section-meta">
                  {viewModel.artifacts.length} files
                </span>
              </header>

              {viewModel.artifacts.length === 0 && (
                <div className="ide-empty-stack" data-testid="ide-export-empty-state">
                  <div className="ide-empty-illustration ide-empty-illustration-export" aria-hidden="true" />
                  <IdeCallout tone="warn" title="No artifact data">
                    Artifact previews appear after a successful export build.
                  </IdeCallout>
                </div>
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
                        <span data-testid="ide-export-preview-path">{selectedArtifact.path}</span>
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

            <section className="ide-export-section" data-testid="ide-export-readme-preview">
              <header className="ide-export-section-header">
                <h3>README Preview</h3>
                <span className="ide-export-section-meta">first 20 lines</span>
              </header>
              {readmePreview.length > 0 ? (
                <pre className="ide-export-artifact-code ide-export-readme-code">{readmePreview}</pre>
              ) : (
                <IdeCallout tone="warn" title="README unavailable">
                  README preview appears after export validation produces artifact text.
                </IdeCallout>
              )}
            </section>

            <section className="ide-export-section" data-testid="ide-export-vivado-import-panel">
              <header className="ide-export-section-header">
                <h3>Vivado Import</h3>
                <span className="ide-export-section-meta">batch command</span>
              </header>
              <div className="ide-export-vivado-box">
                <p className="ide-copy">
                  Run this command from the extracted export folder:
                </p>
                <pre
                  className="ide-export-artifact-code ide-export-readme-code"
                  data-testid="ide-export-vivado-command"
                >
                  {vivadoCommand}
                </pre>
                <div className="ide-export-diagnostic-actions">
                  <IdeButton
                    tone="secondary"
                    onClick={() => {
                      void copyToClipboard(vivadoCommand, 'command');
                    }}
                    testId="ide-export-copy-vivado-command"
                  >
                    Copy TCL command
                  </IdeButton>
                  <IdeButton
                    tone="ghost"
                    onClick={() => {
                      void copyToClipboard(quickDebugReport, 'report');
                    }}
                    testId="ide-export-copy-debug-report"
                  >
                    Copy quick debug report
                  </IdeButton>
                </div>
                <p className="ide-copy" data-testid="ide-export-copy-state">
                  {copyState === 'command'
                    ? 'Vivado command copied.'
                    : copyState === 'report'
                      ? 'Debug report copied.'
                      : copyState === 'error'
                        ? 'Clipboard unavailable in this browser context.'
                        : 'Copy command/report for fast handoff debugging.'}
                </p>
              </div>
            </section>

            <section className="ide-export-section" data-testid="ide-export-vivado-checklist">
              <header className="ide-export-section-header">
                <h3>Vivado Steps</h3>
              </header>
              <ol className="ide-export-checklist">
                <li>Create a Vivado RTL project for Basys3.</li>
                <li>Add <code>top.vhd</code> as a Design Source.</li>
                <li>Add <code>top.xdc</code> as Constraints.</li>
                <li>Add <code>testbench.vhd</code> as Simulation Source only.</li>
                <li>Run synthesis, implementation, bitstream, then program Basys3.</li>
              </ol>
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

function buildEvidenceDiagnostics(
  verifyResult: ProjectHealthVerifyResult | undefined,
  dirtySinceVerify: boolean
): ExportDiagnosticView[] {
  const diagnostics: ExportDiagnosticView[] = [];

  if (!verifyResult) {
    diagnostics.push(createEvidenceDiagnostic({
      code: 'RBEV1000',
      message: 'Evidence Capsule requires a verification run before export.',
      fix: 'Open Verify and run the deterministic vector suite to generate a PASS report.',
    }));
    return diagnostics;
  }

  if (verifyResult.status !== 'pass') {
    diagnostics.push(createEvidenceDiagnostic({
      code: 'RBEV1001',
      message:
        typeof verifyResult.failingTick === 'number'
          ? `Latest verification failed at tick ${verifyResult.failingTick}.`
          : 'Latest verification failed.',
      fix: 'Open Verify, inspect the failure diff, then rerun until PASS.',
    }));
  }

  if (dirtySinceVerify) {
    diagnostics.push(createEvidenceDiagnostic({
      code: 'RBEV1002',
      message: 'Design changed since the last PASS verification run.',
      fix: 'Rerun verification to refresh deterministic evidence before export.',
    }));
  }

  return diagnostics;
}

function createEvidenceDiagnostic(input: {
  code: string;
  message: string;
  fix: string;
}): ExportDiagnosticView {
  const canonical: IdeDiagnostic = {
    id: createDiagnosticId({
      code: input.code,
      owner: {
        kind: 'file',
        filePath: 'verify-report.json',
      },
      message: input.message,
      hint: [input.fix],
    }),
    severity: 'error',
    code: input.code,
    title: 'Evidence gate blocker',
    message: input.message,
    hint: [input.fix],
    owner: {
      kind: 'file',
      filePath: 'verify-report.json',
    },
    actions: [
      {
        kind: 'open-mode',
        label: 'Open Verify',
        payload: {
          mode: 'verify',
          filePath: 'verify-report.json',
        },
      },
    ],
  };

  return {
    id: canonical.id,
    code: canonical.code,
    title: canonical.title,
    message: canonical.message,
    hint: canonical.hint,
    fix: input.fix,
    severity: 'error',
    owner: canonical.owner,
    actions: canonical.actions,
    canonical,
  };
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

function toArtifactTestId(path: string): string {
  return path
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
