import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { deriveIdeBlockingDesignIssue, projectRepository, runtimePersistence, useProjectRuntime } from '@redbyte/rb-apps/runtime';
import {
  BASYS3_BOARD_RESOURCES,
  buildCurrentVerifyProjectHash,
  elaborateProjectHierarchy,
  findVerifyRunLedgerEntry,
  generateJourneySource,
  getActiveScenario,
  planStudioRun,
  type RuntimeVerifyRun,
  type StudioRunPlan,
} from '@redbyte/rb-apps/domain';
import { buildCircuitScene, connectionEndpoints, findPin, netValue, type CircuitScene } from '@redbyte/rb-logic-view/scene';
import {
  buildTimeline,
  captureFacts,
  clockDrivingInputs,
  createMomentStore,
  createResolver,
  explainSelection,
  findCause,
  indexRecording,
  isCapture,
  paintVerdict,
  partKind,
  pendingCaptures,
  placeMoment,
  primaryPin,
  recordingRunId,
  refNodeId,
  roseByTheSample,
  roseInPhase,
  stepEvent,
  stepTick,
  unconnectedInputPins,
  valuesAt,
  type BoardBinding,
  type Explanation,
  type LensId,
  type LogicValue,
  type ObjectRef,
  type RecordingMoment,
  type SymbolRole,
} from '@redbyte/rb-studio-kernel';
import { useStoreSelector } from '@redbyte/rb-studio-kernel/react';
import { Sheet, type SheetMode, type StateWindow, type ValueState, type WireRefusal } from './Sheet';
import { TimeLens, type TimeLane } from './lenses/TimeLens';
import { SourceLens } from './lenses/SourceLens';
import { LogicLens } from './lenses/LogicLens';
import { BoardLens } from './lenses/BoardLens';
import { buildBoardModel } from './lenses/boardModel';
import { Inspector, type InspectorAction } from './Inspector';
import { isTypingTarget, STUDIO_KEYMAP } from './keymap';
import { sceneMetadata, shortHash } from './metadata';
import type { Camera } from './camera';
import '@redbyte/rb-apps/fonts';
import './styles/meridian.css';

type Stage = 'design' | 'simulate' | 'board';
type BlockingIssue = NonNullable<StudioRunPlan['blockingIssue']>;

const STAGES: readonly { id: Stage; label: string; key: string }[] = [
  { id: 'design', label: 'Design', key: '2' },
  { id: 'simulate', label: 'Simulate', key: '3' },
  { id: 'board', label: 'Board', key: '4' },
];
const DEFAULT_LENSES: Record<Stage, LensId[]> = { design: [], simulate: ['time'], board: ['board'] };
const LENS_TITLES: Record<LensId, string> = { time: 'Time', logic: 'Logic', source: 'Source', board: 'Board' };
const LENS_KEYS: readonly { id: LensId; key: string }[] = [
  { id: 'time', key: 'T' }, { id: 'logic', key: 'L' }, { id: 'source', key: 'H' }, { id: 'board', key: 'B' },
];
const EMPTY_VALUES: ReadonlyMap<string, LogicValue> = new Map();
const BUSY = new Set(['preparing', 'computing', 'publishing']);
const EVIDENCE_TITLE = 'Evidence tier E0: simulated in this browser. Not Vivado, not a board.';
/** What gives way in a crowded title strip, first to last (meridian.css data-squeeze). */
const STRIP_SQUEEZE = ['wide', 'compact', 'zoom', 'roomy', 'chip', 'stage', 'moment'] as const;

function readParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

function currentScheme(): 'light' | 'dark' {
  const theme = typeof document === 'undefined' ? 'light' : document.documentElement.dataset.rbTheme;
  return theme === 'dark' || theme === 'midnight' ? 'dark' : 'light';
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth));
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return width;
}

/** Entry: opens the same persisted working session the workbench uses, then mounts the studio. */
export const MeridianStudio: React.FC = () => {
  const [ready, setReady] = useState(() => typeof indexedDB === 'undefined');
  const [failure, setFailure] = useState<string | null>(null);
  const [pendingExample, setPendingExample] = useState<string | null>(null);
  // Read once at mount: the effect below runs twice in development (StrictMode) and drops the
  // parameter from the address bar, so it must not be re-read there.
  const [requestedExample] = useState(() => readParam('example'));
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await projectRepository.ready();
        if (!useProjectRuntime.persist.hasHydrated()) await useProjectRuntime.persist.rehydrate();
        if (!useProjectRuntime.persist.hasHydrated()) throw new Error(runtimePersistence.getStatus().message ?? 'The saved session could not be decoded.');
        // `?example=` opens a starter only into an empty session. A session that holds work is
        // never replaced by a link or a reload: the student chooses. The parameter is dropped
        // either way, so reloading keeps the working session.
        const example = requestedExample;
        const state = useProjectRuntime.getState();
        if (example && state.activeExampleId !== example) {
          if (isPristineSession(state)) state.loadExample(example);
          else if (active) setPendingExample(example);
        }
        dropParam('example');
        if (active) setReady(true);
      } catch (error) {
        if (active) setFailure(error instanceof Error ? error.message : 'Saved sessions could not be opened.');
      }
    })();
    return () => {
      active = false;
    };
  }, [requestedExample]);

  const notice = pendingExample ? (
    <ExampleNotice
      example={pendingExample}
      onOpen={() => { useProjectRuntime.getState().loadExample(pendingExample); setPendingExample(null); }}
      onKeep={() => setPendingExample(null)}
    />
  ) : null;

  return (
    <div data-rb-studio="meridian" data-scheme={currentScheme()}
      data-motion={reducedMotion ? 'reduced' : 'full'} data-testid="meridian-studio">
      {ready ? (
        <Studio reducedMotion={reducedMotion} notice={notice} />
      ) : (
        <div className="mrd-opening" role={failure ? 'alert' : 'status'}>
          <h1>{failure ? 'The saved session could not open' : 'Opening your working session'}</h1>
          <div>{failure ?? 'Loading projects and recordings from this browser.'}</div>
        </div>
      )}
    </div>
  );
};

/**
 * The workbench's "nothing open" rule (IdeApp `isPristineProjectHome`), plus no recordings and
 * no reusable modules: only such a session may be replaced by a link without asking.
 */
function isPristineSession(state: ReturnType<typeof useProjectRuntime.getState>): boolean {
  const scenario = state.scenarios.find((entry) => entry.id === state.activeScenarioId);
  return state.projectKind === 'home'
    && state.circuit.nodes.length === 0
    && (scenario?.vectors.length ?? 0) === 0
    && state.customVectors.length === 0
    && !state.activeExampleId
    && !state.sourceExampleId
    && !state.verifyLastRun
    && state.verifyRunArchive.length === 0
    && state.hierarchy.modules.length === 0;
}

function dropParam(name: string): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(name)) return;
    url.searchParams.delete(name);
    window.history.replaceState(window.history.state, '', url);
  } catch {
    // Address bar unavailable: nothing to drop.
  }
}

/** The storage failure, as the browser reported it (an IndexedDB DOMException carries a message). */
function failureReason(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.trim() ? message : 'The last change could not be saved.';
}

const ExampleNotice: React.FC<{ example: string; onOpen: () => void; onKeep: () => void }> = ({ example, onOpen, onKeep }) => {
  const projectName = useProjectRuntime((s) => s.projectName);
  return (
    <div className="mrd-notice" role="status" data-testid="meridian-example-notice">
      <span>This link opens the <strong>{example}</strong> example, which replaces the working session <strong>{projectName}</strong>.</span>
      <button type="button" className="mrd-btn" onClick={onKeep} data-testid="meridian-example-keep">Keep my session</button>
      <button type="button" className="mrd-btn" onClick={onOpen} data-testid="meridian-example-open">Open the example</button>
    </div>
  );
};

