// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Classroom guardrail feedback banners

import React, { useState } from 'react';
import { useCircuitStore } from '../stores/circuitStore';
import { useClassroomModeStore } from '../stores/classroomModeStore';

export const ClassroomModeBanner: React.FC = () => {
  const lastClampEvent = useCircuitStore((s) => s.lastClampEvent);
  const clearClampEvent = useCircuitStore((s) => s.clearClampEvent);
  const nodeCount = useClassroomModeStore((s) => s.nodeCount);
  const safeMode = useClassroomModeStore((s) => s.safeMode);
  const isStepOnlyMode = useClassroomModeStore((s) => s.isStepOnlyMode);
  
  const [showDetails, setShowDetails] = useState(false);
  
  // Auto-degrade banner: workspace exceeds limits (from undo or old save)
  const exceeds = nodeCount > 20;
  
  // Clamp banner: circuit was clamped during load/paste
  const showClampBanner = !!lastClampEvent;

  if (!exceeds && !showClampBanner) {
    return null;
  }

  if (showClampBanner && lastClampEvent) {
    const dropped = lastClampEvent.originalNodes - lastClampEvent.keptNodes;
    
    return (
      <div
        className="bg-yellow-900 text-yellow-50 px-4 py-2 text-sm border-b border-yellow-700"
        data-testid="clamp-banner"
      >
        <div className="flex items-center justify-between">
          <span>
            <strong>⚠️ Circuit too large:</strong> Loaded {lastClampEvent.keptNodes} of {lastClampEvent.originalNodes} nodes (dropped {dropped}).
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-yellow-200 hover:text-yellow-100 underline text-xs"
            >
              {showDetails ? 'Hide' : 'Details'}
            </button>
            <button
              onClick={clearClampEvent}
              className="text-yellow-200 hover:text-yellow-100 text-xs px-2 py-1 border border-yellow-600 rounded"
            >
              Dismiss
            </button>
          </div>
        </div>
        
        {showDetails && (
          <div className="mt-2 text-xs bg-yellow-950 p-2 rounded border border-yellow-800">
            <div><strong>Source:</strong> {lastClampEvent.source}</div>
            <div><strong>Original nodes:</strong> {lastClampEvent.originalNodes}</div>
            <div><strong>Kept nodes:</strong> {lastClampEvent.keptNodes}</div>
            <div><strong>Dropped:</strong> {dropped}</div>
            <div className="mt-1 opacity-75">
              Classroom limit is 20 nodes. First 20 nodes were kept; remaining nodes and orphaned connections were removed.
            </div>
          </div>
        )}
      </div>
    );
  }

  if (exceeds) {
    return (
      <div
        className="bg-red-900 text-red-50 px-4 py-2 text-sm border-b border-red-700"
        data-testid="auto-degrade-banner"
      >
        <div className="flex items-center justify-between">
          <span>
            <strong>🛡️ Workspace exceeds classroom limits ({nodeCount} nodes).</strong> Safe Mode + Step-only enabled.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-red-200 hover:text-red-100 underline text-xs"
            >
              {showDetails ? 'Hide' : 'Details'}
            </button>
          </div>
        </div>
        
        {showDetails && (
          <div className="mt-2 text-xs bg-red-950 p-2 rounded border border-red-800">
            <div><strong>Current nodes:</strong> {nodeCount}</div>
            <div><strong>Classroom limit:</strong> 20 nodes</div>
            <div><strong>Safe Mode:</strong> {safeMode ? 'ON' : 'OFF'}</div>
            <div><strong>Step-only:</strong> {isStepOnlyMode ? 'ON' : 'OFF'}</div>
            <div className="mt-1 opacity-75">
              This workspace has more than 20 nodes (likely from undo or an old saved circuit).
              Heavy features are disabled. Remove nodes to restore full functionality.
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

