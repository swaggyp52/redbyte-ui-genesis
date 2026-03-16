import React, { useMemo } from 'react';
import { IdeButton } from '../components/IdePrimitives';
import type { MacroDefinition } from '../macros/MacroLibrary';

export interface MacroLibraryPanelProps {
  macros: MacroDefinition[];
  totalMacroCount?: number;
  searchQuery?: string;
  activeMacroId: string | null;
  onSelectMacro: (macroId: string) => void;
  onDeleteMacro?: (macroId: string) => void;
}

function formatCreatedAt(createdAt: number): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) {
    return 'Saved';
  }
  return new Date(createdAt).toISOString().slice(0, 10);
}

function summarizeIoCount(inputs: number, outputs: number): string {
  return `${inputs} in / ${outputs} out`;
}

function summarizeMacroPorts(macro: MacroDefinition): string {
  const inputLabels = macro.inputs.map((entry) => entry.label).filter((entry) => entry.length > 0);
  const outputLabels = macro.outputs.map((entry) => entry.label).filter((entry) => entry.length > 0);
  const left = inputLabels.length > 0 ? inputLabels.join(', ') : 'inputs';
  const right = outputLabels.length > 0 ? outputLabels.join(', ') : 'outputs';
  return `${left} -> ${right}`;
}

export const MacroLibraryPanel: React.FC<MacroLibraryPanelProps> = ({
  macros,
  totalMacroCount,
  searchQuery,
  activeMacroId,
  onSelectMacro,
  onDeleteMacro,
}) => {
  const sortedMacros = useMemo(
    () =>
      [...macros].sort((left, right) => {
        const nameDelta = left.name.localeCompare(right.name);
        if (nameDelta !== 0) return nameDelta;
        return left.createdAt - right.createdAt;
      }),
    [macros]
  );
  const visibleCount = sortedMacros.length;
  const displayCount =
    typeof totalMacroCount === 'number' && totalMacroCount > visibleCount
      ? `${visibleCount}/${totalMacroCount}`
      : String(typeof totalMacroCount === 'number' ? totalMacroCount : visibleCount);
  const trimmedSearch = searchQuery?.trim() ?? '';

  return (
    <div className="ide-palette-subsection ide-macro-library" data-testid="ide-macro-library-panel">
      <header className="ide-palette-subsection-header ide-macro-library-header">
        <div>
          <h5>Saved Macros</h5>
          <p>Reusable clusters saved directly from the Design canvas.</p>
        </div>
        <span className="ide-palette-subsection-count ide-macro-library-count">{displayCount}</span>
      </header>

      {visibleCount === 0 ? (
        <p className="ide-copy ide-macro-library-empty">
          {trimmedSearch.length > 0
            ? `No saved macros match "${trimmedSearch}".`
            : 'Save a selected gate cluster to reuse it here.'}
        </p>
      ) : (
        <div className="ide-macro-library-list">
          {sortedMacros.map((macro) => (
            <div
              key={macro.id}
              className={`ide-macro-library-row${activeMacroId === macro.id ? ' is-active' : ''}`}
            >
              <button
                type="button"
                className={`ide-palette-card ide-palette-card--macro ide-macro-library-card${activeMacroId === macro.id ? ' is-active' : ''}`}
                onClick={() => onSelectMacro(macro.id)}
                data-testid={`ide-macro-library-card-${macro.id}`}
                title={macro.description || `${macro.name} - ${summarizeMacroPorts(macro)}`}
              >
                <span className="ide-palette-card-glyph" aria-hidden="true">
                  M
                </span>
                <span className="ide-palette-card-body">
                  <span className="ide-palette-card-title-row">
                    <span className="ide-palette-card-title ide-macro-library-name">{macro.name}</span>
                    <span className="ide-palette-card-badge">Macro</span>
                  </span>
                  <span className="ide-palette-card-subtitle">
                    {macro.description || summarizeMacroPorts(macro)}
                  </span>
                  <span className="ide-macro-library-meta">
                    <span className="ide-macro-library-io">
                      {summarizeIoCount(macro.inputs.length, macro.outputs.length)}
                    </span>
                    <span className="ide-macro-library-date">{formatCreatedAt(macro.createdAt)}</span>
                  </span>
                </span>
              </button>
              {onDeleteMacro ? (
                <IdeButton
                  tone="ghost"
                  onClick={() => onDeleteMacro(macro.id)}
                  testId={`ide-macro-library-delete-${macro.id}`}
                >
                  Delete
                </IdeButton>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
