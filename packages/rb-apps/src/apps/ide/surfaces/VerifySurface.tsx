import React, { useEffect, useMemo, useState } from 'react';
import type { TestVector } from '@redbyte/rb-utils';
import type { RunVerificationInput, RuntimeVerifyRun } from '../projectRuntime';
import { buildVerifyTickSignalIndex } from '../verifyReport';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';

interface VerifyRow {
  tick: number;
  signal: string;
  expected: string;
  actual: string;
}

interface VerifyScenario {
  id: 'fail' | 'pass';
  name: string;
  hash: string;
  rows: VerifyRow[];
}

interface VerifyVectorDraftInput {
  id: string;
  label: string;
  pin?: string;
}

interface VerifyAuthorVector {
  id: string;
  tick: number;
  inputs: Record<string, 0 | 1>;
  expected: Record<string, 0 | 1>;
}

export interface VerifyFailureTarget {
  signal: string;
  tick: number;
  expected: string;
  actual: string;
}

const VERIFY_SCENARIOS: VerifyScenario[] = [
  {
    id: 'fail',
    name: 'Counter mismatch sample',
    hash: 'sha:verify-fail-7b91',
    rows: [
      { tick: 12, signal: 'q0', expected: '1', actual: '1' },
      { tick: 12, signal: 'q1', expected: '0', actual: '0' },
      { tick: 13, signal: 'q2', expected: '1', actual: '0' },
      { tick: 14, signal: 'q0', expected: '0', actual: '0' },
    ],
  },
  {
    id: 'pass',
    name: 'Counter baseline sample',
    hash: 'sha:verify-pass-3f2c',
    rows: [
      { tick: 12, signal: 'q0', expected: '1', actual: '1' },
      { tick: 12, signal: 'q1', expected: '0', actual: '0' },
      { tick: 13, signal: 'q2', expected: '1', actual: '1' },
      { tick: 14, signal: 'q0', expected: '0', actual: '0' },
    ],
  },
];

type VerifyStatus = 'idle' | 'pass' | 'fail';

export interface VerifySurfaceProps {
  deterministicHash: string;
  hasVectors: boolean;
  vectors?: TestVector[];
  lastRun?: RuntimeVerifyRun;
  mappedInputs?: Array<{ id: string; label?: string; pin?: string }>;
  onVectorsChange?: (vectors: VerifyAuthorVector[]) => void;
  onRunVerification?: (input: RunVerificationInput) => void;
  onClearVerification?: () => void;
  onOpenProjectVectors: () => void;
  onFixPath?: (target: VerifyFailureTarget) => void;
}

