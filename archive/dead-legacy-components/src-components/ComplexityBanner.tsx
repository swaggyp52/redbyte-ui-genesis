// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Complexity warning banner for circuit size guardrails

import React from 'react';
import { useClassroomModeStore } from '../stores/classroomModeStore';

interface ComplexityBannerProps {
  onDismiss?: () => void;
}

export const ComplexityBanner: React.FC<ComplexityBannerProps> = ({ onDismiss }) => {
  const { nodeCount, isComplexityWarning, isComplexityBlocked, safeMode } = useClassroomModeStore();
  const [showDetails, setShowDetails] = React.useState(false);

  if (!isComplexityWarning && !isComplexityBlocked) return null;

  if (isComplexityBlocked) {
    return (
      <div
        className="bg-red-900 text-red-50 px-4 py-3 border-b border-red-700"
        data-testid="complexity-blocked-banner"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">🛑</span>
            <div>
              <div className="font-semibold text-sm">
                Circuit limit reached ({nodeCount} nodes)
              </div>
              <div className="text-xs text-red-200 mt-0.5">
                Simplify your circuit or reset workspace to continue.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded text-xs transition-all"
              data-testid="complexity-details-button"
            >
              {showDetails ? 'Hide Details' : 'Details'}
            </button>
          </div>
        </div>

        {showDetails && (
          <div className="mt-3 pt-3 border-t border-red-700 text-xs text-red-100">
            <div><strong>Node count:</strong> {nodeCount} / 20 (max)</div>
            <div className="mt-1 text-red-200">
              Try: Remove some components, use simpler gates, or click "Reset Workspace" in the top bar.
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="bg-orange-900 text-orange-50 px-4 py-3 border-b border-orange-700"
      data-testid="complexity-warning-banner"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <div className="font-semibold text-sm">
              Circuit is getting complex ({nodeCount} nodes)
            </div>
            <div className="text-xs text-orange-200 mt-0.5">
              Switching to step mode to stay responsive. {safeMode && 'Safe Mode is active.'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 bg-orange-800 hover:bg-orange-700 text-white rounded text-xs transition-all"
              data-testid="complexity-dismiss-button"
            >
              Dismiss
            </button>
          )}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-1.5 bg-orange-800 hover:bg-orange-700 text-white rounded text-xs transition-all"
            data-testid="complexity-details-button"
          >
            {showDetails ? 'Hide Details' : 'Details'}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-orange-700 text-xs text-orange-100">
          <div><strong>Node count:</strong> {nodeCount} / 15 (warning) / 20 (max)</div>
          <div className="mt-1 text-orange-200">
            Step mode prevents simulation lag. You can still add up to {20 - nodeCount} more nodes.
          </div>
        </div>
      )}
    </div>
  );
};
