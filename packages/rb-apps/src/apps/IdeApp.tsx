// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// IdeApp - IDE-first shell surface with deterministic mode markers.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLogicViewStore } from '@redbyte/rb-logic-view';
import type { TestVector } from '@redbyte/rb-utils';
import { installFatalCapture, pushMount } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import './ide/ide-root.css';
import { IdeLeftRail, type IdeMode } from './ide/components/IdeLeftRail';
import { IdeTopBar } from './ide/components/IdeTopBar';
import { IdeStatusBar } from './ide/components/IdeStatusBar';
import { IdeButton, IdeModal } from './ide/components/IdePrimitives';
import { ProjectSurface } from './ide/surfaces/ProjectSurface';
import { DesignSurface, type DesignCompilerStatus } from './ide/surfaces/DesignSurface';
import { VerifySurface } from './ide/surfaces/VerifySurface';
import { ExportSurface } from './ide/surfaces/ExportSurface';
import { ImportSurface } from './ide/surfaces/ImportSurface';
import { buildExportViewModel } from './ide/viewmodels/buildExportViewModel';
import {
  IDE_DEFAULT_EXAMPLE_ID,
  IDE_EXAMPLES,
  getIdeExampleById,
  type IdeExampleIoRow,
} from './ide/examplesCatalog';
import {
  choosePrimaryProjectCta,
  deriveProjectHealth,
  type ProjectHealthCore,
  type ProjectHealthExportResult,
  type ProjectHealthVerifyResult,
} from './ide/projectHealth';

type ProjectIoRow = IdeExampleIoRow;

const INITIAL_EXAMPLE = getIdeExampleById(IDE_DEFAULT_EXAMPLE_ID) ?? IDE_EXAMPLES[0];

