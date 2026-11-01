import { WorkbenchDisclosure } from '../../components/WorkbenchDisclosure';
import React from 'react';
import type { RuntimeVerifyRun } from '../../projectRuntime';
import { getRuntimeVerifyRunId } from '../../runArchive';
import { summarizeRepetitions, outputDigest } from '../../runDeterminism';
import { describeRecordingState, type RecordingState } from './recordingState';
import './run-identity.css';

/** How the failing-check count moved since the previous checked recording, in words. */
function describeFailedDelta(delta: number): string {
  if (delta === 0) return 'no change in failing checks';
  const count = Math.abs(delta);
  return `${count} ${delta < 0 ? 'fewer' : 'more'} failing ${count === 1 ? 'check' : 'checks'}`;
}

export function RunIdentityStrip({ run, archive, changes, recording, currencyReason, onSelect, onDifference, onReproduce, reproduceDisabledReason }: {
  run: RuntimeVerifyRun;
  archive: readonly RuntimeVerifyRun[];
  changes: readonly string[];
  recording?: RecordingState;
  currencyReason?: string | null;
  onSelect?: (runId: string) => void;
  onDifference?: (signal: string, tick: number) => void;
  onReproduce?: () => void;
  reproduceDisabledReason?: string;
}) {
  const repetition = summarizeRepetitions(run, archive);
  const digest = run.outputDigest ?? outputDigest(run);
  const state = recording ?? describeRecordingState({ run, archive, changes, stale: false });
  const records = archive.filter(entry => entry.projectId === run.projectId && entry.scenarioId === run.scenarioId);
  const hasRepeats = repetition.runs.length > 1;
  const repeatStatus = <span data-testid="ide-run-repetition" role="status">
    {run.identity ? hasRepeats ? `${repetition.runs.length} runs · ${repetition.identical} identical` : '1 run · no repeat yet' : 'Older recording · identity unavailable'}
  </span>;
  const values = [
    ['Design', run.identity?.design], ['Stimulus', run.identity?.stimulus],
    ['Engine', run.identity?.engine], ['Output', digest],
  ] as const;
  return <section className="rb-run-identity" data-testid="ide-run-identity" data-run-id={state.runId ?? ''} data-currency={state.currency} title={currencyReason ?? undefined} aria-label="Recorded execution identity">
    <div className="rb-run-identity__status">
      <strong className="rb-run-identity__label">Recorded {state.ordinal ? `#${state.ordinal}` : 'run'}</strong>

      <span data-testid="ide-run-check-result" data-check-status={state.verdict === 'unchecked' ? 'not-configured' : state.verdict}>{state.label}</span>
      {state.currencyLabel && <span data-testid="ide-run-currency">{state.currencyLabel}</span>}
    <WorkbenchDisclosure className="rb-run-identity__details" data-testid="ide-run-details" summary="Recordings & details">
      {records.length > 1 && onSelect && <label>Recording <select aria-label="Recorded run" value={getRuntimeVerifyRunId(run)} onChange={event => onSelect(event.target.value)}>
        {state.options.map(option => <option key={option.runId} value={option.runId}>
          {option.label} · {option.verdictLabel}
        </option>)}
      </select></label>}
      {onReproduce && <button type="button" className="wb-btn wb-btn--ghost" data-testid="ide-vcb-reproduce" onClick={onReproduce}
        disabled={Boolean(reproduceDisabledReason)} title={reproduceDisabledReason ?? 'Run this recording’s retained design and stimulus again.'}>Reproduce recording</button>}
      {reproduceDisabledReason && <p>{reproduceDisabledReason}</p>}
      {repeatStatus}
      <p data-testid="ide-run-comparison" data-run-id={state.runId ?? ''}>
        {state.comparison?.previous ? `Previous checked recording #${state.comparison.previous.ordinal} · ${describeFailedDelta(state.comparison.failedDelta ?? 0)}`
          : 'No previous comparison'}
      </p>
    <div className="rb-run-identity__equation">
      {values.map(([label, value], index) => <React.Fragment key={label}>
        {index > 0 && <span aria-hidden="true">{index === 3 ? '→' : '+'}</span>}
        <span className="rb-run-identity__term">
          <span>{label}</span>
          <code data-testid={`ide-run-${label.toLowerCase()}-digest`} data-digest={value ?? ''} title={value ?? 'Identity unavailable for this older recording'}>
            {value ? label === 'Engine' ? value.replace('redbyte-browser-', 'Browser ') : value.slice(0, 10) : 'unavailable'}
          </code>
        </span>
      </React.Fragment>)}
    </div>

      <dl>{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><code>{value ?? 'Unavailable'}</code></dd></div>)}</dl>
      <p>Browser execution · no physical hardware evidence. Output digest is FNV-1a over recorded engine samples, excluding display aliases, timestamps and check results. Repetition counts cover recordings retained in this project; identical means the samples also agree.</p>
      <ol>{records.map((entry, index) => <li key={getRuntimeVerifyRunId(entry)}>
        <button type="button" onClick={() => onSelect?.(getRuntimeVerifyRunId(entry))}>Recording {state.options[index].ordinal}</button>{' '}
        <span>{state.options[index].verdictLabel}</span>{' '}
        <code data-recording-output-digest={entry.outputDigest ?? outputDigest(entry)}>{entry.outputDigest ?? outputDigest(entry)}</code>
        {entry.reproducedFromRunId && <span> · reproduced</span>}
      </li>)}</ol>
    </WorkbenchDisclosure>
    </div>
    {(changes.length > 0 || state.currency === 'differs') && <p className="rb-run-identity__changes" data-testid="ide-run-input-changes">{/* The manual: what changed (Design, Stimulus, Engine); without a listed change, why the run is no longer current. */}{changes.length > 0 ? changes.join(' · ') : currencyReason} This recording is retained. Rerun uses current inputs; Reproduce uses this recording’s inputs.</p>}
    {repetition.divergent && <div role="alert" className="rb-run-identity__alarm" data-testid="ide-run-divergence">
      <strong>Same configuration produced different outputs.</strong>{' '}
      {repetition.difference ? <button type="button" onClick={() => onDifference?.(repetition.difference!.signal, repetition.difference!.tick)}>
        First difference: {repetition.difference.signal} at t{repetition.difference.tick} · {repetition.difference.expected} → {repetition.difference.actual}
      </button> : 'The retained output digests differ; no differing sample is available.'}
    </div>}

  </section>;
}
