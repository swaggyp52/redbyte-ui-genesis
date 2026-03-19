/**
 * ScenarioLibraryHeader
 *
 * Compact strip above the vector editor that exposes the full scenario lifecycle:
 *   - Switch active scenario via dropdown
 *   - Create new (seeded from active by default)
 *   - Duplicate active scenario
 *   - Rename active scenario (inline)
 *   - Delete active scenario (disabled when only one exists)
 *
 * Keeps zero internal state about which scenario is "active" — that lives
 * exclusively in the runtime store.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { VerifyScenario } from '../verifyScenario';

export interface ScenarioLibraryHeaderProps {
  scenarios: VerifyScenario[];
  activeScenarioId: string | null;
  onSwitch: (id: string) => void;
  /** Create a new scenario — runtime seeds from active by default. */
  onCreate: () => void;
  onDuplicate: () => void;
  onRename: (name: string) => void;
  onDelete: (id: string) => void;
}

export const ScenarioLibraryHeader: React.FC<ScenarioLibraryHeaderProps> = ({
  scenarios,
  activeScenarioId,
  onSwitch,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
}) => {
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0] ?? null;
  const canDelete = scenarios.length > 1;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  const handleStartRename = useCallback(() => {
    setRenameValue(activeScenario?.name ?? '');
    setRenaming(true);
    setDropdownOpen(false);
  }, [activeScenario]);

  const handleCommitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== activeScenario?.name) {
      onRename(trimmed);
    }
    setRenaming(false);
  }, [renameValue, activeScenario, onRename]);

  const handleRenameKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') handleCommitRename();
      if (event.key === 'Escape') setRenaming(false);
    },
    [handleCommitRename]
  );

  const handleSwitch = useCallback(
    (id: string) => {
      setDropdownOpen(false);
      if (id !== activeScenarioId) onSwitch(id);
    },
    [activeScenarioId, onSwitch]
  );

  const handleDelete = useCallback(() => {
    if (!activeScenario || !canDelete) return;
    onDelete(activeScenario.id);
  }, [activeScenario, canDelete, onDelete]);

  if (!activeScenario) return null;

  return (
    <div className="ide-scenario-library-header" data-testid="ide-scenario-library-header">
      {/* Scenario switcher — name button + dropdown */}
      <div className="ide-scenario-switcher" ref={dropdownRef}>
        {renaming ? (
          <input
            ref={renameInputRef}
            className="ide-scenario-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleCommitRename}
            onKeyDown={handleRenameKeyDown}
            aria-label="Rename scenario"
            data-testid="ide-scenario-rename-input"
            maxLength={64}
          />
        ) : (
          <button
            className="ide-scenario-switcher-btn"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            data-testid="ide-scenario-switcher-btn"
            title={`Active scenario: ${activeScenario.name} (v${activeScenario.version})`}
          >
            <span className="ide-scenario-switcher-name">{activeScenario.name}</span>
            <span className="ide-scenario-switcher-meta" aria-hidden="true">
              v{activeScenario.version}
            </span>
            <span className="ide-scenario-switcher-caret" aria-hidden="true">▾</span>
          </button>
        )}

        {dropdownOpen && !renaming && (
          <div
            className="ide-scenario-dropdown"
            role="listbox"
            aria-label="Scenarios"
            data-testid="ide-scenario-dropdown"
          >
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                className={`ide-scenario-dropdown-item${scenario.id === activeScenarioId ? ' is-active' : ''}`}
                role="option"
                aria-selected={scenario.id === activeScenarioId}
                onClick={() => handleSwitch(scenario.id)}
                data-testid={`ide-scenario-option-${scenario.id}`}
              >
                <span className="ide-scenario-dropdown-item-name">{scenario.name}</span>
                <span className="ide-scenario-dropdown-item-meta">v{scenario.version}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CRUD actions */}
      <div className="ide-scenario-library-actions">
        <button
          className="ide-scenario-action-btn"
          onClick={onCreate}
          title="New scenario (seeded from current)"
          data-testid="ide-scenario-create-btn"
          aria-label="Create new scenario"
        >
          + New
        </button>
        <button
          className="ide-scenario-action-btn"
          onClick={onDuplicate}
          title="Duplicate active scenario"
          data-testid="ide-scenario-duplicate-btn"
          aria-label="Duplicate scenario"
        >
          ⎘ Dup
        </button>
        <button
          className="ide-scenario-action-btn"
          onClick={handleStartRename}
          title="Rename active scenario"
          data-testid="ide-scenario-rename-btn"
          aria-label="Rename scenario"
        >
          T Rename
        </button>
        <button
          className={`ide-scenario-action-btn ide-scenario-action-btn--danger${!canDelete ? ' is-disabled' : ''}`}
          onClick={handleDelete}
          disabled={!canDelete}
          title={canDelete ? 'Delete active scenario' : 'Cannot delete the last scenario'}
          data-testid="ide-scenario-delete-btn"
          aria-label="Delete scenario"
          aria-disabled={!canDelete}
        >
          ✕ Delete
        </button>
      </div>
    </div>
  );
};