export const IdeApp: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<IdeMode>(() => resolveInitialIdeMode());
  const [projectName, setProjectName] = useState(INITIAL_EXAMPLE.name);
  const [projectDescription, setProjectDescription] = useState(INITIAL_EXAMPLE.summary);
  const [lastSavedAt, setLastSavedAt] = useState('Seeded example');
  const [projectIoRows, setProjectIoRows] = useState<ProjectIoRow[]>(() => cloneIoRows(INITIAL_EXAMPLE.ioRows));
  const [projectVectors, setProjectVectors] = useState<TestVector[]>(() => cloneVectors(INITIAL_EXAMPLE.vectors));
  const [activeExampleId, setActiveExampleId] = useState<string | null>(INITIAL_EXAMPLE.id);
  const [pendingExampleId, setPendingExampleId] = useState<string | null>(null);
  const [projectHealthCore, setProjectHealthCore] = useState<ProjectHealthCore>({
    dirtySinceVerify: false,
    dirtySinceExport: false,
  });

  const determinismHash = useMemo(() => '2f4e0bb0f17ac4d2', []);
  const hasCircuit = true;
  const missingRequiredCount = useMemo(
    () => projectIoRows.filter((entry) => entry.required && entry.pin.trim().length === 0).length,
    [projectIoRows]
  );
  const hasIoMapping = useMemo(
    () => projectIoRows.filter((entry) => entry.required).length > 0 && missingRequiredCount === 0,
    [missingRequiredCount, projectIoRows]
  );
  const hasVectors = projectVectors.length > 0;
  const latestVerifyPass = projectHealthCore.lastVerify?.status === 'pass';
  const saveState: 'saved' | 'unsaved' | 'autosaving' =
    projectHealthCore.dirtySinceVerify || projectHealthCore.dirtySinceExport ? 'unsaved' : 'saved';

  const readiness = useMemo(
    () => ({
      hasCircuit,
      hasIoMapping,
      hasVectors,
      verifyPass: latestVerifyPass,
      missingRequiredCount,
    }),
    [hasCircuit, hasIoMapping, hasVectors, latestVerifyPass, missingRequiredCount]
  );

  const projectHealth = useMemo(
    () =>
      deriveProjectHealth(projectHealthCore, {
        hasCircuit: readiness.hasCircuit,
        hasIoMapping: readiness.hasIoMapping,
        hasVectors: readiness.hasVectors,
      }),
    [projectHealthCore, readiness.hasCircuit, readiness.hasIoMapping, readiness.hasVectors]
  );

  const primaryProjectCta = useMemo(
    () =>
      choosePrimaryProjectCta(projectHealth, {
        hasCircuit: readiness.hasCircuit,
        hasIoMapping: readiness.hasIoMapping,
        hasVectors: readiness.hasVectors,
      }),
    [projectHealth, readiness.hasCircuit, readiness.hasIoMapping, readiness.hasVectors]
  );

  const hasUnsavedWork =
    projectHealthCore.dirtySinceVerify ||
    projectHealthCore.dirtySinceExport ||
    Boolean(projectHealthCore.lastVerify) ||
    Boolean(projectHealthCore.lastExport) ||
    projectVectors.length > 0;

  const pendingExample = useMemo(
    () => (pendingExampleId ? getIdeExampleById(pendingExampleId) : undefined),
    [pendingExampleId]
  );

  const applyExample = useCallback((exampleId: string) => {
    const example = getIdeExampleById(exampleId);
    if (!example) return;

    setActiveExampleId(example.id);
    setProjectName(example.name);
    setProjectDescription(example.summary);
    setProjectIoRows(cloneIoRows(example.ioRows));
    setProjectVectors(cloneVectors(example.vectors));
    setProjectHealthCore({
      dirtySinceVerify: false,
      dirtySinceExport: false,
    });
    setLastSavedAt(`Example loaded: ${example.name}`);
    setPendingExampleId(null);
    setCurrentMode('project');
  }, []);

  const handleOpenExample = useCallback(
    (exampleId: string) => {
      if (activeExampleId === exampleId) return;
      if (hasUnsavedWork) {
        setPendingExampleId(exampleId);
        return;
      }
      applyExample(exampleId);
    },
    [activeExampleId, applyExample, hasUnsavedWork]
  );

  const handleConfirmExampleReplace = useCallback(() => {
    if (!pendingExampleId) return;
    applyExample(pendingExampleId);
  }, [applyExample, pendingExampleId]);

  const handleCancelExampleReplace = useCallback(() => {
    setPendingExampleId(null);
  }, []);

  const handleMappingPinChange = useCallback((rowId: string, pin: string) => {
    setProjectIoRows((previous) =>
      previous.map((entry) => (entry.id === rowId ? { ...entry, pin } : entry))
    );
    setProjectHealthCore((previous) => ({
      ...previous,
      dirtySinceExport: true,
    }));
  }, []);

  const handleAutoSuggestMapping = useCallback(() => {
    setProjectIoRows((previous) =>
      previous.map((entry, index) =>
        entry.pin.trim().length > 0 ? entry : { ...entry, pin: suggestBasys3Pin(entry, index) }
      )
    );
    setProjectHealthCore((previous) => ({
      ...previous,
      dirtySinceExport: true,
    }));
  }, []);

  const handleProjectPrimaryAction = useCallback(() => {
    if (primaryProjectCta.code === 'RBP1001') {
      handleAutoSuggestMapping();
      setCurrentMode('project');
      return;
    }
    setCurrentMode(primaryProjectCta.mode);
  }, [handleAutoSuggestMapping, primaryProjectCta.code, primaryProjectCta.mode]);

  const handleVectorsChange = useCallback((vectors: TestVector[]) => {
    setProjectVectors(vectors);
    setProjectHealthCore((previous) => ({
      ...previous,
      dirtySinceVerify: true,
      dirtySinceExport: true,
    }));
  }, []);

  const handleVerificationComplete = useCallback((result: ProjectHealthVerifyResult) => {
    setProjectHealthCore((previous) => ({
      ...previous,
      lastVerify: result,
      dirtySinceVerify: false,
    }));
  }, []);

  const handleExportResult = useCallback((result: ProjectHealthExportResult) => {
    setProjectHealthCore((previous) => ({
      ...previous,
      lastExport: result,
      dirtySinceExport: result.status === 'ok' ? false : previous.dirtySinceExport,
    }));
  }, []);

  const handleDesignMutation = useCallback(() => {
    setProjectHealthCore((previous) => ({
      ...previous,
      dirtySinceVerify: true,
      dirtySinceExport: true,
    }));
  }, []);

  const topEntityName = useMemo(() => buildTopEntityName(projectName), [projectName]);
  const hdlText = useMemo(() => buildVhdlFromMapping(topEntityName, projectIoRows), [projectIoRows, topEntityName]);
  const xdcText = useMemo(() => buildConstraintText(projectIoRows), [projectIoRows]);

  const exportProject = useMemo<RBProject>(
    () => ({
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-02-19T00:00:00.000Z',
      updatedAt: '2026-02-19T00:00:00.000Z',
      name: projectName,
      description: projectDescription,
      circuit: buildProjectCircuit(projectIoRows),
      hdl: {
        top: topEntityName,
        sources: [
          {
            path: 'top.vhd',
            language: 'vhdl',
            text: hdlText,
          },
        ],
      },
      fpga: {
        board: 'basys3',
        top: topEntityName,
        constraints: {
          type: 'xdc',
          text: xdcText,
        },
      },
      ioMapping: {
        inputs: projectIoRows
          .filter((entry) => entry.direction === 'in')
          .map((entry) => ({
            id: entry.id,
            nodeId: entry.nodeId,
            port: entry.port,
            label: entry.label,
            pin: entry.pin,
          })),
        outputs: projectIoRows
          .filter((entry) => entry.direction === 'out')
          .map((entry) => ({
            id: entry.id,
            nodeId: entry.nodeId,
            port: entry.port,
            label: entry.label,
            pin: entry.pin,
          })),
      },
      vectors: projectVectors,
      meta: {
        appSurface: 'ide-export',
      },
    }),
    [hdlText, projectDescription, projectIoRows, projectName, projectVectors, topEntityName, xdcText]
  );

  const exportViewModel = useMemo(() => buildExportViewModel(exportProject), [exportProject]);
  const designCompilerStatus = useMemo<DesignCompilerStatus>(
    () => ({
      dirtySinceVerify: projectHealthCore.dirtySinceVerify,
      dirtySinceExport: projectHealthCore.dirtySinceExport,
      errorCount: exportViewModel.errors.length,
      warningCount: exportViewModel.warnings.length,
      diagnostics: [
        ...exportViewModel.errors.map((entry) => ({
          code: entry.code,
          message: entry.message,
          severity: 'error' as const,
          port: entry.port,
        })),
        ...exportViewModel.warnings.map((entry) => ({
          code: entry.code,
          message: entry.message,
          severity: 'warning' as const,
          port: entry.port,
        })),
      ],
    }),
    [
      exportViewModel.errors,
      exportViewModel.warnings,
      projectHealthCore.dirtySinceExport,
      projectHealthCore.dirtySinceVerify,
    ]
  );

  const verifyMappedInputs = useMemo(
    () =>
      projectIoRows
        .filter((entry) => entry.direction === 'in' && entry.pin.trim().length > 0)
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          pin: entry.pin,
        })),
    [projectIoRows]
  );

  const handleVerifyFixPath = useCallback(
    (signalName: string) => {
      const desiredSignal = normalizeSignalKey(signalName);
      const targetNode =
        exportProject.circuit.nodes.find(
          (node) => normalizeSignalKey(node.label ?? node.id) === desiredSignal
        ) ??
        exportProject.circuit.nodes.find((node) => node.type === 'OUTPUT');

      setCurrentMode('design');

      if (!targetNode || typeof window === 'undefined') return;
      window.setTimeout(() => {
        const viewState = useLogicViewStore.getState();
        viewState.setToolMode('select');
        viewState.selectMultipleNodes([targetNode.id], false);
      }, 0);
    },
    [exportProject.circuit.nodes]
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
            lastSavedAt={lastSavedAt}
            readiness={readiness}
            health={projectHealth}
            mappingRows={projectIoRows}
            examples={IDE_EXAMPLES.map((example) => ({
              id: example.id,
              name: example.name,
              summary: example.summary,
              expectedBehavior: example.expectedBehavior,
              tags: example.tags,
            }))}
            activeExampleId={activeExampleId}
            onOpenExample={handleOpenExample}
            primaryCtaLabel={primaryProjectCta.label}
            onPrimaryCta={handleProjectPrimaryAction}
            onUpdateMappingPin={handleMappingPinChange}
            onAutoSuggestMapping={handleAutoSuggestMapping}
            onOpenDesign={() => setCurrentMode('design')}
            onOpenVerify={() => setCurrentMode('verify')}
            onOpenExport={() => setCurrentMode('export')}
            onOpenImport={() => setCurrentMode('import')}
          />
        ) : currentMode === 'design' ? (
          <DesignSurface
            onOpenPalette={() => null}
            onCircuitMutated={handleDesignMutation}
            compilerStatus={designCompilerStatus}
          />
        ) : currentMode === 'verify' ? (
          <VerifySurface
            deterministicHash={determinismHash}
            hasVectors={projectVectors.length > 0}
            vectors={projectVectors}
            mappedInputs={verifyMappedInputs}
            onVectorsChange={handleVectorsChange}
            onVerificationComplete={handleVerificationComplete}
            onOpenProjectVectors={() => setCurrentMode('project')}
            onFixPath={handleVerifyFixPath}
          />
        ) : currentMode === 'export' ? (
          <ExportSurface project={exportProject} onExportResult={handleExportResult} />
        ) : (
          <ImportSurface />
        )}
      </div>

      {pendingExample ? (
        <IdeModal
          title="Replace current workspace with example?"
          body={
            <p className="ide-copy">
              Opening <strong>{pendingExample.name}</strong> replaces the current workspace state.
              Continue only if you want to discard unsaved progress.
            </p>
          }
          actions={
            <>
              <IdeButton tone="ghost" onClick={handleCancelExampleReplace} testId="ide-example-cancel">
                Keep current project
              </IdeButton>
              <IdeButton tone="danger" onClick={handleConfirmExampleReplace} testId="ide-example-confirm">
                Replace with example
              </IdeButton>
            </>
          }
          onClose={handleCancelExampleReplace}
          testId="ide-example-confirm-modal"
        />
      ) : null}

      <IdeStatusBar mode={currentMode} determinismHash={determinismHash} gateStatus="warn" />
    </div>
  );
};

