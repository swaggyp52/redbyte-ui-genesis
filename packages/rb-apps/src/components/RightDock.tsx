// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Circuit, CircuitEngine } from '@redbyte/rb-logic-core';
import type { ProofPack } from '../recording/runRecord';
import { useLogicViewStore } from '@redbyte/rb-logic-view';
import { PropertyInspector } from './PropertyInspector';
import { CircuitHealthPanel } from './CircuitHealthPanel';
import { LearnModePanel } from './LearnModePanel';
import { RunRecorderPanel } from './RunRecorderPanel';
import type { GuidedExample } from '../logic/learnMode';
import { useProbeStore } from '../stores/probeStore';
import { useLayoutStore, type LearnSubview } from '../stores/layoutStore';
import { trackRender, useUiTickStore } from '@redbyte/rb-utils';
import { HelpApp } from '../apps/HelpApp';
import { UserManualAppComponent } from '../apps/UserManualApp';
import type { ToolchainProjectInput } from '../fpga/toolchainBackend';
import { HdlEditorPanel } from './HdlEditorPanel';
import type { RBFpgaConfig } from '../export/projectFormat';

/**
 * Logic Playground vNext Right Dock
 *
 * Tabbed panel with:
 * - Inspector (selected node details, pin values, state)
 * - Probes/Scope (quick probe list + open scope)
 * - Chips (saved chips browse/insert)
 *
 * States: Collapsed / Peek / Expanded
 * Never overlaps the main stage
 */

export type RightDockTab = 'inspector' | 'health' | 'learn' | 'probes' | 'record' | 'chips' | 'io' | 'hdl';
export type RightDockState = 'collapsed' | 'peek' | 'expanded';

interface RightDockProps {
  circuit: Circuit;
  engine: CircuitEngine;
  isRunning: boolean;
  windowId?: string;
  isReplayMode?: boolean;
  onNodeUpdate?: (nodeId: string, updates: any) => void;
  onConnectionDelete?: (connectionId: string) => void;
  onRun?: () => void;
  onPause?: () => void;
  onStep?: () => void;
  onResetTickCount?: () => void;
  lastTickAt?: number | null;
  highlightProbePaths?: boolean;
  onToggleHighlightProbePaths?: (enabled: boolean) => void;

  // Health tab
  onFocusNode?: (nodeId: string, portName?: string) => void;
  onIssueHover?: (nodeId: string | null, portName?: string | null) => void;

  // Record tab
  tickCount?: number;
  tickRate?: number;
  onRecordArm?: () => void;
  onRecordStart?: () => void;
  onRecordStop?: () => void;
  onRecordReplayStart?: () => void;
  onRecordReplayStop?: () => void;
  onRecordReplayPause?: () => void;
  onRecordReplayResume?: () => void;
  onRecordReplayStep?: (ticks: number) => void;
  onRecordReplayJump?: (tick: number) => void;
  onRecordVerify?: () => void;
  onRecordExport?: () => void;
  onRecordExportProof?: () => void;
  onRecordProof?: () => void;
  onRecordFocus?: (nodeId: string, portName: string) => void;
  onRecordMismatchSelect?: (probeId: string) => void;
  onRecordImportProofPack?: (pack: ProofPack) => void;

  // Learn tab
  onLoadExample?: (example: GuidedExample) => void;
  onExitLearnMode?: () => void;
  onOpenApp?: (appId: string, props?: Record<string, unknown>) => void;

  // Chips tab
  chips?: Array<{ id: string; name: string; description?: string }>;
  onChipInsert?: (chipId: string) => void;
  onChipDelete?: (chipId: string) => void;
  onChipEdit?: (chipId: string) => void;

  // IO Tab - REMOVED: Hardware bridge deleted, students use Vivado for board programming

  // HDL Tab (experimental)
  enableHdlTab?: boolean;
  hdlProject?: ToolchainProjectInput;
  onHdlProjectChange?: (next: ToolchainProjectInput) => void;
  fpgaProject?: RBFpgaConfig;
  onFpgaProjectChange?: (next: RBFpgaConfig) => void;

  // State control
  initialTab?: RightDockTab;
  initialState?: RightDockState;
  onStateChange?: (state: RightDockState) => void;
  onTabChange?: (tab: RightDockTab) => void;
}

