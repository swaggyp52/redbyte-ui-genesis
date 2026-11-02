import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { connectionEndpoints } from '@redbyte/rb-logic-view';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { useEngineeringSelection } from '../engineeringSelection';
import { SchematicProjection } from './SchematicProjection';
import { buildRecordedCircuitGeometry, buildRecordedInstanceDrawing } from '../surfaces/verify/recordedCircuitGeometry';
import { deriveRecordedWordLanes } from '../surfaces/verify/recordedWordLanes';
import { journeyEvents, journeyValues, journeyExpression, journeySourceSpans, journeySignal, journeyInstanceKey,
  journeyLocalDrawing, journeyOverviewEndpoint, selectJourney, journeyChecks, journeyTransition,
  type BooleanTerm, type JourneyBoardRow, type JourneySelection } from '../signalJourney';
import type { RunScope } from '../runScope';
import { presentSignalJourney } from '../signalJourneyPresentation';
import './signal-journey.css';

type Lens = 'circuit' | 'logic' | 'table' | 'hdl' | 'board';
function Expression({ term, onSelect, expanded = false }: {
  term: BooleanTerm; onSelect: (id: string, port: string) => void; expanded?: boolean;
}) {
  if (!expanded || !term.children.length) return <span className="rb-journey-term">
    <button type="button" onClick={() => onSelect(term.nodeId, term.port)} data-journey-term={term.nodeId}
      title={term.stop ?? `Select ${term.label} · ${term.port}`}>{term.label}<code>{term.value ?? '?'}</code></button>
    {term.stop && <small>{term.stop}</small>}
  </span>;
  return <ExpressionBranch term={term} onSelect={onSelect} initiallyOpen />;
}
function ExpressionBranch({ term, onSelect, initiallyOpen = false }: {
  term: BooleanTerm; onSelect: (id: string, port: string) => void; initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return <div className="rb-journey-branch" data-journey-branch={term.nodeId}>
    <div><Expression term={term} onSelect={onSelect} />
      {term.children.length > 0 && <button type="button" aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Explore'} inputs of ${term.label}`} onClick={() => setOpen(value => !value)}>{open ? '−' : '+'} inputs</button>}
      {term.operator && <small>{({ '∧': 'AND', '∨': 'OR', '⊕': 'XOR', '¬∧': 'NAND', '¬∨': 'NOR', '¬⊕': 'XNOR', '¬': 'NOT' } as Record<string, string>)[term.operator] ?? 'connection'}</small>}
    </div>
    {open && <ul>{term.children.map((child, i) => <li key={`${child.nodeId}.${child.port}.${i}`}><ExpressionBranch term={child} onSelect={onSelect} /></li>)}</ul>}
  </div>;
}
/**
 * `currency` is the recording's scope against the design being edited (deriveRecordingScope);
 * `board` is its boundary set against the live pin mapping (journeyBoardBoundary). Both come
 * from the project's own authorities; without them the journey makes no claim either way.
 */
export function SignalJourney({ run, selection, onSignal, onTick, onReturn, currency, board }: {
  run: RuntimeVerifyRun; selection: JourneySelection; onSignal: (signal: string | null) => void;
  onTick: (tick: number) => void; onReturn: () => void;
  currency?: Pick<RunScope, 'kind' | 'detail'>; board?: readonly JourneyBoardRow[];
}) {
  const seek = useEngineeringSelection(state => state.seekJourney);
  const [lens, setLens] = useState<Lens>('circuit');
  const [scope, setScope] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [localFocus, setLocalFocus] = useState(false);
  const [casePage, setCasePage] = useState(0);
  const [sourcePage, setSourcePage] = useState(0);
  const [loadPage, setLoadPage] = useState(0);
  const sourceRef = useRef<HTMLPreElement>(null);
  const circuit = run.circuitSnapshot;
  const geometry = useMemo(() => buildRecordedCircuitGeometry(circuit?.nodes ?? []), [circuit]);
  const connections = useMemo(() => circuit?.connections.map(connectionEndpoints) ?? [], [circuit]);
  const events = useMemo(() => journeyEvents(run, selection), [run, selection.anchorNodeId, selection.nodeId, selection.tick]);
  const event = selection.eventOrder == null ? undefined : run.evaluationTrace?.events.find(e =>
    e.order === selection.eventOrder && e.context.tick === selection.tick);
  const values = useMemo(() => journeyValues(run, selection, event), [run, selection, event]);
  const node = circuit?.nodes.find(n => n.id === selection.nodeId);
  const focusNode = node;
  const focusPort = selection.port;
  const objectEvent = event?.nodeId === selection.nodeId ? event : undefined;
  const expression = useMemo(() => circuit && focusNode ? journeyExpression(circuit, focusNode.id, focusPort, values) : null, [circuit, focusNode, focusPort, values]);
  const eventIndex = events.findIndex(e => e.order === selection.eventOrder);
  const sample = run.waveform.find(s => s.tick === selection.tick);
  const selectedSignal = journeySignal(run, selection.nodeId, selection.port);
  const boundaryValue = selectedSignal ? sample?.signals[selectedSignal] : undefined;
  const mismatch = sample?.mismatches.find(m => m.signal === selectedSignal || run.executionInput?.ioRows.some(r => r.id === m.signal && r.nodeId === selection.nodeId));
  const words = useMemo(() => deriveRecordedWordLanes(run), [run]);
  const checks = useMemo(() => journeyChecks(run, selection.nodeId, selectedSignal), [run, selection.nodeId, selectedSignal]);
  const failedChecks = checks.filter(row => row.expected !== row.actual);
  const transition = journeyTransition(run, selectedSignal, selection.tick);
  const select = (id: string, port?: string) => {
    const pins = geometry.get(id)?.geometry.pins ?? [];
    const resolvedPort = port ?? pins.find(pin => pin.direction === 'out')?.id ?? pins[0]?.id ?? 'out';
    const ref = selectJourney(run, { nodeId: id, port: resolvedPort }, selection.tick);
    seek({ ...ref, anchorNodeId: selection.anchorNodeId, anchorPort: selection.anchorPort,
      eventOrder: selection.eventOrder }); onSignal(journeySignal(run, id, resolvedPort));
    setScope(journeyInstanceKey(run.elaborationSources, id)); setPlaying(false); setHover(null);
  };
  const seekTick = (tick: number) => { seek({ tick, eventOrder: null }); onTick(tick); setPlaying(false); setHover(null); };
  const revealEvent = (order: number) => {
    const next = run.evaluationTrace?.events.find(e => e.order === order && e.context.tick === selection.tick);
    if (!next) return;
    const ref = selectJourney(run, { nodeId: next.nodeId, port: Object.keys(next.outputs)[0] ?? 'out' }, selection.tick);
    seek({ ...ref, anchorNodeId: selection.anchorNodeId, anchorPort: selection.anchorPort, eventOrder: order });
    onSignal(journeySignal(run, ref.nodeId, ref.port)); setScope(null); setHover(null);
  };
  const step = (delta: number) => {
    const next = events[Math.max(0, Math.min(events.length - 1, eventIndex < 0 ? (delta > 0 ? 0 : events.length - 1) : eventIndex + delta))];
    if (next) revealEvent(next.order);
  };
  useEffect(() => { setPlaying(false); setScope(null); setCasePage(Math.max(0, Math.floor(run.waveform.findIndex(s => s.tick === selection.tick) / 50))); }, [run.runId, selection.tick]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const next = events[eventIndex + 1]; if (!next) { setPlaying(false); return; } revealEvent(next.order);
    }, 650);
    return () => window.clearInterval(timer);
  }, [playing, events, eventIndex, seek]);
  const scopes = useMemo(() => {
    const entries = new Map<string, { label: string; ids: string[] }>();
    for (const n of circuit?.nodes ?? []) {
      const key = journeyInstanceKey(run.elaborationSources, n.id), source = run.elaborationSources?.[n.id];
      entries.set(key, { label: source?.displayPath.join(' / ') || 'Top', ids: source?.instancePath ?? [] });
    }
    return [...entries].map(([key, value]) => ({ key, ...value }));
  }, [circuit, run.elaborationSources]);
  const activeScope = scope ?? journeyInstanceKey(run.elaborationSources, selection.nodeId);
  const overviewMode = scope === 'whole' || (!scope && activeScope === '[]' && !!run.hierarchySnapshot?.hierarchy?.modules.length);
  useEffect(() => { setLoadPage(0); }, [selection.nodeId, selection.port]);
  const drawing = useMemo<Circuit | null>(() => {
    if (!circuit) return null;
    if (localFocus) return journeyLocalDrawing(circuit, selection.nodeId).circuit;
    if (overviewMode) {
      const overview = run.hierarchySnapshot?.topCircuit ?? circuit;
      return overview.nodes.length <= 256 ? overview : null;
    }
    const ids = new Set(circuit.nodes.filter(n => journeyInstanceKey(run.elaborationSources, n.id) === activeScope).map(n => n.id));
    if (ids.size > 256) return null;
    const tagged = { ...circuit, nodes: circuit.nodes.map(n => ({ ...n, config: { ...n.config,
      hierarchyPath: ids.has(n.id) ? 'selected-instance' : 'neighbour' } })) };
    const instance = buildRecordedInstanceDrawing(tagged, 'selected-instance');
    return instance.nodes.length <= 256 ? instance : null;
  }, [circuit, activeScope, overviewMode, localFocus, selection.nodeId, run.hierarchySnapshot]);
  const drawingValues = useMemo(() => {
    const result = new Map(values);
    // The elaborator retained the actual definition boundary node ids. Map those pins
    // back onto the original instance symbol; never infer a bit from a friendly label.
    if (overviewMode && !localFocus) for (const instance of run.hierarchySnapshot?.topCircuit.nodes ?? []) {
      const definition = run.hierarchySnapshot?.hierarchy?.modules.find(m => m.id === instance.config?.moduleDefinitionId);
      for (const port of definition?.ports ?? []) {
        const boundary = port.sourceBoundary.internalRefs[0];
        if (!boundary) continue;
        const source = Object.entries(run.elaborationSources ?? {}).find(([, s]) => s.instancePath.length === 1
          && s.instancePath[0] === instance.id && s.localNodeId === boundary.nodeId);
        if (!source) continue;
        const value = values.get(`${source[0]}.${boundary.portName}`);
        if (value !== undefined) result.set(`${instance.id}.${port.name}`, value);
      }
    }
    return result;
  }, [values, overviewMode, localFocus, run.hierarchySnapshot, run.elaborationSources]);
  const correspondenceNode = selection.nodeId;
  const spans = journeySourceSpans(run, correspondenceNode), hdlSpan = spans[0];
  const hdlFile = run.generatedSource?.files.find(f => f.path === hdlSpan?.path);
  const currentInstance = run.elaborationSources?.[correspondenceNode];
  const sourceCandidates = run.generatedSource?.spans.filter(s => s.path === hdlFile?.path
    && s.definitionId === (currentInstance?.definitionId ?? 'top')) ?? [];
  useEffect(() => { setSourcePage(Math.floor(((hdlSpan?.startLine ?? 1) - 1) / 120)); }, [hdlFile?.path, hdlSpan?.startLine]);
  useEffect(() => {
    if (lens === 'hdl') sourceRef.current?.querySelector('.is-selected')?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [lens, hdlFile?.path, hdlSpan?.startLine, sourcePage]);
  const moveOnDrawing = (id: string) => {
    if (circuit?.nodes.some(n => n.id === id)) { select(id); return; }
    const candidates = Object.entries(run.elaborationSources ?? {}).filter(([, source]) => source.instancePath[0] === id);
    const chosen = candidates.find(([, source]) => source.localNodeId === currentInstance?.localNodeId) ?? candidates[0];
    if (chosen) { select(chosen[0]); setScope(journeyInstanceKey(run.elaborationSources, chosen[0])); }
  };
  const focusLabel = focusNode?.label ?? correspondenceNode;
  const selectedInput = geometry.get(selection.nodeId)?.geometry.pins.some(pin => pin.id === selection.port && pin.direction === 'in');
  const drivers = connections.filter(w => w.to.nodeId === selection.nodeId && (!selectedInput || w.to.port === selection.port));
  const loads = connections.filter(w => w.from.nodeId === selection.nodeId && !selectedInput && w.from.port === selection.port);
  const pins = geometry.get(selection.nodeId)?.geometry.pins ?? [];
  const retainedDefinition = run.hierarchySnapshot?.hierarchy?.modules.find(module => module.id === currentInstance?.definitionId);
  const localNode = retainedDefinition?.circuit.nodes.find(item => item.id === currentInstance?.localNodeId);
  const learning = node ? presentSignalJourney({ node: localNode ? { ...node, label: localNode.label } : node, source: currentInstance, selected: selection,
    observation: objectEvent, values, publishedValue: boundaryValue, revision: selection.revision,
    inputPorts: pins.filter(pin => pin.direction === 'in').map(pin => pin.id),
    outputPorts: pins.filter(pin => pin.direction === 'out').map(pin => pin.id),
    publication: event ? objectEvent?.commitPhase === 'after-capture' ? 'awaiting-common-publication' : 'evaluation' : 'published-sample' }) : null;
  if (learning && retainedDefinition) learning.node.stage = `${(retainedDefinition.displayName ?? retainedDefinition.name).replace(/([a-z])([A-Z])/g, '$1 $2')} · ${currentInstance?.displayPath.join(' / ')}`;
  const selectedWire = selectedInput ? connections.find(wire => wire.to.nodeId === selection.nodeId && wire.to.port === selection.port)?.wireId : null;
  const anchor = circuit?.nodes.find(n => n.id === (selection.anchorNodeId ?? selection.nodeId));
  const localDrawing = useMemo(() => circuit ? journeyLocalDrawing(circuit, selection.nodeId) : null, [circuit, selection.nodeId]);
  const sourceLines = useMemo(() => hdlFile?.text.split('\n') ?? [], [hdlFile]);
  const sourceStart = sourcePage * 120;
  const visibleSamples = run.waveform.slice(casePage * 50, (casePage + 1) * 50);
  return <section className="rb-signal-journey" data-testid="ide-signal-journey" data-run-id={selection.runId}
    data-revision={selection.revision} data-node-id={selection.nodeId} data-port={selection.port} data-tick={selection.tick} data-event={selection.eventOrder ?? 'sample'}
    data-active-node={correspondenceNode} data-phase={event?.evaluationPhase ?? 'published-sample'}
    aria-label="Signal Journey" tabIndex={0} onKeyDown={e => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    }}>
    <header className="rb-journey-heading"><div><span>Signal Journey · recorded playback · following {anchor?.label ?? 'selected signal'}</span>
      <strong>{learning?.node.title ?? focusLabel}<code>{values.get(`${selection.nodeId}.${selection.port}`) ?? '?'}</code></strong>
      <small>{learning?.node.stage || 'Whole circuit'} · Recording #{run.sequence ?? 'legacy'} · {run.scenarioName}{mismatch ? ` · expected ${mismatch.expected} · mismatch` : ''}</small></div>
      <details className="rb-journey-provenance"><summary>Recording details</summary><div>
        <p>This is a retained recording. Change inputs or cases in the experiment, then Run to make a new recording. Playback never runs the circuit.</p>
        <dl><dt>Revision</dt><dd><code>{selection.revision}</code></dd><dt>Node / port</dt><dd><code>{selection.nodeId} / {selection.port}</code></dd>
          <dt>Instance</dt><dd><code>{selection.instancePath.join(' / ') || 'top'}</code></dd><dt>Engine</dt><dd>{run.identity?.engine ?? 'unrecorded'}</dd>
          <dt>Captured step</dt><dd>{event?.order ?? 'published sample'} · {event?.context.phase ?? 'sample'} · {event?.evaluationPhase ?? 'sample'}</dd></dl>
        <p>Logical execution order · independent gates may share a boundary · no physical delay is established.</p>
        <p>{run.evaluationTrace?.events.length ?? 0} captured evaluations · {run.evaluationTrace?.status ?? 'samples only'}</p>
      </div></details>
      <button type="button" className="wb-btn" onClick={() => { setPlaying(false); onReturn(); }} data-testid="ide-journey-return">Return to experiment</button></header>
    <div className="rb-journey-evidence" data-testid="ide-journey-evidence">
      {currency && currency.kind !== 'none' && <p className={`rb-journey-currency is-${currency.kind}`} data-testid="ide-journey-currency" data-currency={currency.kind}>
        {currency.kind === 'current' ? <><strong>Current recording</strong><span>It matches the design you are editing.</span></>
          : <><strong>Historical recording</strong><span>{currency.detail ?? 'The project changed after this recording.'} Values here are what this recording observed, not your current design. Return to the experiment and Run to record it again.</span></>}
      </p>}
      <p data-testid="ide-journey-transition" data-value={transition.value ?? 'unrecorded'} data-since={transition.since ?? ''}>
        {selectedSignal === null ? <>This object is not a recorded lane; its values come from the captured evaluation.</>
          : transition.value === null ? <>No sample of this signal at t{selection.tick}.</>
          : transition.previous === null ? <><code>{transition.value}</code> from the first recorded moment through t{selection.tick}</>
          : <><code>{transition.previous}</code> → <code>{transition.value}</code> at <button type="button" onClick={() => seekTick(transition.since!)}>t{transition.since}</button>{transition.since !== selection.tick ? `, unchanged through t${selection.tick}` : ''}</>}
      </p>
      <p data-testid="ide-journey-checks" data-checks={checks.length} data-failed={failedChecks.length}>
        {checks.length === 0 ? 'No authored check judges this signal.'
          : failedChecks.length === 0 ? `${checks.length} check${checks.length === 1 ? '' : 's'} on this signal · all match`
          : <>{checks.length} check{checks.length === 1 ? '' : 's'} on this signal · <strong>{failedChecks.length} mismatch{failedChecks.length === 1 ? '' : 'es'}</strong> · first at <button type="button" onClick={() => seekTick(failedChecks[0].tick)}>t{failedChecks[0].tick}</button>: expected {failedChecks[0].expected}, observed {failedChecks[0].actual}</>}
      </p>
    </div>
    <div className="rb-journey-toolbar"><nav aria-label="Connected representations">{(['circuit', 'logic', 'table', 'hdl', 'board'] as const).map(item =>
      <button type="button" key={item} aria-pressed={lens === item} onClick={() => { setLens(item); setPlaying(false); }}>{item === 'hdl' ? 'Generated HDL' : item === 'table' ? (run.schedule === 'combinational' ? 'Case table' : 'Recorded time') : item === 'logic' ? 'Logic' : item === 'board' ? 'Board boundary' : 'Circuit'}</button>)}</nav>
      <label>Moment <select value={selection.tick} onChange={e => seekTick(Number(e.target.value))}>{run.waveform.map((s, i) => <option key={s.tick} value={s.tick}>{run.schedule === 'combinational' ? `Case ${i + 1} · ` : ''}t{s.tick}</option>)}</select></label>
      <button type="button" onClick={() => { seek({ eventOrder: null }); setPlaying(false); }}>Published sample</button></div>
    <div className="rb-journey-playback" aria-label="Evaluation playback"><button type="button" onClick={() => step(-1)} disabled={!events.length || eventIndex === 0}>Previous evaluation</button>
      <button type="button" onClick={() => setPlaying(p => !p)} disabled={!events.length} aria-pressed={playing}>{playing ? 'Pause' : 'Play evaluations'}</button>
      <button type="button" onClick={() => step(1)} disabled={!events.length || eventIndex === events.length - 1}>Next evaluation</button>
      <span>{event ? `${playing ? 'Playing' : 'Paused'} · step ${eventIndex >= 0 ? eventIndex + 1 : 'outside selected path'} of ${events.length} · ${learning?.phase.label ?? 'evaluation'}` : 'Recorded result · select a gate or step through its evaluation'}</span>
      <small>{event ? 'Captured steps, not physical delay' : `Published sample t${selection.tick}`}</small></div>
    {!run.evaluationTrace && <p className="rb-journey-notice">This recording retained samples only. Enable evaluation steps and Run to make a new recording; this recording stays available.</p>}
    {run.evaluationTrace?.status !== 'complete' && run.evaluationTrace && <p className="rb-journey-notice">Evaluation trace {run.evaluationTrace.status}: {run.evaluationTrace.unavailableReason ?? 'capture limit reached; published samples remain available'}.</p>}
    {(lens === 'circuit' || lens === 'logic') && <div className={`rb-journey-atlas${lens === 'logic' ? ' is-logic-primary' : ''}`}>
      <section className="rb-journey-drawing"><div className="rb-journey-drawing-tools"><label>Instance <select value={overviewMode ? 'whole' : activeScope} onChange={e => { setScope(e.target.value); setLocalFocus(false); }}>
        <option value="whole">Whole circuit</option>{scopes.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
        <button type="button" onClick={() => { setScope('whole'); setEnlarged(false); setLocalFocus(false); }}>Overview</button>
        <button type="button" onClick={() => setEnlarged(v => !v)}>{enlarged ? 'Fit' : 'Enlarge'}</button>
        {localFocus && <small>Selected connection focus</small>}
        <small>Select a gate or connection</small></div>
        <div className={`rb-journey-sheet${enlarged ? ' is-enlarged' : ''}`} onPointerLeave={() => setHover(null)} data-preview-node={hover ?? ''}>
          {drawing ? <SchematicProjection circuit={drawing} ariaLabel="Retained Signal Journey schematic" values={drawingValues} modules={run.hierarchySnapshot?.hierarchy?.modules}
            selectedNodeId={hover ?? (overviewMode && !localFocus && currentInstance?.instancePath.length ? currentInstance.instancePath[0] : correspondenceNode)} selectedWireId={selectedWire}
            onSelectWire={id => {
              const wire = drawing.connections.map(connectionEndpoints).find(w => w.wireId === id);
              if (!wire) return;
              const endpoint = overviewMode && !localFocus
                ? journeyOverviewEndpoint(run, wire.from.nodeId, wire.from.port) ?? journeyOverviewEndpoint(run, wire.to.nodeId, wire.to.port)
                : { nodeId: wire.to.nodeId, port: wire.to.port };
              if (endpoint) select(endpoint.nodeId, endpoint.port);
            }}
            onSelectNode={moveOnDrawing} onOpenNode={moveOnDrawing} /> : <div className="rb-journey-fallback"><h3>This view is larger than the drawing limit</h3><p>More than 256 nodes. Enter a smaller module or focus the selected connection. Captured values, cases and source remain available.</p><button type="button" onClick={() => setLocalFocus(true)}>Focus selected connection</button></div>}
          {localFocus && <p className="rb-journey-focus-note">Local focus · {drawing?.nodes.length} nodes · {localDrawing?.omittedNodes} other nodes and {localDrawing?.omittedConnections} connections outside this view. Follow a connection to move the focus.</p>}</div>
        <div className="rb-journey-connections"><span>Follow driver</span>{drivers.map((w, i) => <button type="button" key={i} onPointerEnter={() => setHover(w.from.nodeId)} onPointerLeave={() => setHover(null)} onClick={() => select(w.from.nodeId, w.from.port)}>{circuit?.nodes.find(n => n.id === w.from.nodeId)?.label ?? w.from.nodeId} · {w.from.port}</button>)}
          <span>Follow load</span>{loads.slice(loadPage * 24, (loadPage + 1) * 24).map((w, i) => <button type="button" key={i} onClick={() => select(w.to.nodeId, w.to.port)}>{circuit?.nodes.find(n => n.id === w.to.nodeId)?.label ?? w.to.nodeId} · {w.to.port}</button>)}
          {loads.length > 24 && <div className="rb-journey-pages"><span>Loads {loadPage * 24 + 1}–{Math.min((loadPage + 1) * 24, loads.length)} of {loads.length}</span>
            <button type="button" disabled={loadPage === 0} onClick={() => setLoadPage(p => p - 1)}>Previous loads</button><button type="button" disabled={(loadPage + 1) * 24 >= loads.length} onClick={() => setLoadPage(p => p + 1)}>Next loads</button></div>}</div>
      </section>
      <aside className="rb-journey-rule"><span>{selectedInput ? 'SELECTED CONNECTION' : learning?.phase.label ?? 'Recorded values'}</span><h3>{learning?.node.title ?? focusLabel}</h3>
        <p>{learning?.node.stage || 'Whole circuit'}</p>
        {selectedInput ? <div className="rb-journey-understand" data-testid="ide-journey-understand"><strong>Input {selection.port} = {values.get(`${selection.nodeId}.${selection.port}`) ?? '?'}</strong>
          <p>{drivers.length === 1 ? `Read from ${circuit?.nodes.find(n => n.id === drivers[0].from.nodeId)?.label ?? 'its driver'}.` : drivers.length ? 'Multiple drivers: an exact explanation is unavailable.' : 'No recorded driver.'}</p>
          {pins.some(pin => pin.direction === 'out') ? <button type="button" onClick={() => select(selection.nodeId)}>Inspect gate output</button>
            : drivers.length === 1 && <button type="button" onClick={() => select(drivers[0].from.nodeId, drivers[0].from.port)}>Inspect driving gate</button>}</div> : <div className="rb-journey-understand" data-testid="ide-journey-understand">
          <strong>{learning?.sequential && learning.sequential.kind !== 'unavailable' ? learning.sequential.label : learning?.rule.text ?? 'Values unavailable at this step'}</strong>
          <p>{learning?.outcome.text}</p>
          {learning?.sequential && <p>{learning.sequential.reason}</p>}
          <dl>{learning?.inputs.map(input => <div key={input.key}><dt>{input.label}</dt><dd><code>{input.value.text}</code></dd></div>)}</dl>
          <div className="rb-journey-state" data-testid="ide-journey-canonical-outputs">{learning?.outputs.filter(output => output.role !== 'metadata').map(output => <div key={output.key} data-output-ports={output.ports.join(',')}>
            <span>{output.label}</span><code>{objectEvent ? `${output.previousValue?.text ?? '?'} → ` : ''}{output.value.text}</code></div>)}</div>
          {objectEvent?.commitPhase === 'after-capture' && <p>Captured result shown here; the circuit still shows the previous output until all registers publish together.</p>}
          {!objectEvent && event && <small>This gate has no observation at the paused step. Values shown belong to that step; its change is unrecorded here.</small>}
          {learning?.notices.map(notice => <p key={notice}>{notice}</p>)}
        </div>}
        {expression?.children.length ? <details open={lens === 'logic'}><summary>Explore the input logic</summary><Expression term={expression} onSelect={select} expanded /></details> : null}
        <details className="rb-journey-execution-details"><summary>Connection and execution details</summary>
        <p>{objectEvent ? `${objectEvent.context.phase} · ${objectEvent.evaluationPhase} · event ${objectEvent.order}` : `Published sample t${selection.tick}`}</p>
        {expression && <div className="rb-journey-expression"><strong>{expression.label} = </strong>{expression.operator?.startsWith('¬') && '¬('}
          {expression.children.length ? expression.children.map((child, i) => <React.Fragment key={`${child.nodeId}.${child.port}.${i}`}>
            {i > 0 && <b className="rb-journey-operator">{expression.operator?.replace('¬', '') || '→'}</b>}<Expression term={child} onSelect={select} />
          </React.Fragment>) : <Expression term={expression} onSelect={select} />}{expression.operator?.startsWith('¬') && ')'}<strong> = {expression.value ?? '?'}</strong></div>}
        {objectEvent && <><dl>{objectEvent.inputReads.map((read, i) => <div key={i}><dt>{read.portName}</dt><dd><code>{String(read.value)}</code><small>{read.origin}</small></dd></div>)}</dl>
          <p className="rb-journey-transition">{Object.entries(objectEvent.outputs).map(([port, value]) => <code key={port}>{port}: {String(objectEvent.previousOutputs[port] ?? 'unrecorded')} → {String(value)}{objectEvent.commitPhase === 'after-capture' ? ' · pending shared commit' : ''}</code>)}</p>
          <p>{objectEvent.evaluationPhase === 'capture' ? 'Storage evaluation at the common capture boundary.' : JSON.stringify(objectEvent.previousOutputs) === JSON.stringify(objectEvent.outputs) ? 'Output unchanged despite this evaluation.' : 'Output evaluated from the inputs above.'}</p>
          </>}
        <small>Read-only retained topology. Registers stop the expression. ? means unrecorded at this phase. Derived logic does not author expected checks.</small></details>
        {objectEvent && /Register|FlipFlop|StateBank|Latch/i.test(objectEvent.nodeType) && <details><summary>Recorded state before / after</summary><code>{JSON.stringify(objectEvent.stateBefore)} → {JSON.stringify(objectEvent.stateAfter)}</code></details>}
      </aside>
    </div>}
    {lens === 'table' && <div className="rb-journey-table"><p>Published samples at the selected case or clock moment. Intermediate evaluations stay paused separately above.</p>
      {run.schedule !== 'combinational' && selectedSignal && <div className="rb-journey-waveform" aria-label={`Recorded waveform ${node?.label}`}>
        {visibleSamples.map(s => <button type="button" key={s.tick} onClick={() => seekTick(s.tick)} aria-pressed={s.tick === selection.tick} data-value={s.signals[selectedSignal] ?? 'unrecorded'}>
          <span>t{s.tick}</span><code>{s.signals[selectedSignal] ?? '?'}</code></button>)}</div>}
      <table><caption>{run.schedule === 'combinational' ? `${run.waveform.length} cases` : `${run.waveform.length} samples`} · {run.report.rows.length} authored checks</caption>
        <thead><tr><th>Moment</th><th>{node?.label}</th>{words.map(w => <th key={w.id}>{w.label} · binary / decimal</th>)}<th>Expected</th><th>Check</th></tr></thead>
        <tbody>{visibleSamples.map((s, i) => {
          const value = selectedSignal ? s.signals[selectedSignal] : undefined;
          const row = checks.find(r => r.tick === s.tick);
          return <tr key={s.tick} aria-selected={s.tick === selection.tick}><td><button type="button" onClick={() => seekTick(s.tick)}>{run.schedule === 'combinational' ? `Case ${casePage * 50 + i + 1} · ` : ''}t{s.tick}</button></td><td><code>{value ?? 'unrecorded'}</code></td>
            {words.map(w => { const word = w.valueByTick.get(s.tick); return <td key={w.id}><code>{word ? `${word.bits} / ${word.value}` : 'unrecorded'}</code></td>; })}
            <td>{row?.expected ?? 'no check'}</td><td>{row ? row.expected === row.actual ? 'match' : 'mismatch' : 'recorded'}</td></tr>;
        })}</tbody></table>
      {run.waveform.length > 50 && <nav className="rb-journey-pages" aria-label="Recorded cases pages"><button type="button" data-testid="ide-journey-cases-previous" disabled={casePage === 0} onClick={() => setCasePage(p => p - 1)}>Previous cases</button>
        <span>Showing {casePage * 50 + 1}–{Math.min((casePage + 1) * 50, run.waveform.length)} of {run.waveform.length} recorded moments</span><button type="button" data-testid="ide-journey-cases-next" disabled={(casePage + 1) * 50 >= run.waveform.length} onClick={() => setCasePage(p => p + 1)}>Next cases</button></nav>}
      </div>}
    {lens === 'hdl' && <div className="rb-journey-source"><p>Generated source · {hdlFile?.path ?? 'no exact correspondence'} · {learning?.node.stage || 'Whole circuit'} · {learning?.node.title ?? focusLabel}</p>
      <small>Source identifies this object; it does not represent an intermediate signal value.</small>
      {!hdlFile ? <p>This recording has no emitter source map for this object. Authored/imported HDL correspondence is unavailable.</p> : <>
        <div className="rb-journey-mapped-source" data-testid="ide-journey-mapped-source"><strong>{hdlFile.path}:{hdlSpan.startLine}–{hdlSpan.endLine}</strong><code>{hdlFile.text.split('\n').slice(hdlSpan.startLine - 1, hdlSpan.endLine).join('\n')}</code></div>
        {sourceLines.length > 120 && <nav className="rb-journey-pages" aria-label="Generated source pages"><button type="button" data-testid="ide-journey-source-previous" disabled={sourcePage === 0} onClick={() => setSourcePage(p => p - 1)}>Previous lines</button>
          <span>Lines {sourceStart + 1}–{Math.min(sourceStart + 120, sourceLines.length)} of {sourceLines.length}</span><button type="button" data-testid="ide-journey-source-selected" onClick={() => setSourcePage(Math.floor((hdlSpan.startLine - 1) / 120))}>Selected assignment</button>
          <button type="button" data-testid="ide-journey-source-next" disabled={sourceStart + 120 >= sourceLines.length} onClick={() => setSourcePage(p => p + 1)}>Next lines</button></nav>}
        <pre ref={sourceRef}>{sourceLines.slice(sourceStart, sourceStart + 120).map((line, offset) => {
          const i = sourceStart + offset;
          const matches = sourceCandidates.filter(s => s.startLine <= i + 1 && s.endLine >= i + 1), source = matches.length === 1 ? matches[0] : null;
          const id = source ? Object.entries(run.elaborationSources ?? {}).find(([, s]) => s.definitionId === source.definitionId && s.localNodeId === source.nodeId && JSON.stringify(s.instancePath) === JSON.stringify(currentInstance?.instancePath ?? []))?.[0] ?? (selection.instancePath.length === 0 ? source.nodeId : null) : null;
          return <span className={i + 1 >= hdlSpan.startLine && i + 1 <= hdlSpan.endLine ? 'is-selected' : ''} key={i}>{id ? <button type="button" onClick={() => select(id)} aria-label={`Select source object at line ${i + 1}`}><b>{i + 1}</b>{line}</button> : <><b>{i + 1}</b>{line}</>}</span>;
        })}</pre></>}</div>}
    {lens === 'board' && <div className="rb-journey-board"><h3>Recorded board boundary</h3><p>Board resources from this recording, set against the project's pin mapping now · {event ? 'values visible at the paused evaluation phase' : `published simulated sample at t${selection.tick}`} · browser simulation, no physical board observation.</p>
      <table><thead><tr><th>Signal</th><th>Recorded on</th>{board && <th>Mapped now</th>}<th>{event ? 'Paused phase value' : `Published value at t${selection.tick}`}</th></tr></thead><tbody>{(board ?? run.executionInput?.ioRows.map(row => ({
        id: row.id, label: row.label, nodeId: row.nodeId ?? null, port: row.port || (row.direction === 'in' ? 'out' : 'in'), direction: row.direction,
        recorded: row.pin ? { pin: row.pin, resource: null } : null, current: null, removed: false, changed: false })) ?? []).map(row => {
        const value = row.nodeId ? values.get(`${row.nodeId}.${row.port}`) : undefined;
        const where = (assignment: JourneyBoardRow['recorded']) => assignment ? `${assignment.resource ? `${assignment.resource} · ` : ''}${assignment.pin}` : 'unassigned';
        return <tr key={row.id} aria-selected={row.nodeId === selection.nodeId} data-testid={`ide-journey-board-row-${row.id}`} data-changed={row.changed ? 'true' : 'false'}>
          <td><button type="button" onClick={() => row.nodeId && select(row.nodeId, row.port)}>{row.label}</button></td><td>{where(row.recorded)}</td>
          {board && <td>{row.removed ? 'no longer a boundary signal' : row.changed ? <strong>{where(row.current)} · changed since this recording</strong> : `${where(row.current)} · same`}</td>}
          <td><code>{value ?? 'unrecorded at this phase'}</code></td></tr>;
      })}</tbody></table></div>}
  </section>;
}
