// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// IdeApp - IDE-first shell surface with deterministic mode markers.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLogicViewStore } from '@redbyte/rb-logic-view';
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

export const IdeApp: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<IdeMode>('project');
  const [projectName] = useState('Basys3 Design');
  const [projectDescription] = useState('Deterministic student FPGA workspace');
  const [lastSavedAt] = useState('2026-02-19 15:10');
  const [projectReadiness, setProjectReadiness] = useState({
    hasCircuit: true,
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
    vectors: [
      { id: 'vec-01', tick: 12, inputs: { clk: 0, rst: 0 }, expected: {} },
      { id: 'vec-02', tick: 13, inputs: { clk: 1, rst: 0 }, expected: {} },
      { id: 'vec-03', tick: 14, inputs: { clk: 0, rst: 1 }, expected: {} },
    ] as Array<{
      id: string;
      tick: number;
      inputs: Record<string, number>;
      expected: Record<string, number>;
    }>,
    lastVerify: null as { pass: boolean; failedCount: number } | null,
  });
  const [saveState] = useState<'saved' | 'unsaved' | 'autosaving'>('saved');

  const determinismHash = useMemo(() => '2f4e0bb0f17ac4d2', []);
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
        inputs: [
          { id: 'clk', nodeId: 'clk_node', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
          { id: 'rst', nodeId: 'rst_node', port: 'out', label: 'rst', pin: 'SW0' },
          { id: 'count_en', nodeId: 'count_en_node', port: 'out', label: 'count_en', pin: '' },
          { id: 'unused_btn', nodeId: 'unused_btn_node', port: 'out', label: 'unused_btn', pin: 'SW2' },
        ],
        outputs: [
          { id: 'q0', nodeId: 'q0_node', port: 'in', label: 'q0', pin: 'LD0' },
          { id: 'q1', nodeId: 'q1_node', port: 'in', label: 'q1', pin: 'LD1' },
          { id: 'q2', nodeId: 'q2_node', port: 'in', label: 'q2', pin: '' },
        ],
      },
      vectors: projectReadiness.vectors,
      meta: {
        appSurface: 'ide-export',
      },
    }),
    [projectDescription, projectName, projectReadiness.vectors]
  );
  const verifyMappedInputs = useMemo(
    () =>
      (exportProject.ioMapping?.inputs ?? [])
        .filter((entry) => (entry.pin ?? '').trim().length > 0)
        .map((entry) => ({
          id: entry.label ?? entry.id,
          label: entry.label ?? entry.id,
          pin: entry.pin,
        })),
    [exportProject.ioMapping]
  );

  const handleVectorsChange = useCallback(
    (
      vectors: Array<{
        id: string;
        tick: number;
        inputs: Record<string, 0 | 1>;
        expected: Record<string, 0 | 1>;
      }>
    ) => {
      setProjectReadiness((previous) => ({
        ...previous,
        vectors,
      }));
    },
    []
  );

  const handleVerificationComplete = useCallback(
    (result: { pass: boolean; failedCount: number }) => {
      setProjectReadiness((previous) => ({
        ...previous,
        lastVerify: result,
      }));
    },
    []
  );

  const handleVerifyFixPath = useCallback(
    (signalName: string) => {
      const desiredSignal = normalizeSignalKey(signalName);
      const targetNode =
        exportProject.circuit.nodes.find(
          (node) => normalizeSignalKey(node.label ?? node.id) === desiredSignal
        ) ??
        exportProject.circuit.nodes.find(
          (node) => node.type === 'Lamp' || node.type === 'OUTPUT'
        );

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
            vectors={projectReadiness.vectors}
            mappedInputs={verifyMappedInputs}
            onVectorsChange={handleVectorsChange}
            onVerificationComplete={handleVerificationComplete}
            onOpenProjectVectors={() => setCurrentMode('project')}
            onFixPath={handleVerifyFixPath}
          />
        ) : currentMode === 'export' ? (
          <ExportSurface project={exportProject} />
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

export default IdeApp;
