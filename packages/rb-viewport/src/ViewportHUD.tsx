// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Viewport HUD — Shows zoom%, mode, and hints

import React from 'react';
import type { InteractionState } from './types.js';

export interface ViewportHUDProps {
  zoom: number;
  mode?: InteractionState;
  hints?: string[];
}

export const ViewportHUD: React.FC<ViewportHUDProps> = ({
  zoom,
  mode = 'idle',
  hints = []
}) => {
  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end pointer-events-none">
      {/* Zoom + Mode Indicator */}
      <div className="bg-gray-800/90 backdrop-blur border border-gray-700 rounded-lg px-3 py-1.5 shadow-lg pointer-events-auto flex items-center gap-2">
        <span className="text-[10px] font-mono text-cyan-400 min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        {mode !== 'idle' && (
          <>
            <div className="w-px h-3 bg-gray-600"></div>
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">{mode}</span>
          </>
        )}
      </div>

      {/* Hints (Optional) */}
      {hints.length > 0 && (
        <div className="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg px-2 py-1 shadow-lg text-[9px] text-gray-500 max-w-[200px]">
          {hints.map((hint, i) => (
            <div key={i}>{hint}</div>
          ))}
        </div>
      )}
    </div>
  );
};
