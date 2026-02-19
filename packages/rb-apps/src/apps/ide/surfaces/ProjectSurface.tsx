import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectHealth } from '../projectHealth';
import type { IdeDiagnosticRouteRequest } from '../diagnostics';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeChip,
  IdeCallout,
  IdeDataTable,
  IdeGrid,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';

export interface ProjectMappingRow {
  id: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
}

export interface ProjectSurfaceProps {
  projectName: string;
  description: string;
  determinismHash: string;
  lastSavedAt: string;
  readiness: {
    hasCircuit: boolean;
    hasIoMapping: boolean;
    hasVectors: boolean;
    verifyPass: boolean;
    missingRequiredCount: number;
  };
  health: ProjectHealth;
  mappingRows: ProjectMappingRow[];
  examples: Array<{
    id: string;
    name: string;
    summary: string;
    expectedBehavior: string;
    tags: string[];
  }>;
  activeExampleId: string | null;
  onOpenExample: (exampleId: string) => void;
  primaryCtaLabel: string;
  onPrimaryCta: () => void;
  onUpdateMappingPin: (rowId: string, pin: string) => void;
  onAutoSuggestMapping: () => void;
  onOpenDesign: () => void;
  onOpenVerify: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  diagnosticRouteRequest?: IdeDiagnosticRouteRequest | null;
}