export const VerifySurface: React.FC<VerifySurfaceProps> = ({
  deterministicHash,
  hasVectors,
  vectors,
  lastRun,
  mappedInputs,
  onVectorsChange,
  onRunVerification,
  onClearVerification,
  onOpenProjectVectors,
  onFixPath,
}) => {
  const inputFields = useMemo(() => {
    const normalized = (mappedInputs ?? [])
      .map((entry) => ({
        id: normalizeFieldId(entry.id),
        label: (entry.label ?? entry.id).trim() || entry.id,
        pin: entry.pin,
      }))
      .filter((entry) => entry.id.length > 0);

    const deduped = new Map<string, VerifyVectorDraftInput>();
    for (const entry of normalized) {
      if (!deduped.has(entry.id)) deduped.set(entry.id, entry);
    }

    if (deduped.size === 0) {
      deduped.set('in_a', { id: 'in_a', label: 'in_a' });
      deduped.set('in_b', { id: 'in_b', label: 'in_b' });
    }
    return Array.from(deduped.values());
  }, [mappedInputs]);

  const authoredVectors = useMemo(
    () => normalizeVectors(vectors, inputFields),
    [inputFields, vectors]
  );

  const [selectedScenario, setSelectedScenario] = useState<VerifyScenario['id']>('fail');
  const [selectedTick, setSelectedTick] = useState<number | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);
  const [draftTick, setDraftTick] = useState<number>(() => nextVectorTick(vectors));
  const [draftInputs, setDraftInputs] = useState<Record<string, '0' | '1'>>(() =>
    createDraftInputs(inputFields)
  );

  useEffect(() => {
    setDraftInputs((prev) => withInputFieldDefaults(prev, inputFields));
  }, [inputFields]);

  useEffect(() => {
    setDraftTick(nextVectorTick(vectors));
  }, [vectors]);

  const runRows = lastRun?.report.rows ?? [];
  const tickIndex = useMemo(
    () => (lastRun?.report ? buildVerifyTickSignalIndex(lastRun.report) : { ticks: [], rowsByTick: {} }),
    [lastRun?.report]
  );
  const timelineTicks = tickIndex.ticks;
  const signalTimeline = useMemo(() => {
    const signalValueMap = new Map<string, Map<number, string>>();
    for (const sample of lastRun?.waveform ?? []) {
      for (const [signal, value] of Object.entries(sample.signals)) {
        const values = signalValueMap.get(signal) ?? new Map<number, string>();
        values.set(sample.tick, value);
        signalValueMap.set(signal, values);
      }
    }

    return Array.from(signalValueMap.entries())
      .sort((left, right) => compareText(left[0], right[0]))
      .map(([signal, values]) => ({
        signal,
        values: timelineTicks.map((tick) => ({
          tick,
          value: values.get(tick) ?? '-',
        })),
      }));
  }, [lastRun?.waveform, timelineTicks]);

  const failingRows = useMemo(
    () => runRows.filter((row) => row.status === 'fail'),
    [runRows]
  );
  const selectedTickRows = useMemo(() => {
    if (selectedTick === null) return [];
    const keyed = tickIndex.rowsByTick[String(selectedTick)] ?? [];
    return selectedSignal
      ? keyed.filter((row) => row.signal === selectedSignal)
      : keyed;
  }, [selectedSignal, selectedTick, tickIndex.rowsByTick]);

  useEffect(() => {
    if (timelineTicks.length === 0) {
      setSelectedTick(null);
      return;
    }

    const preferredTick =
      typeof lastRun?.firstFailingTick === 'number'
        ? lastRun.firstFailingTick
        : timelineTicks[0];
    setSelectedTick((previous) =>
      previous !== null && timelineTicks.includes(previous) ? previous : preferredTick
    );
  }, [lastRun?.firstFailingTick, timelineTicks]);

  useEffect(() => {
    if (signalTimeline.length === 0) {
      setSelectedSignal(null);
      return;
    }
    const firstFailSignal = failingRows[0]?.signal;
    setSelectedSignal((previous) => {
      if (previous && signalTimeline.some((entry) => entry.signal === previous)) return previous;
      if (firstFailSignal) return firstFailSignal;
      return signalTimeline[0]?.signal ?? null;
    });
  }, [failingRows, signalTimeline]);

  const activeScenario = useMemo(
    () => VERIFY_SCENARIOS.find((scenario) => scenario.id === selectedScenario) ?? VERIFY_SCENARIOS[0],
    [selectedScenario]
  );

  const resultRows = useMemo(
    () =>
      runRows.map((row) => [
        String(row.tick),
        row.signal,
        row.expected,
        row.actual,
        row.status === 'pass' ? 'PASS' : 'FAIL',
      ]),
    [runRows]
  );

  const vectorRows = useMemo(
    () =>
      authoredVectors.map((vector) => [
        String(vector.tick),
        ...inputFields.map((field) => (
          <code key={`${vector.id}-${field.id}`}>{String(vector.inputs[field.id] ?? 0)}</code>
        )),
      ]),
    [authoredVectors, inputFields]
  );

  const status: VerifyStatus = lastRun ? (lastRun.status === 'pass' ? 'pass' : 'fail') : 'idle';
  const hasResults = runRows.length > 0;
  const firstFailure = failingRows[0];
  const firstFailureTick = firstFailure?.tick ?? lastRun?.firstFailingTick;
  const canExportTestbench = status === 'pass';
  const vectorSourceLabel =
    authoredVectors.length > 0 || hasVectors ? 'Project vectors loaded' : 'No vectors saved yet';

  const runVerification = () => {
    onRunVerification?.({
      scenarioId: activeScenario.id,
      scenarioName: activeScenario.name,
      deterministicHash: activeScenario.hash,
      rows: activeScenario.rows,
    });
  };

  const clearResults = () => {
    onClearVerification?.();
  };

  const handleAddVector = () => {
    const tick = Number.isFinite(draftTick) ? Math.max(0, Math.floor(draftTick)) : authoredVectors.length;
    const nextVector: VerifyAuthorVector = {
      id: `vec-${String(authoredVectors.length + 1).padStart(2, '0')}`,
      tick,
      inputs: inputFields.reduce<Record<string, 0 | 1>>((acc, field) => {
        acc[field.id] = draftInputs[field.id] === '1' ? 1 : 0;
        return acc;
      }, {}),
      expected: {},
    };
    const nextVectors = [...authoredVectors, nextVector].sort((left, right) => left.tick - right.tick);
    onVectorsChange?.(nextVectors);
    setDraftTick(nextVector.tick + 1);
  };

  const handleGenerateBasicVectors = () => {
    const templateFields = inputFields.length > 0 ? inputFields : [{ id: 'in_a', label: 'in_a' }];
    const vectorsGenerated: VerifyAuthorVector[] = [
      {
        id: 'vec-01',
        tick: 0,
        inputs: templateFields.reduce<Record<string, 0 | 1>>((acc, field) => {
          acc[field.id] = 0;
          return acc;
        }, {}),
        expected: {},
      },
      {
        id: 'vec-02',
        tick: 1,
        inputs: templateFields.reduce<Record<string, 0 | 1>>((acc, field, index) => {
          acc[field.id] = index === 0 ? 1 : 0;
          return acc;
        }, {}),
        expected: {},
      },
      {
        id: 'vec-03',
        tick: 2,
        inputs: templateFields.reduce<Record<string, 0 | 1>>((acc, field) => {
          acc[field.id] = 1;
          return acc;
        }, {}),
        expected: {},
      },
    ];
    onVectorsChange?.(vectorsGenerated);
    setDraftTick(3);
  };

  return (
    <IdeSurfaceLayout
      mode="verify"
      dock={
        <section className="ide-verify-left-dock" data-testid="ide-verify-left-dock">
          <header className="ide-design-subheader">
            <h3>Signals</h3>
            <span className="ide-copy">{signalTimeline.length}</span>
          </header>
          <div className="ide-signal-list" data-testid="ide-verify-signal-list">
            {signalTimeline.length === 0 ? (
              <p className="ide-copy">Run verification to populate waveform lanes.</p>
            ) : (
              signalTimeline.map((signalRow) => (
                <button
                  key={signalRow.signal}
                  className={`ide-signal-row ${selectedSignal === signalRow.signal ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => setSelectedSignal(signalRow.signal)}
                  data-testid={`ide-verify-signal-${toTestId(signalRow.signal)}`}
                >
                  {signalRow.signal}
                </button>
              ))
            )}
          </div>
          <IdeCallout tone={status === 'pass' ? 'success' : status === 'fail' ? 'error' : 'info'}>
            {status === 'pass'
              ? 'Latest run PASS. Export testbench is enabled.'
              : status === 'fail'
                ? 'Latest run FAIL. Drill into mismatches and fix in Design.'
                : 'No run recorded yet.'}
          </IdeCallout>
        </section>
      }
      inspector={
        <>
          <IdeInspectorSection title="Vectors">
            <p className="ide-copy">{vectorSourceLabel}</p>
            <div className="ide-signal-list">
              {VERIFY_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  className="ide-signal-row"
                  type="button"
                  onClick={() => setSelectedScenario(scenario.id)}
                  data-testid={`ide-verify-vector-${scenario.id}`}
                >
                  {scenario.name}
                </button>
              ))}
            </div>

            <div className="ide-verify-vector-form" data-testid="ide-verify-add-vector-form">
              <label className="ide-verify-field">
                Tick
                <input
                  type="number"
                  className="ide-export-pin-input"
                  value={draftTick}
                  min={0}
                  step={1}
                  onChange={(event) => setDraftTick(Number(event.target.value || '0'))}
                  data-testid="ide-verify-add-vector-tick"
                />
              </label>
              <div className="ide-verify-vector-grid">
                {inputFields.map((field) => (
                  <label key={field.id} className="ide-verify-field">
                    <span>
                      {field.label}
                      {field.pin ? <code className="ide-verify-field-pin"> {field.pin}</code> : null}
                    </span>
                    <select
                      className="ide-export-pin-input"
                      value={draftInputs[field.id] ?? '0'}
                      onChange={(event) =>
                        setDraftInputs((prev) => ({
                          ...prev,
                          [field.id]: event.target.value === '1' ? '1' : '0',
                        }))
                      }
                      data-testid={`ide-verify-add-vector-input-${toTestId(field.id)}`}
                    >
                      <option value="0">0</option>
                      <option value="1">1</option>
                    </select>
                  </label>
                ))}
              </div>
              <div className="ide-inline-actions">
                <IdeButton tone="primary" onClick={handleAddVector} testId="ide-verify-add-vector-submit">
                  Add vector
                </IdeButton>
                <IdeButton
                  tone="secondary"
                  onClick={handleGenerateBasicVectors}
                  testId="ide-verify-generate-basic-vectors"
                >
                  Generate basic vectors
                </IdeButton>
                <IdeButton tone="ghost" onClick={onOpenProjectVectors}>
                  Open Project vectors
                </IdeButton>
              </div>
            </div>

            <IdeDataTable
              columns={['Tick', ...inputFields.map((field) => field.label)]}
              rows={vectorRows}
              testId="ide-verify-vectors-table"
            />
          </IdeInspectorSection>
        </>
      }
      console={
        <section className="ide-verify-console" data-testid="ide-verify-console">
          <header className="ide-design-diagnostics-drawer-header">
            <h3>Activity</h3>
            <IdeStatusPill tone={status === 'pass' ? 'ok' : status === 'fail' ? 'error' : 'idle'}>
              {status === 'pass' ? 'PASS' : status === 'fail' ? 'FAIL' : 'IDLE'}
            </IdeStatusPill>
          </header>
          <div className="ide-design-diagnostics-list">
            {hasResults ? (
              <>
                <article className="ide-design-diagnostic-row">
                  <div className="ide-design-diagnostic-row-header">
                    <code>VERIFY</code>
                    <span>
                      Scenario <strong>{lastRun?.scenarioName ?? 'n/a'}</strong> completed at{' '}
                      <code>{lastRun?.generatedAtIso ?? 'n/a'}</code>.
                    </span>
                  </div>
                </article>
                <article className="ide-design-diagnostic-row">
                  <div className="ide-design-diagnostic-row-header">
                    <code>HASH</code>
                    <span data-testid="ide-verify-console-hash">
                      report=<code>{lastRun?.reportHash ?? 'pending'}</code>
                    </span>
                  </div>
                </article>
                {firstFailure ? (
                  <article className="ide-design-diagnostic-row is-error">
                    <div className="ide-design-diagnostic-row-header">
                      <code>FIRST_FAIL</code>
                      <span>
                        tick <code>{firstFailure.tick}</code> signal <code>{firstFailure.signal}</code>
                      </span>
                    </div>
                  </article>
                ) : null}
              </>
            ) : (
              <p className="ide-copy">Run verification to populate deterministic activity output.</p>
            )}
          </div>
        </section>
      }
    >
      <IdePanel
        title="Verification Truth Screen"
        description="Run deterministic vectors, scrub ticks, and jump directly from mismatch to fix path."
        actions={
          <>
            <span data-testid="ide-primary-cta">
              <IdeButton tone="primary" onClick={runVerification} testId="ide-verify-run">
                Run verification
              </IdeButton>
            </span>
            <IdeButton tone="secondary" onClick={clearResults} testId="ide-verify-clear">
              Clear
            </IdeButton>
            <IdeButton tone="ghost" disabled={!canExportTestbench} testId="ide-verify-export-testbench">
              Export testbench
            </IdeButton>
          </>
        }
        right={
          <IdeStatusPill tone={status === 'pass' ? 'ok' : status === 'fail' ? 'error' : 'idle'}>
            {status === 'pass' ? 'PASS' : status === 'fail' ? 'FAIL' : 'IDLE'}
          </IdeStatusPill>
        }
        testId="ide-verify-panel"
      >
        <section
          className={`ide-verify-banner ${status === 'pass' ? 'is-pass' : status === 'fail' ? 'is-fail' : ''}`}
          data-testid="ide-verify-banner"
        >
          <div>
            <p className="ide-verify-label">Verification Result</p>
            <h3 data-testid="ide-verify-status-label">
              {status === 'pass'
                ? 'PASS - deterministic agreement'
                : status === 'fail'
                  ? 'FAIL - mismatch detected'
                  : 'IDLE - run verification'}
            </h3>
            {status === 'fail' && typeof firstFailureTick === 'number' && (
              <p className="ide-copy" data-testid="ide-verify-first-fail-tick">
                First failing tick: <code>{firstFailureTick}</code>
              </p>
            )}
          </div>
          <div className="ide-verify-hash-block">
            <span>Hash</span>
            <code data-testid="ide-verify-hash">{lastRun?.deterministicHash ?? deterministicHash}</code>
            <span>Report</span>
            <code data-testid="ide-verify-report-hash">{lastRun?.reportHash ?? 'pending'}</code>
            <span>Schedule</span>
            <code data-testid="ide-verify-schedule">{lastRun?.schedule ?? 'pending'}</code>
          </div>
        </section>

        {status === 'idle' ? (
          <div className="ide-empty-stack" data-testid="ide-verify-empty-state">
            <div className="ide-empty-illustration ide-empty-illustration-verify" aria-hidden="true" />
            <IdeCallout tone="info" title="Run to generate evidence">
              Add vectors from mapped inputs, run verification, then inspect tick-level waveform output.
            </IdeCallout>
          </div>
        ) : (
          <div className="ide-verify-workbench" data-testid="ide-verify-workbench">
            <section className="ide-verify-waveform-panel" data-testid="ide-verify-workspace-waveform">
              <header className="ide-section-header">
                <h3>Waveform</h3>
                <span className="ide-section-header-meta">
                  {signalTimeline.length} signals / {timelineTicks.length} ticks
                </span>
              </header>
              <section className="ide-verify-tick-nav" data-testid="ide-verify-tick-nav">
                <div className="ide-inline-actions">
                  <IdeButton
                    tone="secondary"
                    onClick={() => {
                      if (typeof firstFailureTick !== 'number') return;
                      setSelectedTick(firstFailureTick);
                    }}
                    disabled={typeof firstFailureTick !== 'number'}
                    testId="ide-verify-jump-first-fail"
                  >
                    Jump to first fail
                  </IdeButton>
                </div>
                {timelineTicks.length > 0 && selectedTick !== null ? (
                  <label className="ide-verify-scrubber-field">
                    Tick
                    <input
                      type="range"
                      min={timelineTicks[0]}
                      max={timelineTicks[timelineTicks.length - 1]}
                      step={1}
                      value={selectedTick}
                      onChange={(event) => setSelectedTick(Number(event.target.value))}
                      data-testid="ide-verify-tick-scrubber"
                    />
                    <code data-testid="ide-verify-selected-tick">{selectedTick}</code>
                  </label>
                ) : null}
              </section>

              <div className="ide-waveform-stub" data-testid="ide-verify-waveform-preview">
                {signalTimeline.length === 0 ? (
                  <p className="ide-copy">Waveform data appears after a verification run.</p>
                ) : (
                  <div className="ide-verify-waveform-grid" data-testid="ide-verify-waveform-grid">
                    {signalTimeline.map((signalRow) => (
                      <div
                        key={signalRow.signal}
                        className={`ide-verify-waveform-row ${
                          selectedSignal === signalRow.signal ? 'is-selected' : ''
                        }`}
                        data-testid={`ide-verify-waveform-row-${toTestId(signalRow.signal)}`}
                      >
                        <button
                          type="button"
                          className="ide-verify-waveform-label"
                          onClick={() => setSelectedSignal(signalRow.signal)}
                        >
                          {signalRow.signal}
                        </button>
                        <div className="ide-verify-waveform-track">
                          {signalRow.values.map((point) => (
                            <button
                              key={`${signalRow.signal}-${point.tick}`}
                              type="button"
                              className={`ide-verify-waveform-point ${
                                selectedTick === point.tick ? 'is-selected' : ''
                              }`}
                              data-testid="ide-verify-waveform-point"
                              onClick={() => {
                                setSelectedTick(point.tick);
                                setSelectedSignal(signalRow.signal);
                              }}
                            >
                              {point.value}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="ide-verify-mismatch-panel" data-testid="ide-verify-mismatch-table">
              <header className="ide-section-header">
                <h3>Mismatches</h3>
                <span className="ide-section-header-meta">{failingRows.length} failing rows</span>
              </header>
              {failingRows.length === 0 ? (
                <IdeCallout tone="success" title="No mismatches in current run">
                  PASS evidence is ready for export.
                </IdeCallout>
              ) : (
                <div className="ide-table-wrap">
                  <table className="ide-table">
                    <thead>
                      <tr>
                        <th>Tick</th>
                        <th>Signal</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failingRows.map((row) => {
                        const isSelected =
                          selectedTick === row.tick && selectedSignal === row.signal;
                        return (
                          <tr
                            key={`${row.tick}-${row.signal}`}
                            className={isSelected ? 'ide-export-row-highlight' : undefined}
                            data-testid={`ide-verify-mismatch-row-${toTestId(`${row.signal}-${row.tick}`)}`}
                          >
                            <td>
                              <button
                                type="button"
                                className="ide-link-button"
                                onClick={() => {
                                  setSelectedTick(row.tick);
                                  setSelectedSignal(row.signal);
                                }}
                              >
                                {row.tick}
                              </button>
                            </td>
                            <td>
                              <code>{row.signal}</code>
                            </td>
                            <td>{row.expected}</td>
                            <td>{row.actual}</td>
                            <td>
                              <IdeButton
                                tone="secondary"
                                onClick={() =>
                                  onFixPath?.({
                                    signal: row.signal,
                                    tick: row.tick,
                                    expected: row.expected,
                                    actual: row.actual,
                                  })
                                }
                                testId="ide-verify-fix-path"
                              >
                                Fix in Design
                              </IdeButton>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section data-testid="ide-verify-signal-table">
              <IdeDataTable
                columns={['Signal', `Tick ${selectedTick ?? '-'}`, 'Expected', 'Actual']}
                rows={selectedTickRows.map((row) => [
                  row.signal,
                  String(row.tick),
                  row.expected,
                  row.actual,
                ])}
              />
            </section>

            {status === 'fail' && (
              <section data-testid="ide-verify-diff-table">
                <IdeCallout tone="error" title="Failure Diff">
                  <ul className="ide-list">
                    {failingRows.map((row) => (
                      <li key={`${row.tick}-${row.signal}`}>
                        Tick <code>{row.tick}</code> signal <code>{row.signal}</code> expected{' '}
                        <code>{row.expected}</code> but observed <code>{row.actual}</code>.
                      </li>
                    ))}
                  </ul>
                  <div className="ide-inline-actions">
                    <IdeButton
                      tone="secondary"
                      onClick={() => {
                        if (!firstFailure) return;
                        onFixPath?.({
                          signal: firstFailure.signal,
                          tick: firstFailure.tick,
                          expected: firstFailure.expected,
                          actual: firstFailure.actual,
                        });
                      }}
                      disabled={!firstFailure || !onFixPath}
                      testId="ide-verify-fix-path-primary"
                    >
                      Fix path in Design
                    </IdeButton>
                  </div>
                </IdeCallout>
              </section>
            )}

            <IdeDataTable
              columns={['Tick', 'Signal', 'Expected', 'Actual', 'Status']}
              rows={resultRows}
              testId="ide-verify-results-table"
            />
          </div>
        )}
      </IdePanel>
    </IdeSurfaceLayout>
  );
};

function normalizeVectors(
  vectors: VerifySurfaceProps['vectors'],
  inputFields: VerifyVectorDraftInput[]
): VerifyAuthorVector[] {
  if (!vectors || vectors.length === 0) return [];
  return vectors
    .map((vector, index) => ({
      id: `vec-${String(index + 1).padStart(2, '0')}`,
      tick: Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : index,
      inputs: inputFields.reduce<Record<string, 0 | 1>>((acc, field) => {
        acc[field.id] = normalizeBit(vector.inputs?.[field.id]);
        return acc;
      }, {}),
      expected: Object.fromEntries(
        Object.entries(vector.expected ?? {}).map(([key, value]) => [normalizeFieldId(key), normalizeBit(value)])
      ),
    }))
    .sort((left, right) => left.tick - right.tick);
}

function nextVectorTick(vectors: VerifySurfaceProps['vectors']): number {
  if (!vectors || vectors.length === 0) return 0;
  return Math.max(...vectors.map((vector) => vector.tick)) + 1;
}

function createDraftInputs(inputFields: VerifyVectorDraftInput[]): Record<string, '0' | '1'> {
  return inputFields.reduce<Record<string, '0' | '1'>>((acc, field) => {
    acc[field.id] = '0';
    return acc;
  }, {});
}

function withInputFieldDefaults(
  current: Record<string, '0' | '1'>,
  inputFields: VerifyVectorDraftInput[]
): Record<string, '0' | '1'> {
  const next: Record<string, '0' | '1'> = {};
  for (const field of inputFields) {
    next[field.id] = current[field.id] === '1' ? '1' : '0';
  }
  return next;
}

function normalizeBit(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1') return 1;
  return 0;
}

function normalizeFieldId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

function toTestId(value: string): string {
  return normalizeFieldId(value);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
