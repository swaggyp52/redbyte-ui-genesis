import React from 'react';
import { Plus, Trash2, Zap, Undo, Redo, ChevronDown } from 'lucide-react';
import type { CircuitNode } from '../plugins/LabDoc';
import { useIsSmallScreen } from '../hooks/useBreakpoint';

interface ToolbarProps {
  onAddNode: (gateType: CircuitNode['type']) => void;
  onDelete: () => void;
  onValidate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectedNodeCount: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onAddNode,
  onDelete,
  onValidate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  selectedNodeCount,
}) => {
  const isSmallScreen = useIsSmallScreen();
  const [showGatePalette, setShowGatePalette] = React.useState(false);

  if (isSmallScreen) {
    return (
      <div className="absolute top-0 left-0 right-0 bg-slate-900 border-b border-slate-700 p-2 flex flex-col gap-1 z-10">
        {/* Mobile compact toolbar */}
        <div className="flex gap-1">
          {/* Gate menu dropdown */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowGatePalette(!showGatePalette)}
              className="px-2 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-xs flex items-center justify-between gap-1 transition w-full"
              title="Add logic gate"
            >
              <Plus size={14} />
              Gates
              <ChevronDown size={12} />
            </button>
            {showGatePalette && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded shadow-lg z-20">
                <button
                  onClick={() => { onAddNode('INPUT'); setShowGatePalette(false); }}
                  className="w-full text-left px-2 py-1.5 text-xs text-green-100 hover:bg-slate-700 block border-b border-slate-700"
                >
                  INPUT
                </button>
                <button
                  onClick={() => { onAddNode('AND'); setShowGatePalette(false); }}
                  className="w-full text-left px-2 py-1.5 text-xs text-teal-100 hover:bg-slate-700 block border-b border-slate-700"
                >
                  AND
                </button>
                <button
                  onClick={() => { onAddNode('OR'); setShowGatePalette(false); }}
                  className="w-full text-left px-2 py-1.5 text-xs text-cyan-100 hover:bg-slate-700 block border-b border-slate-700"
                >
                  OR
                </button>
                <button
                  onClick={() => { onAddNode('NOT'); setShowGatePalette(false); }}
                  className="w-full text-left px-2 py-1.5 text-xs text-orange-100 hover:bg-slate-700 block border-b border-slate-700"
                >
                  NOT
                </button>
                <button
                  onClick={() => { onAddNode('XOR'); setShowGatePalette(false); }}
                  className="w-full text-left px-2 py-1.5 text-xs text-purple-100 hover:bg-slate-700 block border-b border-slate-700"
                >
                  XOR
                </button>
                <button
                  onClick={() => { onAddNode('OUTPUT'); setShowGatePalette(false); }}
                  className="w-full text-left px-2 py-1.5 text-xs text-red-100 hover:bg-slate-700"
                >
                  OUTPUT
                </button>
              </div>
            )}
          </div>

          {/* Action buttons grid */}
          <button
            onClick={onDelete}
            disabled={selectedNodeCount === 0}
            className="px-1.5 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 rounded text-xs flex items-center gap-0.5 transition"
            title="Delete (Del)"
          >
            <Trash2 size={14} />
            <span className="hidden xs:inline">Del</span>
          </button>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="px-1.5 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 rounded text-xs flex items-center gap-0.5 transition"
            title="Undo (Ctrl+Z)"
          >
            <Undo size={14} />
            <span className="hidden xs:inline">Z</span>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="px-1.5 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 rounded text-xs flex items-center gap-0.5 transition"
            title="Redo (Ctrl+Y)"
          >
            <Redo size={14} />
            <span className="hidden xs:inline">Y</span>
          </button>
          <button
            onClick={onValidate}
            className="px-1.5 py-2 bg-yellow-900 hover:bg-yellow-800 text-yellow-100 rounded text-xs flex items-center gap-0.5 transition"
            title="Validate"
          >
            <Zap size={14} />
            <span className="hidden xs:inline">✓</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-0 left-0 right-0 bg-slate-900 border-b border-slate-700 p-3 flex gap-2 flex-wrap z-10">
      {/* Add gate buttons */}
      <div className="flex gap-1 border-r border-slate-700 pr-3">
        <button
          onClick={() => onAddNode('INPUT')}
          className="px-3 py-2 bg-green-900 hover:bg-green-800 text-green-100 rounded text-sm flex items-center gap-1 transition"
          title="Add INPUT node"
        >
          <Plus size={16} />
          INPUT
        </button>
        <button
          onClick={() => onAddNode('AND')}
          className="px-3 py-2 bg-teal-900 hover:bg-teal-800 text-teal-100 rounded text-sm flex items-center gap-1 transition"
          title="Add AND gate"
        >
          <Plus size={16} />
          AND
        </button>
        <button
          onClick={() => onAddNode('OR')}
          className="px-3 py-2 bg-cyan-900 hover:bg-cyan-800 text-cyan-100 rounded text-sm flex items-center gap-1 transition"
          title="Add OR gate"
        >
          <Plus size={16} />
          OR
        </button>
        <button
          onClick={() => onAddNode('NOT')}
          className="px-3 py-2 bg-orange-900 hover:bg-orange-800 text-orange-100 rounded text-sm flex items-center gap-1 transition"
          title="Add NOT gate"
        >
          <Plus size={16} />
          NOT
        </button>
        <button
          onClick={() => onAddNode('XOR')}
          className="px-3 py-2 bg-purple-900 hover:bg-purple-800 text-purple-100 rounded text-sm flex items-center gap-1 transition"
          title="Add XOR gate"
        >
          <Plus size={16} />
          XOR
        </button>
        <button
          onClick={() => onAddNode('OUTPUT')}
          className="px-3 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded text-sm flex items-center gap-1 transition"
          title="Add OUTPUT node"
        >
          <Plus size={16} />
          OUTPUT
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1 border-r border-slate-700 pr-3">
        <button
          onClick={onDelete}
          disabled={selectedNodeCount === 0}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 rounded text-sm flex items-center gap-1 transition"
          title="Delete selected node(s) — Press Delete"
        >
          <Trash2 size={16} />
          Delete
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 rounded text-sm flex items-center gap-1 transition"
          title="Undo — Ctrl+Z"
        >
          <Undo size={16} />
          Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 rounded text-sm flex items-center gap-1 transition"
          title="Redo — Ctrl+Y or Ctrl+Shift+Z"
        >
          <Redo size={16} />
          Redo
        </button>
      </div>

      {/* Validation button */}
      <button
        onClick={onValidate}
        className="px-3 py-2 bg-blue-900 hover:bg-blue-800 text-blue-100 rounded text-sm flex items-center gap-1 transition"
        title="Validate circuit against truth table"
      >
        <Zap size={16} />
        Validate
      </button>
    </div>
  );
};
