import React, { useMemo, useState } from 'react';
import {
  IdeButton,
  IdeChip,
  IdeDataTable,
  IdeEmptyState,
  IdeStatusPill,
} from '../components/IdePrimitives';
import { SurfacePanel, SurfaceSectionTitle } from '../components/SurfaceLayoutPrimitives';
import {
  computeScenarioContentHash,
  materializeScenarioVectors,
  type VerifyScenario,
} from '../verifyScenario';
import type { RuntimeVerifyRun } from '../projectRuntime';

/**
 * ProjectSimulationSetsDocument — the Project-surface document view over the
 * canonical scenario/testbench library.
 *
 * Authority map (consume, never duplicate):
 * - The scenario library itself is `useProjectRuntime` state (`scenarios` +
 *   `activeScenarioId`, projectRuntime.ts). This component receives that state
 *   as props and renders it; it owns only transient rename/delete UI state.
 * - Run evidence is `verifyLastRun` (RuntimeVerifyRun). The 50-entry
 *   `verifyRunHistory` ledger carries NO scenarioId, so per-set run history
 *   does not exist as an authority. This component therefore shows evidence
 *   only for the one set the last recorded run actually belongs to
 *   (`lastRun.scenarioId`) and labels every other set
 *   "No recorded evidence for this browser session" — honestly, not as a bug.
 * - Freshness follows the ExportedScenarioProvenance.isStaleComparedToLastPass
 *   pattern: current scenario content hash (computeScenarioContentHash) vs the
 *   hash recorded on the run, plus projectHealthCore.dirtySinceVerify for
 *   design/mapping drift.
 *
 * Known projectRuntime limitation this component renders truthfully instead of
 * papering over: `renameScenario` and `duplicateScenario` take no scenario id —
 * they operate on the ACTIVE scenario only. Rather than silently
 * switch-then-act (which would stale evidence via commitScenarioSelection as a
 * side effect the student never asked for), rename/duplicate are DISABLED for
 * non-active rows with a tooltip explaining the switch-first requirement.
 *
 * All mutations flow through optional callback props. A missing callback
 * renders the affordance disabled with an honest reason — never hidden, never
 * fake-enabled.
 */

/** The slice of RuntimeVerifyRun this document needs for honest attribution. */
export type SimulationSetLastRun = Pick<
  RuntimeVerifyRun,
  'scenarioId' | 'scenarioName' | 'status' | 'runKind' | 'scenarioContentHash' | 'generatedAtIso'
>;

export type SimulationSetEvidence =
  | { kind: 'none' }
  | { kind: 'stale'; reason: 'scenario-edited' | 'design-changed'; status: 'pass' | 'fail' }
  | { kind: 'current'; status: 'pass' | 'fail'; runKind: 'trace' | 'verify' };

/**
 * Pure evidence derivation for one set. Evidence exists only when the last
 * recorded run belongs to this exact scenario id; it is stale when the design
 * or mapping changed since the run (dirtySinceVerify) or when the scenario
 * content hash drifted from the hash captured by the run.
 */
export function deriveSimulationSetEvidence(
  scenario: VerifyScenario,
  lastRun: SimulationSetLastRun | null | undefined,
  dirtySinceVerify: boolean
): SimulationSetEvidence {
  if (!lastRun || lastRun.scenarioId !== scenario.id) return { kind: 'none' };
  if (dirtySinceVerify) {
    return { kind: 'stale', reason: 'design-changed', status: lastRun.status };
  }
  if (
    lastRun.scenarioContentHash &&
    lastRun.scenarioContentHash !== computeScenarioContentHash(scenario)
  ) {
    return { kind: 'stale', reason: 'scenario-edited', status: lastRun.status };
  }
  return {
    kind: 'current',
    status: lastRun.status,
    runKind: lastRun.runKind === 'trace' ? 'trace' : 'verify',
  };
}

