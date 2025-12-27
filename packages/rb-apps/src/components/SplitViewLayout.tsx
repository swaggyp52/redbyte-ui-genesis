// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { CircuitEngine, Circuit } from '@redbyte/rb-logic-core';
import { LogicCanvas } from '@redbyte/rb-logic-view';
import { Logic3DScene } from '@redbyte/rb-logic-3d';
import { SchematicView } from './SchematicView';
import { OscilloscopeView } from './OscilloscopeView';
import type { SplitScreenMode, ViewMode } from '../stores/viewStateStore';

interface SplitViewLayoutProps {
  mode: SplitScreenMode;
  views: ViewMode[];
  engine: CircuitEngine;
  circuit: Circuit;
  isRunning: boolean;
  onCircuitChange: (circuit: Circuit) => void;
  viewStateStore?: any;
}

interface ViewRendererProps {
  view: ViewMode;
  engine: CircuitEngine;
  circuit: Circuit;
  isRunning: boolean;
  onCircuitChange: (circuit: Circuit) => void;
  viewStateStore?: any;
  width?: number;
  height?: number;
}

const ViewRenderer: React.FC<ViewRendererProps> = ({
  view,
  engine,
  circuit,
  isRunning,
  onCircuitChange,
  viewStateStore,
  width,
  height,
}) => {
  const containerStyle: React.CSSProperties = {
    width: width || '100%',
    height: height || '100%',
    position: 'relative',
    overflow: 'hidden',
  };

  switch (view) {
    case 'circuit':
      return (
        <div style={containerStyle}>
          <LogicCanvas
            circuit={circuit}
            isRunning={isRunning}
            width={width}
            height={height}
            showToolbar={false}
          />
        </div>
      );

    case 'schematic':
      return (
        <div style={containerStyle}>
          <SchematicView
            circuit={circuit}
            engine={engine}
            isRunning={isRunning}
            width={width}
            height={height}
            onCircuitChange={onCircuitChange}
          />
        </div>
      );

    case 'oscilloscope':
      return (
        <div style={containerStyle}>
          <OscilloscopeView
            engine={engine}
            circuit={circuit}
            isRunning={isRunning}
            width={width}
            height={height}
          />
        </div>
      );

    case '3d':
      return (
        <div style={containerStyle}>
          <Logic3DScene
            engine={engine}
            width={width}
            height={height}
            viewStateStore={viewStateStore}
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

export const SplitViewLayout: React.FC<SplitViewLayoutProps> = ({
  mode,
  views,
  engine,
  circuit,
  isRunning,
  onCircuitChange,
  viewStateStore,
}) => {
  // Single view mode
  if (mode === 'single') {
    return (
      <div className="w-full h-full">
        <ViewRenderer
          view={views[0] || 'circuit'}
          engine={engine}
          circuit={circuit}
          isRunning={isRunning}
          onCircuitChange={onCircuitChange}
          viewStateStore={viewStateStore}
        />
      </div>
    );
  }

  // Horizontal split (side by side)
  if (mode === 'horizontal') {
    return (
      <div className="w-full h-full flex gap-px bg-gray-800">
        <div className="flex-1 bg-gray-900">
          <ViewRenderer
            view={views[0] || 'circuit'}
            engine={engine}
            circuit={circuit}
            isRunning={isRunning}
            onCircuitChange={onCircuitChange}
            viewStateStore={viewStateStore}
          />
        </div>
        <div className="flex-1 bg-gray-900">
          <ViewRenderer
            view={views[1] || 'schematic'}
            engine={engine}
            circuit={circuit}
            isRunning={isRunning}
            onCircuitChange={onCircuitChange}
            viewStateStore={viewStateStore}
          />
        </div>
      </div>
    );
  }

  // Vertical split (stacked)
  if (mode === 'vertical') {
    return (
      <div className="w-full h-full flex flex-col gap-px bg-gray-800">
        <div className="flex-1 bg-gray-900">
          <ViewRenderer
            view={views[0] || 'circuit'}
            engine={engine}
            circuit={circuit}
            isRunning={isRunning}
            onCircuitChange={onCircuitChange}
            viewStateStore={viewStateStore}
          />
        </div>
        <div className="flex-1 bg-gray-900">
          <ViewRenderer
            view={views[1] || 'oscilloscope'}
            engine={engine}
            circuit={circuit}
            isRunning={isRunning}
            onCircuitChange={onCircuitChange}
            viewStateStore={viewStateStore}
          />
        </div>
      </div>
    );
  }

  // Quad view (2x2 grid)
  if (mode === 'quad') {
    return (
      <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-px bg-gray-800">
        <div className="bg-gray-900">
          <ViewRenderer
            view={views[0] || 'circuit'}
            engine={engine}
            circuit={circuit}
            isRunning={isRunning}
            onCircuitChange={onCircuitChange}
            viewStateStore={viewStateStore}
          />
        </div>
        <div className="bg-gray-900">
          <ViewRenderer
            view={views[1] || 'schematic'}
            engine={engine}
            circuit={circuit}
            isRunning={isRunning}
            onCircuitChange={onCircuitChange}
            viewStateStore={viewStateStore}
          />
        </div>
        <div className="bg-gray-900">
          <ViewRenderer
            view={views[2] || '3d'}
            engine={engine}
            circuit={circuit}
            isRunning={isRunning}
            onCircuitChange={onCircuitChange}
            viewStateStore={viewStateStore}
          />
        </div>
        <div className="bg-gray-900">
          <ViewRenderer
            view={views[3] || 'oscilloscope'}
            engine={engine}
            circuit={circuit}
            isRunning={isRunning}
            onCircuitChange={onCircuitChange}
            viewStateStore={viewStateStore}
          />
        </div>
      </div>
    );
  }

  return null;
};
