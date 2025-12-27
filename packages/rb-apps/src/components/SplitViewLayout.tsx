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
  viewStateStore?: any;
}

interface ViewRendererProps {
  view: ViewMode;
  engine: CircuitEngine;
  tickEngine: TickEngine;
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
  tickEngine,
  circuit,
  isRunning,
  onCircuitChange,
  viewStateStore,
  width,
  height,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });

  React.useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const containerStyle: React.CSSProperties = {
    width: width || '100%',
    height: height || '100%',
    position: 'relative',
    overflow: 'hidden',
  };

  switch (view) {
    case 'circuit':
      return (
        <div ref={containerRef} style={containerStyle}>
          <LogicCanvas
            engine={tickEngine}
            width={dimensions.width}
            height={dimensions.height}
            showToolbar={false}
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
          />
        </div>
      );

    case 'oscilloscope':
      return (
        <div ref={containerRef} style={containerStyle}>
          <OscilloscopeView
            engine={engine}
            circuit={circuit}
            isRunning={isRunning}
            width={dimensions.width}
            height={dimensions.height}
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
  tickEngine,
  circuit,
  isRunning,
  onCircuitChange,
  viewStateStore,
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
            tickEngine={tickEngine}
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
            tickEngine={tickEngine}
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
            tickEngine={tickEngine}
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
            tickEngine={tickEngine}
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
            tickEngine={tickEngine}
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
            tickEngine={tickEngine}
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
            tickEngine={tickEngine}
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
            tickEngine={tickEngine}
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
