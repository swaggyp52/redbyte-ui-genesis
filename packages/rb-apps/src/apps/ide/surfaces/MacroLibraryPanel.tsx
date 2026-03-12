import React, { useMemo } from 'react';
import { IdeButton } from '../components/IdePrimitives';
import type { MacroDefinition } from '../macros/MacroLibrary';

export interface MacroLibraryPanelProps {
  macros: MacroDefinition[];
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

export const MacroLibraryPanel: React.FC<MacroLibraryPanelProps> = ({
  macros,
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

  return (
    <div className="ide-macro-library" data-testid="ide-macro-library-panel">
      <header className="ide-design-subheader ide-macro-library-header">
        <h4>Macro Library</h4>
        <span className="ide-macro-library-count">{sortedMacros.length}</span>
      </header>

      {sortedMacros.length === 0 ? (
        <p className="ide-copy ide-macro-library-empty">
          Save a selected gate cluster to reuse it from this library.
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
                className={`ide-macro-library-card${activeMacroId === macro.id ? ' is-active' : ''}`}
                onClick={() => onSelectMacro(macro.id)}
                data-testid={`ide-macro-library-card-${macro.id}`}
              >
                <span className="ide-macro-library-name">{macro.name}</span>
                <span className="ide-macro-library-io">
                  {macro.inputs.length} inputs, {macro.outputs.length} outputs
                </span>
                <span className="ide-macro-library-date">{formatCreatedAt(macro.createdAt)}</span>
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