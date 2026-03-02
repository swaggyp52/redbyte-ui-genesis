import React, { useCallback, useMemo, useState } from 'react';
import type { ProjectHealth } from '../projectHealth';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';
import { SurfacePanel } from '../components/SurfaceLayoutPrimitives';
import type { RuntimeSimState } from '../projectRuntime';
import { useIoBus } from '../ioBus';
import { HardwareBoard2D } from '../components/HardwareBoard2D';
import { useBoardSignal } from '../BoardSignalContext';

export interface HardwareMappingRow {
  id: string;
  nodeId?: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
}

export interface HardwareSurfaceProps {
  projectName: string;
  expectedBehavior: string;
  mappingRows: HardwareMappingRow[];
  expectedIoRows: Array<{
    signal: string;
    tick: number;
    expected: string;
  }>;
  vectorsCount: number;
  health: ProjectHealth;
  runtimeSim?: RuntimeSimState;
  onSimSetInput?: (nodeId: string, v: 0 | 1) => void;
  onGenerateBringUpVectors: () => void;
  onOpenExport: () => void;
  onOpenVerify: () => void;
  onGoToDesign?: () => void;
}

const HARDWARE_EMPTY_SIM: RuntimeSimState = {
  tick: 0, running: false, speedHz: 1, irHash: '', traceHash: '',
  inputs: {}, signals: {}, trace: [], selectedSignalKey: null, probes: [],
};

interface AssertionEntry {
  tick: number;
  signal: string;
  expected: string;
  actual: string | null; // null = no trace data for this tick
  pass: boolean;
  hasData: boolean;
}

type HwMode = 'live' | 'bringup' | 'proof';

