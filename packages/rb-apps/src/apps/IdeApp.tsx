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
  const [ioMapped] = useState(6);
  const [ioTotal] = useState(8);
  const [vectorCount] = useState(0);
  const [saveState] = useState<'saved' | 'unsaved' | 'autosaving'>('saved');

  const determinismHash = useMemo(() => '2f4e0bb0f17ac4d2', []);

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
            ioMapped={ioMapped}
            ioTotal={ioTotal}
            vectorCount={vectorCount}
            onOpenDesign={() => setCurrentMode('design')}
            onOpenImport={() => setCurrentMode('import')}
          />
        ) : currentMode === 'design' ? (
          <DesignSurface onOpenPalette={() => null} />
        ) : currentMode === 'verify' ? (
          <VerifySurface
            deterministicHash={determinismHash}
            hasVectors={vectorCount > 0}
            onOpenProjectVectors={() => setCurrentMode('project')}
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