export interface ProjectSimulationSetsDocumentProps {
  scenarios: readonly VerifyScenario[];
  activeScenarioId: string | null;
  /**
   * Design under test. RedByte has one DUT per project (the top module);
   * scenarios carry no per-set DUT, so every row honestly shows the same top.
   */
  dutName: string;
  lastRun?: SimulationSetLastRun | null;
  /** projectHealthCore.dirtySinceVerify — design/mapping drift since the run. */
  dirtySinceVerify?: boolean;
  /** Global verifyRunHistory ledger length. Project-wide — NOT per set. */
  runHistoryCount?: number;
  /** Opens Simulate on the active set. */
  onOpenBench?: () => void;
  /** switchScenario(id). Switching stales current simulation evidence. */
  onSetActive?: (scenarioId: string) => void;
  onCreate?: () => void;
  /** duplicateScenario() — projectRuntime duplicates the ACTIVE set only. */
  onDuplicate?: () => void;
  /** renameScenario(name) — projectRuntime renames the ACTIVE set only. */
  onRename?: (name: string) => void;
  onDelete?: (scenarioId: string) => void;
}

const NOT_WIRED_REASON = 'Not available from this surface yet.';
const ACTIVE_ONLY_REASON =
  'Make this set active first — rename and duplicate operate on the active set only.';
// Non-active rows deliberately get "Make active" instead of an "Open in
// Simulate" affordance: Simulate always shows the active set, so an enabled
// open-without-switch button would lie about what the student will see.
const SWITCH_CONSEQUENCE =
  'Switching sets marks current simulation evidence stale until the new set is re-run.';
const LAST_SET_REASON = 'At least one simulation set must remain.';

/** Same display aliasing as the Simulate Scenario Explorer (TestbenchDocumentTabs). */
function displaySetName(scenario: VerifyScenario, index: number): string {
  return /^new scenario$/i.test(scenario.name.trim()) ? `Scenario ${index + 1}` : scenario.name;
}

function countChecks(vectors: ReadonlyArray<{ expected?: Record<string, unknown> }>): number {
  return vectors.reduce((total, vector) => total + Object.keys(vector.expected ?? {}).length, 0);
}

function renderEvidence(evidence: SimulationSetEvidence, scenarioId: string): React.ReactNode {
  const testId = `ide-project-simsets-evidence-${scenarioId}`;
  if (evidence.kind === 'none') {
    return (
      <span data-testid={testId}>No recorded evidence for this browser session</span>
    );
  }
  if (evidence.kind === 'stale') {
    return (
      <span data-testid={testId}>
        <IdeStatusPill tone="warn">Stale evidence</IdeStatusPill>{' '}
        <small>
          {evidence.reason === 'scenario-edited'
            ? 'Set edited since its last run'
            : 'Design or mapping changed since its last run'}
        </small>
      </span>
    );
  }
  if (evidence.status === 'fail') {
    return (
      <span data-testid={testId}>
        <IdeStatusPill tone="error">Checks failing</IdeStatusPill>
      </span>
    );
  }
  return (
    <span data-testid={testId}>
      {evidence.runKind === 'trace' ? (
        <IdeStatusPill tone="idle">Observed — no checks</IdeStatusPill>
      ) : (
        <IdeStatusPill tone="ok">Checks passing</IdeStatusPill>
      )}
    </span>
  );
}