export const HardwareSurface: React.FC<HardwareSurfaceProps> = ({
  projectName,
  expectedBehavior,
  mappingRows,
  expectedIoRows,
  vectorsCount,
  health,
  runtimeSim,
  onSimSetInput,
  onGenerateBringUpVectors,
  onOpenExport,
  onOpenVerify,
  onGoToDesign,
}) => {
  const { activeBoardSignal, setActiveBoardSignal } = useBoardSignal();
  const [hwMode, setHwMode] = useState<HwMode>('live');
  const [bringupStepIndex, setBringupStepIndex] = useState(0);
  const sim = runtimeSim ?? HARDWARE_EMPTY_SIM;

  const hasClockMapping = useMemo(
    () =>
      mappingRows.some(
        (row) =>
          row.direction === 'in' &&
          /(^clk$|clock|clk100mhz)/i.test(row.label) &&
          row.pin.trim().length > 0
      ),
    [mappingRows]
  );
  const hasOutputMapping = useMemo(
    () => mappingRows.some((row) => row.direction === 'out' && row.pin.trim().length > 0),
    [mappingRows]
  );

  const ioBusIoRows = useMemo(
    () =>
      mappingRows
        .filter((r): r is HardwareMappingRow & { nodeId: string } => Boolean(r.nodeId))
        .map((r) => ({ nodeId: r.nodeId, label: r.label, direction: r.direction })),
    [mappingRows]
  );
  const ioBus = useIoBus({
    ioRows: ioBusIoRows,
    runtimeSim: sim,
    setInput: onSimSetInput ?? (() => {}),
  });
  const mappedSw = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ioBus.meta.swNodeIds[i] != null),
    [ioBus.meta.swNodeIds]
  );
  const mappedLd = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ioBus.meta.ldNodeIds[i] != null),
    [ioBus.meta.ldNodeIds]
  );

  const hasBlocking = health.blockingIssues.length > 0;

  // ── Verify status for callout ────────────────────────────────────────
  const verifyStatus = health.lastVerify?.status
    ? String(health.lastVerify.status).toUpperCase()
    : undefined;

  // ── Bring-Up: group expectedIoRows by tick ──────────────────────────
  const bringupTickGroups = useMemo(() => {
    const map = new Map<number, Array<{ signal: string; expected: string }>>();
    for (const row of expectedIoRows) {
      const bucket = map.get(row.tick) ?? [];
      bucket.push({ signal: row.signal, expected: row.expected });
      map.set(row.tick, bucket);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [expectedIoRows]);

  // ── Bring-Up: compare current step expected vs actual LD values ─────
  const mismatchedLd = useMemo<boolean[]>(() => {
    if (hwMode !== 'bringup' || bringupTickGroups.length === 0)
      return Array(16).fill(false);
    const currentGroup = bringupTickGroups[bringupStepIndex];
    if (!currentGroup) return Array(16).fill(false);
    const [, signals] = currentGroup;
    return Array.from({ length: 16 }, (_, i) => {
      const sig = signals.find(
        (s) =>
          s.signal.toLowerCase() === `ld${i}` ||
          s.signal.toLowerCase() === `ld[${i}]`
      );
      if (!sig) return false;
      return sig.expected !== String(ioBus.state.ld[i]);
    });
  }, [hwMode, bringupTickGroups, bringupStepIndex, ioBus.state.ld]);

  const bringupStepPass = useMemo(
    () => mismatchedLd.every((v) => !v),
    [mismatchedLd]
  );

  // ── Bring-Up inspector: actual vs expected rows ─────────────────────
  const bringupStepRows = useMemo(() => {
    const group = bringupTickGroups[bringupStepIndex];
    if (!group) return [];
    const [, signals] = group;
    return signals.map((s) => {
      const ldMatch = s.signal.match(/ld\[?(\d+)\]?/i);
      const actual = ldMatch ? String(ioBus.state.ld[Number(ldMatch[1])] ?? '—') : '—';
      const pass = actual === s.expected;
      return [
        <code key={s.signal}>{s.signal}</code>,
        s.expected,
        actual,
        <IdeStatusPill key={`${s.signal}-pill`} tone={pass ? 'ok' : 'error'}>
          {pass ? 'OK' : 'FAIL'}
        </IdeStatusPill>,
      ];
    });
  }, [bringupTickGroups, bringupStepIndex, ioBus.state.ld]);

  // ── Live: signal event log from sim trace ───────────────────────────
  const nodeKeyToMeta = useMemo(() => {
    const m = new Map<string, { label: string; direction: 'in' | 'out' }>();
    for (const r of ioBusIoRows) {
      const meta = { label: r.label, direction: r.direction };
      m.set(r.nodeId, meta);
      m.set(`${r.nodeId}.out`, meta);
      m.set(`${r.nodeId}.in`, meta);
    }
    return m;
  }, [ioBusIoRows]);

  interface SignalChangeEvent {
    tick: number;
    label: string;
    from: 0 | 1;
    to: 0 | 1;
    direction: 'in' | 'out';
  }

  const signalChangeFeed = useMemo<SignalChangeEvent[]>(() => {
    if (!sim.trace?.length) return [];
    const events: SignalChangeEvent[] = [];
    let prev: Record<string, 0 | 1> = {};
    for (const sample of sim.trace) {
      for (const [k, v] of Object.entries(sample.signals)) {
        const meta = nodeKeyToMeta.get(k);
        if (!meta) continue;
        const was = prev[k];
        if (was !== undefined && was !== v) {
          events.push({ tick: sample.tick, label: meta.label, from: was, to: v as 0 | 1, direction: meta.direction });
        }
      }
      Object.assign(prev, sample.signals);
    }
    return events.slice(-30).reverse();
  }, [sim.trace, nodeKeyToMeta]);

  // ── Assertions: trace × expected vectors ────────────────────────────
  const traceByTick = useMemo(() => {
    const map = new Map<number, Record<string, 0 | 1>>();
    for (const sample of sim.trace ?? []) {
      map.set(sample.tick, sample.signals);
    }
    return map;
  }, [sim.trace]);

  const hardwareAssertions = useMemo<AssertionEntry[]>(() => {
    return expectedIoRows.map((row) => {
      const ldMatch = row.signal.match(/ld\[?(\d+)\]?/i);
      if (!ldMatch) {
        return { tick: row.tick, signal: row.signal, expected: row.expected, actual: null, pass: false, hasData: false };
      }
      const ldIdx = Number(ldMatch[1]);
      const nodeId = ioBus.meta.ldNodeIds[ldIdx];
      if (!nodeId) {
        return { tick: row.tick, signal: row.signal, expected: row.expected, actual: null, pass: false, hasData: false };
      }
      const signals = traceByTick.get(row.tick);
      if (!signals) {
        return { tick: row.tick, signal: row.signal, expected: row.expected, actual: null, pass: false, hasData: false };
      }
      const rawVal = signals[nodeId] ?? signals[`${nodeId}.out`] ?? signals[`${nodeId}.in`];
      if (rawVal === undefined) {
        return { tick: row.tick, signal: row.signal, expected: row.expected, actual: null, pass: false, hasData: false };
      }
      const actual = String(rawVal);
      return { tick: row.tick, signal: row.signal, expected: row.expected, actual, pass: actual === row.expected, hasData: true };
    });
  }, [expectedIoRows, ioBus.meta.ldNodeIds, traceByTick]);

  const assertionsWithData = useMemo(() => hardwareAssertions.filter((a) => a.hasData), [hardwareAssertions]);
  const assertionFailCount = useMemo(() => assertionsWithData.filter((a) => !a.pass).length, [assertionsWithData]);
  const assertionPassCount = useMemo(() => assertionsWithData.filter((a) => a.pass).length, [assertionsWithData]);
  const hasAssertionData = assertionsWithData.length > 0;

  // ── Confidence score ─────────────────────────────────────────────────
  const confidenceChecks = useMemo(() => [
    { label: 'Clock mapped',        pass: hasClockMapping },
    { label: 'Outputs mapped',      pass: hasOutputMapping },
    { label: 'Vectors generated',   pass: vectorsCount > 0 },
    { label: 'All assertions pass', pass: hasAssertionData && assertionFailCount === 0 },
    { label: 'Verify passed',       pass: health.lastVerify?.status === 'pass' },
  ], [hasClockMapping, hasOutputMapping, vectorsCount, hasAssertionData, assertionFailCount, health.lastVerify?.status]);

  const confidenceScore = useMemo(
    () => Math.round((confidenceChecks.filter((c) => c.pass).length / confidenceChecks.length) * 100),
    [confidenceChecks]
  );

  // ── Dock: Bring-Up step table (expected only, compact) ──────────────
  const bringupDockRows = useMemo(() => {
    const group = bringupTickGroups[bringupStepIndex];
    if (!group) return [];
    const [, signals] = group;
    return signals.map((s) => [
      <code key={s.signal}>{s.signal}</code>,
      s.expected,
    ]);
  }, [bringupTickGroups, bringupStepIndex]);

  // ── Bring-Up: board highlights for current step ──────────────────────
  const currentStepHighlights = useMemo(() => {
    if (hwMode !== 'bringup' || bringupTickGroups.length === 0) {
      return { sw: [] as number[], ld: [] as number[] };
    }
    const [, signals] = bringupTickGroups[bringupStepIndex] ?? [null, []];
    const sw: number[] = [];
    const ld: number[] = [];
    for (const s of (signals ?? [])) {
      const swM = s.signal.match(/sw\[?(\d+)\]?/i);
      if (swM) sw.push(Number(swM[1]));
      const ldM = s.signal.match(/ld\[?(\d+)\]?/i);
      if (ldM) ld.push(Number(ldM[1]));
    }
    return { sw, ld };
  }, [hwMode, bringupTickGroups, bringupStepIndex]);

  const currentTick = bringupTickGroups[bringupStepIndex]?.[0];

  // ── Dock nodes ──────────────────────────────────────────────────────
  const liveDock = (
    <SurfacePanel className="ide-workbench-placeholder" testId="ide-hw-live-dock">
      <header className="ide-workbench-placeholder-header">
        <h3>Live Monitor</h3>
        <IdeStatusPill tone={sim.running ? 'ok' : 'warn'}>
          {sim.running ? 'Board ready' : 'No board detected'}
        </IdeStatusPill>
      </header>
      <div className="ide-kv-list">
        <div className="ide-kv-row">
          <span>Sim tick</span>
          <code>{sim.tick}</code>
        </div>
        <div className="ide-kv-row">
          <span>Mapped I/O</span>
          <span>{ioBusIoRows.length}</span>
        </div>
        <div className="ide-kv-row">
          <span>Clock</span>
          <IdeStatusPill tone={hasClockMapping ? 'ok' : 'warn'}>
            {hasClockMapping ? 'Mapped' : 'Missing'}
          </IdeStatusPill>
        </div>
        <div className="ide-kv-row">
          <span>Outputs</span>
          <IdeStatusPill tone={hasOutputMapping ? 'ok' : 'warn'}>
            {hasOutputMapping ? 'Mapped' : 'Missing'}
          </IdeStatusPill>
        </div>
        <div className="ide-kv-row">
          <span>Vectors</span>
          <span>{vectorsCount}</span>
        </div>
      </div>
      <div className="ide-inline-actions">
        <IdeButton tone="secondary" onClick={onOpenVerify}>Run Verify</IdeButton>
        <IdeButton tone="ghost" onClick={onGenerateBringUpVectors}>Gen Vectors</IdeButton>
      </div>
      {onGoToDesign && (
        <div className="ide-hw-live-design-link">
          <IdeButton tone="ghost" onClick={onGoToDesign} testId="ide-hardware-go-design">
            Open in Design
          </IdeButton>
        </div>
      )}
    </SurfacePanel>
  );

  const bringupDock = (
    <SurfacePanel className="ide-workbench-placeholder" testId="ide-hw-bringup-dock">
      <header className="ide-workbench-placeholder-header">
        <h3>Bring-Up</h3>
        <IdeStatusPill
          tone={
            bringupTickGroups.length === 0
              ? 'warn'
              : bringupStepPass
                ? 'ok'
                : 'error'
          }
        >
          {bringupTickGroups.length === 0 ? 'No vectors' : bringupStepPass ? 'PASS' : 'FAIL'}
        </IdeStatusPill>
      </header>
      {hasAssertionData && (
        <div className="ide-hw-assert-summary" data-testid="ide-hw-assert-summary">
          <span className={assertionFailCount > 0 ? 'ide-hw-assert-fail-count' : 'ide-hw-assert-pass-count'}>
            {assertionFailCount > 0
              ? `${assertionFailCount} ASSERTION${assertionFailCount > 1 ? 'S' : ''} FAILED`
              : `${assertionPassCount} assertions passed`}
          </span>
        </div>
      )}
      {bringupTickGroups.length === 0 ? (
        <IdeCallout tone="info" title="No bring-up vectors">
          <p className="ide-copy">Generate vectors first, then run the simulation.</p>
          <div className="ide-inline-actions">
            <IdeButton tone="primary" onClick={onGenerateBringUpVectors}
              testId="ide-hw-bringup-generate">
              Generate
            </IdeButton>
            <IdeButton tone="ghost" onClick={onOpenVerify}>Run Verify</IdeButton>
          </div>
        </IdeCallout>
      ) : (
        <div className="ide-hw-bringup-step" data-testid="ide-hw-bringup-step">
          <div className="ide-hw-step-header">
            <span className="ide-hw-step-counter">
              Step {bringupStepIndex + 1} of {bringupTickGroups.length}
            </span>
            {currentTick !== undefined && (
              <code className="ide-hw-step-tick">t{currentTick}</code>
            )}
          </div>
          {(() => {
            const swSignals = (bringupTickGroups[bringupStepIndex]?.[1] ?? []).filter(s => /sw/i.test(s.signal));
            if (swSignals.length === 0) return null;
            return (
              <p className="ide-hw-step-instruction" data-testid="ide-hw-step-instruction">
                Set {swSignals.map(s => `${s.signal.toUpperCase()}=${s.expected}`).join(', ')}
              </p>
            );
          })()}
          <IdeDataTable
            columns={['Signal', 'Expected']}
            rows={bringupDockRows}
            testId="ide-hw-bringup-step-table"
          />
          <div className="ide-hw-step-nav">
            <IdeButton
              tone="ghost"
              onClick={() => setBringupStepIndex(Math.max(0, bringupStepIndex - 1))}
              disabled={bringupStepIndex === 0}
              testId="ide-hw-bringup-prev"
            >
              ← Prev
            </IdeButton>
            <IdeButton
              tone="ghost"
              onClick={() =>
                setBringupStepIndex(
                  Math.min(bringupTickGroups.length - 1, bringupStepIndex + 1)
                )
              }
              disabled={bringupStepIndex === bringupTickGroups.length - 1}
              testId="ide-hw-bringup-next"
            >
              Next →
            </IdeButton>
          </div>
        </div>
      )}
    </SurfacePanel>
  );

  const proofDock = (
    <SurfacePanel className="ide-workbench-placeholder" testId="ide-hw-proof-dock">
      <header className="ide-workbench-placeholder-header">
        <h3>Proof Bundle</h3>
        <IdeStatusPill tone={confidenceScore === 100 ? 'ok' : confidenceScore >= 60 ? 'warn' : 'error'}>
          {confidenceScore}%
        </IdeStatusPill>
      </header>
      <div className="ide-hw-confidence-list" data-testid="ide-hw-confidence-list">
        {confidenceChecks.map((check) => (
          <div key={check.label} className={`ide-hw-confidence-row ${check.pass ? 'is-pass' : 'is-pending'}`}>
            <span className="ide-hw-confidence-icon">{check.pass ? '✓' : '○'}</span>
            <span className="ide-hw-confidence-label">{check.label}</span>
          </div>
        ))}
      </div>
      <div className="ide-hw-cert-slab" data-testid="ide-hw-cert-slab">
        <div className="ide-hw-cert-row">
          <span className="ide-hw-cert-key">VERIFY</span>
          <code className="ide-hw-cert-val">{health.lastVerify?.hash?.slice(0, 16) ?? '—'}</code>
        </div>
        <div className="ide-hw-cert-row">
          <span className="ide-hw-cert-key">EXPORT</span>
          <code className="ide-hw-cert-val">{health.lastExport?.hash?.slice(0, 16) ?? '—'}</code>
        </div>
        <div className="ide-hw-cert-row">
          <span className="ide-hw-cert-key">ASSERT</span>
          <code className="ide-hw-cert-val">{hasAssertionData ? `${assertionPassCount}P ${assertionFailCount}F` : '—'}</code>
        </div>
        <div className="ide-hw-cert-row">
          <span className="ide-hw-cert-key">DIRTY</span>
          <code className="ide-hw-cert-val">{health.dirtySinceVerify ? 'YES' : 'NO'}</code>
        </div>
      </div>
      <div className="ide-inline-actions">
        {health.lastVerify?.status === 'pass' ? (
          <IdeButton tone="primary" onClick={onOpenExport} testId="ide-hardware-build-export">
            Build + Export
          </IdeButton>
        ) : (
          <IdeButton tone="primary" onClick={onOpenVerify} testId="ide-hardware-run-verify">
            Run Verify First
          </IdeButton>
        )}
      </div>
    </SurfacePanel>
  );

  const activeDock =
    hwMode === 'live' ? liveDock : hwMode === 'bringup' ? bringupDock : proofDock;

  // ── Inspector nodes ─────────────────────────────────────────────────
  const liveInspector = (
    <IdeInspectorSection title="Signal Log" defaultOpen>
      {signalChangeFeed.length === 0 ? (
        <p className="ide-copy" data-testid="ide-hw-signal-log-empty">
          No trace data.
        </p>
      ) : (
        <div className="ide-hw-event-log" data-testid="ide-hw-signal-log">
          {signalChangeFeed.map((ev, i) => (
            <div key={i} className="ide-hw-event-row">
              <code className="ide-hw-event-tick">t{ev.tick}</code>
              <span className={`ide-hw-event-dir ${ev.direction === 'in' ? 'is-input' : 'is-output'}`}>
                {ev.direction === 'in' ? '▶' : '◀'}
              </span>
              <code className="ide-hw-event-label">{ev.label}</code>
              <span className="ide-hw-event-change">{ev.from}→{ev.to}</span>
            </div>
          ))}
        </div>
      )}
    </IdeInspectorSection>
  );

  const bringupInspector = (
    <>
      <IdeInspectorSection title="Step Result" defaultOpen>
        {bringupStepRows.length === 0 ? (
          <p className="ide-copy">No signals.</p>
        ) : (
          <IdeDataTable
            columns={['Signal', 'Exp', 'Act', 'Status']}
            rows={bringupStepRows}
            testId="ide-hw-bringup-result-table"
          />
        )}
      </IdeInspectorSection>
      <IdeInspectorSection title="Assertion Log" defaultOpen>
        {!hasAssertionData ? null : (
          <div className="ide-hw-assert-log" data-testid="ide-hw-assert-log">
            {hardwareAssertions.slice(0, 30).map((a, i) => (
              <div key={i} className="ide-hw-assert-formal-row">
                <code
                  className={`ide-hw-assert-formal ${a.hasData ? (a.pass ? 'is-pass' : 'is-fail') : 'is-nodata'}`}
                  data-testid={`ide-hw-assert-row-${a.tick}-${a.signal}`}
                >
                  {`ASSERT t${a.tick} ${a.signal}=${a.expected} \u2192 ${
                    !a.hasData ? 'NO_DATA' : a.pass ? 'PASS' : `FAIL(act=${a.actual})`
                  }`}
                </code>
              </div>
            ))}
            {hardwareAssertions.length > 30 && (
              <code className="ide-hw-assert-formal is-nodata">
                ... +{hardwareAssertions.length - 30} assertions
              </code>
            )}
          </div>
        )}
      </IdeInspectorSection>
    </>
  );

  const proofInspector = (
    <>
      <IdeInspectorSection title="Assertion Summary" defaultOpen>
        {!hasAssertionData ? (
          <p className="ide-copy">Awaiting trace.</p>
        ) : assertionFailCount === 0 ? (
          <code
            className="ide-hw-assert-formal ide-hw-proof-assert-ok is-pass"
            data-testid="ide-hw-proof-assert-ok"
          >
            {'\u22A2'} {assertionPassCount} assertions VALID{confidenceScore === 100 ? ' \u220E' : ''}
          </code>
        ) : (
          <div data-testid="ide-hw-proof-assert-failures">
            <p className="ide-copy ide-hw-proof-assert-fail-note">
              {assertionFailCount} assertion{assertionFailCount > 1 ? 's' : ''} failed
            </p>
            <IdeDataTable
              columns={['Tick', 'Signal', 'Exp', 'Act']}
              rows={hardwareAssertions
                .filter((a) => !a.pass && a.hasData)
                .slice(0, 10)
                .map((a) => [
                  <code key={`t${a.tick}`}>t{a.tick}</code>,
                  <code key={a.signal}>{a.signal}</code>,
                  a.expected,
                  a.actual ?? '—',
                ])}
              testId="ide-hw-proof-fail-table"
            />
          </div>
        )}
      </IdeInspectorSection>
      <IdeInspectorSection title="Expected Behavior" defaultOpen={false}>
        <p className="ide-copy" data-testid="ide-hardware-expected-behavior">
          {expectedBehavior}
        </p>
      </IdeInspectorSection>
    </>
  );

  const activeInspector =
    hwMode === 'live'
      ? liveInspector
      : hwMode === 'bringup'
        ? bringupInspector
        : proofInspector;

  return (
    <IdeSurfaceLayout
      mode="hardware"
      consoleHasBlocking={hasBlocking}
      consoleHasEntries={hasBlocking}
      dock={activeDock}
      inspector={activeInspector}
      console={
        <section className="ide-workbench-console-content" data-testid="ide-hardware-console">
          <header className="ide-workbench-console-header">
            <h3>Hardware Console</h3>
            <span className="ide-workbench-console-mode">Hardware</span>
          </header>
          {hasBlocking ? (
            <IdeCallout tone="warn" title="Bring-up blocked">
              {health.blockingIssues[0]?.message ?? 'Resolve blockers before building hardware bundle.'}
            </IdeCallout>
          ) : (
            <IdeCallout tone="success" title="Bring-up ready">
              Ready to export.
            </IdeCallout>
          )}
        </section>
      }
    >
      <IdePanel
        title="Hardware"
        description="Basys3 hardware proof."
        right={
          <IdeStatusPill tone={hasBlocking ? 'warn' : 'ok'}>
            {hasBlocking ? 'Needs Action' : 'Ready'}
          </IdeStatusPill>
        }
        testId="ide-hardware-panel"
      >
        {/* ── Connection callout strip ── */}
        <div className="ide-hw-callout" data-testid="ide-hw-callout">
          <span className="ide-hw-callout-label">Simulating:</span>
          <span className="ide-hw-callout-name">{projectName}</span>
          <span className="ide-hw-callout-sep" aria-hidden="true">·</span>
          <span>{mappingRows.length} pins mapped</span>
          {verifyStatus !== undefined && (
            <>
              <span className="ide-hw-callout-sep" aria-hidden="true">·</span>
              <span className={verifyStatus === 'PASS' ? 'ide-hw-callout-pass' : verifyStatus === 'FAIL' ? 'ide-hw-callout-fail' : ''}>
                Verify: {verifyStatus}
              </span>
            </>
          )}
        </div>

        {/* ── Mode toggle bar ── */}
        <div className="ide-hw-mode-toggle" data-testid="ide-hw-mode-toggle">
          {(['live', 'bringup', 'proof'] as const).map((m) => (
            <IdeButton
              key={m}
              tone={hwMode === m ? 'primary' : 'ghost'}
              onClick={() => setHwMode(m)}
              testId={`ide-hw-mode-btn-${m}`}
            >
              {m === 'live' ? 'Live Monitor' : m === 'bringup' ? 'Bring-Up' : 'Proof'}
            </IdeButton>
          ))}
          {sim.tick > 0 && (
            <span className="ide-hw-tick-badge" data-testid="ide-hw-tick-badge">
              t{sim.tick}
            </span>
          )}
        </div>

        {/* ── Board ── */}
        <div className={`ide-hw-board-wrap ${hwMode === 'proof' ? 'is-proof' : ''}`}>
          <div className="ide-hw-board-inner">
            <HardwareBoard2D
              sw={ioBus.state.sw}
              ld={ioBus.state.ld}
              btn={ioBus.state.btn}
              mappedSw={mappedSw}
              mappedLd={mappedLd}
              mismatchedLd={mismatchedLd}
              highlightedSw={currentStepHighlights.sw}
              highlightedLd={currentStepHighlights.ld}
              activeSignal={activeBoardSignal}
              onSelectSignal={(sig) => setActiveBoardSignal(sig)}
              onToggleSwitch={(i) => {
                ioBus.actions.toggleSwitch(i);
                setActiveBoardSignal({ type: 'sw', index: i });
              }}
              onPressButton={(i, down) => {
                ioBus.actions.setButton(i, down ? 1 : 0);
                if (down) setActiveBoardSignal({ type: 'btn', index: i });
              }}
            />
          </div>
          {hwMode === 'proof' && (
            <div
              className={`ide-hw-proof-verdict ${
                !hasAssertionData
                  ? 'is-pending'
                  : assertionFailCount === 0
                    ? 'is-valid'
                    : 'is-invalid'
              }`}
              data-testid="ide-hw-proof-verdict"
            >
              <span className="ide-hw-proof-verdict-label" data-testid="ide-hw-proof-verdict-label">
                {!hasAssertionData
                  ? 'PROOF PENDING'
                  : assertionFailCount === 0
                    ? 'PROOF VALID'
                    : 'PROOF INVALID'}
              </span>
              <div className="ide-hw-proof-verdict-meta">
                <div className="ide-hw-proof-verdict-row">
                  <span className="ide-hw-cert-key">CONFIDENCE</span>
                  <code className="ide-hw-cert-val">
                    {confidenceScore}%{confidenceScore === 100 ? ' \u220E' : ''}
                  </code>
                </div>
                <div className="ide-hw-proof-verdict-row">
                  <span className="ide-hw-cert-key">ASSERTIONS</span>
                  <code className="ide-hw-cert-val">
                    {hasAssertionData ? `${assertionPassCount}P ${assertionFailCount}F` : '\u2014'}
                  </code>
                </div>
                <div className="ide-hw-proof-verdict-row">
                  <span className="ide-hw-cert-key">HASH</span>
                  <code className="ide-hw-cert-val">
                    {health.lastVerify?.hash?.slice(0, 16) ?? '\u2014'}
                  </code>
                </div>
                <div className="ide-hw-proof-verdict-row">
                  <span className="ide-hw-cert-key">DIRTY</span>
                  <code className="ide-hw-cert-val">
                    {health.dirtySinceVerify ? 'YES' : 'NO'}
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      </IdePanel>
    </IdeSurfaceLayout>
  );
};
