import React, { useMemo } from 'react';
import type { ProjectHealth } from '../projectHealth';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdeGrid,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';

export interface HardwareMappingRow {
  id: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
}

export interface HardwareSurfaceProps {
  projectName: string;
  expectedBehavior: string;
  mappingRows: HardwareMappingRow[];
  expectedIoRows: Array<{
    signal: string;
    tick: number;
    expected: string;
  }>;
  vectorsCount: number;
  health: ProjectHealth;
  onGenerateBringUpVectors: () => void;
  onOpenExport: () => void;
  onOpenVerify: () => void;
}

export const HardwareSurface: React.FC<HardwareSurfaceProps> = ({
  projectName,
  expectedBehavior,
  mappingRows,
  expectedIoRows,
  vectorsCount,
  health,
  onGenerateBringUpVectors,
  onOpenExport,
  onOpenVerify,
}) => {
  const mappedRequiredCount = useMemo(
    () => mappingRows.filter((row) => row.required && row.pin.trim().length > 0).length,
    [mappingRows]
  );
  const requiredCount = useMemo(
    () => mappingRows.filter((row) => row.required).length,
    [mappingRows]
  );
  const hasClockMapping = useMemo(
    () =>
      mappingRows.some(
        (row) =>
          row.direction === 'in' &&
          /(^clk$|clock|clk100mhz)/i.test(row.label) &&
          row.pin.trim().length > 0
      ),
    [mappingRows]
  );
  const hasResetMapping = useMemo(
    () =>
      mappingRows.some(
        (row) =>
          row.direction === 'in' &&
          /(^rst$|reset)/i.test(row.label) &&
          row.pin.trim().length > 0
      ),
    [mappingRows]
  );
  const hasOutputMapping = useMemo(
    () =>
      mappingRows.some((row) => row.direction === 'out' && row.pin.trim().length > 0),
    [mappingRows]
  );
  const hasBlocking = health.blockingIssues.length > 0;

  const checklistRows = useMemo(
    () => [
      ['Clock mapped', statusPill(hasClockMapping)],
      ['Reset mapped', statusPill(hasResetMapping)],
      ['Output pins mapped', statusPill(hasOutputMapping)],
      ['Bring-up vectors', statusPill(vectorsCount > 0)],
      ['Latest verify', statusPill(health.lastVerify?.status === 'pass')],
    ],
    [hasClockMapping, hasOutputMapping, hasResetMapping, health.lastVerify?.status, vectorsCount]
  );

  const mappingTableRows = useMemo(
    () =>
      [...mappingRows]
        .sort((left, right) => left.label.localeCompare(right.label))
        .map((row) => [
          <code key={`${row.id}-signal`}>{row.label}</code>,
          row.direction.toUpperCase(),
          row.pin.trim().length > 0 ? row.pin : 'UNMAPPED',
          <IdeStatusPill key={`${row.id}-status`} tone={row.pin.trim().length > 0 ? 'ok' : 'warn'}>
            {row.pin.trim().length > 0 ? 'Mapped' : 'Missing'}
          </IdeStatusPill>,
        ]),
    [mappingRows]
  );
  const expectedIoTableRows = useMemo(
    () =>
      expectedIoRows.slice(0, 20).map((row) => [
        <code key={`${row.signal}-${row.tick}`}>{row.signal}</code>,
        `t${row.tick}`,
        <code key={`${row.signal}-${row.tick}-expected`}>{row.expected}</code>,
      ]),
    [expectedIoRows]
  );
  const checklistSteps = useMemo(
    () => [
      'Download Vivado pack from Export.',
      'Run vivado_import.tcl in the unpacked folder.',
      'Program Basys3 with generated bitstream.',
      'Flip mapped SW/BTN inputs and compare LED outputs.',
    ],
    []
  );

  return (
    <IdeSurfaceLayout
      mode="hardware"
      consoleHasBlocking={hasBlocking}
      dock={
        <section className="ide-workbench-placeholder" data-testid="ide-hardware-sources-dock">
          <header className="ide-workbench-placeholder-header">
            <h3>Board Target</h3>
            <IdeStatusPill tone="ok">BASYS3</IdeStatusPill>
          </header>
          <div className="ide-kv-list">
            <div className="ide-kv-row">
              <span>Mapped required</span>
              <span>
                {mappedRequiredCount}/{requiredCount}
              </span>
            </div>
            <div className="ide-kv-row">
              <span>Vectors</span>
              <span>{vectorsCount}</span>
            </div>
            <div className="ide-kv-row">
              <span>Verify</span>
              <span>{health.lastVerify?.status?.toUpperCase() ?? 'NEVER'}</span>
            </div>
          </div>
          <div className="ide-inline-actions">
            <IdeButton tone="secondary" onClick={onOpenVerify}>
              Open Verify
            </IdeButton>
          </div>
        </section>
      }
      inspector={
        <>
          <IdeInspectorSection title="Expected Behavior">
            <p className="ide-copy" data-testid="ide-hardware-expected-behavior">
              {expectedBehavior}
            </p>
          </IdeInspectorSection>
          <IdeInspectorSection title="Bring-Up Status">
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Verify Hash</span>
                <span className="ide-status-mono">
                  {health.lastVerify?.hash?.slice(0, 16) ?? 'pending'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Export Hash</span>
                <span className="ide-status-mono">
                  {health.lastExport?.hash?.slice(0, 16) ?? 'pending'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Dirty Since Verify</span>
                <IdeStatusPill tone={health.dirtySinceVerify ? 'warn' : 'ok'}>
                  {health.dirtySinceVerify ? 'YES' : 'NO'}
                </IdeStatusPill>
              </div>
            </div>
          </IdeInspectorSection>
        </>
      }
      console={
        <section className="ide-workbench-console-content" data-testid="ide-hardware-console">
          <header className="ide-workbench-console-header">
            <h3>Hardware Console</h3>
            <span className="ide-workbench-console-mode">Hardware</span>
          </header>
          {hasBlocking ? (
            <IdeCallout tone="warn" title="Bring-up blocked">
              {health.blockingIssues[0]?.message ?? 'Resolve blockers before building hardware bundle.'}
            </IdeCallout>
          ) : (
            <IdeCallout tone="success" title="Bring-up ready">
              Mapping, vectors, and verify state are ready for deterministic Basys3 export.
            </IdeCallout>
          )}
          <section className="ide-export-section" data-testid="ide-hardware-if-wrong">
            <header className="ide-export-section-header">
              <h3>If wrong</h3>
            </header>
            <ul className="ide-export-checklist">
              <li>Confirm top module in Vivado matches exported top entity.</li>
              <li>Check every required signal has a mapped Basys3 pin.</li>
              <li>Ensure constraints file is added to <code>constrs_1</code>.</li>
              <li>Re-run Verify and compare first failing signal before re-export.</li>
            </ul>
          </section>
        </section>
      }
    >
      <IdePanel
        title="Hardware"
        description="Board bring-up truth screen for deterministic Basys3 proof in under five minutes."
        actions={
          <>
            <span data-testid="ide-primary-cta">
              <IdeButton
                tone="primary"
                onClick={onOpenExport}
                testId="ide-hardware-build-export"
              >
                Build + Export Vivado Bundle
              </IdeButton>
            </span>
            <IdeButton
              tone="secondary"
              onClick={onGenerateBringUpVectors}
              testId="ide-hardware-generate-vectors"
            >
              Generate Bring-Up Vectors
            </IdeButton>
            <IdeButton tone="ghost" onClick={onOpenVerify} testId="ide-hardware-open-verify">
              Run Verify
            </IdeButton>
          </>
        }
        right={
          <IdeStatusPill tone={hasBlocking ? 'warn' : 'ok'}>
            {hasBlocking ? 'Needs Action' : 'Ready'}
          </IdeStatusPill>
        }
        testId="ide-hardware-panel"
      >
        <IdeGrid columns={2} testId="ide-hardware-grid">
          <section className="ide-export-section" data-testid="ide-hardware-checklist">
            <header className="ide-export-section-header">
              <h3>Bring-Up Checklist</h3>
            </header>
            <ol className="ide-export-checklist ide-copy" data-testid="ide-hardware-checklist-steps">
              {checklistSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <IdeDataTable
              columns={['Check', 'Status']}
              rows={checklistRows}
              testId="ide-hardware-checklist-table"
            />
          </section>

          <section className="ide-export-section" data-testid="ide-hardware-required-signals">
            <header className="ide-export-section-header">
              <h3>Required Signals</h3>
              <span className="ide-export-section-meta">{requiredCount} required</span>
            </header>
            {requiredCount > 0 ? (
              <IdeCallout tone={mappedRequiredCount === requiredCount ? 'success' : 'warn'}>
                {mappedRequiredCount === requiredCount
                  ? 'All required signals are mapped to Basys3 pins.'
                  : `${requiredCount - mappedRequiredCount} required signal(s) still unmapped.`}
              </IdeCallout>
            ) : (
              <IdeCallout tone="warn" title="No required signals">
                Add mapped IO rows before hardware bring-up.
              </IdeCallout>
            )}
          </section>
        </IdeGrid>

        <section className="ide-export-section" data-testid="ide-hardware-mapping-summary">
          <header className="ide-export-section-header">
            <h3>Mapping Summary</h3>
            <span className="ide-export-section-meta">{mappingRows.length} rows</span>
          </header>
          <IdeDataTable
            columns={['Signal', 'Direction', 'Pin', 'Status']}
            rows={mappingTableRows}
            testId="ide-hardware-mapping-table"
          />
        </section>

        <section className="ide-export-section" data-testid="ide-hardware-expected-io-table">
          <header className="ide-export-section-header">
            <h3>Expected IO</h3>
            <span className="ide-export-section-meta">{expectedIoRows.length} rows</span>
          </header>
          {expectedIoTableRows.length > 0 ? (
            <IdeDataTable
              columns={['Signal', 'Tick', 'Expected']}
              rows={expectedIoTableRows}
              testId="ide-hardware-expected-table"
            />
          ) : (
            <IdeCallout tone="warn" title="Expected IO pending">
              Generate bring-up vectors and run Verify to produce expected IO rows.
            </IdeCallout>
          )}
        </section>
      </IdePanel>
    </IdeSurfaceLayout>
  );
};

function statusPill(pass: boolean): React.ReactNode {
  return <IdeStatusPill tone={pass ? 'ok' : 'warn'}>{pass ? 'Ready' : 'Missing'}</IdeStatusPill>;
}