export const ProjectSimulationSetsDocument: React.FC<ProjectSimulationSetsDocumentProps> = ({
  scenarios,
  activeScenarioId,
  dutName,
  lastRun = null,
  dirtySinceVerify = false,
  runHistoryCount,
  onOpenBench,
  onSetActive,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
}) => {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

  const resolvedActiveId = activeScenarioId ?? scenarios[0]?.id ?? null;
  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === resolvedActiveId) ?? null,
    [resolvedActiveId, scenarios]
  );
  const deletePendingScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === deletePendingId) ?? null,
    [deletePendingId, scenarios]
  );

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && onRename && trimmed !== activeScenario?.name) onRename(trimmed);
    setRenaming(false);
  };

  const tableRows = useMemo(
    () =>
      scenarios.map((scenario, index) => {
        const isActive = scenario.id === resolvedActiveId;
        const vectors = materializeScenarioVectors(scenario);
        const checkCount = countChecks(vectors);
        const evidence = deriveSimulationSetEvidence(scenario, lastRun, dirtySinceVerify);
        const canDelete = Boolean(onDelete) && scenarios.length > 1;
        return [
          <span data-testid={`ide-project-simsets-name-${scenario.id}`} key={`name-${scenario.id}`}>
            <strong>{displaySetName(scenario, index)}</strong>{' '}
            <IdeChip tone="neutral">v{scenario.version}</IdeChip>{' '}
            {isActive ? (
              <IdeChip tone="accent" testId={`ide-project-simsets-active-${scenario.id}`}>
                Active
              </IdeChip>
            ) : null}
          </span>,
          <span
            key={`dut-${scenario.id}`}
            title="All simulation sets run against the project top module."
            data-testid={`ide-project-simsets-dut-${scenario.id}`}
          >
            {dutName}
          </span>,
          <span key={`coverage-${scenario.id}`} data-testid={`ide-project-simsets-coverage-${scenario.id}`}>
            {vectors.length} {vectors.length === 1 ? 'event' : 'events'} · {checkCount}{' '}
            {checkCount === 1 ? 'check' : 'checks'}
          </span>,
          <React.Fragment key={`evidence-${scenario.id}`}>
            {renderEvidence(evidence, scenario.id)}
          </React.Fragment>,
          <span key={`actions-${scenario.id}`}>
            {isActive ? (
              <IdeButton
                tone="secondary"
                onClick={onOpenBench}
                disabled={!onOpenBench}
                title={onOpenBench ? 'Open this set in Simulate.' : NOT_WIRED_REASON}
                testId={`ide-project-simsets-open-${scenario.id}`}
              >
                Open in Simulate
              </IdeButton>
            ) : (
              <IdeButton
                tone="secondary"
                onClick={onSetActive ? () => onSetActive(scenario.id) : undefined}
                disabled={!onSetActive}
                title={onSetActive ? SWITCH_CONSEQUENCE : NOT_WIRED_REASON}
                testId={`ide-project-simsets-activate-${scenario.id}`}
              >
                Make active
              </IdeButton>
            )}
            <IdeButton
              tone="ghost"
              onClick={
                isActive && onRename
                  ? () => {
                      setRenameValue(scenario.name);
                      setRenaming(true);
                      setDeletePendingId(null);
                    }
                  : undefined
              }
              disabled={!isActive || !onRename}
              title={!onRename ? NOT_WIRED_REASON : isActive ? undefined : ACTIVE_ONLY_REASON}
              testId={`ide-project-simsets-rename-${scenario.id}`}
            >
              Rename
            </IdeButton>
            <IdeButton
              tone="ghost"
              onClick={isActive && onDuplicate ? onDuplicate : undefined}
              disabled={!isActive || !onDuplicate}
              title={!onDuplicate ? NOT_WIRED_REASON : isActive ? undefined : ACTIVE_ONLY_REASON}
              testId={`ide-project-simsets-duplicate-${scenario.id}`}
            >
              Duplicate
            </IdeButton>
            <IdeButton
              tone="ghost"
              onClick={
                canDelete
                  ? () => {
                      setDeletePendingId(scenario.id);
                      setRenaming(false);
                    }
                  : undefined
              }
              disabled={!canDelete}
              title={!onDelete ? NOT_WIRED_REASON : scenarios.length <= 1 ? LAST_SET_REASON : undefined}
              testId={`ide-project-simsets-delete-${scenario.id}`}
            >
              Delete
            </IdeButton>
          </span>,
        ];
      }),
    [dirtySinceVerify, dutName, lastRun, onDelete, onDuplicate, onOpenBench, onRename, onSetActive, resolvedActiveId, scenarios]
  );

  if (scenarios.length === 0) {
    return (
      <SurfacePanel testId="ide-project-simulation-sets">
        <SurfaceSectionTitle title="Simulation sets" meta="0 sets" />
        <IdeEmptyState
          title="No simulation sets"
          body="A simulation set names one stimulus-and-checks document for this design. Create one to record behavior evidence."
          primaryAction={
            <IdeButton
              tone="primary"
              onClick={onCreate}
              disabled={!onCreate}
              title={onCreate ? undefined : NOT_WIRED_REASON}
              testId="ide-project-simsets-create"
            >
              New set
            </IdeButton>
          }
          testId="ide-project-simsets-empty"
        />
      </SurfacePanel>
    );
  }

  return (
    <SurfacePanel testId="ide-project-simulation-sets">
      <SurfaceSectionTitle
        title="Simulation sets"
        meta={`${scenarios.length} ${scenarios.length === 1 ? 'set' : 'sets'}`}
        testId="ide-project-simsets-header"
      />
      <div className="ide-surface-actions" data-testid="ide-project-simsets-actions">
        <IdeButton
          tone="secondary"
          onClick={onCreate}
          disabled={!onCreate}
          title={onCreate ? undefined : NOT_WIRED_REASON}
          testId="ide-project-simsets-create"
        >
          New set
        </IdeButton>
        <IdeButton
          tone="ghost"
          onClick={onOpenBench}
          disabled={!onOpenBench}
          title={onOpenBench ? 'Open Simulate on the active set.' : NOT_WIRED_REASON}
          testId="ide-project-simsets-open-bench"
        >
          Open Simulate
        </IdeButton>
      </div>
      <IdeDataTable
        columns={['Set', 'DUT', 'Coverage', 'Run evidence', 'Actions']}
        rows={tableRows}
        testId="ide-project-simsets-table"
      />
      {renaming && activeScenario ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            commitRename();
          }}
          data-testid="ide-project-simsets-rename-form"
        >
          <label htmlFor="ide-project-simsets-rename-input">Set name</label>
          <input
            id="ide-project-simsets-rename-input"
            value={renameValue}
            maxLength={64}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setRenaming(false);
            }}
            data-testid="ide-project-simsets-rename-input"
          />
          <IdeButton tone="primary" type="submit" testId="ide-project-simsets-rename-save">
            Save name
          </IdeButton>
          <IdeButton tone="ghost" onClick={() => setRenaming(false)} testId="ide-project-simsets-rename-cancel">
            Cancel
          </IdeButton>
        </form>
      ) : null}
      {deletePendingScenario ? (
        <div role="alert" data-testid="ide-project-simsets-delete-confirmation">
          <span>
            Delete <strong>{deletePendingScenario.name}</strong>? Other sets stay unchanged.
          </span>
          <IdeButton
            tone="danger"
            onClick={() => {
              onDelete?.(deletePendingScenario.id);
              setDeletePendingId(null);
            }}
            testId="ide-project-simsets-delete-confirm"
          >
            Delete set
          </IdeButton>
          <IdeButton
            tone="ghost"
            onClick={() => setDeletePendingId(null)}
            testId="ide-project-simsets-delete-cancel"
          >
            Cancel
          </IdeButton>
        </div>
      ) : null}
      <p className="ide-panel-description" data-testid="ide-project-simsets-footnote">
        Making a different set active marks current simulation evidence stale until that set is
        re-run.
        {typeof runHistoryCount === 'number'
          ? ` Run history is recorded per project — ${runHistoryCount} ${
              runHistoryCount === 1 ? 'run' : 'runs'
            } this browser session — not per set.`
          : ' Run history is recorded per project, not per set.'}
      </p>
    </SurfacePanel>
  );
};
