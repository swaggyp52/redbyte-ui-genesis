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
import { ProjectSurface } from './ide/surfaces/ProjectSurface';
import { DesignSurface } from './ide/surfaces/DesignSurface';
import { VerifySurface } from './ide/surfaces/VerifySurface';
import { ExportSurface } from './ide/surfaces/ExportSurface';
import { ImportSurface } from './ide/surfaces/ImportSurface';
import {
  choosePrimaryProjectCta,
  deriveProjectHealth,
  type ProjectHealthCore,
  type ProjectHealthExportResult,
  type ProjectHealthVerifyResult,
} from './ide/projectHealth';

interface ProjectIoRow {
  id: string;
  nodeId: string;
  port: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
}

const INITIAL_IO_ROWS: ProjectIoRow[] = [
  {
    id: 'clk',
    nodeId: 'clk_node',
    port: 'out',
    label: 'clk',
    direction: 'in',
    pin: 'CLK100MHZ',
    required: true,
  },
  {
    id: 'rst',
    nodeId: 'rst_node',
    port: 'out',
    label: 'rst',
    direction: 'in',
    pin: 'SW0',
    required: true,
  },
  {
    id: 'count_en',
    nodeId: 'count_en_node',
    port: 'out',
    label: 'count_en',
    direction: 'in',
    pin: 'SW1',
    required: true,
  },
  {
    id: 'q0',
    nodeId: 'q0_node',
    port: 'in',
    label: 'q0',
    direction: 'out',
    pin: 'LD0',
    required: true,
  },
  {
    id: 'q1',
    nodeId: 'q1_node',
    port: 'in',
    label: 'q1',
    direction: 'out',
    pin: 'LD1',
    required: true,
  },
  {
    id: 'q2',
    nodeId: 'q2_node',
    port: 'in',
    label: 'q2',
    direction: 'out',
    pin: 'LD2',
    required: true,
  },
];

export const IdeApp: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<IdeMode>('project');
  const [projectName] = useState('Basys3 Design');
  const [projectDescription] = useState('Deterministic student FPGA workspace');
  const [lastSavedAt] = useState('2026-02-19 15:10');
  const [projectIoRows, setProjectIoRows] = useState<ProjectIoRow[]>(INITIAL_IO_ROWS);
  const [projectVectors, setProjectVectors] = useState<TestVector[]>([]);
  const [projectHealthCore, setProjectHealthCore] = useState<ProjectHealthCore>({
    dirtySinceVerify: false,
    dirtySinceExport: false,
  });
  const [saveState] = useState<'saved' | 'unsaved' | 'autosaving'>('saved');

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

  const exportProject = useMemo<RBProject>(
    () => ({
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-02-19T00:00:00.000Z',
      updatedAt: '2026-02-19T00:00:00.000Z',
      name: projectName,
      description: projectDescription,
      circuit: {
        nodes: [
          { id: 'clk_node', type: 'Clock', x: 96, y: 80, label: 'clk', config: {}, state: {} },
          { id: 'rst_node', type: 'Switch', x: 96, y: 148, label: 'rst', config: {}, state: {} },
          { id: 'count_en_node', type: 'Switch', x: 96, y: 216, label: 'count_en', config: {}, state: {} },
          { id: 'q0_node', type: 'Lamp', x: 520, y: 132, label: 'q0', config: {}, state: {} },
          { id: 'q1_node', type: 'Lamp', x: 520, y: 200, label: 'q1', config: {}, state: {} },
          { id: 'q2_node', type: 'Lamp', x: 520, y: 268, label: 'q2', config: {}, state: {} },
        ],
        connections: [],
      },
      hdl: {
        top: 'counter_top',
        sources: [
          {
            path: 'top.vhd',
            language: 'vhdl',
            text: [
              'library IEEE;',
              'use IEEE.STD_LOGIC_1164.ALL;',
              '',
              'entity counter_top is',
              '  port (',
              '    clk      : in  std_logic;',
              '    rst      : in  std_logic;',
              '    count_en : in  std_logic;',
              '    q0       : out std_logic;',
              '    q1       : out std_logic;',
              '    q2       : out std_logic',
              '  );',
              'end counter_top;',
              '',
              'architecture rtl of counter_top is',
              'begin',
              "  q0 <= count_en;",
              "  q1 <= rst;",
              "  q2 <= clk;",
              'end rtl;',
            ].join('\n'),
          },
        ],
      },
      fpga: {
        board: 'basys3',
        top: 'counter_top',
        constraints: {
          type: 'xdc',
          text: 'create_clock -name sys_clk -period 10.000 [get_ports clk]',
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
    [projectDescription, projectIoRows, projectName, projectVectors]
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
        exportProject.circuit.nodes.find((node) => node.type === 'Lamp' || node.type === 'OUTPUT');

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
          <DesignSurface onOpenPalette={() => null} onCircuitMutated={handleDesignMutation} />
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

      <IdeStatusBar mode={currentMode} determinismHash={determinismHash} gateStatus="warn" />
    </div>
  );
};

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

export default IdeApp;
