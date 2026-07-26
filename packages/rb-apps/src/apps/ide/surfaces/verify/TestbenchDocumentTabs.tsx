import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { VerifyScenario } from '../../verifyScenario';

export interface TestbenchDocumentTabsProps {
  readonly scenarios: readonly VerifyScenario[];
  readonly activeScenarioId: string | null;
  readonly onSwitch: (id: string) => void;
  readonly onCreate: () => void;
  readonly onDuplicate: () => void;
  readonly onRename: (name: string) => void;
  readonly onDelete: (id: string) => void;
}

/**
 * Stable, document-like scenario navigation for Simulation Studio.
 *
 * The component owns only temporary rename/delete UI state. Scenario identity
 * and mutations remain controlled by the runtime store through the callbacks.
 */
export const TestbenchDocumentTabs: React.FC<TestbenchDocumentTabsProps> = ({
  scenarios,
  activeScenarioId,
  onSwitch,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
}) => {
  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0] ?? null,
    [activeScenarioId, scenarios]
  );
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deletePending, setDeletePending] = useState(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRenaming(false);
    setDeletePending(false);
  }, [activeScenario?.id]);

  useEffect(() => {
    if (!renaming) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renaming]);

  if (!activeScenario) return null;

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== activeScenario.name) onRename(trimmed);
    setRenaming(false);
  };

  return (
    <section
      className="ide-testbench-documents"
      data-testid="ide-testbench-documents"
      aria-label="Testbench documents"
    >
      <div className="ide-testbench-documents-heading">
        <div>
          <span className="ide-testbench-documents-eyebrow">Testbench documents</span>
          <strong>Choose the scenario you want to author and run.</strong>
        </div>
        <button
          type="button"
          className="ide-testbench-document-new"
          onClick={onCreate}
          data-testid="ide-scenario-create-btn"
        >
          + New testbench
        </button>
      </div>

      <div className="ide-testbench-document-tabrow">
        <div className="ide-testbench-document-tabs" role="tablist" aria-label="Open testbenches">
          {scenarios.map((scenario) => {
            const isActive = scenario.id === activeScenario.id;
            return (
              <button
                key={scenario.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`ide-testbench-document-tab${isActive ? ' is-active' : ''}`}
                onClick={() => onSwitch(scenario.id)}
                data-testid={`ide-testbench-document-tab-${scenario.id}`}
              >
                <span>{scenario.name}</span>
                <small>v{scenario.version}</small>
              </button>
            );
          })}
        </div>

        <div className="ide-testbench-document-actions" aria-label="Active testbench actions">
          <button
            type="button"
            onClick={onDuplicate}
            data-testid="ide-scenario-duplicate-btn"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => {
              setRenameValue(activeScenario.name);
              setRenaming(true);
              setDeletePending(false);
            }}
            data-testid="ide-scenario-rename-btn"
          >
            Rename
          </button>
          <button
            type="button"
            className="is-danger"
            disabled={scenarios.length <= 1}
            onClick={() => {
              setDeletePending(true);
              setRenaming(false);
            }}
            data-testid="ide-scenario-delete-btn"
          >
            Delete
          </button>
        </div>
      </div>

      {renaming ? (
        <form
          className="ide-testbench-document-editline"
          onSubmit={(event) => {
            event.preventDefault();
            commitRename();
          }}
        >
          <label htmlFor="ide-testbench-document-rename">Testbench name</label>
          <input
            id="ide-testbench-document-rename"
            ref={renameInputRef}
            value={renameValue}
            maxLength={64}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setRenaming(false);
            }}
            data-testid="ide-scenario-rename-input"
          />
          <button type="submit">Save name</button>
          <button type="button" onClick={() => setRenaming(false)}>Cancel</button>
        </form>
      ) : null}

      {deletePending ? (
        <div className="ide-testbench-document-delete" role="alert" data-testid="ide-scenario-delete-confirmation">
          <span>
            Delete <strong>{activeScenario.name}</strong>? Other testbenches stay unchanged.
          </span>
          <button
            type="button"
            className="is-danger"
            onClick={() => {
              onDelete(activeScenario.id);
              setDeletePending(false);
            }}
            data-testid="ide-scenario-delete-confirm"
          >
            Delete testbench
          </button>
          <button
            type="button"
            onClick={() => setDeletePending(false)}
            data-testid="ide-scenario-delete-cancel"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </section>
  );
};
