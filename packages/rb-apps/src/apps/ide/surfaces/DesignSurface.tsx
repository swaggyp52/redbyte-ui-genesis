import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import { TickEngine } from '@redbyte/rb-logic-core';
import { LogicCanvas, findSmartSpawnPosition, useLogicViewStore } from '@redbyte/rb-logic-view';
import { useCircuitStore } from '../../../stores/circuitStore';
import { digestValue } from '../../../utils/digest';
import type { IdeDiagnostic, IdeDiagnosticRouteRequest } from '../diagnostics';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';

export interface DesignSurfaceProps {
  onOpenPalette?: () => void;
  onCircuitMutated?: () => void;
  compilerStatus?: DesignCompilerStatus;
  onDiagnosticAction?: (diagnostic: IdeDiagnostic) => void;
  diagnosticRouteRequest?: IdeDiagnosticRouteRequest | null;
}

export interface DesignCompilerStatus {
  dirtySinceVerify: boolean;
  dirtySinceExport: boolean;
  errorCount: number;
  warningCount: number;
  diagnostics: IdeDiagnostic[];
}

interface PaletteItem {
  type: string;
  title: string;
  category: 'IO' | 'Logic' | 'Sequential';
}

const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'INPUT', title: 'Input Pin', category: 'IO' },
  { type: 'OUTPUT', title: 'Output Pin', category: 'IO' },
  { type: 'AND', title: 'AND Gate', category: 'Logic' },
  { type: 'OR', title: 'OR Gate', category: 'Logic' },
  { type: 'XOR', title: 'XOR Gate', category: 'Logic' },
  { type: 'NOT', title: 'NOT Gate', category: 'Logic' },
  { type: 'DFlipFlop', title: 'DFF', category: 'Sequential' },
  { type: 'Clock', title: 'Clock', category: 'Sequential' },
];