export const RightDock: React.FC<RightDockProps> = ({
  circuit,
  engine,
  isRunning,
  windowId,
  isReplayMode = false,
  onNodeUpdate,
  onConnectionDelete,
  onRun,
  onPause,
  onStep,
  onResetTickCount,
  lastTickAt = null,
  highlightProbePaths = true,
  onToggleHighlightProbePaths,
  onFocusNode,
  onIssueHover,
  tickCount = 0,
  tickRate = 0,
  onRecordArm,
  onRecordStart,
  onRecordStop,
  onRecordReplayStart,
  onRecordReplayStop,
  onRecordReplayPause,
  onRecordReplayResume,
  onRecordReplayStep,
  onRecordReplayJump,
  onRecordVerify,
  onRecordExport,
  onRecordExportProof,
  onRecordProof,
  onRecordFocus,
  onRecordMismatchSelect,
  onRecordImportProofPack,
  onLoadExample,
  onExitLearnMode,
  onOpenApp,
  chips = [],
  onChipInsert,
  onChipDelete,
  onChipEdit,
  enableHdlTab = false,
  hdlProject,
  onHdlProjectChange,
  fpgaProject,
  onFpgaProjectChange,
  initialTab = 'inspector',
  initialState = 'expanded',
  onStateChange,
  onTabChange,
}) => {
  trackRender('RightDock');
  const [activeTab, setActiveTab] = useState<RightDockTab>(initialTab);
  const [dockState, setDockState] = useState<RightDockState>(initialState);

  useEffect(() => {
    if (!enableHdlTab && activeTab === 'hdl') {
      setActiveTab('inspector');
    }
  }, [activeTab, enableHdlTab]);
  // Use shallow comparison to prevent re-renders when selection object reference changes but content is the same
  const rawSelection = useLogicViewStore(useShallow((state: import('@redbyte/rb-logic-view').LogicViewState) => state.selection));
  const selection = useMemo(() => ({
    nodes: rawSelection?.nodes instanceof Set ? rawSelection.nodes : new Set<string>(),
    wires: rawSelection?.wires instanceof Set ? rawSelection.wires : new Set<string>(),
  }), [rawSelection]);

  // Select each probe store property individually to maintain stable references
  // (object literals in selectors create new references on every store update, breaking Zustand's getSnapshot cache)
  const probes = useProbeStore((state) => state.probes);
  const activeProbeId = useProbeStore((state) => state.activeProbeId);
  const addProbe = useProbeStore((state) => state.addProbe);
  const removeProbe = useProbeStore((state) => state.removeProbe);
  const renameProbe = useProbeStore((state) => state.renameProbe);
  const toggleProbe = useProbeStore((state) => state.toggleProbe);
  const setActiveProbe = useProbeStore((state) => state.setActiveProbe);
  const reorderProbes = useProbeStore((state) => state.reorderProbes);
  const uiTick = useUiTickStore((state) => state.uiTick);
  const learnSubview = useLayoutStore((s) => s.learnSubview);
  const setLearnSubview = useLayoutStore((s) => s.setLearnSubview);
  const learnHelpErrorCode = useLayoutStore((s) => s.learnHelpErrorCode);

  // Clear stale errorCode after HelpApp consumes it (one render cycle)
  useEffect(() => {
    if (learnHelpErrorCode && activeTab === 'learn' && learnSubview === 'help') {
      useLayoutStore.setState({ learnHelpErrorCode: null });
    }
  }, [learnHelpErrorCode, activeTab, learnSubview]);

  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [selectedPortName, setSelectedPortName] = useState<string>('out');
  const [probeValues, setProbeValues] = useState<Record<string, number>>({});
  const [draggedProbeIndex, setDraggedProbeIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // PHASE 2C: Mount breadcrumb
  if (import.meta.env.DEV || (typeof navigator !== 'undefined' && navigator.webdriver)) {
    if (typeof window !== 'undefined' && window.__RB_MOUNT_TRACE__) {
      const timestamp = typeof performance !== 'undefined' ? performance.now().toFixed(1) : Date.now();
      window.__RB_MOUNT_TRACE__.push(`${timestamp} RightDock:render`);
    }
  }

  const selectableNodes = useMemo(
    () => circuit.nodes.map((node) => ({ id: node.id, type: node.type })),
    [circuit.nodes]
  );
  const clockNode = useMemo(
    () => circuit.nodes.find((node) => node.type === 'Clock') ?? null,
    [circuit.nodes]
  );

  const portOptions = useMemo(() => {
    if (!selectedNodeId) return [];
    const outputs = engine.getNodeOutputs(selectedNodeId);
    const ports = Object.keys(outputs);
    if (ports.length > 0) return ports;
    return ['out'];
  }, [engine, selectedNodeId]);

  useEffect(() => {
    if (portOptions.length === 0) return;
    if (!portOptions.includes(selectedPortName)) {
      setSelectedPortName(portOptions[0]);
    }
  }, [portOptions, selectedPortName]);

  // PHASE 1.5: DEV-only fault injection for ISSUE-C validation (pointer events)
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const faultType = params.get('fault');

    if (faultType === 'pointer-block') {
      // Block pointer events on tab buttons to make them un-clickable
      console.warn('[FAULT INJECTION] ISSUE-C: pointer-block - expect tab clicks to fail');

      const style = document.createElement('style');
      style.textContent = `
        [data-testid^="rightdock-tab-"] {
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.head.removeChild(style);
      };
    }

    if (faultType === 'hitbox-small') {
      // Make hit box for tab text too small (only icon clickable)
      console.warn('[FAULT INJECTION] ISSUE-C: hitbox-small - expect tab text clicks to fail');

      const style = document.createElement('style');
      style.textContent = `
        [data-testid^="rightdock-tab-"] span {
          width: 8px;
          height: 8px;
          display: block;
          overflow: hidden;
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);


  useEffect(() => {
    const firstSelected = Array.from(selection.nodes)[0];
    if (!firstSelected) return;
    setSelectedNodeId(firstSelected);
  }, [selection.nodes]);

  useEffect(() => {
    if (probes.length === 0) {
      setProbeValues({});
      return;
    }
    if (isRunning) return;
    const nextValues: Record<string, number> = {};
    probes.forEach((probe) => {
      const outputs = engine.getNodeOutputs(probe.nodeId);
      const value = outputs[probe.portName] ?? 0;
      nextValues[probe.id] = value;
    });
    setProbeValues(nextValues);
  }, [engine, probes, isRunning, circuit]);

  useEffect(() => {
    if (!isRunning) return;
    if (probes.length === 0) {
      setProbeValues({});
      return;
    }
    const nextValues: Record<string, number> = {};
    probes.forEach((probe) => {
      const outputs = engine.getNodeOutputs(probe.nodeId);
      const value = outputs[probe.portName] ?? 0;
      nextValues[probe.id] = value;
    });
    setProbeValues(nextValues);
  }, [engine, probes, isRunning, uiTick, circuit]);

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    setDockState(initialState);
  }, [initialState]);

  const handleStateToggle = () => {
    const nextState: RightDockState =
      dockState === 'collapsed' ? 'peek' : dockState === 'peek' ? 'expanded' : 'collapsed';
    setDockState(nextState);
    onStateChange?.(nextState);
  };

  const handleTabChange = (tab: RightDockTab) => {
    if (tab === 'hdl' && !enableHdlTab) return;
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const handleAddProbe = () => {
    if (!selectedNodeId || !selectedPortName) return;
    const node = circuit.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    addProbe({
      nodeId: selectedNodeId,
      portName: selectedPortName,
      label: `${node.type} ${selectedPortName}`,
    });
  };

  const handleProbeSelect = (probeId: string) => {
    const probe = probes.find((item) => item.id === probeId);
    if (!probe) return;
    setActiveProbe(probeId);
  };

  const handleAddClockProbe = () => {
    if (!clockNode) return;
    addProbe({
      nodeId: clockNode.id,
      portName: 'out',
      label: 'Clock out',
    });
  };

  const handleAddFirstProbe = () => {
    if (selectableNodes.length === 0) return;
    const node = selectableNodes[0];
    const outputs = engine.getNodeOutputs(node.id);
    const portName = outputs[0] ?? 'out';
    setSelectedNodeId(node.id);
    setSelectedPortName(portName);
    addProbe({
      nodeId: node.id,
      portName,
      label: `${node.type} ${portName}`,
    });
  };

  if (dockState === 'collapsed') {
    return (
      <div className="w-14 border-l border-[#1B2028] bg-[#0D1117] flex flex-col items-center py-4 gap-4">
        {/* Collapsed tabs - vertical icons */}
        <button
          onClick={() => {
            handleTabChange('inspector');
            setDockState('peek');
          }}
          className="w-10 h-10 rounded hover:bg-[#161B22] transition-colors flex items-center justify-center"
          title="Inspector"
          type="button"
        >
          <span className="text-xl">🔍</span>
        </button>
        <button
          onClick={() => {
            handleTabChange('health');
            setDockState('peek');
          }}
          className="w-10 h-10 rounded hover:bg-[#161B22] transition-colors flex items-center justify-center"
          title="Health"
          type="button"
        >
          <span className="text-xl">💊</span>
        </button>
        <button
          onClick={() => {
            handleTabChange('learn');
            setDockState('peek');
          }}
          className="w-10 h-10 rounded hover:bg-[#161B22] transition-colors flex items-center justify-center"
          title="Learn"
          type="button"
        >
          <span className="text-xl">🎓</span>
        </button>
        <button
          onClick={() => {
            handleTabChange('probes');
            setDockState('peek');
          }}
          className="w-10 h-10 rounded hover:bg-[#161B22] transition-colors flex items-center justify-center"
          title="Probes"
          type="button"
        >
          <span className="text-xl">📊</span>
        </button>
        <button
          onClick={() => {
            handleTabChange('record');
            setDockState('peek');
          }}
          className="w-10 h-10 rounded hover:bg-[#161B22] transition-colors flex items-center justify-center"
          title="Record"
          type="button"
        >
          <span className="text-xl">⏺️</span>
        </button>
        <button
          onClick={() => {
            handleTabChange('chips');
            setDockState('peek');
          }}
          className="w-10 h-10 rounded hover:bg-[#161B22] transition-colors flex items-center justify-center"
          title="Chips"
          type="button"
        >
          <span className="text-xl">🧩</span>
        </button>
      </div>
    );
  }

  const width = dockState === 'peek' ? 'w-80' : 'w-96';

  return (
    <div className={`${width} border-l border-[#1B2028] bg-[#0D1117] flex flex-col transition-all duration-200 shrink-0`} data-testid="right-dock">
      {/* Tab Bar */}
      <div 
        className="flex items-center bg-[#0D1117] border-b border-[#1B2028]"
        style={{
          height: 'calc(48px * var(--rb-ui-scale, 1))'
        }}
      >
        <div 
          className="flex-1 flex items-stretch h-full gap-1" 
          role="tablist"
          style={{
            paddingLeft: 'var(--rb-space-2, 0.5rem)',
            paddingRight: 'var(--rb-space-2, 0.5rem)'
          }}
        >
          <button
            onClick={() => handleTabChange('inspector')}
            className={`flex-1 h-full w-full rounded font-medium transition-all flex items-center justify-center cursor-pointer ${activeTab === 'inspector'
              ? 'text-[#E6EDF3] border-b-2 border-[#D4930D] shadow-[0_2px_8px_rgba(212,147,13,0.2)]'
              : 'text-[#6E7681] hover:text-[#E6EDF3] hover:bg-[#161B22]'
              }`}
            aria-label="Inspector"
            aria-selected={activeTab === 'inspector' ? 'true' : 'false'}
            role="tab"
            tabIndex={activeTab === 'inspector' ? 0 : -1}
            data-testid="rightdock-tab-inspector"
            type="button"
            style={{
              paddingLeft: 'var(--rb-space-3, 0.75rem)',
              paddingRight: 'var(--rb-space-3, 0.75rem)',
              gap: 'var(--r b-space-1, 0.375rem)',
              fontSize: 'var(--rb-text-xs, 0.75rem)'
            }}
          >
            <span className="mr-1 pointer-events-none select-none">🔍</span>
            <span className="pointer-events-none select-none">Info</span>
          </button>
          <button
            onClick={() => handleTabChange('health')}
            className={`flex-1 h-full w-full rounded font-medium transition-all flex items-center justify-center cursor-pointer ${activeTab === 'health'
              ? 'text-[#E6EDF3] border-b-2 border-[#D4930D] shadow-[0_2px_8px_rgba(212,147,13,0.2)]'
              : 'text-[#6E7681] hover:text-[#E6EDF3] hover:bg-[#161B22]'
              }`}
            aria-label="Health"
            aria-selected={activeTab === 'health' ? 'true' : 'false'}
            role="tab"
            tabIndex={activeTab === 'health' ? 0 : -1}
            data-testid="rightdock-tab-health"
            type="button"
            style={{
              paddingLeft: 'var(--rb-space-3, 0.75rem)',
              paddingRight: 'var(--rb-space-3, 0.75rem)',
              gap: 'var(--rb-space-1, 0.375rem)',
              fontSize: 'var(--rb-text-xs, 0.75rem)'
            }}
          >
            <span className="mr-1 pointer-events-none select-none">💊</span>
            <span className="pointer-events-none select-none">Health</span>
          </button>
          <button
            onClick={() => handleTabChange('learn')}
            className={`flex-1 h-full w-full rounded font-medium transition-all flex items-center justify-center cursor-pointer ${activeTab === 'learn'
              ? 'text-[#E6EDF3] border-b-2 border-[#D4930D] shadow-[0_2px_8px_rgba(212,147,13,0.2)]'
              : 'text-[#6E7681] hover:text-[#E6EDF3] hover:bg-[#161B22]'
              }`}
            aria-label="Learn"
            aria-selected={activeTab === 'learn' ? 'true' : 'false'}
            role="tab"
            tabIndex={activeTab === 'learn' ? 0 : -1}
            data-testid="rightdock-tab-learn"
            type="button"
            style={{
              paddingLeft: 'var(--rb-space-3, 0.75rem)',
              paddingRight: 'var(--rb-space-3, 0.75rem)',
              gap: 'var(--rb-space-1, 0.375rem)',
              fontSize: 'var(--rb-text-xs, 0.75rem)'
            }}
          >
            <span className="mr-1 pointer-events-none select-none">🎓</span>
            <span className="pointer-events-none select-none">Learn</span>
          </button>
          <button
            onClick={() => handleTabChange('probes')}
            className={`flex-1 h-full w-full rounded font-medium transition-all flex items-center justify-center cursor-pointer ${activeTab === 'probes'
              ? 'text-[#E6EDF3] border-b-2 border-[#D4930D] shadow-[0_2px_8px_rgba(212,147,13,0.2)]'
              : 'text-[#6E7681] hover:text-[#E6EDF3] hover:bg-[#161B22]'
              }`}
            aria-label="Probes"
            aria-selected={activeTab === 'probes' ? 'true' : 'false'}
            role="tab"
            tabIndex={activeTab === 'probes' ? 0 : -1}
            data-testid="rightdock-tab-probes"
            type="button"
            style={{
              paddingLeft: 'var(--rb-space-3, 0.75rem)',
              paddingRight: 'var(--rb-space-3, 0.75rem)',
              gap: 'var(--rb-space-1, 0.375rem)',
              fontSize: 'var(--rb-text-xs, 0.75rem)'
            }}
          >
            <span className="mr-1 pointer-events-none select-none">📊</span>
            <span className="pointer-events-none select-none">Probes</span>
          </button>
          <button
            onClick={() => handleTabChange('record')}
            className={`flex-1 h-full w-full rounded font-medium transition-all flex items-center justify-center cursor-pointer ${activeTab === 'record'
              ? 'text-[#E6EDF3] border-b-2 border-[#D4930D] shadow-[0_2px_8px_rgba(212,147,13,0.2)]'
              : 'text-[#6E7681] hover:text-[#E6EDF3] hover:bg-[#161B22]'
              }`}
            aria-label="Record"
            aria-selected={activeTab === 'record' ? 'true' : 'false'}
            role="tab"
            tabIndex={activeTab === 'record' ? 0 : -1}
            data-testid="rightdock-tab-record"
            type="button"
            style={{
              paddingLeft: 'var(--rb-space-3, 0.75rem)',
              paddingRight: 'var(--rb-space-3, 0.75rem)',
              gap: 'var(--rb-space-1, 0.375rem)',
              fontSize: 'var(--rb-text-xs, 0.75rem)'
            }}
          >
            <span className="mr-1 pointer-events-none select-none">⏺️</span>
            <span className="pointer-events-none select-none">Record</span>
          </button>

          <button
            onClick={() => handleTabChange('chips')}
            className={`flex-1 h-full w-full rounded font-medium transition-all flex items-center justify-center cursor-pointer ${activeTab === 'chips'
              ? 'text-[#E6EDF3] border-b-2 border-[#D4930D] shadow-[0_2px_8px_rgba(212,147,13,0.2)]'
              : 'text-[#6E7681] hover:text-[#E6EDF3] hover:bg-[#161B22]'
              }`}
            aria-label="Chips"
            aria-selected={activeTab === 'chips' ? 'true' : 'false'}
            role="tab"
            tabIndex={activeTab === 'chips' ? 0 : -1}
            data-testid="rightdock-tab-chips"
            type="button"
            style={{
              paddingLeft: 'var(--rb-space-3, 0.75rem)',
              paddingRight: 'var(--rb-space-3, 0.75rem)',
              gap: 'var(--rb-space-1, 0.375rem)',
              fontSize: 'var(--rb-text-xs, 0.75rem)'
            }}
          >
            <span className="mr-1 pointer-events-none select-none">🧩</span>
            <span className="pointer-events-none select-none">Chips</span>
          </button>
          {enableHdlTab && (
            <button
              onClick={() => handleTabChange('hdl')}
              className={`flex-1 h-full w-full rounded font-medium transition-all flex items-center justify-center cursor-pointer ${activeTab === 'hdl'
                ? 'text-[#E6EDF3] border-b-2 border-[#D4930D] shadow-[0_2px_8px_rgba(212,147,13,0.2)]'
                : 'text-[#6E7681] hover:text-[#E6EDF3] hover:bg-[#161B22]'
                }`}
              aria-label="HDL"
              aria-selected={activeTab === 'hdl' ? 'true' : 'false'}
              role="tab"
              tabIndex={activeTab === 'hdl' ? 0 : -1}
              data-testid="rightdock-tab-hdl"
              type="button"
              style={{
                paddingLeft: 'var(--rb-space-3, 0.75rem)',
                paddingRight: 'var(--rb-space-3, 0.75rem)',
                gap: 'var(--rb-space-1, 0.375rem)',
                fontSize: 'var(--rb-text-xs, 0.75rem)'
              }}
            >
              <span className="mr-1 pointer-events-none select-none">{'</>'}</span>
              <span className="pointer-events-none select-none">HDL</span>
            </button>
          )}
          <button
            onClick={() => handleTabChange('io')}
            className={`flex-1 h-full w-full rounded font-medium transition-all flex items-center justify-center cursor-pointer ${activeTab === 'io'
              ? 'text-[#E6EDF3] border-b-2 border-[#D4930D] shadow-[0_2px_8px_rgba(212,147,13,0.2)]'
              : 'text-[#6E7681] hover:text-[#E6EDF3] hover:bg-[#161B22]'
              }`}
            aria-label="IO"
            aria-selected={activeTab === 'io' ? 'true' : 'false'}
            role="tab"
            tabIndex={activeTab === 'io' ? 0 : -1}
            data-testid="rightdock-tab-io"
            type="button"
            style={{
              paddingLeft: 'var(--rb-space-3, 0.75rem)',
              paddingRight: 'var(--rb-space-3, 0.75rem)',
              gap: 'var(--rb-space-1, 0.375rem)',
              fontSize: 'var(--rb-text-xs, 0.75rem)'
            }}
          >
            <span className="mr-1 pointer-events-none select-none">🔌</span>
            <span className="pointer-events-none select-none">IO</span>
          </button>
        </div>

        {/* Dock state toggle - OUTSIDE tablist */}
        <button
          onClick={handleStateToggle}
          className="h-full px-2 text-[#6E7681] hover:text-[#E6EDF3] hover:bg-[#161B22] rounded transition-colors"
          title={dockState === 'peek' ? 'Expand' : 'Collapse'}
          type="button"
          aria-label={dockState === 'peek' ? 'Expand Dock' : 'Collapse Dock'}
        >
          {dockState === 'peek' ? '→' : '←'}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'inspector' && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1B2028]/60 bg-[#0D1117]/80">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[#6E7681]">
                    Clock
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs font-mono">
                    <span className="text-[#22D3EE]">t{tickCount}</span>
                    <span
                      className={`text-[10px] ${isRunning ? 'text-green-400' : tickCount === 0 ? 'text-[#8B949E]' : 'text-yellow-300'
                        }`}
                    >
                      {isRunning ? 'Running' : tickCount === 0 ? 'Stopped' : 'Paused'}
                    </span>
                    <span className="text-[10px] text-[#8B949E]">
                      {isRunning ? `${tickRate}Hz` : 'Manual'}
                    </span>
                  </div>
                  {lastTickAt && (
                    <div className="mt-1 text-[10px] text-[#6E7681]">
                      Last step {new Date(lastTickAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {onStep && (
                    <button
                      onClick={onStep}
                      className="px-2 py-1 text-[10px] rounded border border-[#22D3EE]/40 text-[#22D3EE] hover:bg-[#22D3EE]/10"
                      type="button"
                      title="Advance one tick"
                    >
                      Step
                    </button>
                  )}
                  {onRun && onPause && (
                    <button
                      onClick={isRunning ? onPause : onRun}
                      className={`px-2 py-1 text-[10px] rounded border ${isRunning
                        ? 'border-yellow-500/50 text-yellow-200 hover:bg-yellow-500/20'
                        : 'border-green-500/50 text-green-200 hover:bg-green-500/20'
                        }`}
                      type="button"
                    >
                      {isRunning ? 'Pause' : 'Run'}
                    </button>
                  )}
                  {onResetTickCount && (
                    <button
                      onClick={onResetTickCount}
                      className="px-2 py-1 text-[10px] rounded border border-[#2D333B] text-[#8B949E] hover:bg-[#161B22]/60"
                      type="button"
                      title="Reset tick counter"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <PropertyInspector
                circuit={circuit}
                engine={engine}
                isRunning={isRunning}
                windowId={windowId}
                isReplayMode={isReplayMode}
                onNodeUpdate={onNodeUpdate}
                onConnectionDelete={onConnectionDelete}
              />
            </div>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="h-full overflow-y-auto">
            <CircuitHealthPanel
              circuit={circuit}
              onFocusNode={onFocusNode}
              onIssueHover={onIssueHover}
            />
          </div>
        )}

        {activeTab === 'learn' && (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Learn subview selector */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-[#1B2028]/60 bg-[#0D1117]/80">
              {(['lessons', 'help', 'manual'] as const).map((sv) => (
                <button
                  key={sv}
                  type="button"
                  onClick={() => setLearnSubview(sv)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    learnSubview === sv
                      ? 'text-[#E6EDF3] border-b-2 border-[#D4930D]'
                      : 'text-[#6E7681] hover:text-[#E6EDF3] hover:bg-[#161B22]'
                  }`}
                >
                  {sv === 'lessons' ? 'Lessons' : sv === 'help' ? 'Help' : 'Manual'}
                </button>
              ))}
            </div>
            {/* Subview content */}
            <div className="flex-1 overflow-hidden">
              {learnSubview === 'lessons' && (
                <LearnModePanel
                  circuit={circuit}
                  onLoadExample={onLoadExample}
                  onExitLearnMode={onExitLearnMode}
                />
              )}
              {learnSubview === 'help' && (
                <HelpApp initialErrorCode={learnHelpErrorCode ?? undefined} />
              )}
              {learnSubview === 'manual' && (
                <UserManualAppComponent onOpenApp={onOpenApp} />
              )}
            </div>
          </div>
        )}

        {activeTab === 'probes' && (
          <div className="h-full p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#E6EDF3]">Signal Probes</h3>
              <span className="text-[10px] text-[#6E7681]">Live values</span>
            </div>
            <label className="flex items-center justify-between text-[10px] text-[#8B949E] bg-[#161B22]/40 border border-[#1B2028]/60 rounded px-2 py-1">
              <span>Highlight probed paths</span>
              <input
                type="checkbox"
                checked={highlightProbePaths}
                onChange={(e) => onToggleHighlightProbePaths?.(e.target.checked)}
                className="w-3 h-3"
              />
            </label>

            <div className="space-y-2">
              <select
                value={selectedNodeId}
                onChange={(e) => setSelectedNodeId(e.target.value)}
                className="w-full px-2 py-1 bg-[#161B22] rounded border border-[#1B2028] text-xs"
                aria-label="Select node to probe"
              >
                <option value="">Select node...</option>
                {selectableNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.type} ({node.id.slice(0, 8)})
                  </option>
                ))}
              </select>

              <select
                value={selectedPortName}
                onChange={(e) => setSelectedPortName(e.target.value)}
                className="w-full px-2 py-1 bg-[#161B22] rounded border border-[#1B2028] text-xs"
                aria-label="Select port to probe"
              >
                {portOptions.map((port) => (
                  <option key={port} value={port}>
                    {port}
                  </option>
                ))}
              </select>

              <button
                onClick={handleAddProbe}
                disabled={!selectedNodeId}
                className="w-full px-2 py-1 bg-[#D4930D] hover:bg-[#E0A30E] rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                Add Probe
              </button>

              <button
                onClick={handleAddClockProbe}
                disabled={!clockNode}
                className="w-full px-2 py-1 bg-[#21262D] hover:bg-[#2D333B] rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                Add Clock Probe
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-1">
              {probes.length === 0 ? (
                <div className="text-center py-12 text-[#8B949E] space-y-2">
                  <div className="text-sm font-semibold">No probes added</div>
                  <div className="text-xs text-[#6E7681]">
                    Select a node output or add the first probe automatically.
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFirstProbe}
                    disabled={selectableNodes.length === 0}
                    className="mt-2 px-3 py-1.5 rounded bg-[#D4930D] hover:bg-[#E0A30E] text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add First Probe
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {probes.map((probe, index) => (
                    <div
                      key={probe.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedProbeIndex(index);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverIndex(index);
                      }}
                      onDragLeave={() => {
                        setDragOverIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedProbeIndex !== null && draggedProbeIndex !== index) {
                          reorderProbes(draggedProbeIndex, index);
                        }
                        setDraggedProbeIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedProbeIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={`rounded border p-3 transition-colors cursor-move ${draggedProbeIndex === index
                        ? 'opacity-50'
                        : dragOverIndex === index
                          ? 'border-[#D4930D] bg-[#D4930D]/30'
                          : activeProbeId === probe.id
                            ? 'border-[#D4930D]/60 bg-[#D4930D]/20'
                            : 'border-[#1B2028]/50 bg-[#161B22]/50 hover:bg-[#161B22]/80'
                        }`}
                      onClick={() => handleProbeSelect(probe.id)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col items-center gap-0.5 pt-1 cursor-grab active:cursor-grabbing text-[#6E7681] hover:text-[#8B949E]">
                          <div className="w-1 h-1 bg-current rounded-full" />
                          <div className="w-1 h-1 bg-current rounded-full" />
                          <div className="w-1 h-1 bg-current rounded-full" />
                        </div>
                        <div
                          className="mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: probe.color }}
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            value={probe.label}
                            onChange={(e) => renameProbe(probe.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-transparent text-sm font-medium text-white outline-none"
                            aria-label="Probe label"
                          />
                          <div className="text-[10px] text-[#8B949E] font-mono truncate">
                            {probe.nodeId} - {probe.portName}
                          </div>
                        </div>
                        <div
                          className={`px-2 py-1 text-xs rounded font-mono ${probeValues[probe.id] === 1
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-[#21262D]/50 text-[#8B949E]'}`}
                        >
                          {probeValues[probe.id] ?? 0}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] text-[#8B949E] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={probe.enabled}
                            onChange={() => toggleProbe(probe.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3 h-3"
                          />
                          Enabled
                        </label>
                        <div className="flex-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeProbe(probe.id);
                          }}
                          className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'record' && (
          <div className="h-full overflow-y-auto">
            <RunRecorderPanel
              circuit={circuit}
              isRunning={isRunning}
              currentTick={tickCount}
              tickRate={tickRate}
              onArm={onRecordArm ?? (() => { })}
              onStartRecording={onRecordStart ?? (() => { })}
              onStopRecording={onRecordStop ?? (() => { })}
              onStartReplay={onRecordReplayStart ?? (() => { })}
              onStopReplay={onRecordReplayStop ?? (() => { })}
              onPauseReplay={onRecordReplayPause ?? (() => { })}
              onResumeReplay={onRecordReplayResume ?? (() => { })}
              onStepReplay={onRecordReplayStep ?? (() => { })}
              onJumpReplay={onRecordReplayJump ?? (() => { })}
              onVerify={onRecordVerify ?? (() => { })}
              onExport={onRecordExport ?? (() => { })}
              onExportProof={onRecordExportProof ?? (() => { })}
              onRecordProof={onRecordProof ?? (() => { })}
              onFocusTarget={onRecordFocus ?? (() => { })}
              onMismatchSelect={onRecordMismatchSelect ?? (() => { })}
              onImportProofPack={onRecordImportProofPack ?? (() => { })}
            />
          </div>
        )}

        {activeTab === 'chips' && (
          <div className="h-full p-4">
            <h3 className="text-sm font-semibold text-[#E6EDF3] mb-4">Saved Chips</h3>

            {chips.length === 0 ? (
              <div className="text-center py-12 text-[#8B949E]">
                <div className="text-4xl mb-2">🧩</div>
                <div className="text-sm">No saved chips</div>
                <div className="text-xs text-[#6E7681] mt-2">
                  Build a circuit and save it as a chip
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {chips.map((chip) => (
                  <div
                    key={chip.id}
                    className="bg-[#161B22]/50 rounded p-3 hover:bg-[#21262D]/50 transition-colors cursor-pointer"
                    onClick={() => onChipInsert?.(chip.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-white">{chip.name}</div>
                      <div className="flex gap-1">
                        {onChipEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChipEdit(chip.id);
                            }}
                            className="px-2 py-1 text-xs text-[#D4930D] hover:text-[#22D3EE] hover:bg-[#22D3EE]/10 rounded transition-colors"
                          >
                            Edit
                          </button>
                        )}
                        {onChipDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChipDelete(chip.id);
                            }}
                            className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    {chip.description && (
                      <div className="text-xs text-[#8B949E]">{chip.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {enableHdlTab && activeTab === 'hdl' && (
          <div className="h-full overflow-hidden">
            {hdlProject && onHdlProjectChange ? (
              <HdlEditorPanel
                project={hdlProject}
                onProjectChange={onHdlProjectChange}
                fpga={fpgaProject}
                onFpgaChange={onFpgaProjectChange}
              />
            ) : (
              <div className="p-4 text-center text-[#8B949E] text-sm">HDL project data not available</div>
            )}
          </div>
        )}
        {activeTab === 'io' && (
          <div className="h-full overflow-y-auto p-6">
            <div className="text-center space-y-4">
              <div className="text-2xl">🔌</div>
              <h3 className="text-lg font-semibold text-[#E6EDF3]">Board Programming Removed</h3>
              <p className="text-sm text-[#8B949E] max-w-md mx-auto">
                RedByte focuses on circuit design and VHDL export.
                To program your Basys-3 board, use the <strong>Export</strong> tab
                to copy your VHDL and XDC files, then paste them into AMD Vivado.
              </p>
              <div className="mt-6 p-4 bg-[#161B22] border border-[#30363D] rounded text-left text-xs text-[#8B949E]">
                <div className="font-semibold text-[#E6EDF3] mb-2">Workflow:</div>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Design your circuit in RedByte</li>
                  <li>Click <strong>Export</strong> tab → Copy VHDL + XDC</li>
                  <li>Open AMD Vivado → Create Project</li>
                  <li>Add files → Paste VHDL + XDC</li>
                  <li>Synthesize → Generate Bitstream → Program Board</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