function describeRef(ref: ObjectRef | null, label: (nodeId: string) => string, scene: CircuitScene): string {
  if (!ref) return 'Nothing selected';
  switch (ref.kind) {
    case 'node':
      return label(ref.nodeId);
    case 'port':
      return `${label(ref.nodeId)}.${ref.port}`;
    case 'net': {
      const net = scene.netById.get(ref.netId);
      return net ? `net ${label(net.driver.nodeId)}.${net.driver.pin}` : ref.netId;
    }
    case 'wire': {
      const net = scene.nets.find((entry) => entry.wires.some((wire) => wire.wireId === ref.wireId));
      const wire = net?.wires.find((entry) => entry.wireId === ref.wireId);
      return wire ? `wire ${label(wire.fromNodeId)}.${wire.fromPort} → ${label(wire.toNodeId)}.${wire.toPort}` : ref.wireId;
    }
    default:
      return ref.kind;
  }
}

/**
 * A wire carries its driver's value. Every view that shows an input pin (inspector pins, board
 * LEDs, explanations) reads it through its net, exactly as the sheet colours the wire, so a pin
 * whose own evaluation has not yet re-run inside a step never disagrees with its wire.
 */
function withNetValues(scene: CircuitScene, values: ReadonlyMap<string, LogicValue>): ReadonlyMap<string, LogicValue> {
  const resolved = new Map(values);
  for (const net of scene.nets) {
    const value = netValue(net, values);
    if (value === undefined) continue;
    for (const load of net.loads) resolved.set(`${load.nodeId}.${load.pin}`, value);
  }
  return resolved;
}

/** Fan-in cone (stopping at stored state and boundary inputs) plus direct loads: the focus set. */
function focusSet(circuit: Circuit, scene: CircuitScene, nodeId: string): Set<string> {
  const result = new Set<string>([nodeId]);
  const wires = circuit.connections.map(connectionEndpoints);
  const stops = (id: string) => {
    const kind = scene.symbolById.get(id)?.geometry.kind;
    return kind === 'register' || kind === 'io-in' || kind === 'clock';
  };
  const queue = [nodeId];
  while (queue.length) {
    const id = queue.pop()!;
    for (const wire of wires) {
      if (wire.to.nodeId !== id || result.has(wire.from.nodeId)) continue;
      result.add(wire.from.nodeId);
      if (!stops(wire.from.nodeId)) queue.push(wire.from.nodeId);
    }
  }
  for (const wire of wires) if (wire.from.nodeId === nodeId) result.add(wire.to.nodeId);
  return result;
}

