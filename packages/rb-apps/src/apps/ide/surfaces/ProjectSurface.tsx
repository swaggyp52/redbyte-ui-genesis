import React, { useMemo, useState } from 'react';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';

interface ProjectIoSignal {
  id: string;
  direction: 'in' | 'out';
  mapped: boolean;
}

interface MappingRow extends ProjectIoSignal {
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
    ioSignals: ProjectIoSignal[];
    vectors: Array<{ id: string; tick: number }>;
    lastVerify: { pass: boolean; failedCount: number } | null;
  };
  onOpenDesign: () => void;
  onOpenImport: () => void;
}

export const ProjectSurface: React.FC<ProjectSurfaceProps> = ({
  projectName,
  description,
  determinismHash,
  lastSavedAt,
  readiness,
  onOpenDesign,
  onOpenImport,
}) => {
  const [mappingRows, setMappingRows] = useState<MappingRow[]>(
    readiness.ioSignals.map((signal, index) => ({
      ...signal,
      required: true,
      pin: signal.mapped ? suggestBasys3Pin(signal, index) : '',
    }))
  );

  const hasVectors = readiness.vectors.length > 0;
  const hasVerifyPass = Boolean(readiness.lastVerify?.pass);
  const missingRequiredCount = mappingRows.filter((row) => row.required && row.pin.trim().length === 0).length;
  const hasIoMapping = mappingRows.length > 0 && missingRequiredCount === 0;

  const checklist = useMemo(
    () => [
      { key: 'circuit', label: 'Has circuit', pass: readiness.hasCircuit },
      { key: 'io', label: 'Has I/O mapping', pass: hasIoMapping },
      { key: 'vectors', label: 'Has vectors', pass: hasVectors },
      { key: 'verify', label: 'Verify pass (latest)', pass: hasVerifyPass },
    ],
    [hasIoMapping, hasVectors, hasVerifyPass, readiness.hasCircuit]
  );

  const readinessRows = checklist.map((item) => [
    item.label,
    <IdeStatusPill key={`${item.key}-status`} tone={item.pass ? 'ok' : 'warn'}>
      {item.pass ? 'Ready' : 'Missing'}
    </IdeStatusPill>,
  ]);

  const mappingTableRows = mappingRows.map((row, index) => [
    <code key={`${row.id}-signal`}>{row.id}</code>,
    row.direction.toUpperCase(),
    <input
      key={`${row.id}-pin`}
      className="ide-export-pin-input"
      value={row.pin}
      onChange={(event) => {
        const nextPin = event.target.value.toUpperCase().trim();
        setMappingRows((prev) =>
          prev.map((entry, entryIndex) =>
            entryIndex === index
              ? {
                  ...entry,
                  pin: nextPin,
                  mapped: nextPin.length > 0,
                }
              : entry
          )
        );
      }}
      placeholder={suggestBasys3Pin(row, index)}
      aria-label={`pin-${row.id}`}
    />,
    row.required ? 'Required' : 'Optional',
    <IdeStatusPill key={`${row.id}-mapped`} tone={row.pin.trim().length > 0 ? 'ok' : 'warn'}>
      {row.pin.trim().length > 0 ? 'Mapped' : 'Missing'}
    </IdeStatusPill>,
  ]);

  const quickSuggest = () => {
    setMappingRows((prev) =>
      prev.map((row, index) =>
        row.pin.trim().length > 0
          ? row
          : {
              ...row,
              pin: suggestBasys3Pin(row, index),
              mapped: true,
            }
      )
    );
  };

  const projectReady = checklist.every((item) => item.pass);

  return (
    <IdeSurfaceLayout
      mode="project"
      inspector={
        <>
          <IdeInspectorSection title="Project Summary">
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Board</span>
                <span>Basys3</span>
              </div>
              <div className="ide-kv-row">
                <span>Missing Ports</span>
                <span>{missingRequiredCount}</span>
              </div>
              <div className="ide-kv-row">
                <span>Vectors</span>
                <span>{readiness.vectors.length}</span>
              </div>
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Next Step">
            {projectReady ? (
              <IdeCallout tone="success" title="Ready for Export">
                Project checks are green. Move to Verify or Export.
              </IdeCallout>
            ) : (
              <IdeCallout tone="warn" title="Readiness Blocked">
                Resolve missing checklist items before export.
              </IdeCallout>
            )}
          </IdeInspectorSection>
        </>
      }
    >
      <IdePanel
        title="Project Source of Truth"
        description="Control identity, mapping, and readiness from one deterministic dashboard."
        actions={
          <>
            <IdeButton tone="primary" onClick={onOpenDesign}>
              Open Design
            </IdeButton>
            <IdeButton tone="secondary" onClick={quickSuggest} testId="ide-project-auto-suggest">
              Auto-suggest Basys3
            </IdeButton>
            <IdeButton tone="ghost" onClick={onOpenImport}>
              Import HDL
            </IdeButton>
          </>
        }
        right={
          <IdeStatusPill tone={projectReady ? 'ok' : 'warn'}>
            {projectReady ? 'Ready' : 'Needs Work'}
          </IdeStatusPill>
        }
        testId="ide-project-panel"
      >
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

        <section className="ide-export-section" data-testid="ide-project-io-mapping">
          <header className="ide-export-section-header">
            <h3>I/O Mapping</h3>
          </header>
          {missingRequiredCount > 0 ? (
            <IdeCallout tone="error" title="Missing required ports" testId="ide-project-mapping-banner">
              {missingRequiredCount} required port{missingRequiredCount === 1 ? '' : 's'} missing mapping.
              Use Auto-suggest Basys3 to fill default pins quickly.
            </IdeCallout>
          ) : (
            <IdeCallout tone="success" title="All required ports mapped" testId="ide-project-mapping-banner">
              Required inputs/outputs are mapped for Basys3 export.
            </IdeCallout>
          )}
          <IdeDataTable
            columns={['Signal', 'Direction', 'Pin', 'Required', 'Status']}
            rows={mappingTableRows}
            testId="ide-project-mapping-table"
          />
        </section>

        <section className="ide-export-section" data-testid="ide-project-readiness">
          <header className="ide-export-section-header">
            <h3>Readiness Checklist</h3>
          </header>
          <IdeDataTable
            columns={['Check', 'Status']}
            rows={readinessRows}
            testId="ide-project-readiness-checklist"
          />
        </section>
      </IdePanel>
    </IdeSurfaceLayout>
  );
};

function suggestBasys3Pin(signal: ProjectIoSignal, index: number): string {
  if (signal.direction === 'in') {
    if (signal.id.toLowerCase() === 'clk') return 'CLK100MHZ';
    return `SW${Math.min(index, 15)}`;
  }
  return `LD${Math.min(index, 15)}`;
}
