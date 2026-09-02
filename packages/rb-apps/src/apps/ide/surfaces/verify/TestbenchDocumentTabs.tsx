import React, { useEffect, useMemo, useRef, useState } from 'react';
import { materializeScenarioVectors, type VerifyScenario } from '../../verifyScenario';

function summarizeScenario(scenario: VerifyScenario) {
  const vectors = materializeScenarioVectors(scenario);
  const checkCount = vectors.reduce(
    (total, vector) => total + Object.keys(vector.expected ?? {}).length,
    0
  );
  const inputNames = Array.from(
    new Set(vectors.flatMap((vector) => Object.keys(vector.inputs ?? {})))
  ).slice(0, 3);
  const previewValues = inputNames.map((inputName) => ({
    inputName,
    values: vectors.slice(0, 16).map((vector) => (Number(vector.inputs?.[inputName]) ? 1 : 0)),
  }));
  const isSequential =
    Boolean(scenario.steps?.length) ||
    scenario.sequentialPolicy?.executionModel === 'manual_event_driven_lab' ||
    (scenario.sequentialPolicy?.runCycles ?? 1) > 1 ||
    inputNames.some((inputName) => /(^|[_\W])(clk|clock)([_\W]|$)/i.test(inputName));

  return {
    vectors,
    checkCount,
    previewValues,
    kindLabel: isSequential ? 'Sequential' : 'Combinational',
    cycleCount: scenario.sequentialPolicy?.runCycles,
  };
}

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
 * Scenario explorer — a tool window of scenario rows for the Simulate
 * workspace. Each row is one persisted scenario (kind · events · checks and
 * a stimulus strip). The component owns only temporary rename / delete UI
 * state; scenario identity and mutations stay with the runtime store.
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
  const manageRef = useRef<HTMLDetailsElement | null>(null);

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
  const closeManage = () => {
    if (manageRef.current) manageRef.current.open = false;
  };

  return (
    <section
      className="wb-toolwindow rb-scn"
      data-testid="ide-testbench-documents"
      aria-label="Scenario explorer"
    >
      <header className="wb-toolwindow-header rb-scn-header">
        <span className="wb-toolwindow-title">Scenarios</span>
        <span className="wb-toolwindow-count">{scenarios.length}</span>
        <span className="wb-toolbar-spacer" />
        <button
          type="button"
          className="wb-btn wb-btn--ghost rb-scn-new"
          onClick={onCreate}
          data-testid="ide-scenario-create-btn"
          title="Create a new scenario"
        >
          + New scenario
        </button>
        <details className="rb-scn-manage" ref={manageRef}>
          <summary className="wb-btn wb-btn--ghost wb-btn--icon" aria-label="Manage testbench" title="Manage testbench">
            <span className="rb-scn-manage-label">Manage testbench</span>
            <span aria-hidden="true">⋯</span>
          </summary>
          <div className="wb-menu rb-scn-menu" aria-label="Active testbench actions">
            <button
              type="button"
              className="wb-menu-item"
              onClick={() => {
                closeManage();
                onDuplicate();
              }}
              data-testid="ide-scenario-duplicate-btn"
            >
              <span className="wb-menu-item-check" aria-hidden="true" />
              <span className="wb-menu-item-label">Duplicate</span>
              <span className="wb-menu-item-key" />
            </button>
            <button
              type="button"
              className="wb-menu-item"
              onClick={() => {
                closeManage();
                setRenameValue(activeScenario.name);
                setRenaming(true);
                setDeletePending(false);
              }}
              data-testid="ide-scenario-rename-btn"
            >
              <span className="wb-menu-item-check" aria-hidden="true" />
              <span className="wb-menu-item-label">Rename</span>
              <span className="wb-menu-item-key" />
            </button>
            <div className="wb-menu-sep" />
            <button
              type="button"
              className="wb-menu-item is-danger"
              disabled={scenarios.length <= 1}
              onClick={() => {
                closeManage();
                setDeletePending(true);
                setRenaming(false);
              }}
              data-testid="ide-scenario-delete-btn"
            >
              <span className="wb-menu-item-check" aria-hidden="true" />
              <span className="wb-menu-item-label">Delete</span>
              <span className="wb-menu-item-key" />
            </button>
          </div>
        </details>
      </header>

      <div className="wb-toolwindow-body rb-scn-body" role="tablist" aria-label="Open testbenches">
        {scenarios.map((scenario, scenarioIndex) => {
          const isActive = scenario.id === activeScenario.id;
          const summary = summarizeScenario(scenario);
          const displayName = /^new scenario$/i.test(scenario.name.trim())
            ? `Scenario ${scenarioIndex + 1}`
            : scenario.name;
          return (
            <button
              key={scenario.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`rb-scn-row${isActive ? ' is-active' : ''}`}
              onClick={() => onSwitch(scenario.id)}
              data-testid={`ide-testbench-document-tab-${scenario.id}`}
              title={`${displayName} · ${summary.kindLabel} · v${scenario.version}`}
            >
              <span className="rb-scn-row-main">
                <span className="rb-scn-name">{displayName}</span>
                <code className="rb-scn-version">v{scenario.version}</code>
              </span>
              <span className="rb-scn-meta">
                <span>{summary.kindLabel}</span>
                <span>{summary.vectors.length} events</span>
                <span>{summary.checkCount} checks</span>
                {summary.cycleCount ? <span>{summary.cycleCount} cycles</span> : null}
              </span>
              <span
                className="rb-scn-preview"
                aria-label={`${displayName} stimulus preview`}
                data-testid={`ide-testbench-document-preview-${scenario.id}`}
              >
                {summary.previewValues.length > 0 ? (
                  summary.previewValues.map((row) => (
                    <span className="rb-scn-preview-row" key={row.inputName}>
                      <code className="rb-scn-preview-label">{row.inputName}</code>
                      <span className="rb-scn-preview-bits" aria-hidden="true">
                        {row.values.map((value, index) => (
                          <span key={`${row.inputName}-${index}`} className={value ? 'is-high' : 'is-low'} />
                        ))}
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="rb-scn-preview-empty">No stimulus yet</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {renaming ? (
        <form
          className="rb-scn-editline"
          onSubmit={(event) => {
            event.preventDefault();
            commitRename();
          }}
        >
          <label htmlFor="ide-testbench-document-rename">Name</label>
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
          <button type="submit" className="wb-btn wb-btn--primary">Save name</button>
          <button type="button" className="wb-btn wb-btn--ghost" onClick={() => setRenaming(false)}>Cancel</button>
        </form>
      ) : null}

      {deletePending ? (
        <div className="rb-scn-confirm" role="alert" data-testid="ide-scenario-delete-confirmation">
          <span>
            Delete <strong>{activeScenario.name}</strong>? Other testbenches stay unchanged.
          </span>
          <button
            type="button"
            className="wb-btn rb-scn-danger"
            onClick={() => {
              onDelete(activeScenario.id);
              setDeletePending(false);
            }}
            data-testid="ide-scenario-delete-confirm"
          >
            Delete testbench
          </button>
          <button type="button" className="wb-btn wb-btn--ghost" onClick={() => setDeletePending(false)} data-testid="ide-scenario-delete-cancel">
            Cancel
          </button>
        </div>
      ) : null}
    </section>
  );
};
