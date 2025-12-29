// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { CircuitEngine, Circuit, TickEngine } from '@redbyte/rb-logic-core';
import { LogicCanvas } from '@redbyte/rb-logic-view';
import { Logic3DScene } from '@redbyte/rb-logic-3d';
import { SchematicView } from './SchematicView';
import { OscilloscopeView } from './OscilloscopeView';
import type { SplitScreenMode, ViewMode } from '../stores/viewStateStore';

interface SplitViewLayoutProps {
  mode: SplitScreenMode;
  views: ViewMode[];
  engine: CircuitEngine;
  tickEngine: TickEngine;
  circuit: Circuit;
  isRunning: boolean;
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
}

interface ViewRendererProps {
  view: ViewMode;
  engine: CircuitEngine;
  tickEngine: TickEngine;
  circuit: Circuit;
  isRunning: boolean;
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
}

// View metadata for headers
const VIEW_METADATA = {
  circuit: { icon: '⚡', label: 'Circuit View', color: 'cyan' },
  schematic: { icon: '📐', label: 'Schematic View', color: 'blue' },
  '3d': { icon: '🧊', label: '3D View', color: 'purple' },
  oscilloscope: { icon: '📊', label: 'Oscilloscope', color: 'green' },
} as const;

const ViewRenderer: React.FC<ViewRendererProps> = ({
  view,
  engine,
  tickEngine,
  circuit,
  isRunning,
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
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });

  React.useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Account for header height
        setDimensions({ width: rect.width, height: rect.height - 32 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

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
              key={`circuit-${circuit.nodes.length}-${circuit.connections.length}`}
              engine={tickEngine}
              width={dimensions.width}
              height={dimensions.height}
              showToolbar={false}
              showHints={showCircuitHints}
              onDismissHints={onDismissCircuitHints}
              getChipMetadata={getChipMetadata}
              onNodeDoubleClick={onNodeDoubleClick}
              onInputToggled={onInputToggled}
            />
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
            />
          </div>
        );

      case '3d':
        return (
          <div ref={containerRef} style={containerStyle}>
            <Logic3DScene
              engine={engine}
              width={dimensions.width}
              height={dimensions.height}
              viewStateStore={viewStateStore}
              getChipMetadata={getChipMetadata}
              showHints={show3DHints}
              onDismissHints={onDismiss3DHints}
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
    <div className="flex flex-col h-full">
      {/* View Header */}
      <div className={`h-8 px-3 flex items-center gap-2 border-b border-gray-700/50 bg-gradient-to-r from-${metadata.color}-900/20 to-gray-900/20`}>
        <span className="text-lg">{metadata.icon}</span>
        <span className={`text-xs font-semibold text-${metadata.color}-400 uppercase tracking-wide`}>{metadata.label}</span>
        <div className="ml-auto text-[10px] text-gray-500">
          {circuit.nodes.length} nodes • {circuit.connections.length} wires
        </div>
      </div>
      {/* View Content */}
      {renderContent()}
    </div>
  );
};

export const SplitViewLayout: React.FC<SplitViewLayoutProps> = ({
  mode,
  views,
  engine,
  tickEngine,
  circuit,
  isRunning,
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
}) => {
  // Safety check: ensure engine and circuit are defined
  if (!engine || !tickEngine || !circuit) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-500">
        Initializing circuit engine...
      </div>
    );
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
        />
      </div>
    );
  }

  // Horizontal split (side by side)
  if (mode === 'horizontal') {
    return (
      <div className="w-full h-full flex gap-1 bg-gray-950">
        <div className="flex-1 bg-gray-900 overflow-hidden">
          <ViewRenderer
            view={views[0] || 'circuit'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
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
          />
        </div>
        <div className="flex-1 bg-gray-900 overflow-hidden">
          <ViewRenderer
            view={views[1] || 'schematic'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
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
          />
        </div>
      </div>
    );
  }

  // Vertical split (stacked)
  if (mode === 'vertical') {
    return (
      <div className="w-full h-full flex flex-col gap-1 bg-gray-950">
        <div className="flex-1 bg-gray-900 overflow-hidden">
          <ViewRenderer
            view={views[0] || 'circuit'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
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
          />
        </div>
        <div className="flex-1 bg-gray-900 overflow-hidden">
          <ViewRenderer
            view={views[1] || 'oscilloscope'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
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
          />
        </div>
        <div className="bg-gray-900 overflow-hidden">
          <ViewRenderer
            view={views[1] || 'schematic'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
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
          />
        </div>
        <div className="bg-gray-900 overflow-hidden">
          <ViewRenderer
            view={views[2] || '3d'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
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
          />
        </div>
        <div className="bg-gray-900 overflow-hidden">
          <ViewRenderer
            view={views[3] || 'oscilloscope'}
            engine={engine}
            tickEngine={tickEngine}
            circuit={circuit}
            isRunning={isRunning}
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
          />
        </div>
      </div>
    );
  }

  return null;
};
