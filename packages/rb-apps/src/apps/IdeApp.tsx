// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// IdeApp - IDE-first shell surface with deterministic mode markers.

import React, { useEffect, useMemo, useState } from 'react';
import { installFatalCapture, pushMount } from '@redbyte/rb-utils';
import './ide/ide-root.css';
import { IdeLeftRail, type IdeMode } from './ide/components/IdeLeftRail';
import { IdeTopBar } from './ide/components/IdeTopBar';
import { IdeStatusBar } from './ide/components/IdeStatusBar';
import { ProjectSurface } from './ide/surfaces/ProjectSurface';
import { DesignSurface } from './ide/surfaces/DesignSurface';
import { VerifySurface } from './ide/surfaces/VerifySurface';
import { ExportSurface } from './ide/surfaces/ExportSurface';
import {
  IdeButton,
  IdeCallout,
  IdeCard,
  IdeEmptyState,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from './ide/components/IdePrimitives';

const MODE_TEXT: Record<IdeMode, { title: string; description: string; marker: string }> = {
  project: {
    title: 'Project Mode',
    description: 'Project truth, readiness checks, and Basys3 constraints.',
    marker: 'PROJECT',
  },
  design: {
    title: 'Design Mode',
    description: 'Circuit-first workspace with deterministic graph updates.',
    marker: 'DESIGN',
  },
  verify: {
    title: 'Verify Mode',
    description: 'Deterministic vector execution with explicit pass/fail evidence.',
    marker: 'VERIFY',
  },
  export: {
    title: 'Export Mode',
    description: 'Compiler-style artifact validation and Basys3 export preview.',
    marker: 'EXPORT',
  },
  import: {
    title: 'Import Mode',
    description: 'HDL/XDC intake with diagnostics and pin mapping guidance.',
    marker: 'IMPORT',
  },
};

const ModePlaceholder: React.FC<{ mode: IdeMode }> = ({ mode }) => {
  const modeText = MODE_TEXT[mode];

  return (
    <div className="ide-content-grid" data-testid={`ide-mode-${mode}`} data-ide-mode-marker={mode}>
      <main className="ide-main-area" data-testid="ide-mode-body">
        <IdePanel
          title={modeText.title}
          description={modeText.description}
          actions={
            <>
              <IdeButton tone="primary">Continue Build</IdeButton>
              <IdeButton tone="ghost">View Contract</IdeButton>
            </>
          }
          testId="ide-main-panel"
        >
          <div className="ide-card-grid">
            <IdeCard title="Current Focus" subtitle="Intentional surface planning">
              <p className="ide-copy">
                This mode now has a locked layout contract. Next commits replace placeholders with
                fully functional mode-specific panels.
              </p>
              <div className="ide-inline-actions">
                <IdeStatusPill tone="warn">In Progress</IdeStatusPill>
                <IdeStatusPill tone="idle">{modeText.marker}</IdeStatusPill>
              </div>
            </IdeCard>
            <IdeCard title="Primary Actions" subtitle="Mode-scoped only">
              <ul className="ide-list">
                <li>Read and write only allowed RBProject fields.</li>
                <li>Render deterministic empty, error, and success states.</li>
                <li>Preserve Basys3-only product constraints.</li>
              </ul>
            </IdeCard>
          </div>
          <IdeEmptyState
            title={`${modeText.title} content is being implemented`}
            body="The shell, typography, spacing, and mode structure are now stable. Next mode commits populate this area with real workflows."
            primaryAction={<IdeButton tone="primary">Continue Build</IdeButton>}
            secondaryAction={<IdeButton tone="ghost">View Contract</IdeButton>}
            testId="ide-mode-empty-state"
          />
        </IdePanel>
      </main>

      <aside className="ide-inspector" data-testid="ide-inspector">
        <IdeInspectorSection title="Inspector">
          <p className="ide-copy">
            Right-side inspection stays consistent across modes. Sections vary by mode depth.
          </p>
        </IdeInspectorSection>
        <IdeInspectorSection title="Determinism">
          <IdeCallout tone="info" title="Contract">
            No silent fallback. No hidden mode mutations. No launcher surface at default route.
          </IdeCallout>
        </IdeInspectorSection>
      </aside>
    </div>
  );
};

export const IdeApp: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<IdeMode>('project');
  const [projectName] = useState('Basys3 Design');
  const [projectDescription] = useState('Deterministic student FPGA workspace');
  const [projectReadiness] = useState({
    ioSignals: [
      { id: 'sw0', direction: 'in' as const, mapped: true },
      { id: 'sw1', direction: 'in' as const, mapped: true },
      { id: 'sw2', direction: 'in' as const, mapped: true },
      { id: 'sw3', direction: 'in' as const, mapped: true },
      { id: 'led0', direction: 'out' as const, mapped: true },
      { id: 'led1', direction: 'out' as const, mapped: true },
      { id: 'led2', direction: 'out' as const, mapped: false },
      { id: 'led3', direction: 'out' as const, mapped: false },
    ],
    vectors: [] as Array<{ id: string; tick: number }>,
    lastVerify: null as { pass: boolean; failedCount: number } | null,
  });
  const [saveState] = useState<'saved' | 'unsaved' | 'autosaving'>('saved');

  const determinismHash = useMemo(() => '2f4e0bb0f17ac4d2', []);
  const exportPreview = useMemo(
    () => ({
      diagnostics: {
        success: false,
        errors: [
          {
            type: 'validation' as const,
            severity: 'error' as const,
            message: 'Unmapped required input port "count_en". Fix: map "count_en" to "SW0 / V17".',
          },
          {
            type: 'validation' as const,
            severity: 'error' as const,
            message: 'Unmapped required output port "q2". Fix: map "q2" to "LD0 / U16".',
          },
          {
            type: 'constraint' as const,
            severity: 'warning' as const,
            message:
              'Ignoring source XDC directive "create_clock" during deterministic Basys3 export; constraints are regenerated from IO mapping.',
          },
          {
            type: 'validation' as const,
            severity: 'warning' as const,
            message: 'Unused mapped input "unused_btn" will be ignored by top-entity export.',
          },
        ],
        warnings: [],
        determinismHash,
      },
      artifacts: [
        {
          name: 'top.vhd',
          status: 'ready' as const,
          note: 'Generated from deterministic netlist.',
        },
        {
          name: 'top.xdc',
          status: 'blocked' as const,
          note: 'Blocked until all required ports are mapped.',
        },
        {
          name: 'testbench.vhd',
          status: 'pending' as const,
          note: 'Available when vectors and export checks are valid.',
        },
      ],
      mappings: [
        {
          port: 'clk',
          direction: 'in' as const,
          pin: 'CLK100MHZ',
          status: 'mapped' as const,
          notes: 'Required board clock input.',
          suggestedPin: 'CLK100MHZ',
        },
        {
          port: 'rst',
          direction: 'in' as const,
          pin: 'SW0',
          status: 'mapped' as const,
          notes: 'Reset control from switch.',
          suggestedPin: 'SW0',
        },
        {
          port: 'count_en',
          direction: 'in' as const,
          pin: '',
          status: 'missing' as const,
          notes: 'Top-entity required input.',
          suggestedPin: 'SW1',
        },
        {
          port: 'q0',
          direction: 'out' as const,
          pin: 'LD0',
          status: 'mapped' as const,
          notes: 'Output indicator.',
          suggestedPin: 'LD0',
        },
        {
          port: 'q1',
          direction: 'out' as const,
          pin: 'LD1',
          status: 'mapped' as const,
          notes: 'Output indicator.',
          suggestedPin: 'LD1',
        },
        {
          port: 'q2',
          direction: 'out' as const,
          pin: '',
          status: 'missing' as const,
          notes: 'Top-entity required output.',
          suggestedPin: 'LD2',
        },
        {
          port: 'unused_btn',
          direction: 'in' as const,
          pin: 'SW2',
          status: 'unused' as const,
          notes: 'Mapped but not used by top entity.',
          suggestedPin: 'SW2',
        },
      ],
    }),
    [determinismHash]
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.redbyteMode = 'ide';
    }
    installFatalCapture({ force: true });
    pushMount('IdeApp: mounted');
    console.log('RB_IDE_APP_BOOT');
    return () => {
      if (typeof document !== 'undefined' && document.documentElement.dataset.redbyteMode === 'ide') {
        delete document.documentElement.dataset.redbyteMode;
      }
    };
  }, []);

  return (
    <div className="ide-root" data-testid="ide-root" data-redbyte-mode="ide">
      <div className="ide-backdrop-gradient" aria-hidden="true" />

      <IdeTopBar
        projectName={projectName}
        saveState={saveState}
        onRunVerify={() => setCurrentMode('verify')}
        onExport={() => setCurrentMode('export')}
        onHelp={() => setCurrentMode('project')}
      />

      <div className="ide-layout-shell">
        <IdeLeftRail currentMode={currentMode} onModeChange={setCurrentMode} />
        {currentMode === 'project' ? (
          <ProjectSurface
            projectName={projectName}
            description={projectDescription}
            determinismHash={determinismHash}
            readiness={projectReadiness}
            onOpenDesign={() => setCurrentMode('design')}
            onOpenImport={() => setCurrentMode('import')}
          />
        ) : currentMode === 'design' ? (
          <DesignSurface onOpenPalette={() => null} />
        ) : currentMode === 'verify' ? (
          <VerifySurface
            deterministicHash={determinismHash}
            hasVectors={projectReadiness.vectors.length > 0}
            onOpenProjectVectors={() => setCurrentMode('project')}
          />
        ) : currentMode === 'export' ? (
          <ExportSurface
            diagnostics={exportPreview.diagnostics}
            artifacts={exportPreview.artifacts}
            mappings={exportPreview.mappings}
          />
        ) : (
          <ModePlaceholder mode={currentMode} />
        )}
      </div>

      <IdeStatusBar mode={currentMode} determinismHash={determinismHash} gateStatus="warn" />
    </div>
  );
};

export default IdeApp;