const Studio: React.FC<{ reducedMotion: boolean; notice: React.ReactNode }> = ({ reducedMotion, notice }) => {
  const projectId = useProjectRuntime((s) => s.projectId);
  const projectName = useProjectRuntime((s) => s.projectName);
  const circuit = useProjectRuntime((s) => s.circuit);
  const hierarchy = useProjectRuntime((s) => s.hierarchy);
  const ioRows = useProjectRuntime((s) => s.projectIoRows);
  const scenarios = useProjectRuntime((s) => s.scenarios);
  const hardwareMappingV2 = useProjectRuntime((s) => s.hardwareMappingV2);
  const dirtySinceVerify = useProjectRuntime((s) => s.projectHealthCore.dirtySinceVerify);
  const lastRun = useProjectRuntime((s) => s.verifyLastRun);
  const verifyRunHistory = useProjectRuntime((s) => s.verifyRunHistory);
  const activeScenarioId = useProjectRuntime((s) => s.activeScenarioId);
  const customVectors = useProjectRuntime((s) => s.customVectors);
  const execution = useProjectRuntime((s) => s.verificationExecution);
  const sim = useProjectRuntime((s) => s.sim);
  const activeTop = useProjectRuntime((s) => s.activeTop);

  const [stage, setStage] = useState<Stage>(() => (['design', 'simulate', 'board'].includes(readParam('stage') ?? '') ? readParam('stage') as Stage : 'design'));
  const [designMode, setDesignMode] = useState<'edit' | 'explore'>('edit');
  const [lensesByStage, setLensesByStage] = useState<Record<Stage, LensId[]>>(DEFAULT_LENSES);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [showKeys, setShowKeys] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);
  const [frameRequest, setFrameRequest] = useState(0);
  const [zoomRequest, setZoomRequest] = useState({ seq: 0, factor: 1 });
  // The View controls live in the title strip, outside the drawing, so they never cover a part
  // or a margin label. The zoom readout is written imperatively: panning never re-renders here.
  const zoomLabelRef = useRef<HTMLOutputElement | null>(null);
  const onCameraChange = useCallback((camera: Camera) => {
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(camera.zoom * 100)}%`;
  }, []);
  const zoomBy = useCallback((factor: number) => setZoomRequest((current) => ({ seq: current.seq + 1, factor })), []);
  const [focused, setFocused] = useState(false);
  const [liveSeq, setLiveSeq] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [pendingWire, setPendingWire] = useState<{ nodeId: string; port: string } | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  // RB-DEBT-023: the rail links leave this document, and a write that has not landed when it goes
  // never lands. A link waits for the last change; a failed write keeps the student here with the
  // reason and a Leave anyway path. A modified click opens a new tab and keeps this document.
  const [leaveNotice, setLeaveNotice] = useState<{ href: string; reason: string } | null>(null);
  const leavingAnywayRef = useRef(false);
  const leaveStudio = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const href = event.currentTarget.getAttribute('href') ?? '';
    setLeaveNotice(null);
    runtimePersistence.whenDurable().then(
      () => window.location.assign(href),
      (error: unknown) => setLeaveNotice({ href, reason: failureReason(error) }),
    );
  }, []);
  const leaveAnyway = useCallback(() => {
    if (!leaveNotice) return;
    leavingAnywayRef.current = true;
    window.location.assign(leaveNotice.href);
  }, [leaveNotice]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (leavingAnywayRef.current) return;
      if (!runtimePersistence.hasUnacknowledgedWrites() && runtimePersistence.getStatus().state !== 'failed') return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);
  const width = useWindowWidth();

  const moment = useMemo(() => createMomentStore(projectId), [projectId]);
  const selection = useStoreSelector(moment, (state) => state.selection);
  const cursor = useStoreSelector(moment, (state) => state.cursor);

  const scene = useMemo(() => buildCircuitScene(circuit, sceneMetadata), [circuit]);
  const run: RuntimeVerifyRun | null = lastRun ?? null;
  const index = useMemo(() => (run ? indexRecording(run) : null), [run]);
  // Inside each tick, as the engine ordered it: phases, lane segments and causes (kernel timeline).
  const timeline = useMemo(() => (run && index ? buildTimeline(run, index) : null), [run, index]);
  // Evidence currency is the workbench's run-scope verdict: run ledger plus the current project
  // hash (IdeApp `currentVerifyProjectHash`), not dirtiness alone.
  const verdict = useMemo(() => {
    if (!run) return null;
    const simulationCircuit = elaborateProjectHierarchy(circuit, hierarchy);
    const currentVerifyProjectHash = buildCurrentVerifyProjectHash({
      circuit: simulationCircuit,
      projectVectors: getActiveScenario(scenarios, activeScenarioId)?.vectors ?? [],
      customVectors,
      projectIoRows: ioRows,
    });
    return paintVerdict({
      projectId, run, circuit, hierarchy, projectIoRows: ioRows, hardwareMappingV2, scenarios, dirtySinceVerify, simulationCircuit,
      latestVerifyLedgerEntry: findVerifyRunLedgerEntry(verifyRunHistory, run) ?? null,
      currentVerifyProjectHash,
    });
  }, [projectId, run, circuit, hierarchy, ioRows, hardwareMappingV2, scenarios, activeScenarioId, customVectors, verifyRunHistory, dirtySinceVerify]);
  const resolver = useMemo(() => createResolver({ scene, run, ioRows, boardResources: BASYS3_BOARD_RESOURCES }), [scene, run, ioRows]);
  const unconnected = useMemo(() => unconnectedInputPins(scene), [scene]);
  // Clock sources: the board clock row and Clock parts. Their nets show edges, not a sampled level.
  const clockNodeIds = useMemo(() => new Set([
    ...ioRows.filter((row) => row.timingRole === 'clock' && row.nodeId).map((row) => row.nodeId!),
    ...circuit.nodes.filter((node) => node.type === 'Clock').map((node) => node.id),
  ]), [ioRows, circuit]);
  const nodeLabel = useCallback((nodeId: string) => scene.symbolById.get(nodeId)?.node.label?.trim() || nodeId, [scene]);
  const pinOf = useCallback((nodeId: string) => {
    const symbol = scene.symbolById.get(nodeId);
    return symbol ? primaryPin(symbol) : null;
  }, [scene]);
  const bindings = useMemo(() => {
    const map = new Map<string, BoardBinding>();
    for (const row of ioRows) {
      if (!row.nodeId) continue;
      const binding = resolver.resolve({ kind: 'node', scope: [], nodeId: row.nodeId }).board;
      if (binding) map.set(row.nodeId, binding);
    }
    return map;
  }, [ioRows, resolver]);

  // ── The Moment policy: Edit lights nothing, Explore is live, Simulate/Board read the recording.
  const lastRecorded = useRef<RecordingMoment | null>(null);
  useEffect(() => {
    if (cursor?.source === 'recording') lastRecorded.current = cursor;
  }, [cursor]);
  useEffect(() => {
    if (stage === 'design') {
      moment.setCursor(designMode === 'explore' ? { source: 'live', seq: liveSeq } : null);
      return;
    }
    if (!run || !index) {
      moment.setCursor(null);
      return;
    }
    const runId = recordingRunId(run);
    const current = moment.getState().cursor;
    if (current?.source === 'recording' && current.runId === runId) return;
    const remembered = lastRecorded.current?.runId === runId ? lastRecorded.current : null;
    // A new recording opens where it needs attention: its first failed check, else its first tick.
    const failure = run.report.rows.find((row) => String(row.expected) !== String(row.actual) && index.ticks.includes(row.tick));
    moment.setCursor(remembered ?? { source: 'recording', runId, tick: failure?.tick ?? index.ticks[0] ?? 0, view: 'published', eventOrder: null });
  }, [stage, designMode, run, index, liveSeq, moment]);
  // Explore counts the clock edges applied since it began, so each '.' is confirmed. A status
  // notice belongs to the mode it was raised in.
  useEffect(() => {
    setEdgeCount(0);
    setStatusNotice(null);
  }, [stage, designMode]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('stage', stage);
      window.history.replaceState(window.history.state, '', url);
    } catch {
      // Address bar unavailable: the stage still works.
    }
  }, [stage]);

  const recordingCursor = cursor?.source === 'recording' && run && recordingRunId(run) === cursor.runId ? cursor : null;
  const place = recordingCursor && timeline ? placeMoment(timeline, recordingCursor) : null;
  const recordedValues = useMemo(
    () => (recordingCursor && run && index ? valuesAt(run, index, recordingCursor) : null),
    [recordingCursor, run, index],
  );
  const liveValues = useMemo(
    () => (cursor?.source === 'live' ? new Map(Object.entries(sim.signals)) as Map<string, LogicValue> : null),
    [cursor, sim.signals],
  );
  const valueState: ValueState = !cursor ? 'none' : cursor.source === 'live' ? 'live' : verdict?.withdraw.sheet ? 'withdrawn' : 'recorded';
  const resolvedRecorded = useMemo(() => (recordedValues ? withNetValues(scene, recordedValues) : null), [scene, recordedValues]);
  const resolvedLive = useMemo(() => (liveValues ? withNetValues(scene, liveValues) : null), [scene, liveValues]);
  const sheetValues = valueState === 'live' ? resolvedLive ?? EMPTY_VALUES : valueState === 'recorded' ? resolvedRecorded ?? EMPTY_VALUES : EMPTY_VALUES;

  // Registers print their stored value: prior→current at a recorded tick, and, inside the
  // rising edge, the value already captured but not yet on Q (pending until the shared commit).
  const stateWindows = useMemo(() => {
    if (valueState !== 'recorded' || !recordingCursor || !run || !index || !timeline) return null;
    const windows = new Map<string, StateWindow>();
    if (recordingCursor.view === 'event') {
      for (const [nodeId, capture] of pendingCaptures(timeline, recordingCursor, pinOf)) {
        windows.set(nodeId, { prior: String(capture.prior), current: String(capture.next), pending: true, clocked: capture.clocked, tick: recordingCursor.tick });
      }
      return windows;
    }
    const position = index.ticks.indexOf(recordingCursor.tick);
    if (position <= 0) return null;
    const prior = timeline.ticks.get(index.ticks[position - 1])?.sample;
    if (!prior) return null;
    for (const symbol of scene.symbols) {
      if (symbol.geometry.kind !== 'register') continue;
      const pin = primaryPin(symbol);
      if (!pin) continue;
      const before = prior.get(`${symbol.nodeId}.${pin}`);
      const after = sheetValues.get(`${symbol.nodeId}.${pin}`);
      if (before === undefined || after === undefined) continue;
      const cause = before !== after ? findCause(timeline, symbol.nodeId, pin, recordingCursor.tick) : null;
      const clocked = cause?.kind === 'changed' && cause.place.tick === recordingCursor.tick && isCapture(cause.place.event)
        && captureFacts(cause.place.event, pin).clocked;
      windows.set(symbol.nodeId, { prior: String(before), current: String(after), clocked, tick: recordingCursor.tick });
    }
    return windows;
  }, [valueState, recordingCursor, run, index, timeline, scene, sheetValues, pinOf]);

  const selectedNodeId = refNodeId(selection);
  const selectedWireId = selection?.kind === 'wire' ? selection.wireId : null;
  const selectedNetId = selection?.kind === 'net' ? selection.netId
    : selectedWireId ? scene.nets.find((net) => net.wires.some((wire) => wire.wireId === selectedWireId))?.netId ?? null : null;
  const focusNodeIds = useMemo(() => (focused && selectedNodeId ? focusSet(circuit, scene, selectedNodeId) : null), [focused, selectedNodeId, circuit, scene]);

  const select = useCallback((ref: ObjectRef | null) => {
    moment.select(ref);
    if (!ref) setFocused(false);
  }, [moment]);
  const selectNode = useCallback((nodeId: string) => select({ kind: 'node', scope: [], nodeId }), [select]);

  // ── Edits go through the runtime's existing commands (one undo history).
  const mutate = useCallback((change: (current: Circuit) => Circuit) => {
    const state = useProjectRuntime.getState();
    state.applyCircuitMutation(change(state.circuit));
  }, []);
  const moveNode = useCallback((nodeId: string, position: { x: number; y: number }) => mutate((current) => ({
    ...current,
    nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, position, x: position.x, y: position.y } : node)),
  })), [mutate]);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const connect = useCallback((from: { nodeId: string; port: string }, to: { nodeId: string; port: string }) => {
    // The workbench refuses a part wired to itself ("Cannot connect node to itself"); here it
    // would also replace the input's real driver, so the click does nothing.
    if (from.nodeId === to.nodeId) return;
    mutate((current) => {
      // A new driver replaces the input's previous one: an input has exactly one driver. A wire
      // may name the input by an accepted alias (in1, clk, ...): compare canonical pins, but keep
      // a bit-addressed vector pin (sum(2)) exact so other bits keep their drivers.
      const geometry = sceneRef.current.symbolById.get(to.nodeId)?.geometry;
      const canonical = (port: string) => (/[[(]\d+[\])]$/.test(port) || !geometry ? port : findPin(geometry, port)?.id ?? port);
      const target = canonical(to.port);
      const kept = current.connections.filter((wire) => {
        const { to: end } = connectionEndpoints(wire);
        return !(end.nodeId === to.nodeId && canonical(end.port) === target);
      });
      return {
        ...current,
        connections: [...kept, {
          id: `${from.nodeId}.${from.port}-${to.nodeId}.${to.port}`,
          from: { nodeId: from.nodeId, portName: from.port },
          to: { nodeId: to.nodeId, portName: to.port },
        }],
      };
    });
  }, [mutate]);
  const deleteWire = useCallback((wireId: string) => mutate((current) => ({
    ...current,
    connections: current.connections.filter((wire) => connectionEndpoints(wire).wireId !== wireId),
  })), [mutate]);
  const onPendingWireChange = useCallback((port: { nodeId: string; port: string } | null) => {
    setPendingWire(port);
    if (port) setStatusNotice(null);
  }, []);
  const onWireRefused = useCallback((reason: WireRefusal) => {
    setStatusNotice(reason === 'same-part' ? 'A part cannot be wired to itself' : 'Connect an output to an input');
  }, []);
  const toggleInput = useCallback((nodeId: string) => {
    useProjectRuntime.getState().actions.sim.toggleInput(nodeId);
    setLiveSeq((value) => value + 1);
  }, []);
  const clockEdge = useCallback(() => {
    // Exactly the workbench's "Clock edge": pulse every input that drives a clock port.
    const state = useProjectRuntime.getState();
    const clocks = clockDrivingInputs(state.circuit, state.sim.inputs);
    if (clocks.length === 0) {
      setStatusNotice('This design has no clock input to pulse');
      return;
    }
    const sim = state.actions.sim;
    for (const nodeId of clocks) sim.setInput(nodeId, 0);
    for (const nodeId of clocks) sim.setInput(nodeId, 1);
    sim.step();
    for (const nodeId of clocks) sim.setInput(nodeId, 0);
    setLiveSeq((value) => value + 1);
    setEdgeCount((value) => value + 1);
  }, []);

  const busy = BUSY.has(execution.status);
  // A Design issue that turned checks off belongs to the recording that Run produced, and only to it.
  const [runNotice, setRunNotice] = useState<{ runId: string; issue: BlockingIssue } | null>(null);
  const pendingNotice = useRef<{ fromRunId: string | null; issue: BlockingIssue | null } | null>(null);
  const startRun = useCallback(() => {
    const state = useProjectRuntime.getState();
    if (BUSY.has(state.verificationExecution.status)) return;
    const plan = planStudioRun(state, { captureEvaluations: true, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
    // Like Simulate: a Design issue turns checks off; the Run still records the behaviour.
    pendingNotice.current = { fromRunId: state.verifyLastRun ? recordingRunId(state.verifyLastRun) : null, issue: plan.blockingIssue };
    state.startVerification(plan.input);
  }, []);
  useEffect(() => {
    const pending = pendingNotice.current;
    if (!run || !pending) return;
    const runId = recordingRunId(run);
    if (runId === pending.fromRunId) return;
    pendingNotice.current = null;
    setRunNotice(pending.issue ? { runId, issue: pending.issue } : null);
  }, [run]);
  useEffect(() => {
    if (execution.status === 'cancelled' || execution.status === 'error') pendingNotice.current = null;
  }, [execution.status]);
  const cancelRun = useCallback(() => useProjectRuntime.getState().cancelVerification('Cancelled from the studio'), []);

  const seekTick = useCallback((tick: number) => moment.seek({ tick, view: 'published', eventOrder: null }), [moment]);
  const stepTicks = useCallback((delta: 1 | -1) => {
    const current = moment.getState().cursor;
    if (current?.source !== 'recording' || !index) return;
    moment.seek({ tick: stepTick(index.ticks, current.tick, delta), view: 'published', eventOrder: null });
  }, [moment, index]);
  const budget = width >= 1600 ? 2 : 1;
  // A lens key shows that lens; pressing it again while it is on screen closes it. A lens that
  // is open but outside the pane budget is brought on screen, never silently closed.
  const toggleLens = useCallback((lens: LensId) => setLensesByStage((current) => {
    const list = current[stage];
    const visible = list.slice(-budget);
    if (visible.includes(lens)) return { ...current, [stage]: list.filter((entry) => entry !== lens) };
    return { ...current, [stage]: [...list.filter((entry) => entry !== lens), lens] };
  }), [stage, budget]);

  // ── Causal navigation: from a value to the retained evaluation that set it, and back.
  const [returnTo, setReturnTo] = useState<RecordingMoment | null>(null);
  useEffect(() => {
    if (recordingCursor && recordingCursor.view !== 'event') setReturnTo(null);
  }, [recordingCursor]);
  const backRef = useRef<(() => void) | null>(null);
  // A new recording ends causal navigation; the same recording handed back after an edit or undo does not.
  const runKey = run ? recordingRunId(run) : null;
  useEffect(() => {
    setReturnTo(null);
  }, [runKey]);

  // ── Keyboard: extends the shipped keymap (see keymap.ts).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key === 'Enter') { event.preventDefault(); startRun(); return; }
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        const state = useProjectRuntime.getState();
        if (event.shiftKey) state.redoProjectEdit(); else state.undoProjectEdit();
        return;
      }
      if (event.key === 'Escape') {
        // One Esc backs out one step: the sheet consumes it first to cancel a pending wire.
        if (event.defaultPrevented) return;
        if (BUSY.has(useProjectRuntime.getState().verificationExecution.status)) cancelRun();
        else if (showKeys) setShowKeys(false);
        else if (backRef.current) backRef.current();
        else if (focused) setFocused(false);
        else select(null);
        return;
      }
      if (mod || event.altKey) return;
      const recording = moment.getState().cursor;
      switch (event.key) {
        case '2': setStage('design'); break;
        case '3': setStage('simulate'); break;
        case '4': setStage('board'); break;
        case 't': case 'T': toggleLens('time'); break;
        case 'l': case 'L': toggleLens('logic'); break;
        case 'h': case 'H': toggleLens('source'); break;
        case 'b': case 'B': toggleLens('board'); break;
        case 'i': case 'I': setInspectorOpen((open) => !open); break;
        case '?': setShowKeys((open) => !open); break;
        case 'e': case 'E': if (stage === 'design') setDesignMode((mode) => (mode === 'edit' ? 'explore' : 'edit')); break;
        case '.': if (stage === 'design' && designMode === 'explore') clockEdge(); break;
        case 'f': case 'F':
          if (moment.getState().selection && refNodeId(moment.getState().selection)) { setFocused(true); setFrameRequest((n) => n + 1); }
          else setFitRequest((n) => n + 1);
          break;
        case 'ArrowLeft': case 'ArrowRight': case 'Home': case 'End':
          if (recording?.source === 'recording' && index) {
            event.preventDefault();
            const tick = event.key === 'Home' ? index.ticks[0] : event.key === 'End' ? index.ticks[index.ticks.length - 1]
              : stepTick(index.ticks, recording.tick, event.key === 'ArrowRight' ? 1 : -1);
            moment.seek({ tick, view: 'published', eventOrder: null });
          }
          break;
        case '[': case ']':
          if (recording?.source === 'recording' && index) {
            const next = stepEvent(index, recording, event.key === ']' ? 1 : -1);
            if (next) moment.seek({ tick: next.tick, view: next.view, eventOrder: next.eventOrder });
          }
          break;
        case 'Delete': case 'Backspace': {
          const current = moment.getState().selection;
          if (stage === 'design' && designMode === 'edit' && current?.kind === 'wire') { event.preventDefault(); deleteWire(current.wireId); select(null); }
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelRun, clockEdge, deleteWire, designMode, focused, index, moment, select, showKeys, stage, startRun, toggleLens]);

  // ── Derived views for the lenses and inspector.
  const lanes = useMemo<TimeLane[]>(() => {
    if (!run) return [];
    const rows = run.executionInput?.ioRows ?? ioRows;
    const ordered = [...rows.filter((row) => row.direction === 'in'), ...rows.filter((row) => row.direction === 'out')];
    const laneFor = (nodeId: string) => {
      const resolved = resolver.resolve({ kind: 'node', scope: [], nodeId });
      const pin = resolved.port ?? pinOf(nodeId);
      return { resolved, valueKey: pin ? `${nodeId}.${pin}` : null };
    };
    const result: TimeLane[] = ordered.filter((row) => row.nodeId).map((row) => {
      const { resolved, valueKey } = laneFor(row.nodeId!);
      const label = nodeLabel(row.nodeId!);
      const board = resolved.board;
      // The second line names what the label does not: the board resource, else its package pin.
      const sub = board && board.name.toUpperCase() !== label.toUpperCase() ? board.name : board?.packagePin ?? '';
      return { key: resolved.lane, valueKey, fieldId: row.id, label, sub, nodeId: row.nodeId!, role: clockNodeIds.has(row.nodeId!) ? 'clock' : row.direction };
    });
    if (selectedNodeId && !result.some((lane) => lane.nodeId === selectedNodeId)) {
      // A selected register shows what its data input held on each side of the edge, above Q.
      const symbol = scene.symbolById.get(selectedNodeId);
      if (symbol?.geometry.kind === 'register') {
        for (const pin of symbol.geometry.pins) {
          if (pin.direction !== 'in' || pin.clock) continue;
          const resolved = resolver.resolve({ kind: 'port', scope: [], nodeId: selectedNodeId, port: pin.id });
          if (resolved.lane) result.push({ key: resolved.lane, valueKey: `${selectedNodeId}.${pin.id}`, fieldId: null, label: `${nodeLabel(selectedNodeId)}.${pin.name}`, sub: 'in', nodeId: selectedNodeId, role: 'selected' });
        }
      }
      const { resolved, valueKey } = laneFor(selectedNodeId);
      if (resolved.lane) result.push({ key: resolved.lane, valueKey, fieldId: null, label: nodeLabel(selectedNodeId), sub: resolved.port ?? '', nodeId: selectedNodeId, role: 'selected' });
    }
    return result;
  }, [run, ioRows, resolver, nodeLabel, pinOf, selectedNodeId, clockNodeIds, scene]);

  const liveSource = useMemo(() => {
    try {
      return generateJourneySource(circuit, hierarchy, ioRows, activeTop || 'top');
    } catch {
      return null;
    }
  }, [circuit, hierarchy, ioRows, activeTop]);
  const sourceFromRecording = Boolean(recordingCursor && run?.generatedSource);
  const source = sourceFromRecording ? run!.generatedSource! : liveSource;
  const sourceFile = source?.files.find((file) => file.path === 'top.vhd') ?? source?.files[0] ?? null;

  const selectedSymbol = selectedNodeId ? scene.symbolById.get(selectedNodeId) ?? null : null;
  const selectedRole: SymbolRole | null = !selectedSymbol ? null
    : clockNodeIds.has(selectedSymbol.nodeId) || selectedSymbol.geometry.kind === 'clock' ? 'clock'
      : selectedSymbol.geometry.kind === 'register' ? 'register'
        : selectedSymbol.geometry.kind === 'io-in' ? 'io-in'
          : selectedSymbol.geometry.kind === 'io-out' ? 'io-out' : 'logic';
  // The explanation reads only the recording: samples, and the retained evaluation behind them.
  const explanation = useMemo<Explanation | null>(() => {
    if (!selectedSymbol || !selectedRole || !recordingCursor || !run || !index || !timeline || valueState !== 'recorded') return null;
    if (!run.circuitSnapshot?.nodes.some((node) => node.id === selectedSymbol.nodeId)) return null;
    return explainSelection({
      timeline,
      index,
      moment: recordingCursor,
      nodeId: selectedSymbol.nodeId,
      nodeType: selectedSymbol.node.type,
      role: selectedRole,
      pin: primaryPin(selectedSymbol),
      clockPins: selectedSymbol.geometry.pins.filter((pin) => pin.clock).map((pin) => pin.id),
      title: nodeLabel(selectedSymbol.nodeId),
      label: nodeLabel,
      values: resolvedRecorded ?? EMPTY_VALUES,
      unconnectedPins: selectedSymbol.geometry.pins.filter((pin) => unconnected.has(`${selectedSymbol.nodeId}.${pin.id}`)).map((pin) => pin.id),
    });
  }, [selectedSymbol, selectedRole, recordingCursor, run, index, timeline, valueState, nodeLabel, resolvedRecorded, unconnected]);

  const showCause = useCallback(() => {
    const cause = explanation?.cause;
    if (!cause || cause.kind === 'unavailable' || !recordingCursor) return;
    setReturnTo(recordingCursor);
    moment.seek({ tick: cause.place.tick, view: 'event', eventOrder: cause.place.event.order });
  }, [explanation, recordingCursor, moment]);
  const backTarget = recordingCursor?.view === 'event'
    ? returnTo && returnTo.runId === recordingCursor.runId ? returnTo : { ...recordingCursor, view: 'published' as const, eventOrder: null }
    : null;
  const goBack = useCallback(() => {
    if (!backTarget) return;
    moment.seek({ tick: backTarget.tick, view: backTarget.view, eventOrder: backTarget.eventOrder });
    setReturnTo(null);
  }, [backTarget, moment]);
  backRef.current = backTarget ? goBack : null;

  const boardModel = useMemo(() => buildBoardModel(BASYS3_BOARD_RESOURCES, ioRows.flatMap((row) => {
    const binding = row.nodeId ? bindings.get(row.nodeId) : undefined;
    return row.nodeId && binding ? [{ nodeId: row.nodeId, signal: nodeLabel(row.nodeId), binding }] : [];
  })), [ioRows, bindings, nodeLabel]);
  const mappedParts = useMemo(() => boardModel.parts.filter((part) => part.mapped), [boardModel]);
  const boardRecorded = useMemo(() => {
    if (!resolvedRecorded || verdict?.withdraw.board) return null;
    const map = new Map<string, 0 | 1 | null>();
    for (const part of mappedParts) {
      const pin = pinOf(part.mapped!.nodeId);
      const value = pin ? resolvedRecorded.get(`${part.mapped!.nodeId}.${pin}`) : undefined;
      map.set(part.alias.toUpperCase(), value === 1 ? 1 : value === 0 ? 0 : null);
    }
    return map;
  }, [resolvedRecorded, verdict, mappedParts, pinOf]);
  const boardInputs = useMemo(() => {
    const map = new Map<string, 0 | 1 | null>();
    for (const part of mappedParts) {
      const alias = part.alias.toUpperCase();
      if (cursor?.source === 'live') {
        const value = sim.inputs[part.mapped!.nodeId];
        map.set(alias, value === 1 ? 1 : value === 0 ? 0 : null);
      } else if (boardRecorded) {
        map.set(alias, boardRecorded.get(alias) ?? null);
      }
    }
    return map;
  }, [mappedParts, cursor, sim.inputs, boardRecorded]);

  const checks = run?.report.rows ?? [];
  const failed = checks.filter((row) => String(row.expected) !== String(row.actual)).length;
  const runLabel = run ? `r-${shortHash(recordingRunId(run))}` : null;
  // After a reload the notice is gone; a recording made without checks on this same design is
  // explained by the design's own blocking issue, derived again the way Run derives it.
  const derivedIssue = useMemo(() => {
    if (!run || run.report.rows.length > 0 || run.runKind !== 'trace' || !verdict?.paintEligible) return null;
    try {
      const plan = planStudioRun(useProjectRuntime.getState(), { captureEvaluations: true, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
      const sameScenario = plan.input.scenarioId === run.scenarioId && Boolean(run.scenarioContentHash) && plan.input.scenarioContentHash === run.scenarioContentHash;
      return sameScenario && plan.authoredCheckCount > 0 ? plan.blockingIssue : null;
    } catch {
      return null;
    }
    // Re-derived when the recording, the design or the scenario changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, verdict?.paintEligible, circuit, scenarios, activeScenarioId]);
  const checksOff = (run && runNotice && runNotice.runId === recordingRunId(run) ? runNotice.issue : null) ?? derivedIssue;
  const notCurrent = Boolean(run && verdict && !verdict.evidenceCurrent);
  // An invalid model (e.g. a combinational loop) is never simulated: only its test inputs are recorded.
  const notSimulated = run?.evaluationTrace?.status === 'unavailable' && run.evaluationTrace.unavailableReason === 'invalid-ir';
  // A recording made without checks (none authored, or turned off by a Design issue) is not a pass.
  const checkText = !run ? '' : checksOff ? `checks ${notCurrent ? 'were ' : ''}off · ${notSimulated ? 'not simulated · ' : ''}${checksOff.title}`
    : notSimulated ? 'not simulated · only the test inputs were recorded'
    : checks.length === 0 ? 'recorded without checks' : failed ? `${failed} of ${checks.length} checks failed` : `${checks.length} checks passed`;
  const runTone = !run || checksOff || checks.length === 0 ? 'none' : notCurrent ? 'stale' : failed ? 'fail' : 'pass';
  // Why recorded values are withdrawn: an older recording has no design identity to match; a
  // current one was made on an earlier revision (design) or before the pin mapping changed.
  const withdrawnText = verdict?.legacy ? 'older recording · values withdrawn' : 'design changed · values withdrawn';
  const withdrawnReason = verdict?.legacy
    ? 'Values withdrawn: this older recording has no design identity to match.'
    : verdict?.withdraw.sheet ? 'Values withdrawn: the design changed since this run.' : 'Values withdrawn: the pin mapping changed since this run.';
  const withdrawnTitle = verdict?.legacy
    ? 'This recording comes from an older engine without a design identity, so its values cannot be matched to the design. Run again to record this design.'
    : 'The design changed since this recording was made, so its values are withdrawn from the sheet. The Time lens keeps them as recorded. Run again to record this design.';
  // The Moment in words. In a narrow strip the parts marked roomy give way first, so the
  // position (tick, step, part) always stays whole.
  const momentText: React.ReactNode = !cursor ? (stage === 'design' ? 'Editing · nothing lit' : 'No recording yet · Run creates one')
    : cursor.source === 'live' ? <>Exploring<span className="mrd-roomy"> · not recorded</span>{edgeCount ? ` · ${edgeCount} clock edge${edgeCount === 1 ? '' : 's'}` : ''}</>
      : valueState === 'withdrawn' ? withdrawnText
        : place ? <>t{cursor.tick} · <span className="mrd-roomy">{place.phase.words} · </span>step {place.step} of {place.of} · {nodeLabel(place.event.nodeId)}</>
          : `t${cursor.tick}`;
  // Values painted from a recording whose evidence is not current (an edit since, even one undone).
  const currencyChip = valueState === 'recorded' && notCurrent ? 'not current' : null;
  const rerun = !busy && (valueState === 'withdrawn' || currencyChip !== null);
  const boardLegend: React.ReactNode = recordingCursor
    ? verdict?.withdraw.board
      ? <>{verdict.legacy ? 'older recording without a design identity' : verdict.withdraw.sheet ? 'design changed since this run' : 'pin mapping changed since this run'} · values withdrawn{' '}
          <button type="button" className="mrd-btn mrd-btn--inline" onClick={startRun} data-testid="meridian-board-rerun">Run again</button></>
      : `Recorded · t${recordingCursor.tick}${place ? ` · step ${place.step} of ${place.of}` : ''} · simulation · not a board observation`
    : cursor?.source === 'live' ? 'Exploring · switches show live inputs · LEDs light only from a recording'
      : 'No recording on screen · LEDs light only from a recording · not a board observation';

  const openLenses = lensesByStage[stage].slice(-budget);
  const sheetMode: SheetMode = stage === 'design' ? designMode : 'inspect';
  const runStatus = busy
    ? `Running${execution.completedCases ? ` · case ${execution.completedCases}` : ''} · Esc cancels`
    : execution.status === 'cancelled' ? 'Run cancelled · the previous recording stays'
      : execution.status === 'error' ? `Run failed · ${execution.message ?? 'the previous recording stays'}`
        : run ? `${runLabel} · ${checkText}${notCurrent && !checksOff ? ' · not current' : ''}` : 'No recording yet';
  const issueHint = checksOff?.hint && !checksOff.message.includes(checksOff.hint) ? ` ${checksOff.hint}` : '';
  const runStatusTitle = checksOff ? `${checksOff.message}${issueHint}${notSimulated ? ' The simulator could not run this design, so only the test inputs were recorded.' : ''} Fix it in Design, then Run again.`
    : notSimulated ? 'The simulator could not run this design, so only the test inputs were recorded. Fix it in Design, then Run again.'
    : notCurrent ? 'This recording was made before your last edit. Run again to make its checks current.' : undefined;
  const momentLabel = recordingCursor ? (place ? `t${recordingCursor.tick} · step ${place.step} of ${place.of}` : `t${recordingCursor.tick}`) : '';
  const capturing = place && selectedNodeId && place.event.nodeId === selectedNodeId && place.event.evaluationPhase === 'capture' && place.phase.kind === 'rise';
  const logicCaption = valueState === 'live' ? 'Marked row: the live values'
    : recordingCursor ? (capturing ? `Marked row: the values at this clock edge → what ${nodeLabel(selectedNodeId!)} captures`
      : place ? `Marked row: the values at step ${place.step} of ${place.of} in t${recordingCursor.tick}` : `Marked row: the values recorded at t${recordingCursor.tick}`) : null;

  // A clock tag reads '↑' only where the recording shows the clock rising: by the sample of a
  // published tick, or in the phase of the current step. Otherwise it shows the recorded level.
  const clockRose = useMemo(() => {
    if (valueState !== 'recorded' || !recordingCursor || !timeline) return false;
    const time = timeline.ticks.get(recordingCursor.tick);
    if (!time) return false;
    const keys = [...clockNodeIds].flatMap((id) => (pinOf(id) ? [`${id}.${pinOf(id)}`] : []));
    return keys.some((key) => (place ? roseInPhase(timeline, key, recordingCursor.tick, time.phases.indexOf(place.phase)) : roseByTheSample(timeline, key, recordingCursor.tick)));
  }, [valueState, recordingCursor, timeline, place, clockNodeIds, pinOf]);
  const hasClock = useMemo(() => clockDrivingInputs(circuit, sim.inputs).length > 0, [circuit, sim.inputs]);

  const selectedClockPins = useMemo(() => {
    const pins = new Set<string>();
    if (!selectedSymbol) return pins;
    for (const pin of selectedSymbol.geometry.pins) {
      const net = scene.netById.get(scene.netByEndpoint.get(`${selectedSymbol.nodeId}.${pin.id}`) ?? '');
      if (net && clockNodeIds.has(net.driver.nodeId)) pins.add(pin.id);
    }
    return pins;
  }, [selectedSymbol, scene, clockNodeIds]);

  const inspectorActions: InspectorAction[] = [];
  if (explanation?.causeLabel && recordingCursor?.view === 'published') inspectorActions.push({ label: explanation.causeLabel, onClick: showCause, testId: 'meridian-show-cause' });
  if (sheetMode === 'explore' && selectedSymbol && selectedRole === 'io-in') {
    inspectorActions.push({ label: `Toggle ${nodeLabel(selectedSymbol.nodeId)}`, onClick: () => toggleInput(selectedSymbol.nodeId), testId: 'meridian-toggle-input', kbd: 'Enter' });
  }
  if (sheetMode === 'explore' && selectedRole === 'clock' && hasClock) inspectorActions.push({ label: 'Clock edge', onClick: clockEdge, testId: 'meridian-inspector-clock-edge', kbd: '.' });
  const wireActions: InspectorAction[] = sheetMode === 'edit' && selectedWireId
    ? [{ label: 'Delete wire', onClick: () => { deleteWire(selectedWireId); select(null); }, testId: 'meridian-delete-wire', kbd: 'Del' }]
    : [];

  const sourceRange = useMemo(() => {
    if (!sourceFile || !selectedNodeId) return null;
    const lines = (source?.spans ?? []).filter((span) => span.path === sourceFile.path && span.nodeId === selectedNodeId && (span.definitionId ?? 'top') === 'top');
    if (lines.length === 0) return null;
    const first = Math.min(...lines.map((span) => span.startLine));
    const last = Math.max(...lines.map((span) => span.endLine));
    return first === last ? `line ${first}` : `lines ${first}–${last}`;
  }, [source, sourceFile, selectedNodeId]);

  const renderLens = (lens: LensId) => {
    let meta = '';
    let body: React.ReactNode = null;
    if (lens === 'time') {
      const coverage = timeline?.coverage.kind;
      const lastTick = timeline?.coverage.kind === 'partial' ? timeline.coverage.lastTick : null;
      meta = !run ? '' : `${coverage === 'complete' ? 'inputs change at the tick start · registers at the rising edge ↑'
        : notSimulated ? 'not simulated · only the test inputs were recorded'
          : coverage === 'partial' && lastTick !== null ? `evaluations kept up to t${lastTick} · later ticks: one sample each, changes drawn slanted`
            : 'one sample per tick · changes between samples drawn slanted'}${valueState === 'withdrawn' ? ` · as recorded · ${verdict?.legacy ? 'older recording' : 'design changed'}` : ''}`;
      body = (
        <TimeLens run={run} index={index} timeline={timeline} cursor={recordingCursor} place={place} lanes={lanes} selectedNodeId={selectedNodeId}
          stepValues={place && valueState === 'recorded' ? sheetValues : null}
          stale={valueState === 'withdrawn' ? withdrawnText : null} onSeek={seekTick} onSelectNode={selectNode} />
      );
    } else if (lens === 'source') {
      meta = sourceFile ? `${sourceFile.path}${sourceRange && selectedNodeId ? ` · ${nodeLabel(selectedNodeId)} = ${sourceRange}` : ''} · ${sourceFromRecording ? 'as recorded' : 'current design (generated)'}` : '';
      body = <SourceLens file={sourceFile} spans={source?.spans ?? []} activeNodeId={selectedNodeId} onSelectNode={selectNode} nodeLabel={nodeLabel} limits={source?.diagnostics} />;
    } else if (lens === 'logic') {
      meta = selectedSymbol ? nodeLabel(selectedSymbol.nodeId) : '';
      body = (
        <LogicLens circuit={circuit} symbol={selectedSymbol} values={sheetValues}
          valuesShown={valueState === 'recorded' || valueState === 'live'} nodeLabel={nodeLabel} caption={logicCaption} />
      );
    } else {
      meta = 'Basys3 · xc7a35tcpg236-1';
      body = (
        <BoardLens model={boardModel} recorded={boardRecorded} inputs={boardInputs}
          selectedNodeId={selectedNodeId} legend={boardLegend} onSelectNode={selectNode} />
      );
    }
    return (
      <section key={lens} className="mrd-lens" data-lens={lens} data-testid={`meridian-lens-${lens}`} aria-label={`${LENS_TITLES[lens]} lens`}>
        <header className="mrd-lens-head">
          <span className="mrd-lens-title">{LENS_TITLES[lens]}</span>
          <span className="mrd-lens-meta" title={meta}>{meta}</span>
        </header>
        <div className="mrd-lens-body">{body}</div>
      </section>
    );
  };

  const firstUnconnected = [...unconnected][0] ?? null;

  // The strip keeps the Moment whole: when its content overflows, the lower-priority parts give
  // way one level at a time (measured after every render and on every resize).
  const stripRowRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const row = stripRowRef.current;
    if (!row) return undefined;
    const fit = () => {
      row.dataset.squeeze = '';
      for (let level = 1; level <= STRIP_SQUEEZE.length && row.scrollWidth > row.clientWidth + 1; level += 1) {
        row.dataset.squeeze = STRIP_SQUEEZE.slice(0, level).join(' ');
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(row);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  });

  return (
    <>
      <header className="mrd-bar" style={{ position: 'relative' }}>
        <div className="mrd-brand">
          <span className="mrd-brand-mark">Red<span>Byte</span></span>
          <span className="mrd-project" data-testid="meridian-project" title={projectName}>{projectName}</span>
        </div>
        <div className="mrd-bar-spacer" />
        <span className="mrd-run-status" data-testid="meridian-run-status" data-tone={busy ? 'busy' : runTone} title={runStatusTitle}>{runStatus}</span>
        {busy ? (
          <button type="button" className="mrd-btn" onClick={cancelRun} data-testid="meridian-cancel">Cancel <kbd className="mrd-kbd">Esc</kbd></button>
        ) : (
          <button type="button" className="mrd-btn mrd-btn--primary" onClick={startRun} data-testid="meridian-run">Run <kbd className="mrd-kbd">Ctrl+Enter</kbd></button>
        )}
        <button type="button" className="mrd-btn" aria-pressed={showKeys} onClick={() => setShowKeys((open) => !open)} aria-label="Keyboard shortcuts">?</button>
        {busy ? <div className="mrd-run-progress" aria-hidden="true" /> : null}
      </header>
      {notice}
      {leaveNotice ? (
        <div className="mrd-notice" role="alert" data-testid="meridian-leave-notice">
          <span>Your last change has not been saved, so leaving now would lose it: {leaveNotice.reason}</span>
          <button type="button" className="mrd-btn" onClick={() => setLeaveNotice(null)} data-testid="meridian-leave-stay">Stay</button>
          <button type="button" className="mrd-btn" onClick={leaveAnyway} data-testid="meridian-leave-anyway">Leave anyway</button>
        </div>
      ) : null}

      <nav className="mrd-rail" aria-label="Stages">
        <a className="mrd-rail-item mrd-rail-link" href="?mode=project" onClick={leaveStudio} title="Project · opens the classic workbench">Project<span aria-hidden="true">↗</span></a>
        <div className="mrd-rail-rule" role="presentation" />
        {STAGES.map((entry) => (
          <button key={entry.id} type="button" className="mrd-rail-item" aria-current={stage === entry.id ? 'page' : undefined}
            data-testid={`meridian-stage-${entry.id}`} onClick={() => setStage(entry.id)}>
            <span className="mrd-rail-key">{entry.key}</span>{entry.label}
          </button>
        ))}
        <div className="mrd-rail-rule" role="presentation" />
        <a className="mrd-rail-item mrd-rail-link" href="?mode=export" onClick={leaveStudio} title="Package · opens the classic workbench">Package<span aria-hidden="true">↗</span></a>
        <a className="mrd-rail-item mrd-rail-link mrd-rail-classic" href="?mode=design" onClick={leaveStudio} title="Open this project in the classic workbench">Classic<span aria-hidden="true">↗</span></a>
      </nav>

      <main className="mrd-work" data-preset={stage} data-inspector={inspectorOpen ? 'open' : 'closed'} data-testid="meridian-work">
        <div className="mrd-sheet-pane">
          <div className="mrd-title-strip" data-testid="meridian-title-block" data-moment={cursor ? cursor.source : 'none'} data-value-state={valueState}>
            <div className="mrd-strip-row" ref={stripRowRef}>
            {stage === 'design' ? (
              <div className="mrd-mode-switch" role="group" aria-label="Design mode">
                <button type="button" className="mrd-btn" aria-pressed={designMode === 'edit'} onClick={() => setDesignMode('edit')} data-testid="meridian-mode-edit">Edit</button>
                <button type="button" className="mrd-btn" aria-pressed={designMode === 'explore'} onClick={() => setDesignMode('explore')} data-testid="meridian-mode-explore">Explore <kbd className="mrd-kbd">E</kbd></button>
              </div>
            ) : (
              <span className="mrd-strip-stage">{stage === 'simulate' ? 'Simulate' : 'Board'}</span>
            )}
            {stage === 'design' && designMode === 'explore' && hasClock ? (
              <button type="button" className="mrd-btn mrd-btn--strip" onClick={clockEdge} data-testid="meridian-clock-edge" title="Apply one clock edge to the registers">Clock edge <kbd className="mrd-kbd">.</kbd></button>
            ) : null}
            {recordingCursor && index ? (
              <div className="mrd-stepper" role="group" aria-label="Tick">
                <button type="button" className="mrd-btn mrd-btn--icon" onClick={() => stepTicks(-1)} aria-label="Previous tick (←)" data-testid="meridian-prev-tick">‹</button>
                <span className="mrd-strip-item mrd-moment" data-tone={valueState === 'withdrawn' ? 'stale' : 'now'} data-testid="meridian-moment" aria-live="polite"
                  title={valueState === 'withdrawn' ? withdrawnTitle : place ? `t${recordingCursor.tick} · ${place.phase.words} · step ${place.step} of ${place.of} · ${nodeLabel(place.event.nodeId)}` : undefined}>{momentText}</span>
                <button type="button" className="mrd-btn mrd-btn--icon" onClick={() => stepTicks(1)} aria-label="Next tick (→)" data-testid="meridian-next-tick">›</button>
                {backTarget ? (
                  <button type="button" className="mrd-btn mrd-btn--strip" onClick={goBack} data-testid="meridian-back"
                    title={`Return to t${backTarget.tick}${backTarget.view === 'event' ? ' (a step inside it)' : ''}`}>
                    Back to t{backTarget.tick} <kbd className="mrd-kbd mrd-wide">Esc</kbd>
                  </button>
                ) : null}
              </div>
            ) : (
              <span className="mrd-strip-item mrd-moment" data-tone={valueState === 'withdrawn' ? 'stale' : undefined} data-testid="meridian-moment">
                {pendingWire ? `Wiring from ${nodeLabel(pendingWire.nodeId)}.${pendingWire.port} · click an input pin · Esc cancels` : momentText}
              </span>
            )}
            {currencyChip ? (
              <span className="mrd-chip" data-testid="meridian-currency-chip"
                title="Same design as this run, so its values are drawn. Run again to make its checks current.">{currencyChip}</span>
            ) : null}
            {rerun ? (
              <button type="button" className="mrd-btn mrd-btn--strip" onClick={startRun} data-testid="meridian-rerun">Run again <kbd className="mrd-kbd mrd-wide">Ctrl+Enter</kbd></button>
            ) : null}
            <span className="mrd-strip-item mrd-strip-evidence" title={EVIDENCE_TITLE}><span className="mrd-wide">browser </span><span className="mrd-compact">simulation · </span>E0</span>
            <div className="mrd-sheet-tools" role="group" aria-label="View">
              <button type="button" className="mrd-btn" data-testid="meridian-fit" onClick={() => setFitRequest((n) => n + 1)}>Fit</button>
              <button type="button" className="mrd-btn mrd-zoomstep" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>−</button>
              <output ref={zoomLabelRef} data-testid="meridian-zoom" aria-live="off" />
              <button type="button" className="mrd-btn mrd-zoomstep" aria-label="Zoom in" onClick={() => zoomBy(1.2)}>+</button>
            </div>
            </div>
          </div>
          <div className="mrd-sheet-area">
            <Sheet
              projectId={projectId}
              scene={scene}
              values={sheetValues}
              valueState={valueState}
              stateWindows={stateWindows}
              selection={selection}
              selectedNodeId={selectedNodeId}
              selectedNetId={selectedNetId}
              selectedWireId={selectedWireId}
              focusNodeIds={focusNodeIds}
              unconnected={unconnected}
              bindings={bindings}
              mode={sheetMode}
              reducedMotion={reducedMotion}
              fitRequest={fitRequest}
              frameRequest={frameRequest}
              zoomRequest={zoomRequest}
              onCameraChange={onCameraChange}
              onSelect={select}
              onMoveNode={moveNode}
              onConnect={connect}
              onToggleInput={toggleInput}
              onPendingWireChange={onPendingWireChange}
              onWireRefused={onWireRefused}
              clockNodeIds={clockNodeIds}
              clockRose={clockRose}
              ariaLabel={`${projectName} circuit sheet`}
            />
          </div>
        </div>
        <div className="mrd-lenses" data-budget={budget}>{openLenses.map(renderLens)}</div>
        <aside className="mrd-inspector" aria-label="Inspector">
          <Inspector
            symbol={selectedSymbol}
            title={selectedSymbol ? nodeLabel(selectedSymbol.nodeId) : ''}
            kindLabel={selectedSymbol ? partKind(selectedSymbol.node.type) ?? (selectedSymbol.geometry.typeLabel || selectedSymbol.node.type) : ''}
            values={sheetValues}
            valueState={valueState}
            withdrawnReason={withdrawnReason}
            clockRose={clockRose}
            momentLabel={momentLabel}
            mode={sheetMode}
            binding={selectedNodeId ? bindings.get(selectedNodeId) ?? null : null}
            explanation={explanation}
            unconnected={unconnected}
            clockPins={selectedClockPins}
            wireLabel={selection?.kind === 'wire' || selection?.kind === 'net' ? describeRef(selection, nodeLabel, scene) : null}
            actions={inspectorActions}
            wireActions={wireActions}
          />
        </aside>
      </main>

      <footer className="mrd-status" data-testid="meridian-status">
        <span><strong>{describeRef(selection, nodeLabel, scene)}</strong></span>
        {unconnected.size && firstUnconnected ? (
          <button type="button" className="mrd-status-link" data-testid="meridian-unconnected-count"
            onClick={() => { selectNode(firstUnconnected.slice(0, firstUnconnected.lastIndexOf('.'))); setFrameRequest((n) => n + 1); }}>
            {unconnected.size} unconnected input{unconnected.size === 1 ? '' : 's'} · read as 0
          </button>
        ) : null}
        <span className="mrd-status-live" role="status" aria-live="polite" data-testid="meridian-wire-notice">{statusNotice ?? ''}</span>
        <span className="mrd-status-hint">{stage !== 'design' && recordingCursor ? '← → tick · [ ] steps inside a tick' : ''}</span>
        <div className="mrd-lens-switch" role="group" aria-label="Lenses">
          {LENS_KEYS.map((entry) => (
            <button key={entry.id} type="button" className="mrd-btn mrd-btn--small" aria-pressed={openLenses.includes(entry.id)}
              onClick={() => toggleLens(entry.id)} data-testid={`meridian-lens-toggle-${entry.id}`}>
              {LENS_TITLES[entry.id]} <kbd className="mrd-kbd">{entry.key}</kbd>
            </button>
          ))}
          <button type="button" className="mrd-btn mrd-btn--small" aria-pressed={inspectorOpen} onClick={() => setInspectorOpen((open) => !open)} data-testid="meridian-inspector-toggle">
            Inspector <kbd className="mrd-kbd">I</kbd>
          </button>
          <button type="button" className="mrd-btn mrd-btn--small" aria-pressed={showKeys} onClick={() => setShowKeys((open) => !open)}>
            Keys <kbd className="mrd-kbd">?</kbd>
          </button>
        </div>
      </footer>

      {showKeys ? (
        <div className="mrd-keys" role="dialog" aria-label="Keyboard shortcuts" data-testid="meridian-keys">
          <dl>
            {STUDIO_KEYMAP.map((binding) => (
              <React.Fragment key={binding.keys}>
                <dt>{binding.keys}</dt>
                <dd>{binding.action}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      ) : null}
    </>
  );
};
