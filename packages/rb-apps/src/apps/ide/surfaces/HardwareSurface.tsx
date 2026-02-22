import React, { useMemo } from 'react';
import type { ProjectHealth } from '../projectHealth';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
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
  projectName: _projectName,
  expectedBehavior,
  mappingRows,
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

  return (
    <IdeSurfaceLayout
      mode="hardware"
      consoleHasBlocking={hasBlocking}
      consoleHasEntries={hasBlocking}
      dock={
        <section className="ide-workbench-placeholder" data-testid="ide-hardware-sources-dock">
          <header className="ide-workbench-placeholder-header">
            <h3>Bring-Up Checklist</h3>
            <IdeStatusPill tone="ok">BASYS3</IdeStatusPill>
          </header>
          <IdeDataTable
            columns={['Check', 'Status']}
            rows={checklistRows}
            testId="ide-hardware-checklist-table"
          />
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
          </div>
          <div className="ide-inline-actions">
            <IdeButton tone="secondary" onClick={onOpenVerify}>
              Run Verify
            </IdeButton>
          </div>
        </section>
      }
      inspector={
        <>
          <IdeInspectorSection title="Live Signals" defaultOpen>
            <p className="ide-copy" style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
              Connect simulation to see live SW / LD values.
            </p>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>SW</span>
                <span>—</span>
              </div>
              <div className="ide-kv-row">
                <span>LD</span>
                <span>—</span>
              </div>
              <div className="ide-kv-row">
                <span>BTN</span>
                <span>—</span>
              </div>
            </div>
          </IdeInspectorSection>
          <IdeInspectorSection title="Expected Behavior" defaultOpen>
            <p className="ide-copy" data-testid="ide-hardware-expected-behavior">
              {expectedBehavior}
            </p>
          </IdeInspectorSection>
          <IdeInspectorSection title="Bring-Up Status" defaultOpen={false}>
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
        <div
          className="ide-hardware-board-placeholder"
          data-testid="ide-hardware-board-placeholder"
          style={{
            border: '1px dashed rgba(46,196,182,0.35)',
            borderRadius: 'var(--ide-radius-s)',
            minHeight: 240,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--ide-space-2)',
            background: 'rgba(8,18,28,0.5)',
            color: 'var(--ide-text-soft)',
          }}
        >
          <span style={{ fontFamily: 'var(--rb-font-mono)', fontSize: 'var(--rb-font-size-1)' }}>
            BASYS3
          </span>
          <span style={{ fontSize: 'var(--rb-font-size-1)' }}>Board visualization — wiring in progress</span>
        </div>

        <section className="ide-export-section" data-testid="ide-hardware-mapping-summary">
          <header className="ide-export-section-header">
            <h3>Mapping Summary</h3>
            <span className="ide-export-section-meta">{mappingRows.length} rows</span>
          </header>
          <IdeDataTable
            columns={['Signal', 'Dir', 'Pin', 'Status']}
            rows={mappingTableRows}
            testId="ide-hardware-mapping-table"
          />
        </section>
      </IdePanel>
    </IdeSurfaceLayout>
  );
};

function statusPill(pass: boolean): React.ReactNode {
  return <IdeStatusPill tone={pass ? 'ok' : 'warn'}>{pass ? 'Ready' : 'Missing'}</IdeStatusPill>;
}
