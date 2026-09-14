import type { Circuit } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { digestValue } from '../../utils/digest';
import type { ProjectIoRow, RuntimeVerifyRun } from './projectRuntime';
import type { VerifyClockPolicy } from './verifyClockPolicy';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import { buildVerifyCircuitEvidenceHash } from './verifyProjectHash';
import { computeExecutionStimulusHash } from './verifyScenario';

/** Semantic engine revision, independent of UI build SHA. Bump when execution changes. */
export const BROWSER_ENGINE_VERSION = 'redbyte-browser-v1';

export interface RunIdentity {
  readonly design: string;
  readonly stimulus: string;
  readonly engine: string;
}

/** Inputs retained by the execution owner, alongside its existing circuit snapshot. */
export interface RecordedExecutionInput {
  readonly ioRows: ProjectIoRow[];
  readonly vectors: TestVector[];
  readonly projectHash: string;
}

export function buildRunIdentity(input: {
  circuit: Circuit;
  ioRows: readonly ProjectIoRow[];
  vectors: readonly TestVector[];
  clockPolicy?: VerifyClockPolicy | null;
  schedule: VerifyScheduleContract;
  runKind: 'trace' | 'verify';
}): RunIdentity {
  // Logical IO binding affects execution; the board package pin does not. Geometry,
  // timestamps, run ordinals, scenario names and authoring IDs never enter this identity.
  const io = input.ioRows.map(row => ({
    id: row.id, nodeId: row.nodeId ?? '', port: row.port ?? '',
    label: row.label, direction: row.direction,
  })).sort((a, b) => a.id.localeCompare(b.id));
  return {
    design: digestValue({ circuit: buildVerifyCircuitEvidenceHash(input.circuit), io }),
    stimulus: digestValue({
      execution: computeExecutionStimulusHash(input.vectors, input.clockPolicy),
      checks: input.runKind === 'verify'
        ? input.vectors.map(vector => ({ tick: vector.tick, expected: vector.expected ?? {} })) : [],
      schedule: input.schedule,
    }),
    engine: BROWSER_ENGINE_VERSION,
  };
}

export function configurationDigest(identity: RunIdentity): string {
  return digestValue(identity);
}

/** Observations only: checks, display aliases, timestamps and report metadata are not outputs. */
/** Native samples without repeating every endpoint name at every tick. Workspace-local,
 * lossless metadata in the existing recording; no portable project format change. */
export interface NativeRecordingTrace {
  readonly signals: string[];
  readonly frames: Array<{ tick: number; values: Array<string | null> }>;
}
export function compactNativeTrace(samples: RuntimeVerifyRun['waveform']): NativeRecordingTrace {
  const signals = [...new Set(samples.flatMap(sample => Object.keys(sample.signals)))].sort();
  return { signals, frames: samples.map(sample => ({ tick: sample.tick,
    values: signals.map(signal => Object.hasOwn(sample.signals, signal) ? String(sample.signals[signal]) : null),
  })) };
}
type RecordedSamples = Pick<RuntimeVerifyRun, 'waveform' | 'traceWaveform' | 'nativeTrace'>;
function observations(run: RecordedSamples) {
  if (run.nativeTrace) {
    const trace = run.nativeTrace;
    return trace.frames.map(frame => ({ tick: frame.tick,
      signals: Object.fromEntries(trace.signals.flatMap((signal, index) => frame.values[index] == null ? [] : [[signal, frame.values[index]!]])),
    }));
  }
  return run.traceWaveform ?? run.waveform;
}

export function outputDigest(run: RecordedSamples): string {
  return digestValue(observations(run).map(sample => ({ tick: sample.tick, signals: sample.signals })));
}

export interface RecordingDifference {
  readonly tick: number;
  readonly signal: string;
  readonly expected: string;
  readonly actual: string;
}

export function firstRecordingDifference(
  baseline: RecordedSamples,
  candidate: RecordedSamples,
): RecordingDifference | null {
  const left = new Map(observations(baseline).map(sample => [sample.tick, sample.signals]));
  const right = new Map(observations(candidate).map(sample => [sample.tick, sample.signals]));
  const ticks = [...new Set([...left.keys(), ...right.keys()])].sort((a, b) => a - b);
  for (const tick of ticks) {
    if (!left.has(tick) || !right.has(tick)) {
      return { tick, signal: 'sample', expected: left.has(tick) ? 'recorded' : 'unrecorded', actual: right.has(tick) ? 'recorded' : 'unrecorded' };
    }
    for (const signal of [...new Set([...Object.keys(left.get(tick)!), ...Object.keys(right.get(tick)!)])].sort()) {
      const expected = left.get(tick)?.[signal] ?? 'unrecorded';
      const actual = right.get(tick)?.[signal] ?? 'unrecorded';
      if (expected !== actual) return { tick, signal, expected, actual };
    }
  }
  return null;
}

export function summarizeRepetitions(run: RuntimeVerifyRun, archive: readonly RuntimeVerifyRun[]) {
  const identity = run.identity;
  const runs = identity ? archive.filter(entry => entry.projectId === run.projectId &&
    entry.identity?.design === identity.design && entry.identity.stimulus === identity.stimulus &&
    entry.identity.engine === identity.engine) : [run];
  const baseline = runs[0] ?? run;
  const digest = baseline.outputDigest ?? outputDigest(baseline);
  // Digests are a compact display, not a substitute for comparing the retained samples.
  const agrees = (entry: RuntimeVerifyRun) => (entry.outputDigest ?? outputDigest(entry)) === digest &&
    firstRecordingDifference(baseline, entry) === null;
  const identical = runs.filter(agrees).length;
  const divergent = runs.find(entry => !agrees(entry));
  return { runs, baseline, identical, digest, difference: divergent ? firstRecordingDifference(baseline, divergent) : null, divergent };
}

/** A read model of changed inputs, never a new freshness authority. */
export function describeRecordingChanges(run: RuntimeVerifyRun, current: {
  circuit?: Circuit | null;
  stimulusHash?: string;
  scenarioContentHash?: string;
}): string[] {
  const changes: string[] = [];
  if (current.circuit && run.evidence?.circuitHash && buildVerifyCircuitEvidenceHash(current.circuit) !== run.evidence.circuitHash) {
    const oldNodes = new Map(run.circuitSnapshot?.nodes.map(node => [node.id, node]) ?? []);
    const changed = current.circuit.nodes.find(node => oldNodes.has(node.id) && oldNodes.get(node.id)?.type !== node.type);
    changes.push(changed ? `Design changed: ${oldNodes.get(changed.id)?.label || changed.id} ${oldNodes.get(changed.id)?.type} → ${changed.type}` : 'Design changed');
  }
  if (run.scenarioStimulusHash && current.stimulusHash && run.scenarioStimulusHash !== current.stimulusHash) changes.push('Stimulus changed');
  else if (run.scenarioContentHash && current.scenarioContentHash && run.scenarioContentHash !== current.scenarioContentHash) changes.push('Scenario checks or event structure changed');
  if (run.identity && run.identity.engine !== BROWSER_ENGINE_VERSION) changes.push('Engine changed');
  return changes;
}