function resolveInitialIdeMode(): IdeMode {
  if (typeof window === 'undefined') return 'project';
  const requestedMode = new URLSearchParams(window.location.search).get('mode')?.trim().toLowerCase();
  switch (requestedMode) {
    case 'project':
    case 'design':
    case 'verify':
    case 'export':
    case 'import':
      return requestedMode;
    default:
      return 'project';
  }
}

function normalizeSignalKey(value: string): string {
  return value.trim().toLowerCase().replace(/\[[^\]]+\]/g, '');
}

function suggestBasys3Pin(signal: { id: string; direction: 'in' | 'out' }, index: number): string {
  if (signal.direction === 'in') {
    if (signal.id.toLowerCase() === 'clk') return 'CLK100MHZ';
    return `SW${Math.min(index, 15)}`;
  }
  return `LD${Math.min(index, 15)}`;
}

function cloneIoRows(rows: IdeExampleIoRow[]): IdeExampleIoRow[] {
  return rows.map((row) => ({ ...row }));
}

function cloneVectors(vectors: TestVector[]): TestVector[] {
  return vectors.map((vector) => ({ ...vector }));
}

function buildProjectCircuit(projectIoRows: ProjectIoRow[]): RBProject['circuit'] {
  const inputRows = projectIoRows.filter((row) => row.direction === 'in');
  const outputRows = projectIoRows.filter((row) => row.direction === 'out');

  const inputNodes = inputRows.map((row, index) => ({
    id: row.nodeId,
    type: 'INPUT',
    x: 96,
    y: 96 + index * 72,
    label: row.label,
    config: {},
    state: {},
  }));

  const outputNodes = outputRows.map((row, index) => ({
    id: row.nodeId,
    type: 'OUTPUT',
    x: 520,
    y: 96 + index * 72,
    label: row.label,
    config: {},
    state: {},
  }));

  return {
    nodes: [...inputNodes, ...outputNodes],
    connections: [],
  };
}

