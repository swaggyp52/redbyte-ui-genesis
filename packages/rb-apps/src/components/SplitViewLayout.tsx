// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { CircuitEngine, Circuit, TickEngine } from '@redbyte/rb-logic-core';
import { LogicCanvas, calculateFitToView, useLogicViewStore } from '@redbyte/rb-logic-view';
// Lazy-load 3D scene to avoid loading heavy Three.js stack unless enabled
const Logic3DSceneLazy = React.lazy(() =>
  import('@redbyte/rb-logic-3d').then((m) => ({ default: m.Logic3DScene }))
);
import { SchematicView } from './SchematicView';
import { OscilloscopeView } from './OscilloscopeView';
import { CodeView } from './CodeView';
import { CircuitToolStrip } from './CircuitToolStrip';
import { HardwareMapper } from './HardwareMapper';
import { Icon, type IconName } from '@redbyte/rb-icons';
import type { SplitScreenMode, ViewMode } from '../stores/viewStateStore';
import { useViewStateStore } from '../stores/viewStateStore';
import type { HelpSectionId } from './HelpDock';

interface SplitViewLayoutProps {
  mode: SplitScreenMode;
  views: ViewMode[];
  splitRatio?: number;
  engine: CircuitEngine;
  tickEngine: TickEngine;
  circuit: Circuit;
  isRunning: boolean;
  tickCount?: number;
  debugSignals?: Map<string, 0 | 1> | null;
  debugTick?: number | null;
  mismatchWireHighlights?: Map<string, string[]> | null;
  mismatchNodeIds?: Set<string> | null;
  mismatchPortKeys?: Set<string> | null;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onCircuitChange: (circuit: Circuit) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  viewStateStore?: any;
  showCircuitHints?: boolean;
  onDismissCircuitHints?: () => void;
  showSchematicHints?: boolean;
  onDismissSchematicHints?: () => void;
  show3DHints?: boolean;
  onDismiss3DHints?: () => void;
  showOscilloscopeHints?: boolean;
  onDismissOscilloscopeHints?: () => void;
  getChipMetadata?: (nodeType: string) => any;
  // Milestone D: Determinism recording (optional, dev-only)
  onInputToggled?: (nodeId: string, portName: string, newValue: 0 | 1) => void;
  // Probe toggling
  onProbeToggle?: (nodeId: string, portName: string, label: string) => void;
  probedPorts?: Set<string>;
  probeWireHighlights?: Map<string, string[]>;
  highlightedPort?: { nodeId: string; portName: string } | null;
  isReplayMode?: boolean;
  onHelpOpen?: (section: HelpSectionId) => void;
  disableToolStrip?: boolean;
}

interface ViewRendererProps {
  view: ViewMode;
  engine: CircuitEngine;
  tickEngine: TickEngine;
  circuit: Circuit;
  isRunning: boolean;
  tickCount?: number;
  debugSignals?: Map<string, 0 | 1> | null;
  debugTick?: number | null;
  mismatchWireHighlights?: Map<string, string[]> | null;
  mismatchNodeIds?: Set<string> | null;
  mismatchPortKeys?: Set<string> | null;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onCircuitChange: (circuit: Circuit) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  viewStateStore?: any;
  width?: number;
  height?: number;
  showCircuitHints?: boolean;
  onDismissCircuitHints?: () => void;
  showSchematicHints?: boolean;
  onDismissSchematicHints?: () => void;
  show3DHints?: boolean;
  onDismiss3DHints?: () => void;
  showOscilloscopeHints?: boolean;
  onDismissOscilloscopeHints?: () => void;
  getChipMetadata?: (nodeType: string) => any;
  onInputToggled?: (nodeId: string, portName: string, newValue: 0 | 1) => void;
  onProbeToggle?: (nodeId: string, portName: string, label: string) => void;
  probedPorts?: Set<string>;
  probeWireHighlights?: Map<string, string[]>;
  highlightedPort?: { nodeId: string; portName: string } | null;
  isReplayMode?: boolean;
  onHelpOpen?: (section: HelpSectionId) => void;
  disableToolStrip?: boolean;
  // Signal propagation for scope/3D
  onSignalsUpdated?: (signals: Map<string, 0 | 1>, reason: 'input' | 'tick') => void;
  latestSignals?: Map<string, 0 | 1>;
  signalsUpdateReason?: 'input' | 'tick';
  signalsVersion?: number;
}

