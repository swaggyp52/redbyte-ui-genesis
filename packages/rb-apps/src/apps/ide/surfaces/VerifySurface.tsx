import React, { useMemo, useState } from 'react';
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

const VERIFY_SCENARIOS: VerifyScenario[] = [
  {
    id: 'fail',
    name: 'Counter mismatch sample',
    hash: 'sha:verify-fail-7b91',
    rows: [
      { tick: 12, signal: 'sum[0]', expected: '1', actual: '1' },
      { tick: 12, signal: 'carry', expected: '0', actual: '1' },
      { tick: 13, signal: 'sum[1]', expected: '1', actual: '1' },
      { tick: 14, signal: 'q2', expected: '1', actual: '0' },
    ],
  },
  {
    id: 'pass',
    name: 'Counter baseline sample',
    hash: 'sha:verify-pass-3f2c',
    rows: [
      { tick: 12, signal: 'sum[0]', expected: '1', actual: '1' },
      { tick: 12, signal: 'carry', expected: '0', actual: '0' },
      { tick: 13, signal: 'sum[1]', expected: '1', actual: '1' },
      { tick: 14, signal: 'q2', expected: '1', actual: '1' },
    ],
  },
];

type VerifyStatus = 'idle' | 'blocked' | 'running' | 'pass' | 'fail';

export interface VerifySurfaceProps {
  deterministicHash: string;
  hasVectors: boolean;
  onOpenProjectVectors: () => void;
}

export const VerifySurface: React.FC<VerifySurfaceProps> = ({
  deterministicHash,
  hasVectors,
  onOpenProjectVectors,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<VerifyScenario['id']>('fail');
  const [status, setStatus] = useState<VerifyStatus>('idle');
  const [resultRows, setResultRows] = useState<Array<Array<React.ReactNode>>>([]);
  const [failingRows, setFailingRows] = useState<VerifyRow[]>([]);
  const [resultHash, setResultHash] = useState<string>(deterministicHash);

  const activeScenario = useMemo(
    () => VERIFY_SCENARIOS.find((scenario) => scenario.id === selectedScenario) ?? VERIFY_SCENARIOS[0],
    [selectedScenario]
  );

  const runVerification = () => {
    setStatus('running');
    const rows = activeScenario.rows.map((row) => [
      String(row.tick),
      row.signal,
      row.expected,
      row.actual,
      row.expected === row.actual ? 'PASS' : 'FAIL',
    ]);
    const failing = activeScenario.rows.filter((row) => row.expected !== row.actual);
    setResultRows(rows);
    setFailingRows(failing);
    setResultHash(activeScenario.hash);
    setStatus(failing.length > 0 ? 'fail' : 'pass');
  };

  const clearResults = () => {
    setStatus('idle');
    setResultRows([]);
    setFailingRows([]);
    setResultHash(deterministicHash);
  };

  const firstFailureTick = failingRows[0]?.tick;
  const hasResults = resultRows.length > 0;
  const canExportTestbench = status === 'pass';
  const vectorSourceLabel = hasVectors ? 'Project vectors loaded' : 'Using sample vectors';

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
            <div className="ide-inline-actions">
              <IdeButton tone="ghost" onClick={onOpenProjectVectors}>
                Add vectors
              </IdeButton>
              <IdeButton tone="ghost">Import sample</IdeButton>
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Waveform Preview">
            <div className="ide-waveform-stub" data-testid="ide-verify-waveform-preview">
              <span />
              <span />
              <span />
              <span />
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
            <IdeButton tone="primary" onClick={runVerification} testId="ide-verify-run">
              Run
            </IdeButton>
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
        <div className={`ide-verify-banner ${status === 'pass' ? 'is-pass' : 'is-fail'}`} data-testid="ide-verify-banner">
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
          </div>
        </div>

        {status === 'idle' && (
          <IdeCallout tone="info" title="Run to generate evidence">
            Choose a vector set in the left panel, then run verification to produce PASS/FAIL evidence.
          </IdeCallout>
        )}

        {hasResults && (
          <>
            <IdeDataTable
              columns={['Tick', 'Signal', 'Expected', 'Actual', 'Status']}
              rows={resultRows}
              testId="ide-verify-results-table"
            />
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
                </IdeCallout>
              </section>
            )}
          </>
        )}
      </IdePanel>
    </IdeSurfaceLayout>
  );
};