function buildTopEntityName(projectName: string): string {
  const normalized = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = normalized.length > 0 ? normalized : 'redbyte_top';
  return /^[a-z]/.test(base) ? base : `rb_${base}`;
}

function buildVhdlFromMapping(topName: string, ioRows: ProjectIoRow[]): string {
  const inputRows = ioRows.filter((row) => row.direction === 'in');
  const outputRows = ioRows.filter((row) => row.direction === 'out');

  const inputSignals = inputRows.map((row, index) => createSignalName(row.label || row.id, `in_${index}`));
  const outputSignals = outputRows.map((row, index) => createSignalName(row.label || row.id, `out_${index}`));

  const portLines: string[] = [];
  for (let index = 0; index < inputSignals.length; index++) {
    portLines.push(`    ${inputSignals[index]} : in  std_logic;`);
  }
  for (let index = 0; index < outputSignals.length; index++) {
    const suffix = index === outputSignals.length - 1 ? '' : ';';
    portLines.push(`    ${outputSignals[index]} : out std_logic${suffix}`);
  }

  const sourceSignal = inputSignals[0] ?? "'0'";
  const assignmentLines =
    outputSignals.length > 0
      ? outputSignals.map((signal) => `  ${signal} <= ${sourceSignal};`)
      : ['  -- No output ports declared yet.'];

  return [
    'library IEEE;',
    'use IEEE.STD_LOGIC_1164.ALL;',
    '',
    `entity ${topName} is`,
    '  port (',
    ...(portLines.length > 0
      ? portLines
      : ['    placeholder_in : in std_logic;', '    placeholder_out : out std_logic']),
    '  );',
    `end ${topName};`,
    '',
    `architecture rtl of ${topName} is`,
    'begin',
    ...assignmentLines,
    'end rtl;',
  ].join('\n');
}

function buildConstraintText(ioRows: ProjectIoRow[]): string {
  const clockRow = ioRows.find(
    (row) =>
      row.direction === 'in' &&
      /(^clk$|clock|clk100mhz)/i.test(row.label) &&
      row.pin.trim().length > 0
  );

  if (!clockRow) {
    return '# Clock constraint pending: map a clock-like input (clk/clock/clk100mhz) to CLK100MHZ.';
  }

  const clockSignal = createSignalName(clockRow.label || clockRow.id, 'clk');
  return `create_clock -name sys_clk -period 10.000 [get_ports ${clockSignal}]`;
}

function createSignalName(raw: string, fallback: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized.length === 0) return fallback;
  return /^[a-z]/.test(normalized) ? normalized : `sig_${normalized}`;
}

export default IdeApp;
