// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { useHierarchyStore } from '../stores/hierarchyStore';

export const HierarchyBreadcrumbs: React.FC = () => {
  const { stack, exitToParent, exitToTop, isEditMode, currentChip } = useHierarchyStore();

  // Don't show if we're at top level
  if (stack.length === 0) return null;

  const currentLevel = stack[stack.length - 1];

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-b border-purple-600/50">
      {/* Context indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-purple-300 font-semibold">
          {isEditMode ? '✏️ Editing:' : '👁️ Viewing:'}
        </span>
        <span className="text-white font-bold">{currentLevel.name}</span>
        <span className="text-purple-400 text-xs">
          (Layer {stack.length})
        </span>
      </div>

      {/* Breadcrumb trail */}
      <div className="flex items-center gap-1 ml-4 text-xs flex-1">
        <button
          onClick={exitToTop}
          className="px-2 py-1 hover:bg-purple-700/50 rounded text-purple-200 transition-colors"
          title="Return to top level"
        >
          🏠 Top
        </button>

        {stack.map((level, i) => (
          <React.Fragment key={i}>
            <span className="text-purple-500">›</span>
            <span className="text-purple-300">{level.name}</span>
          </React.Fragment>
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={exitToParent}
          className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded text-white font-semibold transition-colors flex items-center gap-1"
          title="Back to parent (Esc)"
        >
          ← Back
        </button>

        <button
          onClick={exitToTop}
          className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-white font-semibold transition-colors"
          title="Exit to top level"
        >
          Exit All
        </button>
      </div>

      {/* Edit mode hint */}
      {!isEditMode && (
        <div className="text-xs text-purple-300 italic">
          Read-only • Press 'E' to edit
        </div>
      )}

      {/* Chip I/O indicator */}
      {currentChip && (
        <div className="flex items-center gap-2 text-xs border-l border-purple-600/50 pl-3">
          <span className="text-purple-400">I/O:</span>
          <span className="text-green-400">{currentChip.inputs.length} in</span>
          <span className="text-orange-400">{currentChip.outputs.length} out</span>
        </div>
      )}
    </div>
  );
};