// View metadata for headers
const VIEW_METADATA: Record<ViewMode, { icon: IconName; label: string; color: string }> = {
  circuit: { icon: 'logic', label: 'Circuit View', color: 'cyan' },
  schematic: { icon: 'grid', label: 'Schematic View', color: 'blue' },
  '3d': { icon: 'chip', label: '3D View', color: 'purple' },
  oscilloscope: { icon: 'neon-wave', label: 'Oscilloscope', color: 'green' },
  code: { icon: 'code', label: 'HDL Code', color: 'yellow' },
};

const ViewRenderer: React.FC<ViewRendererProps> = ({
  view,
  engine,
  tickEngine,
  circuit,
  isRunning,
  tickCount,
  debugSignals,
  debugTick,
  mismatchWireHighlights,
  mismatchNodeIds,
  mismatchPortKeys,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCircuitChange,
  onNodeDoubleClick,
  viewStateStore,
  width,
  height,
  showCircuitHints,
  onDismissCircuitHints,
  showSchematicHints,
  onDismissSchematicHints,
  show3DHints,
  onDismiss3DHints,
  showOscilloscopeHints,
  onDismissOscilloscopeHints,
  getChipMetadata,
  onInputToggled,
  onProbeToggle,
  probedPorts,
  probeWireHighlights,
  highlightedPort,
  isReplayMode,
  onHelpOpen,
  disableToolStrip = false,
  onSignalsUpdated,
  latestSignals,
  signalsUpdateReason,
  signalsVersion,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
  const toolMode = useLogicViewStore((state) => state.toolMode);
  const setToolMode = useLogicViewStore((state) => state.setToolMode);
  const snapToGrid = useLogicViewStore((state) => state.snapToGrid);
  const toggleSnapToGrid = useLogicViewStore((state) => state.toggleSnapToGrid);
  const setCamera = useLogicViewStore((state) => state.setCamera);
  const setCircuitViewSize = useViewStateStore((state) => state.setCircuitViewSize);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const nextWidth = rect.width;
      const nextHeight = Math.max(0, rect.height - 32); // Subtract header height

      setDimensions((prev) => {
        if (Math.abs(prev.width - nextWidth) < 1 && Math.abs(prev.height - nextHeight) < 1) {
          return prev;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(updateDimensions);
    });

    observer.observe(containerRef.current);
    updateDimensions();

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (view === 'circuit') {
      setCircuitViewSize(dimensions);
    }
  }, [view, dimensions, setCircuitViewSize]);

  const handleFitToView = React.useCallback(() => {
    const nextCamera = calculateFitToView(circuit.nodes, dimensions.width, dimensions.height);
    setCamera(nextCamera);
  }, [circuit.nodes, dimensions.width, dimensions.height, setCamera]);

  const handleResetView = React.useCallback(() => {
    setCamera({ x: 0, y: 0, zoom: 1 });
  }, [setCamera]);

  const renderMicroToolbar = () => {
    if (view !== 'circuit') return null;

    return (
      <div className="ml-3 flex items-center gap-1.5" data-testid="circuit-micro-toolbar">
        <button
          onClick={() => setToolMode('select')}
          className={`px-2 py-1 rounded text-[10px] border ${toolMode === 'select'
            ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
            : 'border-gray-600 text-gray-300 hover:bg-gray-800/60'
            }`}
          title="Select tool"
          type="button"
        >
          SEL
        </button>
        <button
          onClick={() => setToolMode(toolMode === 'wire' ? 'select' : 'wire')}
          className={`px-2 py-1 rounded text-[10px] border ${toolMode === 'wire'
            ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
            : 'border-gray-600 text-gray-300 hover:bg-gray-800/60'
            }`}
          title="Wire tool"
          type="button"
        >
          W
        </button>
        <button
          onClick={toggleSnapToGrid}
          className={`px-2 py-1 rounded text-[10px] border ${snapToGrid
            ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
            : 'border-gray-600 text-gray-300 hover:bg-gray-800/60'
            }`}
          title="Toggle snap to grid"
          type="button"
        >
          G
        </button>
        <button
          onClick={handleFitToView}
          className="px-2 py-1 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-800/60"
          title="Fit to view"
          type="button"
        >
          F
        </button>
        <button
          onClick={handleResetView}
          className="px-2 py-1 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-800/60"
          title="Reset view"
          type="button"
        >
          0
        </button>
        {onHelpOpen && (
          <button
            onClick={() => onHelpOpen('circuit-controls')}
            className="px-2 py-1 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-800/60"
            title="Circuit controls"
            type="button"
          >
            ?
          </button>
        )}
      </div>
    );
  };

  const metadata = VIEW_METADATA[view];
  const containerStyle: React.CSSProperties = {
    width: width || '100%',
    height: height || 'calc(100% - 32px)',
    position: 'relative',
    overflow: 'hidden',
  };

  const renderContent = () => {
    switch (view) {
      case 'circuit':
        return (
          <div ref={containerRef} style={containerStyle}>
            <LogicCanvas
              engine={tickEngine}
              circuit={circuit}
              width={dimensions.width}
              height={dimensions.height}
              showToolbar={false}
              showHints={showCircuitHints}
              onDismissHints={onDismissCircuitHints}
              getChipMetadata={getChipMetadata}
              onNodeDoubleClick={onNodeDoubleClick}
              onCircuitChange={onCircuitChange}
              onProbeToggle={onProbeToggle}
              probedPorts={probedPorts}
              probeWireHighlights={probeWireHighlights}
              mismatchWireHighlights={mismatchWireHighlights}
              mismatchNodeIds={mismatchNodeIds}
              mismatchPortKeys={mismatchPortKeys}
              highlightedPort={highlightedPort}
              onInputToggled={onInputToggled}
              isRunning={isRunning}
              isReplayMode={isReplayMode}
              tickRate={tickEngine.getTickRate()}
              tickCount={tickCount}
              debugSignals={debugSignals}
              debugTick={debugTick}
              onSignalsUpdated={onSignalsUpdated}
            />
            {onUndo && onRedo && !disableToolStrip && (
              <CircuitToolStrip
                circuit={circuit}
                width={dimensions.width}
                height={dimensions.height}
                canUndo={!!canUndo}
                canRedo={!!canRedo}
                onUndo={onUndo}
                onRedo={onRedo}
              />
            )}
          </div>
        );

      case 'schematic':
        return (
          <div ref={containerRef} style={containerStyle}>
            <SchematicView
              circuit={circuit}
              engine={engine}
              isRunning={isRunning}
              width={dimensions.width}
              height={dimensions.height}
              onCircuitChange={onCircuitChange}
              showHints={showSchematicHints}
              onDismissHints={onDismissSchematicHints}
              probeWireHighlights={probeWireHighlights}
              mismatchWireHighlights={mismatchWireHighlights}
              mismatchNodeIds={mismatchNodeIds}
              mismatchPortKeys={mismatchPortKeys}
              onHelp={onHelpOpen ? () => onHelpOpen('schematic-controls') : undefined}
              debugSignals={debugSignals}
              debugTick={debugTick}
              isReplayMode={isReplayMode}
            />
          </div>
        );

      case 'oscilloscope':
        return (
          <div ref={containerRef} style={containerStyle}>
            <OscilloscopeView
              engine={engine}
              tickEngine={tickEngine}
              circuit={circuit}
              isRunning={isRunning}
              width={dimensions.width}
              height={dimensions.height}
              showHints={showOscilloscopeHints}
              onDismissHints={onDismissOscilloscopeHints}
              onHelp={onHelpOpen ? () => onHelpOpen('scope-controls') : undefined}
              debugTick={debugTick}
              signals={latestSignals}
              signalsVersion={signalsVersion}
              signalsUpdateReason={signalsUpdateReason}
            />
          </div>
        );

      case '3d':
        {
          const disable3d =
            typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('disable3d') === '1';

          if (disable3d) {
            return (
              <div ref={containerRef} style={containerStyle} className="flex items-center justify-center text-sm text-gray-300">
                3D view disabled by flag.
              </div>
            );
          }

          return (
            <div ref={containerRef} style={containerStyle}>
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    Loading 3D…
                  </div>
                }
              >
                <Logic3DSceneLazy
                  engine={engine}
                  width={dimensions.width}
                  height={dimensions.height}
                  viewStateStore={viewStateStore}
                  getChipMetadata={getChipMetadata}
                  showHints={show3DHints}
                  onDismissHints={onDismiss3DHints}
                  probeWireHighlights={probeWireHighlights}
                  mismatchWireHighlights={mismatchWireHighlights}
                  mismatchNodeIds={mismatchNodeIds}
                  mismatchPortKeys={mismatchPortKeys}
                  debugSignals={signalsUpdateReason === 'input' ? latestSignals : debugSignals}
                  onHelp={onHelpOpen ? () => onHelpOpen('3d-controls') : undefined}
                  onLayoutChange={() => {
                    // Trigger circuit save when 3D layout changes
                    onCircuitChange({ ...engine.getCircuit() });
                  }}
                />
              </React.Suspense>
            </div>
          );
        }

      case 'code':
        return (
          <div ref={containerRef} style={containerStyle}>
            <CodeView
              circuit={circuit}
              width={dimensions.width}
              height={dimensions.height}
              onHelp={onHelpOpen ? () => onHelpOpen('code-controls') : undefined}
            />
          </div>
        );

      default:
        return (
          <div style={containerStyle} className="flex items-center justify-center bg-gray-900 text-gray-500">
            Unknown view: {view}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0">
      {/* View Header */}
      <div className={`h-8 px-3 flex items-center gap-2 border-b border-gray-700/50 bg-gradient-to-r from-${metadata.color}-900/20 to-gray-900/20 shrink-0`}>
        <Icon name={metadata.icon} size={16} className={`text-${metadata.color}-400`} />
        <span className={`text-xs font-semibold text-${metadata.color}-400 uppercase tracking-wide`}>{metadata.label}</span>
        {renderMicroToolbar()}
        <div className="ml-auto text-[10px] text-gray-500">
          {circuit.nodes.length} nodes • {circuit.connections.length} wires
        </div>
      </div>
      {/* Headless Mapper */}
      {hardwareMapper}
      {/* View Content */}
      <div className="flex-1 min-h-0 min-w-0 relative overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export const SplitViewLayout: React.FC<SplitViewLayoutProps> = ({
  mode,
  views,
  splitRatio = 0.5,
  engine,
  tickEngine,
  circuit,
  isRunning,
  tickCount,
  debugSignals,
  debugTick,
  mismatchWireHighlights,
  mismatchNodeIds,
  mismatchPortKeys,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCircuitChange,
  onNodeDoubleClick,
  viewStateStore,
  showCircuitHints,
  onDismissCircuitHints,
  showSchematicHints,
  onDismissSchematicHints,
  show3DHints,
  onDismiss3DHints,
  showOscilloscopeHints,
  onDismissOscilloscopeHints,
  getChipMetadata,
  onInputToggled,
  onProbeToggle,
  probedPorts,
  probeWireHighlights,
  highlightedPort,
  isReplayMode,
  onHelpOpen,
}) => {
  // Track latest signals and update reason for scope/3D reactivity
  const [latestSignals, setLatestSignals] = React.useState<Map<string, 0 | 1> | undefined>();
  const [signalsUpdateReason, setSignalsUpdateReason] = React.useState<'input' | 'tick' | undefined>();
  const [signalsVersion, setSignalsVersion] = React.useState(0);

  // Handle logic updates from LogicCanvas
  const handleSignalsUpdated = React.useCallback((signals: Map<string, 0 | 1>, reason: 'input' | 'tick') => {
    setLatestSignals(signals);
    setSignalsUpdateReason(reason);
    setSignalsVersion(v => v + 1);
  }, []);

  // PHASE 2C: Mount breadcrumb
  if (import.meta.env.DEV || (typeof navigator !== 'undefined' && navigator.webdriver)) {
    if (typeof window !== 'undefined' && window.__RB_MOUNT_TRACE__) {
      const timestamp = typeof performance !== 'undefined' ? performance.now().toFixed(1) : Date.now();
      window.__RB_MOUNT_TRACE__.push(`${timestamp} SplitViewLayout:render`);
    }
  }

  // Safety check: ensure engine and circuit are defined
  if (!engine || !tickEngine || !circuit) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-500">
        Initializing circuit engine...
      </div>
    );
  }

  // --- SUBAGENT C: Hardware Mapper ---
  // Headless component to handle auto-spawn
  // Uses key to reset if engine changes, but mostly stable
  // -----------------------------------

  // Renders the mapper, but returns null (headless)
  const hardwareMapper = (
    <HardwareMapper
      circuit={circuit}
      onCircuitChange={onCircuitChange}
    />
  );

  // PHASE 1.5: DEV-only fault injection for ISSUE-A validation
  // When ?fault=selector-object is added, use unstable Zustand selector to trigger React #185
  if (import.meta.env.DEV) {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    if (params.get('fault') === 'selector-object') {
      // This violates Zustand's selector contract: returns new object every render
      // Expected to trigger React #185 "Maximum update depth exceeded"
      const _unstableValue = useLogicViewStore((state) => ({
        toolMode: state.toolMode,
        timestamp: Date.now(), // NEW object every render = infinite loop
      }));

      if (import.meta.env.DEV) {
        console.warn('[FAULT INJECTION] ISSUE-A: unstable selector - expect React #185');
      }
    }
  }

  // Single view mode
  if (mode === 'single') {
    return (
      <div className="w-full h-full">
        <ViewRenderer
          view={views[0] || 'circuit'}
          engine={engine}
          tickEngine={tickEngine}
          circuit={circuit}
          isRunning={isRunning}
          tickCount={tickCount}
          debugSignals={debugSignals}
          debugTick={debugTick}
          mismatchWireHighlights={mismatchWireHighlights}
          mismatchNodeIds={mismatchNodeIds}
          mismatchPortKeys={mismatchPortKeys}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          onCircuitChange={onCircuitChange}
          onNodeDoubleClick={onNodeDoubleClick}
          viewStateStore={viewStateStore}
          getChipMetadata={getChipMetadata}
          showCircuitHints={showCircuitHints}
          onDismissCircuitHints={onDismissCircuitHints}
          showSchematicHints={showSchematicHints}
          onDismissSchematicHints={onDismissSchematicHints}
          show3DHints={show3DHints}
          onDismiss3DHints={onDismiss3DHints}
          showOscilloscopeHints={showOscilloscopeHints}
          onDismissOscilloscopeHints={onDismissOscilloscopeHints}
          onInputToggled={onInputToggled}
          onProbeToggle={onProbeToggle}
          probedPorts={probedPorts}
          probeWireHighlights={probeWireHighlights}
          highlightedPort={highlightedPort}
          isReplayMode={isReplayMode}
          onHelpOpen={onHelpOpen}
          onSignalsUpdated={handleSignalsUpdated}
          latestSignals={latestSignals}
          signalsUpdateReason={signalsUpdateReason}
        />
      </div>
    );
  }

  // Horizontal split (side by side)
  if (mode === 'horizontal') {
    const primaryStyle = { flex: `0 0 ${Math.round(splitRatio * 100)}%` };
    const secondaryStyle = { flex: '1 1 0%' };
    return (
      <div className="w-full h-full flex gap-1 bg-gray-950">
        <div className="bg-gray-900 overflow-hidden" style={primaryStyle}>
          <ViewRenderer
            view={views[0] || 'circuit'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
            tickCount={tickCount}
            debugSignals={debugSignals}
            debugTick={debugTick}
            mismatchWireHighlights={mismatchWireHighlights}
            mismatchNodeIds={mismatchNodeIds}
            mismatchPortKeys={mismatchPortKeys}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            onCircuitChange={onCircuitChange}
            onNodeDoubleClick={onNodeDoubleClick}
            viewStateStore={viewStateStore}
            getChipMetadata={getChipMetadata}
            showCircuitHints={showCircuitHints}
            onDismissCircuitHints={onDismissCircuitHints}
            showSchematicHints={showSchematicHints}
            onDismissSchematicHints={onDismissSchematicHints}
            show3DHints={show3DHints}
            onDismiss3DHints={onDismiss3DHints}
            showOscilloscopeHints={showOscilloscopeHints}
            onDismissOscilloscopeHints={onDismissOscilloscopeHints}
            onInputToggled={onInputToggled}
            onProbeToggle={onProbeToggle}
            probedPorts={probedPorts}
            probeWireHighlights={probeWireHighlights}
            highlightedPort={highlightedPort}
            isReplayMode={isReplayMode}
            onHelpOpen={onHelpOpen}
            onSignalsUpdated={handleSignalsUpdated}
            latestSignals={latestSignals}
            signalsUpdateReason={signalsUpdateReason}
            signalsVersion={signalsVersion}
          />
        </div>
        <div className="bg-gray-900 overflow-hidden" style={secondaryStyle}>
          <ViewRenderer
            view={views[1] || 'schematic'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
            tickCount={tickCount}
            debugSignals={debugSignals}
            debugTick={debugTick}
            mismatchWireHighlights={mismatchWireHighlights}
            mismatchNodeIds={mismatchNodeIds}
            mismatchPortKeys={mismatchPortKeys}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            onCircuitChange={onCircuitChange}
            onNodeDoubleClick={onNodeDoubleClick}
            viewStateStore={viewStateStore}
            getChipMetadata={getChipMetadata}
            showCircuitHints={showCircuitHints}
            onDismissCircuitHints={onDismissCircuitHints}
            showSchematicHints={showSchematicHints}
            onDismissSchematicHints={onDismissSchematicHints}
            show3DHints={show3DHints}
            onDismiss3DHints={onDismiss3DHints}
            showOscilloscopeHints={showOscilloscopeHints}
            onDismissOscilloscopeHints={onDismissOscilloscopeHints}
            onProbeToggle={onProbeToggle}
            probedPorts={probedPorts}
            probeWireHighlights={probeWireHighlights}
            highlightedPort={highlightedPort}
            isReplayMode={isReplayMode}
            onHelpOpen={onHelpOpen}
            onSignalsUpdated={handleSignalsUpdated}
            latestSignals={latestSignals}
            signalsUpdateReason={signalsUpdateReason}
            signalsVersion={signalsVersion}
          />
        </div>
      </div>
    );
  }

  // Vertical split (stacked)
  if (mode === 'vertical') {
    const primaryStyle = { flex: `0 0 ${Math.round(splitRatio * 100)}%` };
    const secondaryStyle = { flex: '1 1 0%' };
    return (
      <div className="w-full h-full flex flex-col gap-1 bg-gray-950">
        <div className="bg-gray-900 overflow-hidden" style={primaryStyle}>
          <ViewRenderer
            view={views[0] || 'circuit'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
            tickCount={tickCount}
            debugSignals={debugSignals}
            debugTick={debugTick}
            mismatchWireHighlights={mismatchWireHighlights}
            mismatchNodeIds={mismatchNodeIds}
            mismatchPortKeys={mismatchPortKeys}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            onCircuitChange={onCircuitChange}
            onNodeDoubleClick={onNodeDoubleClick}
            viewStateStore={viewStateStore}
            getChipMetadata={getChipMetadata}
            showCircuitHints={showCircuitHints}
            onDismissCircuitHints={onDismissCircuitHints}
            showSchematicHints={showSchematicHints}
            onDismissSchematicHints={onDismissSchematicHints}
            show3DHints={show3DHints}
            onDismiss3DHints={onDismiss3DHints}
            showOscilloscopeHints={showOscilloscopeHints}
            onDismissOscilloscopeHints={onDismissOscilloscopeHints}
            onInputToggled={onInputToggled}
            onProbeToggle={onProbeToggle}
            probedPorts={probedPorts}
            probeWireHighlights={probeWireHighlights}
            highlightedPort={highlightedPort}
            isReplayMode={isReplayMode}
            onHelpOpen={onHelpOpen}
            onSignalsUpdated={handleSignalsUpdated}
            latestSignals={latestSignals}
            signalsUpdateReason={signalsUpdateReason}
            signalsVersion={signalsVersion}
          />
        </div>
        <div className="bg-gray-900 overflow-hidden" style={secondaryStyle}>
          <ViewRenderer
            view={views[1] || 'oscilloscope'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
            tickCount={tickCount}
            debugSignals={debugSignals}
            debugTick={debugTick}
            mismatchWireHighlights={mismatchWireHighlights}
            mismatchNodeIds={mismatchNodeIds}
            mismatchPortKeys={mismatchPortKeys}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            onCircuitChange={onCircuitChange}
            onNodeDoubleClick={onNodeDoubleClick}
            viewStateStore={viewStateStore}
            getChipMetadata={getChipMetadata}
            showCircuitHints={showCircuitHints}
            onDismissCircuitHints={onDismissCircuitHints}
            showSchematicHints={showSchematicHints}
            onDismissSchematicHints={onDismissSchematicHints}
            show3DHints={show3DHints}
            onDismiss3DHints={onDismiss3DHints}
            showOscilloscopeHints={showOscilloscopeHints}
            onDismissOscilloscopeHints={onDismissOscilloscopeHints}
            onProbeToggle={onProbeToggle}
            probedPorts={probedPorts}
            probeWireHighlights={probeWireHighlights}
            highlightedPort={highlightedPort}
            isReplayMode={isReplayMode}
            onHelpOpen={onHelpOpen}
            onSignalsUpdated={handleSignalsUpdated}
            latestSignals={latestSignals}
            signalsUpdateReason={signalsUpdateReason}
            signalsVersion={signalsVersion}
          />
        </div>
      </div>
    );
  }

  // Quad view (2x2 grid)
  if (mode === 'quad') {
    return (
      <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-1 bg-gray-950">
        <div className="bg-gray-900 overflow-hidden">
          <ViewRenderer
            view={views[0] || 'circuit'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
            tickCount={tickCount}
            debugSignals={debugSignals}
            debugTick={debugTick}
            mismatchWireHighlights={mismatchWireHighlights}
            mismatchNodeIds={mismatchNodeIds}
            mismatchPortKeys={mismatchPortKeys}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            onCircuitChange={onCircuitChange}
            onNodeDoubleClick={onNodeDoubleClick}
            viewStateStore={viewStateStore}
            getChipMetadata={getChipMetadata}
            showCircuitHints={showCircuitHints}
            onDismissCircuitHints={onDismissCircuitHints}
            showSchematicHints={showSchematicHints}
            onDismissSchematicHints={onDismissSchematicHints}
            show3DHints={show3DHints}
            onDismiss3DHints={onDismiss3DHints}
            showOscilloscopeHints={showOscilloscopeHints}
            onDismissOscilloscopeHints={onDismissOscilloscopeHints}
            onInputToggled={onInputToggled}
            onProbeToggle={onProbeToggle}
            probedPorts={probedPorts}
            probeWireHighlights={probeWireHighlights}
            highlightedPort={highlightedPort}
            isReplayMode={isReplayMode}
            onHelpOpen={onHelpOpen}
            onSignalsUpdated={handleSignalsUpdated}
            latestSignals={latestSignals}
            signalsUpdateReason={signalsUpdateReason}
            signalsVersion={signalsVersion}
          />
        </div>
        <div className="bg-gray-900 overflow-hidden">
          <ViewRenderer
            view={views[1] || 'schematic'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
            tickCount={tickCount}
            debugSignals={debugSignals}
            debugTick={debugTick}
            mismatchWireHighlights={mismatchWireHighlights}
            mismatchNodeIds={mismatchNodeIds}
            mismatchPortKeys={mismatchPortKeys}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            onCircuitChange={onCircuitChange}
            onNodeDoubleClick={onNodeDoubleClick}
            viewStateStore={viewStateStore}
            getChipMetadata={getChipMetadata}
            showCircuitHints={showCircuitHints}
            onDismissCircuitHints={onDismissCircuitHints}
            showSchematicHints={showSchematicHints}
            onDismissSchematicHints={onDismissSchematicHints}
            show3DHints={show3DHints}
            onDismiss3DHints={onDismiss3DHints}
            showOscilloscopeHints={showOscilloscopeHints}
            onDismissOscilloscopeHints={onDismissOscilloscopeHints}
            onInputToggled={onInputToggled}
            onProbeToggle={onProbeToggle}
            probedPorts={probedPorts}
            probeWireHighlights={probeWireHighlights}
            highlightedPort={highlightedPort}
            isReplayMode={isReplayMode}
            onHelpOpen={onHelpOpen}
            onSignalsUpdated={handleSignalsUpdated}
            latestSignals={latestSignals}
            signalsUpdateReason={signalsUpdateReason}
            signalsVersion={signalsVersion}
          />
        </div>
        <div className="bg-gray-900 overflow-hidden">
          <ViewRenderer
            view={views[2] || '3d'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
            tickCount={tickCount}
            debugSignals={debugSignals}
            debugTick={debugTick}
            mismatchWireHighlights={mismatchWireHighlights}
            mismatchNodeIds={mismatchNodeIds}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            onCircuitChange={onCircuitChange}
            onNodeDoubleClick={onNodeDoubleClick}
            viewStateStore={viewStateStore}
            getChipMetadata={getChipMetadata}
            showCircuitHints={showCircuitHints}
            onDismissCircuitHints={onDismissCircuitHints}
            showSchematicHints={showSchematicHints}
            onDismissSchematicHints={onDismissSchematicHints}
            show3DHints={show3DHints}
            onDismiss3DHints={onDismiss3DHints}
            showOscilloscopeHints={showOscilloscopeHints}
            onDismissOscilloscopeHints={onDismissOscilloscopeHints}
            onInputToggled={onInputToggled}
            onProbeToggle={onProbeToggle}
            probedPorts={probedPorts}
            probeWireHighlights={probeWireHighlights}
            highlightedPort={highlightedPort}
            isReplayMode={isReplayMode}
            onHelpOpen={onHelpOpen}
            onSignalsUpdated={handleSignalsUpdated}
            latestSignals={latestSignals}
            signalsUpdateReason={signalsUpdateReason}
            signalsVersion={signalsVersion}
          />
        </div>
        <div className="bg-gray-900 overflow-hidden">
          <ViewRenderer
            view={views[3] || 'oscilloscope'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
            onCircuitChange={onCircuitChange}
            onNodeDoubleClick={onNodeDoubleClick}
            viewStateStore={viewStateStore}
            getChipMetadata={getChipMetadata}
            showCircuitHints={showCircuitHints}
            onDismissCircuitHints={onDismissCircuitHints}
            showSchematicHints={showSchematicHints}
            onDismissSchematicHints={onDismissSchematicHints}
            show3DHints={show3DHints}
            onDismiss3DHints={onDismiss3DHints}
            showOscilloscopeHints={showOscilloscopeHints}
            onDismissOscilloscopeHints={onDismissOscilloscopeHints}
            onProbeToggle={onProbeToggle}
            probedPorts={probedPorts}
            probeWireHighlights={probeWireHighlights}
            highlightedPort={highlightedPort}
            onHelpOpen={onHelpOpen}
            onSignalsUpdated={handleSignalsUpdated}
            latestSignals={latestSignals}
            signalsUpdateReason={signalsUpdateReason}
            signalsVersion={signalsVersion}
          />
        </div>
      </div>
    );
  }

  return null;
};