export const DesignSurface: React.FC<DesignSurfaceProps> = ({
  onOpenPalette,
  onCircuitMutated,
  compilerStatus,
  onDiagnosticAction,
  diagnosticRouteRequest,
}) => {
  const circuit = useCircuitStore((state) => state.circuit);
  const addNode = useCircuitStore((state) => state.addNode);
  const updateCircuit = useCircuitStore((state) => state.updateCircuit);
  const deleteNode = useCircuitStore((state) => state.deleteNode);
  const deleteConnection = useCircuitStore((state) => state.deleteConnection);
  const undo = useCircuitStore((state) => state.undo);
  const redo = useCircuitStore((state) => state.redo);
  const setEngine = useCircuitStore((state) => state.setEngine);
  const setTickEngine = useCircuitStore((state) => state.setTickEngine);
  const undoDepth = useCircuitStore((state) => state.past.length);
  const redoDepth = useCircuitStore((state) => state.future.length);

  const camera = useLogicViewStore((state) => state.camera);
  const toolMode = useLogicViewStore((state) => state.toolMode);
  const setToolMode = useLogicViewStore((state) => state.setToolMode);
  const selectMultipleNodes = useLogicViewStore((state) => state.selectMultipleNodes);
  const snapToGrid = useLogicViewStore((state) => state.snapToGrid);
  const toggleSnapToGrid = useLogicViewStore((state) => state.toggleSnapToGrid);
  const clearSelection = useLogicViewStore((state) => state.clearSelection);
  const rawSelection = useLogicViewStore((state) => state.selection);
  const interactionMode = useLogicViewStore((state) => state.interactionMode);

  const selection = useMemo(
    () => ({
      nodes: rawSelection?.nodes instanceof Set ? rawSelection.nodes : new Set<string>(),
      wires: rawSelection?.wires instanceof Set ? rawSelection.wires : new Set<string>(),
    }),
    [rawSelection]
  );
  const editorCircuit = useMemo(() => normalizeCircuitForCanvas(circuit), [circuit]);

  const [paletteQuery, setPaletteQuery] = useState('');
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const previousWireCountRef = useRef(editorCircuit.connections.length);
  const [canvasSize, setCanvasSize] = useState({ width: 880, height: 520 });
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [diagnosticFilterNodeId, setDiagnosticFilterNodeId] = useState<string | null>(null);
  const [tickEngine] = useState(() => new TickEngine(editorCircuit, { tickRate: 10 }));

  useEffect(() => {
    setEngine(tickEngine.getEngine());
    setTickEngine(tickEngine);
    return () => {
      tickEngine.dispose();
    };
  }, [setEngine, setTickEngine, tickEngine]);

  useEffect(() => {
    tickEngine.setCircuit(editorCircuit);
  }, [editorCircuit, tickEngine]);

  useEffect(() => {
    if (!canvasHostRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0];
      if (!next) return;
      const width = Math.max(640, Math.floor(next.contentRect.width));
      const height = Math.max(360, Math.floor(next.contentRect.height));
      setCanvasSize({ width, height });
    });
    observer.observe(canvasHostRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
        onCircuitMutated?.();
      } else if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
        event.preventDefault();
        redo();
        onCircuitMutated?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCircuitMutated, redo, undo]);

  useEffect(() => {
    if (!actionToast) return;
    const timeout = window.setTimeout(() => {
      setActionToast(null);
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [actionToast]);

  useEffect(() => {
    if (!diagnosticRouteRequest) return;
    if (diagnosticRouteRequest.mode !== 'design') return;
    if (!diagnosticRouteRequest.nodeId) return;
    setDiagnosticFilterNodeId(diagnosticRouteRequest.nodeId);
  }, [diagnosticRouteRequest]);

  useEffect(() => {
    const previous = previousWireCountRef.current;
    const current = editorCircuit.connections.length;
    if (current > previous) {
      setActionToast(previous === 0 ? 'First wire linked.' : 'Wire linked.');
    }
    previousWireCountRef.current = current;
  }, [editorCircuit.connections.length]);

  const filteredPalette = useMemo(() => {
    const query = paletteQuery.trim().toLowerCase();
    if (!query) return PALETTE_ITEMS;
    return PALETTE_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  }, [paletteQuery]);

  const spawnAtCanvasCenter = useCallback(
    (nodeType: string, extraOffset: { x: number; y: number } = { x: 0, y: 0 }) => {
      const center = {
        x: (canvasSize.width / 2 - camera.x) / camera.zoom,
        y: (canvasSize.height / 2 - camera.y) / camera.zoom,
      };
      const basePosition = findSmartSpawnPosition(editorCircuit.nodes as Node[], center);
      addNode(nodeType, {
        x: basePosition.x + extraOffset.x,
        y: basePosition.y + extraOffset.y,
      });
      onCircuitMutated?.();
    },
    [
      addNode,
      camera.x,
      camera.y,
      camera.zoom,
      canvasSize.height,
      canvasSize.width,
      editorCircuit.nodes,
      onCircuitMutated,
    ]
  );

  const addIoPins = useCallback(() => {
    spawnAtCanvasCenter('INPUT', { x: -120, y: -24 });
    spawnAtCanvasCenter('OUTPUT', { x: 120, y: -24 });
    setActionToast('Added starter IO pins.');
  }, [spawnAtCanvasCenter]);

  const addAndGateStarter = useCallback(() => {
    spawnAtCanvasCenter('INPUT', { x: -170, y: -72 });
    spawnAtCanvasCenter('INPUT', { x: -170, y: 24 });
    spawnAtCanvasCenter('AND', { x: 0, y: -24 });
    spawnAtCanvasCenter('OUTPUT', { x: 170, y: -24 });
    setActionToast('Added AND starter circuit.');
  }, [spawnAtCanvasCenter]);

  const setSelectMode = useCallback(() => {
    setToolMode('select');
    setActionToast('Select mode active.');
  }, [setToolMode]);

  const setWireMode = useCallback(() => {
    setToolMode('wire');
    setActionToast('Wire mode active.');
  }, [setToolMode]);

  const deleteSelection = useCallback(() => {
    const selectedNodeIds = Array.from(selection.nodes);
    const selectedWireIds = Array.from(selection.wires);

    for (const nodeId of selectedNodeIds) {
      deleteNode(nodeId);
    }

    for (const wireId of selectedWireIds) {
      const parsed = parseWireId(wireId);
      if (!parsed) continue;
      deleteConnection(parsed.fromNodeId, parsed.fromPort, parsed.toNodeId, parsed.toPort);
    }

    clearSelection();
    if (selectedNodeIds.length + selectedWireIds.length > 0) {
      setActionToast('Removed selected nodes and wires.');
      onCircuitMutated?.();
    }
  }, [clearSelection, deleteConnection, deleteNode, onCircuitMutated, selection.nodes, selection.wires]);

  const handleCircuitChange = useCallback(
    (nextCircuit: Circuit) => {
      updateCircuit(normalizeCircuitForCanvas(nextCircuit), { skipHistory: false, enforceLimits: true });
      onCircuitMutated?.();
    },
    [onCircuitMutated, updateCircuit]
  );

  const handleUndo = useCallback(() => {
    undo();
    onCircuitMutated?.();
  }, [onCircuitMutated, undo]);

  const handleRedo = useCallback(() => {
    redo();
    onCircuitMutated?.();
  }, [onCircuitMutated, redo]);

  const selectedNodeIds = useMemo(() => Array.from(selection.nodes).slice(0, 5), [selection.nodes]);
  const selectedWireIds = useMemo(() => Array.from(selection.wires).slice(0, 5), [selection.wires]);
  const selectedNode = useMemo(
    () =>
      selectedNodeIds.length > 0 ? editorCircuit.nodes.find((node) => node.id === selectedNodeIds[0]) : undefined,
    [editorCircuit.nodes, selectedNodeIds]
  );
  const selectedNodePins = useMemo(
    () => deriveNodePins(selectedNode, editorCircuit),
    [editorCircuit, selectedNode]
  );
  const selectedNodeProperties = useMemo(
    () => (selectedNode ? describeNodeProperties(selectedNode) : []),
    [selectedNode]
  );
  const selectedTypeSummary = useMemo(() => summarizeSelectionTypes(selection.nodes, editorCircuit), [editorCircuit, selection.nodes]);
  const compilerDiagnostics = compilerStatus?.diagnostics ?? [];
  const diagnosticsByNode = useMemo(() => {
    const index = new Map<string, IdeDiagnostic[]>();
    for (const diagnostic of compilerDiagnostics) {
      const nodeIds = resolveDiagnosticNodeIds(diagnostic, editorCircuit);
      for (const nodeId of nodeIds) {
        const existing = index.get(nodeId);
        if (existing) {
          existing.push(diagnostic);
        } else {
          index.set(nodeId, [diagnostic]);
        }
      }
    }
    return index;
  }, [compilerDiagnostics, editorCircuit]);
  const nodeDiagnosticBadges = useMemo(() => {
    const badges: Record<string, { error: number; warn: number; total: number }> = {};
    for (const [nodeId, diagnostics] of diagnosticsByNode.entries()) {
      const error = diagnostics.filter((entry) => entry.severity === 'error').length;
      const warn = diagnostics.filter((entry) => entry.severity === 'warn').length;
      badges[nodeId] = {
        error,
        warn,
        total: diagnostics.length,
      };
    }
    return badges;
  }, [diagnosticsByNode]);
  const selectedNodeDiagnostics = useMemo(
    () => (selectedNode ? diagnosticsByNode.get(selectedNode.id) ?? [] : []),
    [diagnosticsByNode, selectedNode]
  );
  const diagnosticsDrawerRows = useMemo(() => {
    if (diagnosticFilterNodeId) {
      return diagnosticsByNode.get(diagnosticFilterNodeId) ?? [];
    }
    return compilerDiagnostics;
  }, [compilerDiagnostics, diagnosticFilterNodeId, diagnosticsByNode]);
  const compilerErrorCount = compilerStatus?.errorCount ?? 0;
  const compilerWarningCount = compilerStatus?.warningCount ?? 0;
  const dirtySinceVerify = compilerStatus?.dirtySinceVerify ?? true;
  const dirtySinceExport = compilerStatus?.dirtySinceExport ?? true;
  const irHash = useMemo(() => digestValue(buildCircuitIrHashPayload(editorCircuit)), [editorCircuit]);
  const hasSelection = selection.nodes.size > 0 || selection.wires.size > 0;
  const activeModeLabel = toolMode === 'wire' ? 'Wire Mode' : 'Select Mode';
  const zoomPercent = Math.round(camera.zoom * 100);
  const interactionLabel =
    interactionMode === 'boxSelecting'
      ? 'Marquee Select'
      : interactionMode === 'panning'
        ? 'Panning'
        : interactionMode === 'draggingNode'
          ? 'Dragging Node'
          : interactionMode === 'wiring'
            ? 'Wiring'
            : 'Idle';
  const toolHint =
    interactionMode === 'boxSelecting'
      ? 'Drag to marquee-select multiple nodes. Hold Shift to add to selection.'
      : toolMode === 'wire'
        ? 'Click two ports to create a wire.'
        : 'Click a node to inspect it. Drag to reposition.';
  const handleNodeDiagnosticBadgeClick = useCallback(
    (nodeId: string) => {
      setToolMode('select');
      selectMultipleNodes([nodeId], false);
      setDiagnosticFilterNodeId((previous) => (previous === nodeId ? null : nodeId));
    },
    [selectMultipleNodes, setToolMode]
  );
  const clearDiagnosticFilter = useCallback(() => {
    setDiagnosticFilterNodeId(null);
  }, []);

  return (
    <IdeSurfaceLayout
      mode="design"
      inspector={
        <>
          <IdeInspectorSection title="Workspace Metrics">
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Nodes</span>
                <span>{circuit.nodes.length}</span>
              </div>
              <div className="ide-kv-row">
                <span>Wires</span>
                <span>{circuit.connections.length}</span>
              </div>
              <div className="ide-kv-row">
                <span>Tool</span>
                <span>{toolMode === 'wire' ? 'Wire' : 'Select'}</span>
              </div>
              <div className="ide-kv-row">
                <span>Snap</span>
                <span>{snapToGrid ? 'On' : 'Off'}</span>
              </div>
              <div className="ide-kv-row">
                <span>Zoom</span>
                <span data-testid="ide-design-zoom-indicator">{zoomPercent}%</span>
              </div>
              <div className="ide-kv-row">
                <span>Interaction</span>
                <span data-testid="ide-design-interaction-indicator">{interactionLabel}</span>
              </div>
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Selection">
            {selectedNode && selection.nodes.size === 1 ? (
              <div className="ide-design-selection-inspector" data-testid="ide-design-selection-inspector">
                <div className="ide-kv-list">
                  <div className="ide-kv-row">
                    <span>Type</span>
                    <span data-testid="ide-design-selection-type">{selectedNode.type}</span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Node ID</span>
                    <span>
                      <code data-testid="ide-design-selection-id">{selectedNode.id}</code>
                    </span>
                  </div>
                </div>
                <div className="ide-design-selection-pins" data-testid="ide-design-selection-pins">
                  {selectedNodePins.map((pin) => (
                    <span key={`${selectedNode.id}-${pin}`} className="ide-design-pin-pill">
                      {pin}
                    </span>
                  ))}
                </div>
                <div className="ide-design-selection-properties" data-testid="ide-design-selection-properties">
                  <p className="ide-copy">IR Properties</p>
                  <div className="ide-kv-list">
                    {selectedNodeProperties.length > 0 ? (
                      selectedNodeProperties.map((entry) => (
                        <div key={`${selectedNode.id}-${entry.key}`} className="ide-kv-row">
                          <span>{entry.key}</span>
                          <code>{entry.value}</code>
                        </div>
                      ))
                    ) : (
                      <p className="ide-copy">No typed properties on this node.</p>
                    )}
                  </div>
                </div>
                <div className="ide-design-selection-warnings" data-testid="ide-design-selection-warnings">
                  <p className="ide-copy">Node Diagnostics</p>
                  {selectedNodeDiagnostics.length > 0 ? (
                    <ul className="ide-design-selection-warning-list">
                      {selectedNodeDiagnostics.map((diagnostic) => (
                        <li
                          key={`${selectedNode.id}-${diagnostic.code}-${diagnostic.message}`}
                          className={`ide-design-selection-warning-item ${
                            diagnostic.severity === 'error' ? 'is-error' : 'is-warning'
                          }`}
                        >
                          <span>{diagnostic.code}</span>
                          <span>{diagnostic.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ide-copy">No diagnostics attached to this node.</p>
                  )}
                </div>
                <IdeButton tone="danger" onClick={deleteSelection} testId="ide-design-inspector-delete">
                  Delete selected node
                </IdeButton>
              </div>
            ) : selection.nodes.size > 1 ? (
              <div className="ide-design-selection-inspector" data-testid="ide-design-multiselect-summary">
                <div className="ide-kv-row">
                  <span>Selected</span>
                  <span data-testid="ide-design-multiselect-count">{selection.nodes.size} nodes</span>
                </div>
                <div className="ide-design-selection-pins" data-testid="ide-design-multiselect-types">
                  {selectedTypeSummary.map((entry) => (
                    <span key={entry.type} className="ide-design-pin-pill">
                      {entry.type}: {entry.count}
                    </span>
                  ))}
                </div>
                <p className="ide-copy">
                  Bulk actions: drag to move as a unit, press Delete to remove selection, Ctrl+Z to restore.
                </p>
                <IdeButton tone="danger" onClick={deleteSelection} testId="ide-design-inspector-delete">
                  Delete selected nodes
                </IdeButton>
              </div>
            ) : (
              <p className="ide-copy">No node selected. Click a node to inspect type, id, and pins.</p>
            )}
            {selectedWireIds.length > 0 && (
              <div className="ide-copy-top-gap">
                <strong>Selected wires:</strong> {selectedWireIds.length}
              </div>
            )}
          </IdeInspectorSection>

          <IdeInspectorSection title="Next Action">
            <IdeCallout tone="info" title="Design Flow">
              Place IO pins, wire through logic gates, then switch to Verify for deterministic test vectors.
            </IdeCallout>
          </IdeInspectorSection>
        </>
      }
    >
        <IdePanel
          title="Design Command Center"
          description="Build your circuit with deterministic graph updates and explicit editing controls."
          actions={
            <div className="ide-design-primary-actions" data-testid="ide-design-primary-actions">
              <span data-testid="ide-primary-cta">
                <IdeButton tone="primary" onClick={addIoPins} testId="ide-design-add-io-pins">
                  Add IO Pins
                </IdeButton>
              </span>
              <IdeButton tone="secondary" onClick={addAndGateStarter} testId="ide-design-add-and-starter">
                Add AND Starter
              </IdeButton>
            </div>
          }
          right={<IdeStatusPill tone={toolMode === 'wire' ? 'warn' : 'ok'}>{activeModeLabel}</IdeStatusPill>}
          testId="ide-design-panel"
        >
          <section
            className="ide-design-command-center"
            data-testid="ide-design-command-header"
            data-interaction-mode={interactionMode}
          >
            <div className="ide-design-command-title">
              <h3 data-testid="ide-design-mode-title">Design</h3>
              <p data-testid="ide-design-mode-subtitle">Build your circuit</p>
            </div>

            <div className="ide-design-tool-segmented" data-testid="ide-design-tool-segmented">
              <button
                type="button"
                className={`ide-design-tool-segment ${toolMode === 'select' ? 'is-active' : ''}`}
                onClick={setSelectMode}
                data-testid="ide-design-tool-select"
                aria-pressed={toolMode === 'select'}
              >
                <span className="ide-design-tool-icon" aria-hidden="true">
                  SEL
                </span>
                <span className="ide-design-tool-text">
                  <strong>Select</strong>
                  <kbd>S</kbd>
                </span>
              </button>
              <button
                type="button"
                className={`ide-design-tool-segment ${toolMode === 'wire' ? 'is-active' : ''}`}
                onClick={setWireMode}
                data-testid="ide-design-tool-wire"
                aria-pressed={toolMode === 'wire'}
              >
                <span className="ide-design-tool-icon" aria-hidden="true">
                  WIR
                </span>
                <span className="ide-design-tool-text">
                  <strong>Wire</strong>
                  <kbd>W</kbd>
                </span>
              </button>
            </div>

            <div className="ide-design-command-actions" data-testid="ide-design-command-actions">
              <span className="ide-design-depth-pill" data-testid="ide-design-undo-depth">
                Undo {undoDepth}
              </span>
              <span className="ide-design-depth-pill" data-testid="ide-design-redo-depth">
                Redo {redoDepth}
              </span>
              <IdeButton tone="ghost" onClick={toggleSnapToGrid} testId="ide-design-tool-snap">
                Snap {snapToGrid ? 'On' : 'Off'}
              </IdeButton>
              <IdeButton
                tone="ghost"
                onClick={handleUndo}
                disabled={undoDepth === 0}
                testId="ide-design-tool-undo"
              >
                Undo
              </IdeButton>
              <IdeButton
                tone="ghost"
                onClick={handleRedo}
                disabled={redoDepth === 0}
                testId="ide-design-tool-redo"
              >
                Redo
              </IdeButton>
              <IdeButton
                tone="danger"
                onClick={deleteSelection}
                disabled={!hasSelection}
                testId="ide-design-tool-delete"
              >
                Delete
              </IdeButton>
              <span className={`ide-wire-mode-pill ${toolMode === 'wire' ? 'is-wire' : ''}`} data-testid="ide-design-wire-pill">
                {activeModeLabel}
              </span>
              <span className="ide-wire-mode-pill" data-testid="ide-design-interaction-pill">
                {interactionLabel}
              </span>
            </div>
          </section>

          <section className="ide-design-compiler-strip" data-testid="ide-design-compiler-strip">
            <div className="ide-design-compiler-item">
              <span>IR Hash</span>
              <code data-testid="ide-design-ir-hash">{irHash}</code>
            </div>
            <div className="ide-design-compiler-item">
              <span>Dirty since verify</span>
              <strong
                data-testid="ide-design-dirty-since-verify"
                className={dirtySinceVerify ? 'is-warn' : 'is-ok'}
              >
                {dirtySinceVerify ? 'Yes' : 'No'}
              </strong>
            </div>
            <div className="ide-design-compiler-item">
              <span>Dirty since export</span>
              <strong
                data-testid="ide-design-dirty-since-export"
                className={dirtySinceExport ? 'is-warn' : 'is-ok'}
              >
                {dirtySinceExport ? 'Yes' : 'No'}
              </strong>
            </div>
            <div className="ide-design-compiler-item">
              <span>Errors</span>
              <strong data-testid="ide-design-diagnostics-errors" className={compilerErrorCount > 0 ? 'is-error' : 'is-ok'}>
                {compilerErrorCount}
              </strong>
            </div>
            <div className="ide-design-compiler-item">
              <span>Warnings</span>
              <strong data-testid="ide-design-diagnostics-warnings" className={compilerWarningCount > 0 ? 'is-warn' : 'is-ok'}>
                {compilerWarningCount}
              </strong>
            </div>
            <div className="ide-design-compiler-item">
              <span>Diagnostics linked</span>
              <strong data-testid="ide-design-diagnostics-total">{compilerDiagnostics.length}</strong>
            </div>
          </section>

          <section
            className="ide-design-diagnostics-drawer"
            data-testid="ide-design-diagnostics-drawer"
            data-filtered-node={diagnosticFilterNodeId ?? 'all'}
          >
            <header className="ide-design-diagnostics-drawer-header">
              <h3>Compiler Diagnostics</h3>
              <div className="ide-inline-actions">
                {diagnosticFilterNodeId ? (
                  <span className="ide-copy" data-testid="ide-design-diagnostics-filtered-node">
                    filtered: <code>{diagnosticFilterNodeId}</code>
                  </span>
                ) : (
                  <span className="ide-copy">all nodes</span>
                )}
                {diagnosticFilterNodeId ? (
                  <IdeButton
                    tone="ghost"
                    onClick={clearDiagnosticFilter}
                    testId="ide-design-diagnostics-clear-filter"
                  >
                    Clear filter
                  </IdeButton>
                ) : null}
              </div>
            </header>
            <div className="ide-design-diagnostics-list">
              {diagnosticsDrawerRows.length > 0 ? (
                diagnosticsDrawerRows.slice(0, 12).map((diagnostic) => (
                  <article
                    key={diagnostic.id}
                    className={`ide-design-diagnostic-row ${
                      diagnostic.severity === 'error' ? 'is-error' : 'is-warning'
                    }`}
                    data-testid={`ide-design-diagnostic-${diagnostic.id}`}
                  >
                    <div className="ide-design-diagnostic-row-header">
                      <IdeStatusPill tone={diagnostic.severity === 'error' ? 'error' : 'warn'}>
                        {diagnostic.severity === 'error' ? 'ERROR' : 'WARN'}
                      </IdeStatusPill>
                      <code>{diagnostic.code}</code>
                      <span>{diagnostic.title}</span>
                    </div>
                    <p className="ide-copy">{diagnostic.message}</p>
                    {diagnostic.hint.length > 0 ? (
                      <p className="ide-copy ide-design-diagnostic-hint">{diagnostic.hint[0]}</p>
                    ) : null}
                    <div className="ide-inline-actions">
                      {onDiagnosticAction ? (
                        <IdeButton
                          tone="secondary"
                          onClick={() => onDiagnosticAction(diagnostic)}
                          testId={`ide-design-diagnostic-action-${diagnostic.id}`}
                        >
                          Show fix path
                        </IdeButton>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <p className="ide-copy">No diagnostics currently linked to this view.</p>
              )}
            </div>
          </section>

          <div className="ide-design-layout">
            <section className="ide-design-palette" data-testid="ide-design-palette">
              <header className="ide-design-subheader">
                <h3>Palette</h3>
                <IdeButton tone="ghost" onClick={onOpenPalette}>
                  Focus
                </IdeButton>
              </header>
              <input
                type="text"
                className="ide-design-search"
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                placeholder="Search gates, IO, DFF, clock..."
                data-testid="ide-design-search"
              />
              <div className="ide-palette-groups">
                {(['IO', 'Logic', 'Sequential'] as const).map((category) => {
                  const items = filteredPalette.filter((item) => item.category === category);
                  if (items.length === 0) return null;
                  return (
                    <div key={category} className="ide-palette-group">
                      <h4>{category}</h4>
                      <div className="ide-palette-chips">
                        {items.map((item) => (
                          <button
                            key={item.type}
                            className="ide-palette-chip"
                            type="button"
                            onClick={() => spawnAtCanvasCenter(item.type)}
                            data-testid={`ide-design-palette-${item.type.toLowerCase()}`}
                          >
                            {item.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="ide-design-canvas" data-testid="ide-design-canvas">
              <div className="ide-design-tool-hud" data-testid="ide-design-tool-hud">
                <span className="ide-design-tool-hud-label">{activeModeLabel}</span>
                <span className="ide-design-tool-hud-hint">{toolHint}</span>
              </div>
              <div
                className={`ide-design-canvas-live ${toolMode === 'wire' ? 'is-wire-mode' : 'is-select-mode'}`}
                ref={canvasHostRef}
                data-testid="ide-design-live-canvas"
                data-tool-mode={toolMode}
                data-interaction-mode={interactionMode}
              >
                <div className="ide-design-canvas-mode-indicator" data-testid="ide-design-canvas-mode-indicator">
                  {activeModeLabel}
                </div>
                <div className="ide-design-canvas-zoom-indicator" data-testid="ide-design-canvas-zoom-indicator">
                  {zoomPercent}% zoom
                </div>
                <LogicCanvas
                  engine={tickEngine}
                  circuit={editorCircuit}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  showToolbar={false}
                  onCircuitChange={handleCircuitChange}
                  showHints={false}
                  nodeDiagnosticBadges={nodeDiagnosticBadges}
                  onNodeDiagnosticBadgeClick={handleNodeDiagnosticBadgeClick}
                />
                {editorCircuit.nodes.length === 0 && (
                  <div className="ide-design-overlay-empty" data-testid="ide-design-empty-state">
                    <h3>Build a circuit in three steps</h3>
                    <ol className="ide-design-empty-steps" data-testid="ide-design-empty-checklist">
                      <li>
                        <span className="ide-design-empty-step-index">1</span>
                        <span>Add Inputs/Outputs</span>
                      </li>
                      <li>
                        <span className="ide-design-empty-step-index">2</span>
                        <span>Place Gates</span>
                      </li>
                      <li>
                        <span className="ide-design-empty-step-index">3</span>
                        <span>Wire and Verify</span>
                      </li>
                    </ol>
                    <div className="ide-design-empty-actions">
                      <IdeButton tone="secondary" onClick={addIoPins} testId="ide-design-empty-add-io">
                        Add Inputs/Outputs
                      </IdeButton>
                      <IdeButton tone="primary" onClick={addAndGateStarter} testId="ide-design-empty-add-and">
                        Add an AND example
                      </IdeButton>
                    </div>
                  </div>
                )}
                {actionToast && (
                  <div className="ide-design-toast" role="status" data-testid="ide-design-action-toast">
                    {actionToast}
                  </div>
                )}
              </div>
            </section>
          </div>
        </IdePanel>
    </IdeSurfaceLayout>
  );
};

function normalizeCircuitForCanvas(circuit: Circuit): Circuit {
  return {
    ...circuit,
    nodes: circuit.nodes.map((node) => {
      const fallbackX = typeof node.x === 'number' ? node.x : 0;
      const fallbackY = typeof node.y === 'number' ? node.y : 0;
      const position = node.position ?? { x: fallbackX, y: fallbackY };
      return {
        ...node,
        position,
        x: position.x,
        y: position.y,
        config: node.config ?? {},
        state: node.state ?? {},
      };
    }),
    connections: circuit.connections.map((connection) => ({ ...connection })),
  };
}

function parseWireId(
  wireId: string
): { fromNodeId: string; fromPort: string; toNodeId: string; toPort: string } | null {
  const separatorIndex = wireId.indexOf('-');
  if (separatorIndex < 0) return null;
  const fromRaw = wireId.slice(0, separatorIndex);
  const toRaw = wireId.slice(separatorIndex + 1);
  const fromDot = fromRaw.indexOf('.');
  const toDot = toRaw.indexOf('.');
  if (fromDot < 0 || toDot < 0) return null;

  return {
    fromNodeId: fromRaw.slice(0, fromDot),
    fromPort: fromRaw.slice(fromDot + 1),
    toNodeId: toRaw.slice(0, toDot),
    toPort: toRaw.slice(toDot + 1),
  };
}

const NODE_PIN_CATALOG: Record<string, string[]> = {
  INPUT: ['out'],
  OUTPUT: ['in'],
  Switch: ['out'],
  Lamp: ['in'],
  Clock: ['out'],
  AND: ['a', 'b', 'out'],
  OR: ['a', 'b', 'out'],
  XOR: ['a', 'b', 'out'],
  NOT: ['in', 'out'],
  DFlipFlop: ['d', 'clk', 'q'],
};

function deriveNodePins(node: Node | undefined, circuit: Circuit): string[] {
  if (!node) return [];
  const listed = NODE_PIN_CATALOG[node.type];
  if (listed && listed.length > 0) return listed;

  const inferred = new Set<string>();
  for (const connection of circuit.connections) {
    const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
    const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
    if (fromNodeId === node.id) {
      const fromPort =
        typeof connection.from === 'string'
          ? connection.fromPort ?? connection.fromPin ?? 'out'
          : connection.from.portName ?? connection.from.port ?? 'out';
      inferred.add(fromPort);
    }
    if (toNodeId === node.id) {
      const toPort =
        typeof connection.to === 'string'
          ? connection.toPort ?? connection.toPin ?? 'in'
          : connection.to.portName ?? connection.to.port ?? 'in';
      inferred.add(toPort);
    }
  }

  if (inferred.size === 0) {
    inferred.add('in');
    inferred.add('out');
  }

  return Array.from(inferred).sort();
}

function buildCircuitIrHashPayload(circuit: Circuit): unknown {
  const nodes = circuit.nodes
    .map((node) => ({
      id: node.id,
      type: node.type,
      position: {
        x: Math.round((node.position?.x ?? 0) * 1000) / 1000,
        y: Math.round((node.position?.y ?? 0) * 1000) / 1000,
      },
      config: node.config ?? {},
      state: node.state ?? {},
    }))
    .sort((left, right) => compareText(left.id, right.id));

  const connections = circuit.connections
    .map((connection) => {
      const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
      const fromPort = typeof connection.from === 'string'
        ? connection.fromPort ?? connection.fromPin ?? 'out'
        : connection.from.portName ?? connection.from.port ?? 'out';
      const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
      const toPort = typeof connection.to === 'string'
        ? connection.toPort ?? connection.toPin ?? 'in'
        : connection.to.portName ?? connection.to.port ?? 'in';

      return {
        id: `${fromNodeId}.${fromPort}-${toNodeId}.${toPort}`,
        fromNodeId,
        fromPort,
        toNodeId,
        toPort,
      };
    })
    .sort((left, right) => compareText(left.id, right.id));

  return { nodes, connections };
}

function describeNodeProperties(node: Node): Array<{ key: string; value: string }> {
  const values = new Map<string, unknown>();
  values.set('type', node.type);
  values.set('x', Math.round((node.position?.x ?? 0) * 1000) / 1000);
  values.set('y', Math.round((node.position?.y ?? 0) * 1000) / 1000);

  const config = node.config ?? {};
  const state = node.state ?? {};
  for (const key of Object.keys(config).sort(compareText)) {
    values.set(`config.${key}`, (config as Record<string, unknown>)[key]);
  }
  for (const key of Object.keys(state).sort(compareText)) {
    values.set(`state.${key}`, (state as Record<string, unknown>)[key]);
  }

  return Array.from(values.entries()).map(([key, value]) => ({
    key,
    value: stringifyPropertyValue(value),
  }));
}

function summarizeSelectionTypes(
  selectedNodeIds: Set<string>,
  circuit: Circuit
): Array<{ type: string; count: number }> {
  const typeCounts = new Map<string, number>();
  for (const nodeId of selectedNodeIds) {
    const node = circuit.nodes.find((entry) => entry.id === nodeId);
    if (!node) continue;
    typeCounts.set(node.type, (typeCounts.get(node.type) ?? 0) + 1);
  }
  return Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => compareText(left.type, right.type));
}

function resolveDiagnosticNodeIds(diagnostic: IdeDiagnostic, circuit: Circuit): string[] {
  const directNodeId = normalizeDiagnosticToken(diagnostic.owner.nodeId);
  if (directNodeId.length > 0) {
    const exists = circuit.nodes.find((node) => normalizeDiagnosticToken(node.id) === directNodeId);
    return exists ? [exists.id] : [];
  }

  const candidateTokens = new Set<string>();
  candidateTokens.add(normalizeDiagnosticToken(diagnostic.owner.portName));
  candidateTokens.add(normalizeDiagnosticToken(diagnostic.owner.mappingKey));
  if (Array.from(candidateTokens).every((entry) => entry.length === 0)) return [];

  const matches: string[] = [];
  for (const node of circuit.nodes) {
    const nodePins = deriveNodePins(node, circuit);
    if (diagnosticMatchesNodeTokens(candidateTokens, node, nodePins)) {
      matches.push(node.id);
    }
  }
  return matches;
}

function diagnosticMatchesNodeTokens(
  candidateTokens: Set<string>,
  node: Node,
  nodePins: string[]
): boolean {
  const nodeTokens = new Set<string>([
    normalizeDiagnosticToken(node.id),
    normalizeDiagnosticToken(node.label),
    normalizeDiagnosticToken(node.type),
  ]);

  for (const pin of nodePins) {
    nodeTokens.add(normalizeDiagnosticToken(pin));
    nodeTokens.add(normalizeDiagnosticToken(`${node.id}.${pin}`));
    if (node.label) {
      nodeTokens.add(normalizeDiagnosticToken(`${node.label}.${pin}`));
    }
  }

  for (const candidate of candidateTokens) {
    if (!candidate) continue;
    for (const token of nodeTokens) {
      if (!token) continue;
      if (candidate === token || candidate.endsWith(`.${token}`) || token.endsWith(`.${candidate}`)) {
        return true;
      }
    }
  }
  return false;
}

function stringifyPropertyValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function normalizeDiagnosticToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
