// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { analyzeCircuitHealth, type HealthIssue } from '../logic/circuitHealth';

export interface CircuitHealthPanelProps {
  circuit: Circuit;
  onFocusNode?: (nodeId: string, portName?: string) => void;
}

export const CircuitHealthPanel: React.FC<CircuitHealthPanelProps> = ({
  circuit,
  onFocusNode,
}) => {
  const health = React.useMemo(() => analyzeCircuitHealth(circuit), [circuit]);

  const handleIssueClick = (issue: HealthIssue) => {
    if (onFocusNode) {
      onFocusNode(issue.nodeId, issue.portName);
    }
  };

  if (health.isHealthy && circuit.nodes.length > 0) {
    return (
      <div className="p-4 text-sm">
        <div className="flex items-center gap-2 text-green-400">
          <span className="text-lg">✓</span>
          <span className="font-semibold">Circuit looks healthy</span>
        </div>
        <p className="text-gray-400 mt-2">All components are properly connected.</p>
      </div>
    );
  }

  if (circuit.nodes.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-400">
        <p>Add components to see circuit health analysis.</p>
      </div>
    );
  }

  // Group issues by severity
  const warnings = health.issues.filter((i) => i.severity === 'warning');
  const hints = health.issues.filter((i) => i.severity === 'hint');

  return (
    <div className="p-4 text-sm space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-2">
        {health.hasWarnings ? (
          <>
            <span className="text-lg">⚠️</span>
            <span className="font-semibold text-yellow-400">
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
          </>
        ) : (
          <>
            <span className="text-lg">💡</span>
            <span className="font-semibold text-blue-400">Suggestions</span>
          </>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wide text-yellow-400 font-semibold">
            Warnings
          </h3>
          {warnings.map((issue, i) => (
            <button
              key={i}
              onClick={() => handleIssueClick(issue)}
              className="w-full text-left p-2 rounded bg-yellow-900/20 hover:bg-yellow-900/30 border border-yellow-700/30 transition-colors cursor-pointer"
            >
              <div className="text-yellow-300 text-xs">{issue.message}</div>
              <div className="text-gray-500 text-xs mt-1">Click to focus</div>
            </button>
          ))}
        </div>
      )}

      {/* Hints */}
      {hints.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wide text-blue-400 font-semibold">Hints</h3>
          {hints.map((issue, i) => (
            <button
              key={i}
              onClick={() => handleIssueClick(issue)}
              className="w-full text-left p-2 rounded bg-blue-900/20 hover:bg-blue-900/30 border border-blue-700/30 transition-colors cursor-pointer"
            >
              <div className="text-blue-300 text-xs">{issue.message}</div>
              <div className="text-gray-500 text-xs mt-1">Click to focus</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
