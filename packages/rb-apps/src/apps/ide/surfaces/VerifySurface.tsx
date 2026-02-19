import React, { useEffect, useMemo, useState } from 'react';
import type { ProjectHealthVerifyResult } from '../projectHealth';
import { buildVerifyReport } from '../verifyReport';
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

type VerifyStatus = 'idle' | 'running' | 'pass' | 'fail';

export interface VerifySurfaceProps {
  deterministicHash: string;
  hasVectors: boolean;
  vectors?: Array<{
    id?: string;
    tick: number;
    inputs?: Record<string, boolean | number>;
    expected?: Record<string, boolean | number>;
  }>;
  mappedInputs?: Array<{ id: string; label?: string; pin?: string }>;
  onVectorsChange?: (vectors: VerifyAuthorVector[]) => void;
  onVerificationComplete?: (result: ProjectHealthVerifyResult) => void;
  onOpenProjectVectors: () => void;
  onFixPath?: (signal: string) => void;
}

export const VerifySurface: React.FC<VerifySurfaceProps> = ({
  deterministicHash,
  hasVectors,
  vectors,
  mappedInputs,
  onVectorsChange,
  onVerificationComplete,
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

  const [selectedScenario, setSelectedScenario] = useState<VerifyScenario['id']>('fail');
  const [status, setStatus] = useState<VerifyStatus>('idle');
  const [runRows, setRunRows] = useState<VerifyRow[]>([]);
  const [resultHash, setResultHash] = useState<string>(deterministicHash);
  const [reportHash, setReportHash] = useState<string>('pending');
  const [selectedTick, setSelectedTick] = useState<number | null>(null);
  const [authoredVectors, setAuthoredVectors] = useState<VerifyAuthorVector[]>(() =>
    normalizeVectors(vectors, inputFields)
  );
  const [draftTick, setDraftTick] = useState<number>(() => nextVectorTick(vectors));
  const [draftInputs, setDraftInputs] = useState<Record<string, '0' | '1'>>(() =>
    createDraftInputs(inputFields)
  );

  useEffect(() => {
    setAuthoredVectors(normalizeVectors(vectors, inputFields));
  }, [inputFields, vectors]);

  useEffect(() => {
    setDraftInputs((prev) => withInputFieldDefaults(prev, inputFields));
  }, [inputFields]);

  useEffect(() => {
    if (vectors && vectors.length > 0) {
      setDraftTick(nextVectorTick(vectors));
    }
  }, [vectors]);

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
        row.expected === row.actual ? 'PASS' : 'FAIL',
      ]),
    [runRows]
  );

  const failingRows = useMemo(
    () => runRows.filter((row) => row.expected !== row.actual),
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

  const timelineTicks = useMemo(() => {
    return Array.from(new Set(runRows.map((row) => row.tick))).sort((left, right) => left - right);
  }, [runRows]);

  useEffect(() => {
    if (timelineTicks.length === 0) {
      setSelectedTick(null);
      return;
    }
    if (selectedTick === null || !timelineTicks.includes(selectedTick)) {
      setSelectedTick(timelineTicks[0]);
    }
  }, [selectedTick, timelineTicks]);

  const signalTimeline = useMemo(() => {
    const signalValueMap = new Map<string, Map<number, string>>();
    for (const row of runRows) {
      const values = signalValueMap.get(row.signal) ?? new Map<number, string>();
      values.set(row.tick, row.actual);
      signalValueMap.set(row.signal, values);
    }
    return Array.from(signalValueMap.entries())
      .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
      .map(([signal, values]) => ({
        signal,
        values: timelineTicks.map((tick) => ({
          tick,
          value: values.get(tick) ?? '-',
        })),
      }));
  }, [runRows, timelineTicks]);

  const selectedTickRows = useMemo(() => {
    if (selectedTick === null) return [];
    return runRows.filter((row) => row.tick === selectedTick);
  }, [runRows, selectedTick]);

  const runVerification = () => {
    setStatus('running');
    const scenarioRows = activeScenario.rows.map((row) => ({ ...row }));
    const failing = scenarioRows.filter((row) => row.expected !== row.actual);
    const pass = failing.length === 0;
    const ranAtIso = new Date().toISOString();
    const report = buildVerifyReport({
      scenarioId: activeScenario.id,
      scenarioName: activeScenario.name,
      status: pass ? 'pass' : 'fail',
      deterministicHash: activeScenario.hash,
      rows: scenarioRows,
      vectors: authoredVectors,
      generatedAtIso: ranAtIso,
    });

    setRunRows(scenarioRows);
    setResultHash(activeScenario.hash);
    setReportHash(report.reportHash);
    setSelectedTick(report.firstFailingTick ?? scenarioRows[0]?.tick ?? null);
    setStatus(pass ? 'pass' : 'fail');
    onVerificationComplete?.({
      status: pass ? 'pass' : 'fail',
      hash: activeScenario.hash,
      reportHash: report.reportHash,
      report,
      failingTick: report.firstFailingTick ?? failing[0]?.tick,
      ranAtIso,
    });
  };

  const clearResults = () => {
    setStatus('idle');
    setRunRows([]);
    setReportHash('pending');
    setSelectedTick(null);
    setResultHash(deterministicHash);
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
    setAuthoredVectors(nextVectors);
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
    setAuthoredVectors(vectorsGenerated);
    onVectorsChange?.(vectorsGenerated);
    setDraftTick(3);
  };

  const firstFailure = failingRows[0];
  const firstFailureTick = firstFailure?.tick;
  const hasResults = runRows.length > 0;
  const canExportTestbench = status === 'pass';
  const vectorSourceLabel =
    authoredVectors.length > 0 || hasVectors ? 'Project vectors loaded' : 'No vectors saved yet';

  return (
    <IdeSurfaceLayout
      mode="verify"
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

          <IdeInspectorSection title="Waveform Preview">
            <div className="ide-waveform-stub" data-testid="ide-verify-waveform-preview">
              {signalTimeline.length === 0 ? (
                <p className="ide-copy">Waveform data appears after a verification run.</p>
              ) : (
                <div className="ide-verify-waveform-grid">
                  {signalTimeline.map((signalRow) => (
                    <div key={signalRow.signal} className="ide-verify-waveform-row">
                      <span className="ide-verify-waveform-label">{signalRow.signal}</span>
                      <div className="ide-verify-waveform-track">
                        {signalRow.values.map((point) => (
                          <span
                            key={`${signalRow.signal}-${point.tick}`}
                            className={`ide-verify-waveform-point ${
                              selectedTick === point.tick ? 'is-selected' : ''
                            }`}
                            data-testid="ide-verify-waveform-point"
                          >
                            {point.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </IdeInspectorSection>
        </>
      }
    >
      <IdePanel
        title="Verification Truth Screen"
        description="Run deterministic vectors, inspect first failure, and prove expected/actual behavior."
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
            {status === 'pass'
              ? 'PASS'
              : status === 'fail'
                ? 'FAIL'
                : status === 'running'
                  ? 'RUNNING'
                  : 'IDLE'}
          </IdeStatusPill>
        }
        testId="ide-verify-panel"
      >
        <div
          className={`ide-verify-banner ${status === 'pass' ? 'is-pass' : 'is-fail'}`}
          data-testid="ide-verify-banner"
        >
          <div>
            <p className="ide-verify-label">Verification Result</p>
            <h3 data-testid="ide-verify-status-label">
              {status === 'pass'
                ? 'PASS - deterministic agreement'
                : status === 'fail'
                  ? 'FAIL - mismatch detected'
                  : status === 'running'
                    ? 'RUNNING - deterministic checks in progress'
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
            <code data-testid="ide-verify-hash">{resultHash}</code>
            <span>Report</span>
            <code data-testid="ide-verify-report-hash">{reportHash}</code>
          </div>
        </div>

        {status === 'idle' && (
          <div className="ide-empty-stack" data-testid="ide-verify-empty-state">
            <div className="ide-empty-illustration ide-empty-illustration-verify" aria-hidden="true" />
            <IdeCallout tone="info" title="Run to generate evidence">
              Add vectors from mapped inputs, then run verification to produce PASS/FAIL evidence.
            </IdeCallout>
          </div>
        )}

        {hasResults && (
          <>
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

            <IdeDataTable
              columns={['Tick', 'Signal', 'Expected', 'Actual', 'Status']}
              rows={resultRows}
              testId="ide-verify-results-table"
            />
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
                        onFixPath?.(firstFailure.signal);
                      }}
                      disabled={!firstFailure || !onFixPath}
                      testId="ide-verify-fix-path"
                    >
                      Fix path in Design
                    </IdeButton>
                  </div>
                </IdeCallout>
              </section>
            )}
          </>
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
      id: vector.id ?? `vec-${String(index + 1).padStart(2, '0')}`,
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