export const ProjectSurface: React.FC<ProjectSurfaceProps> = ({
  projectName,
  description,
  determinismHash,
  lastSavedAt,
  readiness,
  health,
  mappingRows,
  examples,
  activeExampleId,
  onOpenExample,
  primaryCtaLabel,
  onPrimaryCta,
  onUpdateMappingPin,
  onAutoSuggestMapping,
  onOpenDesign,
  onOpenVerify,
  onOpenExport,
  onOpenImport,
  diagnosticRouteRequest,
}) => {
  const [highlightedMappingKey, setHighlightedMappingKey] = useState<string | null>(null);
  const mappingInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const highlightResetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(highlightResetTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!diagnosticRouteRequest) return;
    if (diagnosticRouteRequest.mode !== 'project') return;

    const mappingKey = toMappingKey(
      diagnosticRouteRequest.mappingKey ?? diagnosticRouteRequest.portName ?? ''
    );
    if (!mappingKey) return;

    const input = mappingInputRefs.current[mappingKey];
    if (!input) return;

    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus();
    setHighlightedMappingKey(mappingKey);

    if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(highlightResetTimer.current);
    }
    if (typeof window !== 'undefined') {
      highlightResetTimer.current = window.setTimeout(() => {
        setHighlightedMappingKey(null);
      }, 1200);
    }
  }, [diagnosticRouteRequest]);

  const checklistRows = useMemo(
    () => [
      ['Has circuit', statusPill(readiness.hasCircuit)],
      ['Has I/O mapping', statusPill(readiness.hasIoMapping)],
      ['Has vectors', statusPill(readiness.hasVectors)],
      ['Verify pass (latest)', statusPill(readiness.verifyPass)],
    ],
    [readiness.hasCircuit, readiness.hasIoMapping, readiness.hasVectors, readiness.verifyPass]
  );

  const mappingRowsUi = useMemo(
    () =>
      mappingRows.map((row, index) => [
        <div
          key={`${row.id}-signal`}
          className={`ide-project-map-cell ${
            highlightedMappingKey === toMappingKey(row.label) ? 'is-highlighted' : ''
          }`}
          data-testid={`ide-project-map-row-${toMappingKey(row.label)}`}
        >
          <code>{row.label}</code>
        </div>,
        row.direction.toUpperCase(),
        <input
          key={`${row.id}-pin`}
          ref={(node) => {
            mappingInputRefs.current[toMappingKey(row.label)] = node;
          }}
          className={`ide-export-pin-input ${
            highlightedMappingKey === toMappingKey(row.label) ? 'is-highlighted' : ''
          }`}
          value={row.pin}
          onChange={(event) => onUpdateMappingPin(row.id, event.target.value.toUpperCase().trim())}
          placeholder={suggestBasys3Pin(row, index)}
          aria-label={`pin-${row.id}`}
          data-testid={`ide-project-map-input-${toMappingKey(row.label)}`}
        />,
        row.required ? 'Required' : 'Optional',
        <IdeStatusPill key={`${row.id}-mapped`} tone={row.pin.trim().length > 0 ? 'ok' : 'warn'}>
          {row.pin.trim().length > 0 ? 'Mapped' : 'Missing'}
        </IdeStatusPill>,
      ]),
    [highlightedMappingKey, mappingRows, onUpdateMappingPin]
  );

  const lastVerifyStatusTone =
    health.lastVerify?.status === 'pass' ? 'ok' : health.lastVerify?.status === 'fail' ? 'error' : 'idle';
  const lastExportStatusTone =
    health.lastExport?.status === 'ok' ? 'ok' : health.lastExport?.status === 'blocked' ? 'error' : 'idle';
  const mappedRequiredCount = useMemo(
    () => mappingRows.filter((row) => row.required && row.pin.trim().length > 0).length,
    [mappingRows]
  );
  const requiredCount = useMemo(
    () => mappingRows.filter((row) => row.required).length,
    [mappingRows]
  );

  const sourcesRows = useMemo(
    () => [
      ['Circuit graph', readiness.hasCircuit ? 'READY' : 'MISSING'],
      ['Mapped ports', `${mappedRequiredCount}/${requiredCount}`],
      ['Test vectors', readiness.hasVectors ? 'READY' : 'MISSING'],
      ['Starter examples', String(examples.length)],
    ],
    [examples.length, mappedRequiredCount, readiness.hasCircuit, readiness.hasVectors, requiredCount]
  );

  return (
    <IdeSurfaceLayout
      mode="project"
      consoleHasBlocking={health.blockingIssues.length > 0}
      dock={
        <section className="ide-workbench-placeholder" data-testid="ide-project-sources-dock">
          <header className="ide-workbench-placeholder-header">
            <h3>Sources</h3>
            <IdeStatusPill tone={readiness.hasCircuit ? 'ok' : 'warn'}>
              {readiness.hasCircuit ? 'GRAPH READY' : 'ADD LOGIC'}
            </IdeStatusPill>
          </header>
          <IdeDataTable columns={['Source', 'State']} rows={sourcesRows} testId="ide-project-sources-table" />
          <div className="ide-inline-actions">
            <IdeButton tone="secondary" onClick={onOpenImport}>
              Add Sources
            </IdeButton>
            <IdeButton tone="ghost" onClick={onOpenDesign}>
              Open Canvas
            </IdeButton>
          </div>
        </section>
      }
      inspector={
        <>
          <IdeInspectorSection title="Activity">
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Last Verify</span>
                <IdeStatusPill tone={lastVerifyStatusTone} testId="ide-project-last-verify-status">
                  {health.lastVerify?.status?.toUpperCase() ?? 'NEVER'}
                </IdeStatusPill>
              </div>
              <div className="ide-kv-row">
                <span>Verify Hash</span>
                <span className="ide-status-mono" data-testid="ide-project-last-verify-hash">
                  {health.lastVerify?.hash?.slice(0, 16) ?? 'pending'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Verify Ran</span>
                <span>{formatIso(health.lastVerify?.ranAtIso)}</span>
              </div>
              <div className="ide-kv-row">
                <span>First Failing Tick</span>
                <span>{typeof health.lastVerify?.failingTick === 'number' ? health.lastVerify.failingTick : 'n/a'}</span>
              </div>
              <div className="ide-kv-row">
                <span>Last Export</span>
                <IdeStatusPill tone={lastExportStatusTone} testId="ide-project-last-export-status">
                  {health.lastExport?.status?.toUpperCase() ?? 'NEVER'}
                </IdeStatusPill>
              </div>
              <div className="ide-kv-row">
                <span>Export Hash</span>
                <span className="ide-status-mono" data-testid="ide-project-last-export-hash">
                  {health.lastExport?.hash?.slice(0, 16) ?? 'pending'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Export Ran</span>
                <span>{formatIso(health.lastExport?.ranAtIso)}</span>
              </div>
              <div className="ide-kv-row">
                <span>Dirty Since Verify</span>
                <IdeStatusPill
                  tone={health.dirtySinceVerify ? 'warn' : 'ok'}
                  testId="ide-project-dirty-since-verify"
                >
                  {health.dirtySinceVerify ? 'DIRTY' : 'CLEAN'}
                </IdeStatusPill>
              </div>
              <div className="ide-kv-row">
                <span>Dirty Since Export</span>
                <IdeStatusPill
                  tone={health.dirtySinceExport ? 'warn' : 'ok'}
                  testId="ide-project-dirty-since-export"
                >
                  {health.dirtySinceExport ? 'DIRTY' : 'CLEAN'}
                </IdeStatusPill>
              </div>
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Blocking Issues">
            {health.blockingIssues.length > 0 ? (
              <ul className="ide-list">
                {health.blockingIssues.slice(0, 6).map((issue) => (
                  <li key={issue.code}>
                    <code>{issue.code}</code> {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <IdeCallout tone="success" title="No blockers">
                Project state is ready for verify and export.
              </IdeCallout>
            )}
          </IdeInspectorSection>
        </>
      }
      console={
        <section className="ide-workbench-console-content" data-testid="ide-project-console">
          <header className="ide-workbench-console-header">
            <h3>Project Activity Console</h3>
            <span className="ide-workbench-console-mode">Project</span>
          </header>
          {health.blockingIssues.length > 0 ? (
            <IdeCallout tone="warn" title="Action required">
              {health.blockingIssues[0].message}
            </IdeCallout>
          ) : (
            <IdeCallout tone="success" title="Ready for next stage">
              No blocking diagnostics. Continue to Design, Verify, or Export.
            </IdeCallout>
          )}
          <div className="ide-inline-actions">
            <IdeButton tone="ghost" onClick={onOpenDesign}>
              Open Design
            </IdeButton>
            <IdeButton tone="ghost" onClick={onOpenVerify}>
              Run Verify
            </IdeButton>
            <IdeButton tone="ghost" onClick={onOpenExport}>
              Open Export
            </IdeButton>
          </div>
        </section>
      }
    >
      <IdePanel
        title="Project Setup"
        description="Sources, mapping, and readiness in one deterministic control surface."
        actions={
          <>
            <span data-testid="ide-primary-cta">
              <IdeButton tone="primary" onClick={onPrimaryCta} testId="ide-project-continue-cta">
                Continue
              </IdeButton>
            </span>
            <span className="ide-chip ide-chip-neutral" data-testid="ide-project-continue-target">
              Next: {primaryCtaLabel}
            </span>
            <IdeButton tone="secondary" onClick={onAutoSuggestMapping} testId="ide-project-auto-suggest">
              Auto-suggest Basys3
            </IdeButton>
            <IdeButton tone="ghost" onClick={onOpenDesign}>
              Open Design
            </IdeButton>
          </>
        }
        right={
          <IdeStatusPill tone={health.blockingIssues.length > 0 ? 'warn' : 'ok'}>
            {health.blockingIssues.length > 0 ? 'Needs Action' : 'Ready'}
          </IdeStatusPill>
        }
        testId="ide-project-panel"
      >
        <IdeGrid columns={2} testId="ide-project-overview-grid">
          <section className="ide-export-section" data-testid="ide-project-readiness">
            <header className="ide-export-section-header">
              <h3>Readiness</h3>
            </header>
            <IdeDataTable
              columns={['Check', 'Status']}
              rows={checklistRows}
              testId="ide-project-readiness-checklist"
            />
          </section>

          <section className="ide-export-section" data-testid="ide-project-identity">
            <header className="ide-export-section-header">
              <h3>Project Identity</h3>
            </header>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Name</span>
                <span>{projectName}</span>
              </div>
              <div className="ide-kv-row">
                <span>Description</span>
                <span>{description}</span>
              </div>
              <div className="ide-kv-row">
                <span>Board</span>
                <span>Basys3 (locked)</span>
              </div>
              <div className="ide-kv-row">
                <span>Last Saved</span>
                <span>{lastSavedAt}</span>
              </div>
              <div className="ide-kv-row">
                <span>Determinism Hash</span>
                <span className="ide-status-mono">{determinismHash}</span>
              </div>
            </div>
          </section>
        </IdeGrid>

        <section className="ide-export-section" data-testid="ide-project-io-mapping">
          <header className="ide-export-section-header">
            <h3>I/O Mapping</h3>
          </header>
          {readiness.missingRequiredCount > 0 ? (
            <IdeCallout tone="error" title="Missing required ports" testId="ide-project-mapping-banner">
              {readiness.missingRequiredCount} required port
              {readiness.missingRequiredCount === 1 ? '' : 's'} missing mapping.
            </IdeCallout>
          ) : (
            <IdeCallout tone="success" title="All required ports mapped" testId="ide-project-mapping-banner">
              Required inputs and outputs are mapped for Basys3 export.
            </IdeCallout>
          )}
          <IdeDataTable
            columns={['Signal', 'Direction', 'Pin', 'Required', 'Status']}
            rows={mappingRowsUi}
            testId="ide-project-mapping-table"
          />
        </section>

        <section className="ide-export-section" data-testid="ide-project-examples">
          <header className="ide-export-section-header">
            <h3>Starter Examples</h3>
            <span className="ide-export-section-meta">{examples.length} available</span>
          </header>
          <IdeGrid columns={2}>
            {examples.map((example) => (
              <article
                key={example.id}
                className={`ide-example-card ${activeExampleId === example.id ? 'is-active' : ''}`}
                data-testid={`ide-example-card-${example.id}`}
              >
                <header className="ide-example-card-header">
                  <h4>{example.name}</h4>
                  {activeExampleId === example.id ? (
                    <IdeStatusPill tone="ok">Loaded</IdeStatusPill>
                  ) : (
                    <IdeStatusPill tone="idle">Available</IdeStatusPill>
                  )}
                </header>
                <p className="ide-copy">{example.summary}</p>
                <p className="ide-copy ide-copy-top-gap">
                  <span className="ide-copy-strong">Expected:</span> {example.expectedBehavior}
                </p>
                <div className="ide-example-chip-row">
                  {example.tags.map((tag) => (
                    <IdeChip key={`${example.id}-${tag}`} tone="accent">
                      {tag}
                    </IdeChip>
                  ))}
                </div>
                <div className="ide-inline-actions">
                  <IdeButton
                    tone={activeExampleId === example.id ? 'ghost' : 'secondary'}
                    onClick={() => onOpenExample(example.id)}
                    disabled={activeExampleId === example.id}
                    testId={`ide-open-example-${example.id}`}
                  >
                    {activeExampleId === example.id ? 'Loaded' : 'Open example'}
                  </IdeButton>
                </div>
              </article>
            ))}
          </IdeGrid>
        </section>
      </IdePanel>
    </IdeSurfaceLayout>
  );
};

function statusPill(pass: boolean): React.ReactNode {
  return <IdeStatusPill tone={pass ? 'ok' : 'warn'}>{pass ? 'Ready' : 'Missing'}</IdeStatusPill>;
}

function suggestBasys3Pin(signal: { id: string; direction: 'in' | 'out' }, index: number): string {
  if (signal.direction === 'in') {
    if (signal.id.toLowerCase() === 'clk') return 'CLK100MHZ';
    return `SW${Math.min(index, 15)}`;
  }
  return `LD${Math.min(index, 15)}`;
}

function formatIso(value: string | undefined): string {
  if (!value) return 'never';
  return value.replace('T', ' ').replace('.000Z', 'Z');
}

function toMappingKey(value: string): string {
  return value.trim().toLowerCase();
}
