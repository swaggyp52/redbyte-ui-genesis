import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TestVector } from '@redbyte/rb-utils';
import type { RunVerificationInput, RuntimeVerifyRun } from '../projectRuntime';
import { buildVerifyTickSignalIndex } from '../verifyReport';
import type { IdeExampleDefinition } from '../examplesCatalog';
import { getVerifyHint, type VerifyHintContext } from '../verifyHints';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdeInspectorAccordion,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';
import { SurfacePanel } from '../components/SurfaceLayoutPrimitives';
import { TruthTablePane } from './TruthTablePane';
import type { TruthTableMode, TruthTableRow } from './TruthTablePane';

interface VerifyRow {
  tick: number;
  signal: string;
  expected: string;
  actual: string;
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

interface VerifyMappedSignal {
  id: string;
  label?: string;
  pin?: string;
  direction: 'in' | 'out';
}

type VerifyStatus = 'idle' | 'pass' | 'fail';

export interface VerifySurfaceProps {
  deterministicHash: string;
  hasVectors: boolean;
  vectors?: TestVector[];
  lastRun?: RuntimeVerifyRun;
  mappedInputs?: Array<{ id: string; label?: string; pin?: string }>;
  mappedSignals?: VerifyMappedSignal[];
  onVectorsChange?: (vectors: VerifyAuthorVector[]) => void;
  onRunVerification?: (input: RunVerificationInput) => void;
  onClearVerification?: () => void;
  onOpenProjectVectors: () => void;
  onFixPath?: (target: VerifyFailureTarget) => void;
  example?: IdeExampleDefinition | null;
  onGoToDesign?: () => void;
  onGoToHardware?: () => void;
  hasDff?: boolean;
}

// ─── SVG WaveformViewer ──────────────────────────────────────────────────────

interface WaveformSignalRow {
  signal: string;
  values: Array<{ tick: number; value: string }>;
}

const WaveformViewer: React.FC<{
  signals: WaveformSignalRow[];
  ticks: number[];
  failTicks: Set<number>;
  failingSignalKeys: Set<string>;
  selectedTick: number | null;
  onSelectTick: (tick: number) => void;
  onSelectSignal: (signal: string) => void;
  rowHeight?: number;
  emptyMessage?: string;
}> = ({ signals, ticks, failTicks, failingSignalKeys, selectedTick, onSelectTick, onSelectSignal, rowHeight = 38, emptyMessage = 'Run verification to see waveforms' }) => {
  const LABEL_W = 88;
  const ROW_H = rowHeight;
  const ROW_HI = Math.round(ROW_H * 0.24);
  const ROW_LO = Math.round(ROW_H * 0.76);
  const HEADER_H = 24;
  const TICK_W = 48;

  const width = LABEL_W + ticks.length * TICK_W;
  const height = HEADER_H + signals.length * ROW_H;

  if (signals.length === 0) {
    return (
      <div className="ide-verify-waveform-empty" data-testid="ide-verify-waveform-empty">
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      style={{ display: 'block', fontFamily: 'IBM Plex Mono, monospace', overflow: 'visible' }}
      data-testid="ide-verify-waveform-svg"
    >
      <defs>
        <filter id="wfCursorGlow" x="-30%" y="0%" width="160%" height="100%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Dark PCB-style background */}
      <rect width={width} height={height} fill="#030810" />

      {/* Minor + major vertical grid lines (steel-blue, not teal) */}
      {ticks.map((tick, i) => (
        <line key={`grid-${tick}`}
          x1={LABEL_W + i * TICK_W} y1={HEADER_H} x2={LABEL_W + i * TICK_W} y2={height}
          stroke="rgba(56,189,248,0.04)" strokeWidth="1" />
      ))}
      {ticks.map((tick, i) => i % 5 === 0 ? (
        <line key={`grid-major-${tick}`}
          x1={LABEL_W + i * TICK_W} y1={HEADER_H} x2={LABEL_W + i * TICK_W} y2={height}
          stroke="rgba(56,189,248,0.12)" strokeWidth="1" />
      ) : null)}

      {/* Fail column full-height overlay — drawn before signal rows so it sits behind traces */}
      {ticks.map((tick, i) => failTicks.has(tick) ? (
        <rect
          key={`fcol-${tick}`}
          x={LABEL_W + i * TICK_W}
          y={HEADER_H}
          width={TICK_W}
          height={height - HEADER_H}
          fill="rgba(255,85,85,0.07)"
        />
      ) : null)}

      {/* Tick labels in header — number every 5th, dot otherwise */}
      {ticks.map((tick, i) => i % 5 === 0 ? (
        <text
          key={`label-${tick}`}
          x={LABEL_W + i * TICK_W + TICK_W / 2}
          y={15}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(56,189,248,0.5)"
          fontSize={11}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {tick}
        </text>
      ) : (
        <circle
          key={`label-${tick}`}
          cx={LABEL_W + i * TICK_W + TICK_W / 2}
          cy={15}
          r={1.5}
          fill="rgba(56,189,248,0.2)"
        />
      ))}

      {/* Signal rows */}
      {signals.map((signalRow, rowIndex) => {
        const y = HEADER_H + rowIndex * ROW_H;
        const normalizedKey = signalRow.signal.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const isFailing = failingSignalKeys.has(normalizedKey);

        return (
          <g key={signalRow.signal}>
            {/* Alternating row background */}
            <rect
              x={0}
              y={y}
              width={width}
              height={ROW_H}
              fill={rowIndex % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'}
            />

            {/* Signal label */}
            <text
              x={LABEL_W - 8}
              y={y + Math.round(ROW_H / 2) + 4}
              textAnchor="end"
              fontSize="11"
              fill={isFailing ? '#ff9090' : 'rgba(180,200,220,0.72)'}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectSignal(signalRow.signal)}
            >
              <>
                <title>{signalRow.signal}</title>
                {signalRow.signal.length > 13 ? `${signalRow.signal.slice(0, 12)}…` : signalRow.signal}
              </>
            </text>

            {/* Signal trace */}
            {signalRow.values.map((point, i) => {
              const isHigh = point.value === '1';
              const tickX = LABEL_W + i * TICK_W;
              const isFail = failTicks.has(point.tick);
              const isSelected = point.tick === selectedTick;
              const prevValue = i > 0 ? signalRow.values[i - 1]?.value : null;
              const hasTransition = prevValue !== null && prevValue !== point.value;

              return (
                <g key={`${signalRow.signal}-${point.tick}`}>
                  {/* Fail segment highlight */}
                  {isFail && (
                    <rect x={tickX} y={y} width={TICK_W} height={ROW_H} fill="rgba(255,107,107,0.18)" />
                  )}

                  {/* Selected tick column highlight */}
                  {isSelected && (
                    <rect
                      x={tickX}
                      y={HEADER_H}
                      width={TICK_W}
                      height={height - HEADER_H}
                      fill="rgba(56,189,248,0.18)"
                    />
                  )}

                  {/* Signal rail — 3px horizontal line at hi or lo position */}
                  {point.value !== '-' && (
                    <line
                      x1={tickX + 2}          y1={isHigh ? y + ROW_HI : y + ROW_LO}
                      x2={tickX + TICK_W - 2} y2={isHigh ? y + ROW_HI : y + ROW_LO}
                      stroke={isFail ? (isHigh ? '#ff6b6b' : 'rgba(255,107,107,0.55)') : (isHigh ? '#2ec4b6' : 'rgba(46,196,182,0.35)')}
                      strokeWidth="3" strokeLinecap="round"
                    />
                  )}

                  {/* Transition vertical line connecting rail positions */}
                  {hasTransition && (
                    <line
                      x1={tickX} y1={y + ROW_HI} x2={tickX} y2={y + ROW_LO}
                      stroke={isFail ? '#ff6b6b' : 'rgba(46,196,182,0.6)'}
                      strokeWidth="1.5" strokeLinecap="round"
                    />
                  )}

                  {/* Transparent click target */}
                  <rect
                    x={tickX}
                    y={y}
                    width={TICK_W}
                    height={ROW_H}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      onSelectTick(point.tick);
                      onSelectSignal(signalRow.signal);
                    }}
                    data-testid="ide-verify-waveform-point"
                    data-value={String(point.value)}
                  />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Selected tick vertical cursor + badge */}
      {selectedTick !== null && (() => {
        const i = ticks.indexOf(selectedTick);
        if (i < 0) return null;
        const cx = LABEL_W + i * TICK_W + TICK_W / 2;
        return (
          <g style={{ pointerEvents: 'none' }}>
            <line
              x1={cx} y1={HEADER_H}
              x2={cx} y2={height}
              stroke="rgba(56,189,248,0.9)"
              strokeWidth="1.5"
              filter="url(#wfCursorGlow)"
            />
            {/* Tick badge pinned to top of cursor */}
            <rect x={cx - 14} y={1} width={28} height={14} rx={3} fill="rgba(56,189,248,0.18)" />
            <text
              x={cx} y={9}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(56,189,248,0.9)"
              fontSize={9}
              fontWeight="700"
              style={{ userSelect: 'none' }}
            >
              t{selectedTick}
            </text>
          </g>
        );
      })()}

      {/* Label column separator */}
      <line
        x1={LABEL_W}
        y1={0}
        x2={LABEL_W}
        y2={height}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1"
      />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export const VerifySurface: React.FC<VerifySurfaceProps> = ({
  deterministicHash,
  hasVectors,
  vectors,
  lastRun,
  mappedInputs,
  mappedSignals,
  onVectorsChange,
  onRunVerification,
  onClearVerification,
  onOpenProjectVectors,
  onFixPath,
  example,
  onGoToDesign,
  onGoToHardware,
  hasDff = false,
}) => {
  const inputFields = useMemo(() => {
    const mappedInputSeed =
      mappedInputs && mappedInputs.length > 0
        ? mappedInputs
        : (mappedSignals ?? [])
            .filter((entry) => entry.direction === 'in')
            .map((entry) => ({ id: entry.id, label: entry.label, pin: entry.pin }));

    const normalized = mappedInputSeed
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
  }, [mappedInputs, mappedSignals]);

  const authoredVectors = useMemo(
    () => normalizeVectors(vectors, inputFields),
    [inputFields, vectors]
  );

  const [selectedTick, setSelectedTick] = useState<number | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);
  const [draftTick, setDraftTick] = useState<number>(() => nextVectorTick(vectors));
  const [runState, setRunState] = useState<'idle' | 'running' | 'complete'>('idle');
  const [draftInputs, setDraftInputs] = useState<Record<string, '0' | '1'>>(() =>
    createDraftInputs(inputFields)
  );
  const [verifyTab, setVerifyTab] = useState<'mismatches' | 'vectors' | 'details'>('mismatches');
  const [kitTipOpen, setKitTipOpen] = useState(false);
  const [waveformDensity, setWaveformDensity] = useState<'small' | 'normal' | 'large'>('normal');
  const [tickZoom, setTickZoom] = useState<'all' | 'fail' | 'window'>('all');
  const [tickWindowCenter, setTickWindowCenter] = useState<number | null>(null);
  const [truthTableMode, setTruthTableMode] = useState<TruthTableMode>('ticks');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAllVectorTicks, setShowAllVectorTicks] = useState(false);
  const [oracleApplied, setOracleApplied] = useState(false);

  const ROW_H_MAP: Record<string, number> = { small: 26, normal: 38, large: 52 };

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
  const waveformTicks = useMemo(() => {
    const ticks = new Set<number>();
    for (const sample of lastRun?.waveform ?? []) ticks.add(sample.tick);
    return Array.from(ticks).sort((a, b) => a - b);
  }, [lastRun?.waveform]);

  const signalTimeline = useMemo(() => {
    const signalValueMap = new Map<string, Map<number, string>>();
    for (const sample of lastRun?.waveform ?? []) {
      for (const [signal, value] of Object.entries(sample.signals)) {
        const values = signalValueMap.get(signal) ?? new Map<number, string>();
        values.set(sample.tick, value);
        signalValueMap.set(signal, values);
      }
    }

    const displayTicks = waveformTicks.length > 0 ? waveformTicks : timelineTicks;
    return Array.from(signalValueMap.entries())
      .sort((left, right) => compareText(left[0], right[0]))
      .map(([signal, values]) => ({
        signal,
        values: displayTicks.map((tick) => ({
          tick,
          value: values.get(tick) ?? '-',
        })),
      }));
  }, [lastRun?.waveform, timelineTicks, waveformTicks]);

  const failingRows = useMemo(
    () => runRows.filter((row) => row.status === 'fail'),
    [runRows]
  );

  const mappedSignalKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const signal of mappedSignals ?? []) {
      const candidates = [signal.id, signal.label ?? ''];
      for (const candidate of candidates) {
        const normalized = normalizeFieldId(candidate);
        if (normalized) keys.add(normalized);
      }
    }
    return keys;
  }, [mappedSignals]);
  const failingSignalKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of failingRows) {
      const normalized = normalizeFieldId(row.signal);
      if (normalized) keys.add(normalized);
    }
    return keys;
  }, [failingRows]);
  const relevantSignalTimeline = useMemo(() => {
    const filtered = signalTimeline.filter((entry) => {
      const normalized = normalizeFieldId(entry.signal);
      return mappedSignalKeys.has(normalized) || failingSignalKeys.has(normalized);
    });
    return filtered.length > 0 ? filtered : signalTimeline;
  }, [failingSignalKeys, mappedSignalKeys, signalTimeline]);
  const [showAllSignals, setShowAllSignals] = useState(false);
  const [selectedFailureSignal, setSelectedFailureSignal] = useState<string | null>(null);
  const visibleSignalTimeline = showAllSignals ? signalTimeline : relevantSignalTimeline;
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
    if (visibleSignalTimeline.length === 0) {
      setSelectedSignal(null);
      return;
    }
    const firstFailSignal = failingRows[0]?.signal;
    setSelectedSignal((previous) => {
      if (previous && visibleSignalTimeline.some((entry) => entry.signal === previous)) return previous;
      if (firstFailSignal) return firstFailSignal;
      return visibleSignalTimeline[0]?.signal ?? null;
    });
  }, [failingRows, visibleSignalTimeline]);

  useEffect(() => {
    if (lastRun) {
      setRunState('complete');
    }
  }, [lastRun?.reportHash]);

  // Track last auto-opened run so we only auto-open drawer once per run
  const autoOpenedRunRef = useRef<string | null>(null);

  // Auto-open drawer + select mismatches tab when a FAIL result arrives
  useEffect(() => {
    if (!lastRun || lastRun.status !== 'fail') return;
    const key = lastRun.reportHash ?? lastRun.generatedAtIso ?? '';
    if (autoOpenedRunRef.current === key) return;
    autoOpenedRunRef.current = key;
    setDrawerOpen(true);
    setVerifyTab('mismatches');
  }, [lastRun?.reportHash, lastRun?.status]);

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

  const inspectorVectorRows = useMemo(
    () =>
      showAllVectorTicks || selectedTick === null
        ? vectorRows
        : vectorRows.filter((row) => row[0] === String(selectedTick)),
    [vectorRows, showAllVectorTicks, selectedTick]
  );

  const status: VerifyStatus = lastRun ? (lastRun.status === 'pass' ? 'pass' : 'fail') : 'idle';
  const hasResults = runRows.length > 0;

  const truthRows = useMemo<TruthTableRow[]>(() => {
    if (status === 'fail') {
      return failingRows.map((row) => ({
        tick: row.tick,
        signal: row.signal,
        expected: row.expected,
        actual: row.actual,
        isFail: true,
      }));
    }
    return [];
  }, [status, failingRows]);
  const firstFailure = failingRows[0];
  const firstFailureTick = firstFailure?.tick ?? lastRun?.firstFailingTick;
  const canExportTestbench = status === 'pass';

  // Compute verify hint (only shown in FAIL state)
  const verifyHint = useMemo((): string | null => {
    if (status !== 'fail' || failingRows.length === 0) return null;
    const totalRows = runRows.length;
    const failCount = failingRows.length;
    const ctx: VerifyHintContext = {
      hasDff,
      mappingComplete: true, // no unmapped pin data here — conservative default
      allTicksFail: totalRows > 0 && failCount === totalRows,
      onlyFirstTickFails:
        failCount === 1 && timelineTicks.length > 1
          ? failingRows[0].tick === timelineTicks[0]
          : failCount > 0 &&
            failingRows.every((r) => r.tick === failingRows[0].tick) &&
            failingRows[0].tick === timelineTicks[0] &&
            timelineTicks.length > 1,
      mismatch: firstFailure
        ? { expected: firstFailure.expected, actual: firstFailure.actual }
        : null,
      hasFloatingOutputWarning: false, // no compiler status available here
    };
    return getVerifyHint(ctx);
  }, [status, failingRows, runRows.length, hasDff, timelineTicks, firstFailure]);

  const isShowcaseKit = example?.category === 'showcase';
  const kitGoals = (example?.goals ?? []).filter(Boolean);

  const handleJumpToFirstFailure = () => {
    if (firstFailureTick == null) return;
    setSelectedTick(firstFailureTick);
    if (firstFailure?.signal) {
      setSelectedSignal(firstFailure.signal);
      setSelectedFailureSignal(firstFailure.signal);
    }
  };

  // Phase 8.1: Fail Navigator derived state
  const failTicksSorted = useMemo(
    () => Array.from(new Set(failingRows.map((r) => r.tick))).sort((a, b) => a - b),
    [failingRows]
  );

  const currentFailIndex = selectedTick !== null ? failTicksSorted.indexOf(selectedTick) : -1;

  const goToPrevFail = () => {
    if (failTicksSorted.length === 0) return;
    const idx = currentFailIndex > 0 ? currentFailIndex - 1 : failTicksSorted.length - 1;
    setSelectedTick(failTicksSorted[idx]);
  };

  const goToNextFail = () => {
    if (failTicksSorted.length === 0) return;
    const idx = currentFailIndex < failTicksSorted.length - 1 ? currentFailIndex + 1 : 0;
    setSelectedTick(failTicksSorted[idx]);
  };

  // Phase 8.1: Zoomed tick window
  const allWaveformTicks = useMemo(
    () => (waveformTicks.length > 0 ? waveformTicks : timelineTicks),
    [waveformTicks, timelineTicks]
  );
  const zoomedTicks = useMemo(() => {
    if (tickZoom === 'all' || allWaveformTicks.length === 0) return allWaveformTicks;
    const center =
      tickZoom === 'fail'
        ? firstFailureTick ?? allWaveformTicks[0] ?? 0
        : tickWindowCenter ?? selectedTick ?? allWaveformTicks[0] ?? 0;
    return allWaveformTicks.filter((t) => t >= center - 10 && t <= center + 10);
  }, [allWaveformTicks, tickZoom, firstFailureTick, tickWindowCenter, selectedTick]);

  // STOP-SHIP: Stale verify badge detection.
  // If the circuit's deterministic hash changed since the last run, the result is stale.
  // Any displayed PASS or FAIL that was computed against a different circuit is misleading.
  const isRunStale =
    lastRun !== undefined &&
    lastRun.deterministicHash !== '' &&
    deterministicHash !== '' &&
    lastRun.deterministicHash !== deterministicHash;

  // Derived display-state machine: replaces the ambiguous IDLE label
  // hasNoTrace fires only when the runtime ran with actual expectation rows
  // AND still produced no waveform data (broken circuit / no I/O mapping).
  // Does NOT fire for runs with empty expectations (rows=[]) — that is a user
  // authoring state (vectors added but no expected values set), not a broken circuit.
  const hasNoTrace = lastRun !== undefined && runRows.length > 0 && signalTimeline.length === 0;
  const isTraceOnly = lastRun !== undefined && !hasResults && !hasNoTrace;
  type DisplayStatus = 'BLOCKED' | 'READY' | 'RUNNING' | 'PASS' | 'FAIL' | 'TRACE' | 'STALE';
  const displayStatus: DisplayStatus =
    runState === 'running'
      ? 'RUNNING'
      : isRunStale
        ? 'STALE'
        : isTraceOnly
          ? 'TRACE'
          : status === 'pass'
            ? 'PASS'
            : status === 'fail'
              ? 'FAIL'
              : authoredVectors.length === 0
                ? 'BLOCKED'
                : 'READY';
  const displayTone: 'ok' | 'warn' | 'error' | 'idle' =
    displayStatus === 'PASS'
      ? 'ok'
      : displayStatus === 'FAIL'
        ? 'error'
        : displayStatus === 'STALE' || displayStatus === 'BLOCKED'
          ? 'warn'
          : 'idle';
  const displayStatusLabel =
    displayStatus === 'PASS'
      ? 'PASS — deterministic agreement'
      : displayStatus === 'FAIL'
        ? hasNoTrace
          ? 'No trace — run completed with empty waveform'
          : 'FAIL — mismatch detected'
        : displayStatus === 'STALE'
          ? 'STALE — circuit changed since last run, re-run to get current result'
          : displayStatus === 'RUNNING'
            ? 'Running verification…'
            : displayStatus === 'TRACE'
              ? 'TRACE ONLY — no expectations set'
              : displayStatus === 'BLOCKED'
                ? 'Blocked — add test vectors to run'
                : 'Ready — vectors loaded, click Run';

  const vectorSourceLabel =
    authoredVectors.length > 0 || hasVectors ? 'Project vectors loaded' : 'No vectors saved yet';

  const runVerification = () => {
    setRunState('running');
    const rows = authoredVectors.flatMap((vector) =>
      Object.entries(vector.expected).map(([signal, expected]) => ({
        tick: vector.tick,
        signal,
        expected: String(expected),
        actual: '0',
      }))
    );
    onRunVerification?.({
      scenarioId: `project-verify-${deterministicHash.slice(0, 8)}`,
      scenarioName: 'Project Vectors',
      deterministicHash,
      rows,
      useRuntimeTrace: true,
    });
    setRunState('complete');
  };

  // Run Deterministic: always simulates from the circuit — ignores interactive runtime trace.
  // Use when the user hasn't stepped the simulation manually or wants reproducible results.
  const runDeterministicVerification = () => {
    setRunState('running');
    const rows = authoredVectors.flatMap((vector) =>
      Object.entries(vector.expected).map(([signal, expected]) => ({
        tick: vector.tick,
        signal,
        expected: String(expected),
        actual: '0',
      }))
    );
    onRunVerification?.({
      scenarioId: `project-verify-det-${deterministicHash.slice(0, 8)}`,
      scenarioName: 'Project Vectors (deterministic)',
      deterministicHash,
      rows,
      useRuntimeTrace: false,
    });
    setRunState('complete');
  };

  const clearResults = () => {
    onClearVerification?.();
    setRunState('idle');
    setOracleApplied(false);
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
    setOracleApplied(false);
  };

  const handleGenerateBasicVectors = () => {
    const templateFields = inputFields.length > 0 ? inputFields : [{ id: 'in_a', label: 'in_a' }];
    // tick 0: all inputs 0
    // tick 1..N: one-hot — only field[i] = 1
    // tick N+1: all inputs 1
    const allZero = templateFields.reduce<Record<string, 0 | 1>>((acc, field) => {
      acc[field.id] = 0;
      return acc;
    }, {});
    const allOne = templateFields.reduce<Record<string, 0 | 1>>((acc, field) => {
      acc[field.id] = 1;
      return acc;
    }, {});
    const vectors: VerifyAuthorVector[] = [
      { id: 'vec-01', tick: 0, inputs: allZero, expected: {} },
      ...templateFields.map((hotField, hotIndex) => ({
        id: `vec-${String(hotIndex + 2).padStart(2, '0')}`,
        tick: hotIndex + 1,
        inputs: templateFields.reduce<Record<string, 0 | 1>>((acc, field) => {
          acc[field.id] = field.id === hotField.id ? 1 : 0;
          return acc;
        }, {}),
        expected: {} as Record<string, 0 | 1>,
      })),
      { id: `vec-${String(templateFields.length + 2).padStart(2, '0')}`, tick: templateFields.length + 1, inputs: allOne, expected: {} },
    ];
    onVectorsChange?.(vectors);
    setDraftTick(templateFields.length + 2);
    setOracleApplied(false);
  };

  // Derive expected outputs from what the circuit actually produced on the last run.
  // Overwrites every authored vector's `expected` map with the real oracle outputs —
  // so future runs verify the circuit is still producing the same thing.
  const handleSetOracleExpected = () => {
    if (!lastRun?.waveform || lastRun.waveform.length === 0) return;

    // Build tick → full signal snapshot map
    const waveformByTick = new Map<number, Record<string, string>>();
    for (const sample of lastRun.waveform) {
      const prev = waveformByTick.get(sample.tick) ?? {};
      waveformByTick.set(sample.tick, { ...prev, ...sample.signals });
    }

    // Input signal keys to exclude
    const inputSignalKeys = new Set(inputFields.map((f) => f.id));

    // Priority 1: explicit output mappings from mappedSignals
    const outputSignalKeys = new Set(
      (mappedSignals ?? [])
        .filter((s) => s.direction === 'out')
        .flatMap((s) => [s.id, s.label ?? ''].map(normalizeFieldId).filter(Boolean))
    );

    // Priority 2 fallback: any mapped signal (input or output) that isn't an input
    const mappedNonInputKeys = new Set(
      (mappedSignals ?? [])
        .flatMap((s) => [s.id, s.label ?? ''].map(normalizeFieldId).filter(Boolean))
        .filter((key) => !inputSignalKeys.has(key))
    );

    const updatedVectors = authoredVectors.map((vector) => {
      const tickSignals = waveformByTick.get(vector.tick);
      if (!tickSignals) return vector;

      const expected: Record<string, 0 | 1> = {};
      for (const [signal, rawValue] of Object.entries(tickSignals)) {
        // Skip tri-state / unknown / high-impedance values — only lock clean 0/1
        if (rawValue !== '0' && rawValue !== '1') continue;
        const key = normalizeFieldId(signal);
        // Skip inputs
        if (inputSignalKeys.has(key)) continue;
        // Apply scope filter: explicit outputs → mapped non-inputs → all non-inputs
        if (outputSignalKeys.size > 0 && !outputSignalKeys.has(key)) continue;
        if (outputSignalKeys.size === 0 && mappedNonInputKeys.size > 0 && !mappedNonInputKeys.has(key)) continue;
        expected[key] = rawValue === '1' ? 1 : 0;
      }
      return { ...vector, expected };
    });

    onVectorsChange?.(updatedVectors);
    setOracleApplied(true);
  };

  const canSetOracle =
    (lastRun?.waveform?.length ?? 0) > 0 &&
    authoredVectors.length > 0 &&
    onVectorsChange !== undefined;

  return (
    <IdeSurfaceLayout
      mode="verify"
      consoleHasBlocking={status === 'fail'}
      consoleHasEntries={false}
      dock={
        <section className="ide-verify-left-dock" data-testid="ide-verify-left-dock">
          <header className="ide-design-subheader">
            <h3>Signals</h3>
            <span className="ide-copy" data-testid="ide-verify-signal-filter-state">
              {showAllSignals
                ? `${signalTimeline.length} all`
                : `${visibleSignalTimeline.length} relevant`}
            </span>
          </header>
          {signalTimeline.length > relevantSignalTimeline.length ? (
            <div className="ide-inline-actions">
              <IdeButton
                tone="ghost"
                onClick={() => setShowAllSignals((previous) => !previous)}
                testId="ide-verify-show-all-signals"
              >
                {showAllSignals ? 'Show relevant signals' : 'Show all signals'}
              </IdeButton>
            </div>
          ) : null}
          <div className="ide-signal-list" data-testid="ide-verify-signal-list">
            {visibleSignalTimeline.length === 0 ? (
              <p className="ide-copy">
                {lastRun
                  ? 'No signal data in the last run — check circuit mapping.'
                  : 'Run verification to populate waveform lanes.'}
              </p>
            ) : (
              visibleSignalTimeline.map((signalRow) => (
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
          <header className="ide-design-subheader">
            <h3>Failures</h3>
            <span className="ide-copy">{failingRows.length}</span>
          </header>
          <div className="ide-signal-list" data-testid="ide-verify-failures-list">
            {failingRows.length === 0 ? (
              <p className="ide-copy">No failing rows in the latest run.</p>
            ) : (
              failingRows.slice(0, 8).map((row) => (
                <button
                  key={`${row.tick}-${row.signal}`}
                  type="button"
                  className={`ide-signal-row ${selectedFailureSignal === row.signal ? 'is-active' : ''}`}
                  onClick={() => {
                    setSelectedTick(row.tick);
                    setSelectedSignal(row.signal);
                    setSelectedFailureSignal(row.signal);
                  }}
                  data-testid={`ide-verify-failure-${toTestId(`${row.signal}-${row.tick}`)}`}
                >
                  <span>{row.signal}</span>
                  <span>t{row.tick}</span>
                </button>
              ))
            )}
          </div>
        </section>
      }
      inspector={
        <IdeInspectorAccordion defaultOpenId="vectors">
          <IdeInspectorSection title="Mismatch Detail" accordionId="mismatch-detail">
            {selectedFailureSignal ? (() => {
              const matchingFailure = failingRows.find((r) => r.signal === selectedFailureSignal);
              return (
                <div className="ide-kv-list">
                  <div className="ide-kv-row">
                    <span>Signal</span>
                    <code>{selectedFailureSignal}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Expected</span>
                    <code>{matchingFailure?.expected ?? '—'}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Actual</span>
                    <code>{matchingFailure?.actual ?? '—'}</code>
                  </div>
                  <div className="ide-kv-row">
                    <span>Tick</span>
                    <span>{matchingFailure?.tick ?? '—'}</span>
                  </div>
                  {matchingFailure && matchingFailure.expected !== matchingFailure.actual && (
                    <div className="ide-kv-row" data-testid="ide-verify-mismatch-hint">
                      <span>Hint</span>
                      <span style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
                        {matchingFailure.actual === '0' && matchingFailure.expected === '1'
                          ? `${matchingFailure.signal} reads 0 when 1 is expected — verify the driving node is connected and producing output.`
                          : matchingFailure.actual === '1' && matchingFailure.expected === '0'
                            ? `${matchingFailure.signal} reads 1 when 0 is expected — check for unintended connections or inverted logic.`
                            : `${matchingFailure.signal} has an unexpected value at tick ${String(matchingFailure.tick)} — verify input conditions.`}
                      </span>
                    </div>
                  )}
                  {onFixPath && matchingFailure && (
                    <div className="ide-inline-actions">
                      <IdeButton
                        tone="secondary"
                        onClick={() => onFixPath(matchingFailure)}
                        testId="ide-verify-mismatch-fix"
                      >
                        Fix in Design
                      </IdeButton>
                    </div>
                  )}
                </div>
              );
            })() : (
              <p className="ide-copy" style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
                Select a failing signal to see details.
              </p>
            )}
          </IdeInspectorSection>
          <IdeInspectorSection title="Vectors" accordionId="vectors">
            <p className="ide-copy">{vectorSourceLabel}</p>

            <p className="ide-verify-section-subheader">Create Test Case</p>
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
                  Add Case
                </IdeButton>
                <IdeButton
                  tone="secondary"
                  onClick={handleGenerateBasicVectors}
                  testId="ide-verify-generate-basic-vectors"
                >
                  Generate Basics
                </IdeButton>
                <IdeButton tone="ghost" onClick={onOpenProjectVectors}>
                  Open Project vectors
                </IdeButton>
              </div>
            </div>

            {selectedTick !== null && !showAllVectorTicks ? (
              <div className="ide-kv-list ide-verify-tick-snapshot" data-testid="ide-verify-vectors-tick-snapshot">
                {(() => {
                  const tickVec = authoredVectors.find((v) => v.tick === selectedTick);
                  return tickVec ? (
                    inputFields.map((field) => (
                      <div key={field.id} className="ide-kv-row">
                        <span>{field.label}</span>
                        <code>{String(tickVec.inputs[field.id] ?? '—')}</code>
                      </div>
                    ))
                  ) : (
                    <p className="ide-copy" style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
                      No vector at t{selectedTick}.
                    </p>
                  );
                })()}
                {authoredVectors.length > 0 && (
                  <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-1)' }}>
                    <IdeButton tone="ghost" onClick={() => setShowAllVectorTicks(true)} testId="ide-verify-vectors-show-all">
                      Show all {authoredVectors.length}
                    </IdeButton>
                  </div>
                )}
              </div>
            ) : (
              <>
                {selectedTick !== null && (
                  <div className="ide-inline-actions" style={{ marginBottom: 'var(--ide-space-1)' }}>
                    <IdeButton tone="ghost" onClick={() => setShowAllVectorTicks(false)} testId="ide-verify-vectors-tick-filter">
                      t{selectedTick} only
                    </IdeButton>
                  </div>
                )}
                <IdeDataTable
                  columns={['Tick', ...inputFields.map((field) => field.label)]}
                  rows={vectorRows}
                  testId="ide-verify-vectors-table"
                />
              </>
            )}
          </IdeInspectorSection>
        </IdeInspectorAccordion>
      }
      console={
        <section className="ide-verify-console" data-testid="ide-verify-console">
          <header className="ide-design-diagnostics-drawer-header">
            <h3>Activity</h3>
            <IdeStatusPill tone={displayTone} data-testid="ide-verify-console-status">
              {displayStatus}
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
                      report=<code>{lastRun?.reportHash ?? '—'}</code>
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
        className="ide-verify-panel"
        testId="ide-verify-panel"
      >
        {isShowcaseKit && kitGoals.length > 0 && (
          <div className="ide-verify-kit-tip" data-testid="ide-verify-kit-tip">
            <button
              type="button"
              className="ide-verify-kit-tip-toggle"
              onClick={() => setKitTipOpen((v) => !v)}
              data-testid="ide-verify-kit-tip-toggle"
            >
              <span className="ide-verify-kit-tip-icon" aria-hidden="true">ℹ</span>
              <span>Showcase Kit — why is this failing?</span>
              <span className="ide-verify-kit-tip-arrow" aria-hidden="true">{kitTipOpen ? '▲' : '▼'}</span>
            </button>
            {kitTipOpen && (
              <ul className="ide-verify-kit-tip-body" data-testid="ide-verify-kit-goals">
                {kitGoals.slice(0, 4).map((g) => (
                  <li key={g} className="ide-copy">{g}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* STOP-SHIP: Stale verify result banner.
            If the circuit changed since the last run, the result is outdated.
            The badge must never show PASS/FAIL for a circuit that has since changed. */}
        {isRunStale && (
          <div
            className="ide-verify-stale-banner ide-surface-panel"
            data-testid="ide-verify-stale-banner"
            role="alert"
          >
            <strong className="ide-verify-stale-banner-label">STALE</strong>
            <span>Circuit changed since last run. Re-run verification to get a current result.</span>
            <IdeButton tone="secondary" onClick={runVerification} testId="ide-verify-stale-rerun">
              Re-run now
            </IdeButton>
          </div>
        )}

        {/* Status strip — status-first, one primary CTA */}
        <div className="ide-verify-status-strip" data-testid="ide-verify-banner">
          <IdeStatusPill tone={displayTone} testId="ide-verify-summary-status">
            {displayStatus}
          </IdeStatusPill>
          {lastRun && (
            <>
              <span className="ide-verify-strip-sep" aria-hidden="true">·</span>
              <span className="ide-verify-strip-meta ide-verify-strip-pass" data-testid="ide-verify-strip-pass-count">
                {runRows.length - failingRows.length}/{runRows.length} passed
              </span>
              {failingRows.length > 0 && (
                <>
                  <span className="ide-verify-strip-sep" aria-hidden="true">·</span>
                  <span className="ide-verify-strip-meta ide-verify-strip-fail" data-testid="ide-verify-strip-fail-count">
                    {failingRows.length} fail
                    {typeof firstFailureTick === 'number' && (
                      <> at t{firstFailureTick}
                        {failingRows.slice(0, 2).length > 0 && (
                          <> ({failingRows.slice(0, 2).map((r) => r.signal).join(', ')}
                            {failingRows.length > 2 ? ` +${failingRows.length - 2} more` : ''}
                          )
                          </>
                        )}
                      </>
                    )}
                  </span>
                </>
              )}
            </>
          )}
          <div className="ide-verify-strip-actions">
            {/* Primary CTA varies by state */}
            {status === 'pass' && !isRunStale ? (
              <span data-testid="ide-primary-cta">
                <IdeButton tone="primary" onClick={onGoToHardware} testId="ide-verify-cta-continue">
                  Continue → Hardware
                </IdeButton>
              </span>
            ) : isRunStale ? (
              <span data-testid="ide-primary-cta">
                <IdeButton tone="primary" onClick={runVerification} disabled={runState === 'running'} testId="ide-verify-stale-primary-rerun">
                  Re-run Verification
                </IdeButton>
              </span>
            ) : failingRows.length > 0 ? (
              <span data-testid="ide-primary-cta">
                <IdeButton tone="primary" onClick={handleJumpToFirstFailure} testId="ide-verify-jump-first-failure">
                  Jump to fail
                </IdeButton>
              </span>
            ) : (
              <span data-testid="ide-primary-cta">
                <IdeButton
                  tone="primary"
                  onClick={runVerification}
                  disabled={runState === 'running'}
                  testId="ide-verify-run"
                  className={displayStatus === 'READY' ? 'is-pulsing' : undefined}
                >
                  Run
                </IdeButton>
              </span>
            )}
            {/* Secondary: Run when not already run-primary */}
            {(status === 'pass' || failingRows.length > 0) && (
              <IdeButton
                tone="secondary"
                onClick={runVerification}
                disabled={runState === 'running'}
                testId="ide-verify-run-secondary"
              >
                Run
              </IdeButton>
            )}
            <IdeButton tone="ghost" onClick={clearResults} testId="ide-verify-clear">Clear</IdeButton>
            {canSetOracle && (
              <span title="Updates your truth table expected values to match what the circuit currently produces. Use this once the circuit is behaving correctly.">
                <IdeButton
                  tone="ghost"
                  onClick={handleSetOracleExpected}
                  testId="ide-verify-set-oracle"
                >
                  Capture observed outputs as expected
                </IdeButton>
              </span>
            )}
          </div>
        </div>

        {displayStatus === 'FAIL' && (
          <SurfacePanel className="ide-verify-fail-summary" testId="ide-verify-fail-card">
            <span className="ide-verify-fail-summary__status">FAIL</span>
            <span className="ide-verify-fail-summary__count">
              {failingRows.length} of {runRows.length} vectors failing
            </span>
            {firstFailure && (
              <span className="ide-verify-fail-summary__first">
                First failure: <code>{firstFailure.signal}</code> at tick <code>{firstFailure.tick}</code>
              </span>
            )}
            {firstFailure && onFixPath && (
              <IdeButton
                tone="danger"
                onClick={() => { onFixPath(firstFailure); onGoToDesign?.(); }}
                testId="ide-verify-jump-to-failure-card"
              >
                Jump to failing node →
              </IdeButton>
            )}
          </SurfacePanel>
        )}

        {hasDff && (
          <IdeCallout tone="info" testId="ide-verify-clocked-banner">
            Clocked circuit: expected outputs are sampled AFTER the rising edge of each clock tick.
            Tick 0 = initial state (no clock pulse yet).
          </IdeCallout>
        )}

        {displayStatus === 'FAIL' && verifyHint && (
          <IdeCallout tone="warn" testId="ide-verify-hint-callout" className="ide-callout--hint">
            {verifyHint}
          </IdeCallout>
        )}

        {displayStatus === 'FAIL' && oracleApplied && (
          <IdeCallout tone="info" testId="ide-verify-oracle-applied-note">
            Expected values updated — re-run to confirm.
          </IdeCallout>
        )}

        {status === 'pass' && runState !== 'running' && runRows.length > 0 && (
          <SurfacePanel className="ide-verify-pass-hero" testId="ide-verify-pass-hero">
            <div className="ide-verify-pass-hero-body">
              <span className="ide-verify-pass-hero-icon" aria-hidden="true">✓</span>
              <div className="ide-verify-pass-hero-text">
                <strong className="ide-verify-pass-hero-title">Verification Passed</strong>
                <span className="ide-verify-pass-hero-meta">
                  {runRows.length} vector{runRows.length !== 1 ? 's' : ''} · {runRows.length - failingRows.length} pass · {failingRows.length} fail
                </span>
                {oracleApplied && (
                  <span className="ide-verify-oracle-badge" data-testid="ide-verify-oracle-badge">
                    Baseline locked from observed run
                  </span>
                )}
              </div>
              <div className="ide-verify-pass-hero-actions">
                <IdeButton tone="primary" onClick={onGoToHardware} testId="ide-verify-pass-hero-hardware">
                  Continue → Hardware
                </IdeButton>
                {onGoToDesign && (
                  <IdeButton tone="secondary" onClick={onGoToDesign} testId="ide-verify-pass-hero-design">
                    Back to Design
                  </IdeButton>
                )}
              </div>
            </div>
            <code className="ide-verify-pass-hero-hash" data-testid="ide-verify-pass-hero-hash">
              {lastRun?.reportHash?.slice(0, 16) ?? deterministicHash.slice(0, 16)}
            </code>
          </SurfacePanel>
        )}

        {isTraceOnly && canSetOracle && (
          <IdeCallout tone="info" title="Trace captured — no expectations set" testId="ide-verify-trace-oracle-callout">
            <p className="ide-copy">
              The simulation ran and produced {waveformTicks.length} tick{waveformTicks.length !== 1 ? 's' : ''} of waveform data,
              but no expected outputs were defined so nothing was verified.
            </p>
            <p className="ide-copy">
              Click <strong>Capture observed outputs as expected</strong> to lock in the current outputs as the expected values.
              Future runs will fail if the circuit produces different results — that is how Verify works.
            </p>
            <div className="ide-inline-actions">
              <IdeButton tone="primary" onClick={handleSetOracleExpected} testId="ide-verify-trace-oracle-btn">
                Capture observed outputs as expected
              </IdeButton>
              {authoredVectors.length === 0 && (
                <IdeButton tone="secondary" onClick={handleGenerateBasicVectors} testId="ide-verify-trace-generate-basics">
                  Generate Basics first
                </IdeButton>
              )}
            </div>
          </IdeCallout>
        )}

        {status === 'idle' && runState !== 'complete' ? (
          <div className="ide-empty-stack" data-testid="ide-verify-empty-state">
            <div className="ide-verify-empty-message" data-testid="ide-verify-empty-message">
              <span className="ide-verify-empty-label">No verification run yet</span>
              <span className="ide-verify-empty-hint">Add test vectors in the panel on the right, then click Run.</span>
            </div>
            {authoredVectors.length === 0 ? (
              <IdeCallout tone="info" title="No vectors yet">
                <p className="ide-copy">Generate a basic set to get started, then click Run.</p>
                <div className="ide-inline-actions">
                  <IdeButton
                    tone="primary"
                    onClick={handleGenerateBasicVectors}
                    testId="ide-verify-empty-generate-basics"
                  >
                    Generate Basics
                  </IdeButton>
                </div>
              </IdeCallout>
            ) : (
              <IdeCallout tone="info" title="Vectors loaded — ready to run">
                <p className="ide-copy">
                  {authoredVectors.length} vector{authoredVectors.length !== 1 ? 's' : ''} ready.
                  Click Run verification to produce deterministic waveform evidence.
                </p>
                <div className="ide-inline-actions">
                  <IdeButton
                    tone="primary"
                    onClick={runVerification}
                    testId="ide-verify-empty-run"
                  >
                    Run verification
                  </IdeButton>
                </div>
              </IdeCallout>
            )}
          </div>
        ) : (
          <div
            className="ide-verify-workbench ide-verify-workbench-v2"
            data-testid="ide-verify-workbench"
            data-trace-ticks={waveformTicks.length}
            data-trace-signals={signalTimeline.length}
          >
            <div className="ide-verify-console-frame">
            <div className="ide-verify-instrument-deck">
            <section className="ide-verify-oscilloscope-stage" data-testid="ide-verify-workspace-waveform">
              {/* ── Oscilloscope instrument header ── */}
              <div className="ide-verify-scope-header" data-testid="ide-verify-scope-header">
                <span className="ide-verify-scope-label">OSCILLOSCOPE</span>
                {selectedSignal && (
                  <span className="ide-verify-scope-signal-chip" data-testid="ide-verify-scope-signal">
                    {selectedSignal}
                  </span>
                )}
                <span className="ide-verify-scope-header-right">
                  {selectedTick !== null && (
                    <code className="ide-verify-scope-tick">t{selectedTick}</code>
                  )}
                  {failTicksSorted.length > 0 && currentFailIndex >= 0 && (
                    <span className="ide-verify-scope-fail-index">
                      fail {currentFailIndex + 1}/{failTicksSorted.length}
                    </span>
                  )}
                </span>
              </div>
              <div className="ide-verify-waveform-bar" data-testid="ide-verify-waveform-bar">
                {/* Left: Fail navigator */}
                <div className="ide-verify-wfbar-group ide-verify-wfbar-left" data-testid="ide-verify-fail-nav">
                  {failTicksSorted.length > 0 ? (
                    <>
                      <IdeButton tone="secondary" onClick={handleJumpToFirstFailure} testId="ide-verify-fail-nav-first">
                        First
                      </IdeButton>
                      <IdeButton tone="secondary" onClick={goToPrevFail} testId="ide-verify-fail-nav-prev">
                        ‹ Prev
                      </IdeButton>
                      <IdeButton tone="secondary" onClick={goToNextFail} testId="ide-verify-fail-nav-next">
                        Next ›
                      </IdeButton>
                      <span className="ide-verify-fail-nav-position ide-copy">
                        {currentFailIndex >= 0
                          ? `fail ${currentFailIndex + 1} / ${failTicksSorted.length}`
                          : `${failTicksSorted.length} fail tick${failTicksSorted.length !== 1 ? 's' : ''}`}
                      </span>
                    </>
                  ) : (
                    <span className="ide-copy ide-verify-wfbar-meta" data-testid="ide-verify-run-state">
                      {signalTimeline.length} signals · {timelineTicks.length} ticks · {runState.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Center: Zoom + Row density */}
                <div className="ide-verify-wfbar-group ide-verify-wfbar-center">
                  <span className="ide-verify-zoom-label ide-copy">Zoom</span>
                  {(['all', 'fail', 'window'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`ide-verify-zoom-btn ${tickZoom === mode ? 'is-active' : ''}`}
                      onClick={() => {
                        setTickZoom(mode);
                        if (mode === 'window') setTickWindowCenter(selectedTick);
                      }}
                      data-testid={`ide-verify-zoom-${mode}`}
                    >
                      {mode === 'all' ? 'Fit all' : mode === 'fail' ? 'Fit fail' : '±10'}
                    </button>
                  ))}
                  <span className="ide-verify-zoom-label ide-copy" style={{ marginLeft: 'var(--ide-space-2)' }}>Rows</span>
                  {(['small', 'normal', 'large'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`ide-verify-zoom-btn ${waveformDensity === d ? 'is-active' : ''}`}
                      onClick={() => setWaveformDensity(d)}
                      data-testid={`ide-verify-density-${d}`}
                    >
                      {d === 'small' ? 'S' : d === 'normal' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>

                {/* Right: Tick scrubber */}
                <div className="ide-verify-wfbar-group ide-verify-wfbar-right">
                  {timelineTicks.length > 0 && selectedTick !== null ? (
                    <label className="ide-verify-scrubber-field" data-testid="ide-verify-tick-nav">
                      <input
                        type="range"
                        min={timelineTicks[0]}
                        max={timelineTicks[timelineTicks.length - 1]}
                        step={1}
                        value={selectedTick}
                        onChange={(event) => setSelectedTick(Number(event.target.value))}
                        data-testid="ide-verify-tick-scrubber"
                      />
                      <code data-testid="ide-verify-selected-tick" style={{ minWidth: 24 }}>t{selectedTick}</code>
                    </label>
                  ) : null}
                </div>
              </div>

              {/* No-trace diagnostic — shown when run produced no waveform data */}
              {hasNoTrace && (
                <IdeCallout tone="error" title="No trace generated" testId="ide-verify-no-trace-guard">
                  <p className="ide-copy">The run completed but produced no waveform data.</p>
                  <ul className="ide-list">
                    <li>Circuit has no outputs mapped to IO signals — check I/O mapping in Design</li>
                    <li>No clock activity — simulation may not have advanced past tick 0</li>
                    <li>Circuit has unconnected gates — verify all nodes are wired</li>
                  </ul>
                  <div className="ide-inline-actions">
                    <IdeButton
                      tone="primary"
                      onClick={() => onFixPath?.({ signal: '', tick: 0, expected: '', actual: '' })}
                      disabled={!onFixPath}
                      testId="ide-verify-no-trace-fix"
                    >
                      Fix in Design
                    </IdeButton>
                  </div>
                </IdeCallout>
              )}

              <div
                className="ide-waveform-outer"
                data-testid="ide-verify-waveform-preview"
                data-verify-trace-only={isTraceOnly ? '1' : '0'}
                style={{ margin: '0 var(--ide-space-1) var(--ide-space-1)' }}
              >
                {/* Student onboarding: tick explanation */}
                <details className="ide-verify-tick-explainer" data-testid="ide-verify-tick-explainer">
                  <summary className="ide-verify-tick-explainer-summary">
                    What is a tick?
                  </summary>
                  <p className="ide-copy ide-verify-tick-explainer-copy">
                    A <strong>tick</strong> is one simulation step. For combinational logic, one tick
                    settles all outputs. For sequential logic (flip-flops), each clock edge is one tick.
                    Expected values are checked at the end of each tick — a mismatch means the circuit
                    produced a different value than specified.
                  </p>
                </details>
                {/* Legend */}
                {visibleSignalTimeline.length > 0 && (
                  <div className="ide-verify-waveform-legend" data-testid="ide-verify-waveform-legend">
                    <span className="ide-verify-legend-item ide-verify-legend-pass">PASS</span>
                    <span className="ide-verify-legend-item ide-verify-legend-fail">FAIL</span>
                    <span className="ide-verify-legend-item ide-verify-legend-select">SELECTED</span>
                    <span className="ide-copy ide-verify-waveform-legend-meta">
                      {zoomedTicks.length}/{allWaveformTicks.length} ticks shown
                    </span>
                  </div>
                )}
                <WaveformViewer
                  signals={visibleSignalTimeline}
                  ticks={zoomedTicks}
                  failTicks={new Set(failingRows.map((row) => row.tick))}
                  failingSignalKeys={failingSignalKeys}
                  selectedTick={selectedTick}
                  onSelectTick={setSelectedTick}
                  onSelectSignal={setSelectedSignal}
                  rowHeight={ROW_H_MAP[waveformDensity]}
                  emptyMessage={
                    lastRun
                      ? 'No waveform data in this run — check I/O mapping in Design'
                      : 'Run verification to see waveforms'
                  }
                />
              </div>
            </section>

            <TruthTablePane
              mode={truthTableMode}
              rows={truthRows}
              selectedTick={selectedTick}
              onSelectTick={setSelectedTick}
              onModeChange={setTruthTableMode}
              onFixPath={onFixPath ? (row) => onFixPath({ signal: row.signal, tick: row.tick, expected: row.expected, actual: row.actual }) : undefined}
            />
            </div>{/* /ide-verify-instrument-deck */}
            </div>{/* /ide-verify-console-frame */}

            <div className={`ide-verify-supporting-strip ${drawerOpen ? 'is-open' : ''}`}>
            {/* Drawer toggle header */}
            <button
              type="button"
              className="ide-verify-drawer-toggle"
              onClick={() => setDrawerOpen((prev) => !prev)}
              data-testid="ide-verify-drawer-toggle"
              aria-expanded={drawerOpen}
            >
              <span className="ide-verify-drawer-summary">
                {failingRows.length > 0 && (
                  <span className="ide-verify-drawer-badge">{failingRows.length} fail</span>
                )}
                {!drawerOpen && firstFailure && (
                  <span className="ide-verify-drawer-hint">
                    t{firstFailure.tick} · {firstFailure.signal} · exp <code>{firstFailure.expected}</code> act <code>{firstFailure.actual}</code>
                  </span>
                )}
                <span className="ide-verify-drawer-tabs">
                  {(['mismatches', 'vectors', 'details'] as const).map((tab) => (
                    <span
                      key={tab}
                      className={`ide-verify-drawer-tab ${verifyTab === tab ? 'is-active' : ''}`}
                      onClick={(event) => { event.stopPropagation(); setVerifyTab(tab); setDrawerOpen(true); }}
                    >
                      {tab === 'mismatches' ? 'Mismatches' : tab === 'vectors' ? 'Vectors' : 'Details'}
                    </span>
                  ))}
                </span>
              </span>
              <span className="ide-verify-drawer-chevron" aria-hidden="true">
                {drawerOpen ? '▾' : '▸'}
              </span>
            </button>

            {/* Drawer body — only rendered when open */}
            {drawerOpen && (
            <>
            <div className="ide-verify-drawer-body">
              <div className="ide-verify-tab-bar" data-testid="ide-verify-tab-bar">
              <button
                type="button"
                className={`ide-verify-tab-btn ${verifyTab === 'mismatches' ? 'is-active' : ''}`}
                onClick={() => setVerifyTab('mismatches')}
              >
                Mismatches
                {failingRows.length > 0 && (
                  <span className="ide-verify-tab-badge">{failingRows.length}</span>
                )}
              </button>
              <button
                type="button"
                className={`ide-verify-tab-btn ${verifyTab === 'vectors' ? 'is-active' : ''}`}
                onClick={() => setVerifyTab('vectors')}
              >
                Vectors ({authoredVectors.length})
              </button>
              <button
                type="button"
                className={`ide-verify-tab-btn ${verifyTab === 'details' ? 'is-active' : ''}`}
                onClick={() => setVerifyTab('details')}
              >
                Details
              </button>
            </div>

            {/* Tab panels */}
            <div className="ide-verify-tab-panel">
              {verifyTab === 'mismatches' && (
                <section className="ide-verify-mismatch-panel" data-testid="ide-verify-mismatch-table">
                  {failingRows.length === 0 ? (
                    <IdeCallout tone="success" title="No mismatches in current run">
                      PASS evidence is ready for export.
                    </IdeCallout>
                  ) : (
                    <table className="ide-verify-mismatch-list" data-testid="ide-verify-mismatch-list">
                      <thead>
                        <tr>
                          <th>Tick</th>
                          <th>Signal</th>
                          <th>Expected</th>
                          <th>Actual</th>
                          {onFixPath && <th />}
                        </tr>
                      </thead>
                      <tbody>
                        {failingRows.map((row) => (
                          <tr key={`${row.tick}-${row.signal}`} className="ide-verify-mismatch-row">
                            <td className="ide-verify-mismatch-tick">
                              <button
                                type="button"
                                className="ide-verify-mismatch-tick-btn"
                                onClick={() => setSelectedTick(row.tick)}
                              >
                                t{row.tick}
                              </button>
                            </td>
                            <td><code className="ide-verify-mismatch-signal">{row.signal}</code></td>
                            <td><code className="ide-verify-mismatch-expected">{row.expected}</code></td>
                            <td><code className="ide-verify-mismatch-actual--fail">{row.actual}</code></td>
                            {onFixPath && (
                              <td>
                                <button
                                  type="button"
                                  className="ide-verify-mismatch-fix-btn"
                                  onClick={() => { onFixPath({ signal: row.signal, tick: row.tick, expected: row.expected, actual: row.actual }); onGoToDesign?.(); }}
                                  title={`Fix ${row.signal} in Design`}
                                >
                                  Fix →
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}

              {verifyTab === 'vectors' && (
                <>
                  <IdeDataTable
                    columns={['Tick', ...inputFields.map((field) => field.label)]}
                    rows={vectorRows}
                    testId="ide-verify-vectors-table"
                  />
                  <IdeDataTable
                    columns={['Tick', 'Signal', 'Expected', 'Actual', 'Status']}
                    rows={resultRows}
                    testId="ide-verify-results-table"
                  />
                </>
              )}

              {verifyTab === 'details' && (
                <>
                  {/* Advanced run actions */}
                  <div className="ide-verify-details-actions" data-testid="ide-verify-details-actions">
                    {authoredVectors.length > 0 && onRunVerification && (
                      <IdeButton
                        tone="secondary"
                        onClick={runDeterministicVerification}
                        disabled={runState === 'running'}
                        testId="ide-verify-run-deterministic"
                        title="Always simulates from the circuit, ignoring the interactive runtime trace. Use for reproducible results."
                      >
                        Run Deterministic
                      </IdeButton>
                    )}
                  </div>
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

                  <div className="ide-verify-hash-block">
                    <span>Hash</span>
                    <code data-testid="ide-verify-hash">{lastRun?.deterministicHash ?? deterministicHash}</code>
                    <span>Report</span>
                    <code data-testid="ide-verify-report-hash">{lastRun?.reportHash ?? '—'}</code>
                    <span>Schedule</span>
                    <code data-testid="ide-verify-schedule">{lastRun?.schedule ?? '—'}</code>
                  </div>
                </>
              )}
            </div>
            </div>
            </>
            )}
            </div>
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
