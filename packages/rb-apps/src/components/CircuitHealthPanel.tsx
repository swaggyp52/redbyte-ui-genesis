// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { analyzeCircuitHealth, type HealthIssue } from '../logic/circuitHealth';

export interface CircuitHealthPanelProps {
  circuit: Circuit;
  onFocusNode?: (nodeId: string, portName?: string) => void;
  onIssueHover?: (nodeId: string | null, portName?: string | null) => void;
}

const ISSUE_DETAILS: Record<HealthIssue['type'], { why: string; suggestion: string; fixHint: string }> = {
  'unconnected-input': {
    why: 'Inputs left floating will read as 0 and can block logic evaluation.',
    suggestion: 'Wire the input to a source or remove the gate if unused.',
    fixHint: 'Connect the input to a switch, input pin, or power source.',
  },
  'floating-output': {
    why: 'Outputs that do not feed anything make it hard to observe behavior.',
    suggestion: 'Connect the output to a Lamp/OUTPUT or another gate.',
    fixHint: 'Wire the output into a Lamp or OUTPUT node.',
  },
  'disconnected-subgraph': {
    why: 'Disconnected groups of nodes do not affect the main circuit.',
    suggestion: 'Connect the subgraph or delete unused nodes.',
    fixHint: 'Connect this group to the main circuit or remove it.',
  },
  'no-inputs': {
    why: 'Without an input source, the circuit cannot be stimulated.',
    suggestion: 'Add a Switch, INPUT, or PowerSource.',
    fixHint: 'Add at least one input source to drive signals.',
  },
  'no-outputs': {
    why: 'Without an output, there is no visible result.',
    suggestion: 'Add a Lamp or OUTPUT node to observe signals.',
    fixHint: 'Add a Lamp or OUTPUT node to observe behavior.',
  },
};

export const CircuitHealthPanel: React.FC<CircuitHealthPanelProps> = ({
  circuit,
  onFocusNode,
  onIssueHover,
}) => {
  const health = React.useMemo(() => analyzeCircuitHealth(circuit), [circuit]);
  const [ignoredIssues, setIgnoredIssues] = React.useState<Set<string>>(new Set());

  const getIssueId = (issue: HealthIssue) =>
    `${issue.type}:${issue.nodeId}:${issue.portName ?? 'none'}`;

  const handleIssueFocus = (issue: HealthIssue) => {
    if (onFocusNode) {
      onFocusNode(issue.nodeId, issue.portName);
    }
  };

  const handleIssueHover = (issue: HealthIssue | null) => {
    if (!onIssueHover) return;
    if (!issue) {
      onIssueHover(null, null);
      return;
    }
    onIssueHover(issue.nodeId, issue.portName ?? null);
  };

  const toggleIgnore = (issue: HealthIssue) => {
    const id = getIssueId(issue);
    setIgnoredIssues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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

  const visibleIssues = health.issues.filter((issue) => !ignoredIssues.has(getIssueId(issue)));

  // Group issues by severity
  const warnings = visibleIssues.filter((i) => i.severity === 'warning');
  const hints = visibleIssues.filter((i) => i.severity === 'hint');

  const suggestions = Array.from(
    new Set(
      visibleIssues
        .map((issue) => ISSUE_DETAILS[issue.type]?.suggestion)
        .filter((item): item is string => Boolean(item))
    )
  );

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

      {/* Fix Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wide text-cyan-300 font-semibold">
            Fix Suggestions
          </h3>
          <ul className="space-y-1 text-xs text-gray-300">
            {suggestions.map((suggestion) => (
              <li key={suggestion} className="bg-gray-800/40 border border-gray-700/50 rounded px-2 py-1">
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wide text-yellow-400 font-semibold">
            Warnings
          </h3>
          {warnings.map((issue, i) => (
            <div
              key={i}
              className="w-full text-left p-3 rounded bg-yellow-900/20 border border-yellow-700/30 space-y-2"
              onMouseEnter={() => handleIssueHover(issue)}
              onMouseLeave={() => handleIssueHover(null)}
            >
              <div className="text-yellow-300 text-xs font-semibold">{issue.message}</div>
              <div className="text-[10px] text-yellow-200/80">
                Fix hint: {ISSUE_DETAILS[issue.type]?.fixHint}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleIssueFocus(issue)}
                  className="px-2 py-1 text-[10px] bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-200 rounded transition-colors"
                  type="button"
                >
                  Focus
                </button>
                <button
                  onClick={() => toggleIgnore(issue)}
                  className="px-2 py-1 text-[10px] bg-gray-800/60 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                  type="button"
                >
                  {ignoredIssues.has(getIssueId(issue)) ? 'Unignore' : 'Ignore'}
                </button>
              </div>
              <details className="text-[10px] text-gray-400">
                <summary className="cursor-pointer text-gray-300">Why?</summary>
                <div className="mt-1">{ISSUE_DETAILS[issue.type]?.why}</div>
              </details>
            </div>
          ))}
        </div>
      )}

      {/* Hints */}
      {hints.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-wide text-blue-400 font-semibold">Hints</h3>
          {hints.map((issue, i) => (
            <div
              key={i}
              className="w-full text-left p-3 rounded bg-blue-900/20 border border-blue-700/30 space-y-2"
              onMouseEnter={() => handleIssueHover(issue)}
              onMouseLeave={() => handleIssueHover(null)}
            >
              <div className="text-blue-300 text-xs font-semibold">{issue.message}</div>
              <div className="text-[10px] text-blue-200/80">
                Fix hint: {ISSUE_DETAILS[issue.type]?.fixHint}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleIssueFocus(issue)}
                  className="px-2 py-1 text-[10px] bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 rounded transition-colors"
                  type="button"
                >
                  Focus
                </button>
                <button
                  onClick={() => toggleIgnore(issue)}
                  className="px-2 py-1 text-[10px] bg-gray-800/60 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                  type="button"
                >
                  {ignoredIssues.has(getIssueId(issue)) ? 'Unignore' : 'Ignore'}
                </button>
              </div>
              <details className="text-[10px] text-gray-400">
                <summary className="cursor-pointer text-gray-300">Why?</summary>
                <div className="mt-1">{ISSUE_DETAILS[issue.type]?.why}</div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
