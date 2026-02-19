import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Basys3ExportError } from '../../../fpga/boards/basys3/basys3ExportService';
import {
  IdeButton,
  IdeCallout,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';

export interface ExportDiagnosticsInput {
  success: boolean;
  errors: Basys3ExportError[];
  warnings: string[];
  determinismHash?: string;
}

export interface ExportArtifactRow {
  name: string;
  status: 'ready' | 'pending' | 'blocked';
  note: string;
}

export interface ExportMappingRow {
  port: string;
  direction: 'in' | 'out';
  pin: string;
  status: 'mapped' | 'missing' | 'unused';
  notes?: string;
  suggestedPin?: string;
}

export interface ExportSurfaceProps {
  diagnostics: ExportDiagnosticsInput;
  mappings: ExportMappingRow[];
  artifacts: ExportArtifactRow[];
  onExportBundle?: () => void;
}

type DiagnosticSeverity = 'error' | 'warning';

interface DiagnosticViewModel {
  id: string;
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  fixHint: string;
  portKey?: string;
}

const DIAGNOSTIC_ORDER: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
};

export const ExportSurface: React.FC<ExportSurfaceProps> = ({
  diagnostics,
  mappings,
  artifacts,
  onExportBundle,
}) => {
  const [pinOverrides, setPinOverrides] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const row of mappings) {
      initial[toPortKey(row.port)] = row.pin;
    }
    return initial;
  });
  const [highlightedPort, setHighlightedPort] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const pinInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const highlightResetTimer = useRef<number | null>(null);

  useEffect(() => {
    const refreshed: Record<string, string> = {};
    for (const row of mappings) {
      refreshed[toPortKey(row.port)] = row.pin;
    }
    setPinOverrides(refreshed);
  }, [mappings]);

  useEffect(() => {
    return () => {
      if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(highlightResetTimer.current);
      }
    };
  }, []);

  const mappingIndex = useMemo(() => {
    const index = new Map<string, ExportMappingRow>();
    for (const row of mappings) {
      index.set(toPortKey(row.port), row);
    }
    return index;
  }, [mappings]);

  const diagnosticsList = useMemo(() => {
    const list: DiagnosticViewModel[] = [];
    const seenKeys = new Set<string>();

    const pushDiagnostic = (severity: DiagnosticSeverity, message: string, source: string) => {
      const key = `${severity}:${message}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      const portName = extractPortFromMessage(message);
      const portKey = portName ? toPortKey(portName) : undefined;
      list.push({
        id: `${source}-${list.length}`,
        severity,
        code: diagnosticCodeFor(message, severity),
        message,
        fixHint: fixHintFor(message, severity),
        portKey,
      });
    };

    for (const error of diagnostics.errors) {
      pushDiagnostic(error.severity, error.message, 'error');
    }
    for (const warning of diagnostics.warnings) {
      pushDiagnostic('warning', warning, 'warning');
    }

    return list.sort((left, right) => {
      const severityDelta = DIAGNOSTIC_ORDER[left.severity] - DIAGNOSTIC_ORDER[right.severity];
      if (severityDelta !== 0) return severityDelta;
      if (left.code !== right.code) return left.code.localeCompare(right.code);
      return left.message.localeCompare(right.message);
    });
  }, [diagnostics.errors, diagnostics.warnings]);

  const hasBlockingErrors = diagnosticsList.some((entry) => entry.severity === 'error');
  const mappedCount = mappings.filter((row) => {
    const key = toPortKey(row.port);
    const pinValue = (pinOverrides[key] ?? '').trim();
    return row.status !== 'unused' && pinValue.length > 0;
  }).length;

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

  return (
    <div className="ide-content-grid" data-testid="ide-mode-export" data-ide-mode-marker="export">
      <main className="ide-main-area" data-testid="ide-mode-body">
        <IdePanel
          title="Export Compiler"
          description="Validate Basys3 readiness, resolve blockers, and package Vivado artifacts."
          actions={
            <>
              <IdeButton
                tone="primary"
                onClick={onExportBundle}
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
                {diagnosticsList.map((entry) => {
                  const mappingRow = entry.portKey ? mappingIndex.get(entry.portKey) : undefined;
                  const hasSuggestion =
                    Boolean(mappingRow?.suggestedPin) &&
                    (pinOverrides[entry.portKey ?? ''] ?? '').trim().length === 0;

                  return (
                    <article
                      key={entry.id}
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
                      <p className="ide-export-diagnostic-fix">{entry.fixHint}</p>
                      <div className="ide-export-diagnostic-actions">
                        {mappingRow && entry.portKey && (
                          <IdeButton tone="secondary" onClick={() => jumpToMapping(entry.portKey as string)}>
                            Jump to mapping
                          </IdeButton>
                        )}
                        {mappingRow && entry.portKey && hasSuggestion && (
                          <IdeButton tone="ghost" onClick={() => applySuggestion(entry.portKey as string)}>
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
                  {mappedCount}/{mappings.length} mapped
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
                    {mappings.map((row) => {
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
                            <code>{row.port}</code>
                          </td>
                          <td>
                            <span className={`ide-export-direction ide-export-direction-${row.direction}`}>
                              {row.direction === 'in' ? 'IN' : 'OUT'}
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
          </div>
        </IdePanel>
      </main>

      <aside className="ide-inspector" data-testid="ide-inspector">
        <IdeInspectorSection title="Export Context">
          <div className="ide-kv-list">
            <div className="ide-kv-row">
              <span>Board</span>
              <span>Basys3</span>
            </div>
            <div className="ide-kv-row">
              <span>Determinism Hash</span>
              <span className="ide-status-mono">
                {diagnostics.determinismHash ? diagnostics.determinismHash.slice(0, 16) : 'pending'}
              </span>
            </div>
            <div className="ide-kv-row">
              <span>Blocking Errors</span>
              <span>{diagnosticsList.filter((entry) => entry.severity === 'error').length}</span>
            </div>
          </div>
        </IdeInspectorSection>

        <IdeInspectorSection title="Artifact Checklist">
          <div className="ide-export-artifact-list">
            {artifacts.map((artifact) => (
              <div key={artifact.name} className="ide-export-artifact-row">
                <div>
                  <div className="ide-export-artifact-name">{artifact.name}</div>
                  <div className="ide-export-artifact-note">{artifact.note}</div>
                </div>
                <IdeStatusPill tone={artifact.status === 'ready' ? 'ok' : artifact.status === 'blocked' ? 'error' : 'warn'}>
                  {artifact.status === 'ready' ? 'Ready' : artifact.status === 'blocked' ? 'Blocked' : 'Pending'}
                </IdeStatusPill>
              </div>
            ))}
          </div>
        </IdeInspectorSection>
      </aside>
    </div>
  );
};

function toPortKey(value: string): string {
  return value.trim().toLowerCase();
}

function extractPortFromMessage(message: string): string | undefined {
  const quotedPort = message.match(/port "([^"]+)"/i);
  if (quotedPort?.[1]) return quotedPort[1];
  const quotedMapping = message.match(/mapping "([^"]+)"/i);
  if (quotedMapping?.[1]) return quotedMapping[1];
  return undefined;
}

function diagnosticCodeFor(message: string, severity: DiagnosticSeverity): string {
  const lowered = message.toLowerCase();
  if (lowered.includes('unmapped required')) return 'RBEX1001';
  if (lowered.includes('declared but has no basys3 pin assignment')) return 'RBEX1002';
  if (lowered.includes('unsupported') && lowered.includes('pin')) return 'RBEX2001';
  if (lowered.includes('questionable') && lowered.includes('mapping')) return 'RBEX2002';
  if (lowered.includes('unused mapped')) return 'RBEX2003';
  if (lowered.includes('ignoring source xdc directive')) return 'RBEX3001';
  return severity === 'error' ? 'RBEX9000' : 'RBEX9001';
}

function fixHintFor(message: string, severity: DiagnosticSeverity): string {
  const explicitFix = message.match(/Fix:\s*(.+)$/i);
  if (explicitFix?.[1]) return explicitFix[1];
  const lowered = message.toLowerCase();
  if (lowered.includes('ignoring source xdc directive')) {
    return 'No action required unless you need that constraint represented via IO mapping.';
  }
  if (lowered.includes('unused mapped')) {
    return 'Remove the unused mapping or connect the port in the top entity.';
  }
  if (lowered.includes('questionable') && lowered.includes('mapping')) {
    return 'Move this port to a direction-compatible Basys3 alias.';
  }
  if (severity === 'error') {
    return 'Resolve this blocker before exporting.';
  }
  return 'Review and confirm this warning before exporting.';
}

function statusTone(status: 'mapped' | 'missing' | 'unused'): 'ok' | 'error' | 'warn' {
  if (status === 'mapped') return 'ok';
  if (status === 'missing') return 'error';
  return 'warn';
}

function resolveRowStatus(
  baseStatus: 'mapped' | 'missing' | 'unused',
  pinValue: string
): 'mapped' | 'missing' | 'unused' {
  if (baseStatus === 'unused') return 'unused';
  return pinValue.trim().length > 0 ? 'mapped' : 'missing';
}

