import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  routeCircuit, unionBounds, routeBounds, placeSchematicLabels,
  SchematicNodeView, SchematicWireView, DEFAULT_SCHEMATIC_LAYERS,
} from '@redbyte/rb-logic-view';
import type { RuntimeVerifyRun } from '../../projectRuntime';
import { WhyInspectorPanel } from './WhyInspectorPanel';
import type { SignalExplanation } from './signalExplainer';
import './recorded-circuit.css';
import '../design/design-schematic.css';
import { buildRecordedCircuitGeometry, buildRecordedInstanceDrawing, recordedFanInRegion, recordedGateReadout, recordedInspectionGate } from './recordedCircuitGeometry';

/** Smallest region the signal view shows, in drawing units. */
const FOCUS_MIN_WIDTH = 360;
const FOCUS_MIN_HEIGHT = 240;

interface Props {
  circuit: Circuit | null;
  run: RuntimeVerifyRun;
  tick: number | null;
  signal: string | null;
  explanation: SignalExplanation | null;
  resolveSignal: (nodeId: string, port: string) => string | null;
  onSelectSignal: (signal: string) => void;
  onSelectTick?: (tick: number) => void;
  onClose: () => void;
  onEdit?: () => void;
}

/** Pure recorded presentation: the same symbols and router as Design, with no engine or
 * authoring store. Its camera is local to this inspection, and every value is a recorded sample. */
export function RecordedCircuitInspector({ circuit, run, tick, signal, explanation, resolveSignal, onSelectSignal, onSelectTick, onClose, onEdit }: Props) {
  const [scope, setScope] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [fitRatio, setFitRatio] = useState(1.12);
  const fitRatioRef = useRef(1.12);
  const frameRef = useRef<(() => void) | null>(null);
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const cameraTouched = useRef(false);
  const [framingRequest, requestFraming] = useState(0);
  useEffect(() => { setSelectedGateId(null); }, [signal, run.runId]);
  // The pane is too small to read a whole schematic in. It opens on the part of the recording
  // the selected signal touches - its own symbols and the ones wired to them - drawn large
  // enough to read; the whole circuit is one press away and nothing is removed from it.
  const [region, setRegion] = useState<'signal' | 'whole'>('signal');
  const sample = run.waveform.find((entry) => entry.tick === tick);
  const scopes = useMemo(() => Array.from(new Set((circuit?.nodes ?? []).map((node) =>
    typeof node.config?.hierarchyPath === 'string' ? node.config.hierarchyPath : 'top',
  ))).sort(), [circuit]);
  const selectedNodes = useMemo(() => new Set((circuit?.nodes ?? []).filter((node) => {
    const geometry = buildRecordedCircuitGeometry([node]).get(node.id)?.geometry;
    return geometry?.pins.some((pin) => resolveSignal(node.id, pin.id) === signal);
  }).map((node) => node.id)), [circuit, resolveSignal, signal]);
  const selectedNode = circuit?.nodes.find((node) => selectedNodes.has(node.id));
  const connectedRegion = useMemo(() => {
    const roots = new Set(selectedNodes);
    if (selectedGateId) roots.add(selectedGateId);
    return circuit ? recordedFanInRegion(circuit, roots) : new Set<string>();
  }, [circuit, selectedNodes, selectedGateId]);
  const initialGate = circuit ? recordedInspectionGate(circuit, selectedNodes) : undefined;
  const selectedScope = typeof selectedNode?.config?.hierarchyPath === 'string' ? selectedNode.config.hierarchyPath : 'top';
  const activeScope = scope && scopes.includes(scope) ? scope : selectedScope;
  const drawing = useMemo<Circuit>(() => {
    if (!circuit) return { nodes: [], connections: [] };
    if (scopes.length < 2) return circuit;
    return buildRecordedInstanceDrawing(circuit, activeScope);
  }, [circuit, scopes.length, activeScope]);
  const gate = drawing.nodes.find(node => node.id === selectedGateId)
    ?? drawing.nodes.find(node => node.id === initialGate?.id);
  const gateReadout = gate ? recordedGateReadout(gate, run.waveform, tick, resolveSignal) : null;
  const geometry = useMemo(() => buildRecordedCircuitGeometry(drawing.nodes), [drawing]);
  const nets = useMemo(() => routeCircuit(drawing, geometry), [drawing, geometry]);
  const labels = useMemo(() => placeSchematicLabels(geometry, nets), [geometry, nets]);
  const bounds = useMemo(() => {
    const nodes = unionBounds(geometry.values());
    const wires = routeBounds(nets);
    if (!nodes) return { minX: 0, minY: 0, maxX: 400, maxY: 260 };
    const labelBounds = [...labels.values()].map(label => label.bounds);
    return {
      minX: Math.min(nodes.minX, wires?.minX ?? nodes.minX, ...labelBounds.map(label => label.minX)),
      minY: Math.min(nodes.minY, wires?.minY ?? nodes.minY, ...labelBounds.map(label => label.minY)),
      maxX: Math.max(nodes.maxX, wires?.maxX ?? nodes.maxX, ...labelBounds.map(label => label.maxX)),
      maxY: Math.max(nodes.maxY, wires?.maxY ?? nodes.maxY, ...labelBounds.map(label => label.maxY)),
    };
  }, [geometry, nets, labels]);
  const focusBounds = useMemo(() => {
    if (selectedNodes.size === 0) return null;
    // The symbols the signal is on: its source and everything it feeds.
    const nearby = new Set(selectedNodes);
    if (gate) {
      nearby.add(gate.id);
      for (const net of nets) for (const wire of net.wires) {
        if (wire.toNodeId === gate.id) nearby.add(wire.fromNodeId);
        if (wire.fromNodeId === gate.id) nearby.add(wire.toNodeId);
      }
    }
    const symbols = unionBounds(Array.from(geometry.values()).filter((entry) => nearby.has(entry.node.id)));
    if (!symbols) return null;
    const labelBounds = [...labels.entries()].filter(([id]) => nearby.has(id)).map(([, label]) => label.bounds);
    const touched = {
      minX: Math.min(symbols.minX, ...labelBounds.map(label => label.minX)),
      minY: Math.min(symbols.minY, ...labelBounds.map(label => label.minY)),
      maxX: Math.max(symbols.maxX, ...labelBounds.map(label => label.maxX)),
      maxY: Math.max(symbols.maxY, ...labelBounds.map(label => label.maxY)),
    };
    // Never closer than a comfortable working scale: a single small symbol is shown with the
    // sheet around it rather than blown up to fill the pane.
    const growX = Math.max(0, (FOCUS_MIN_WIDTH - (touched.maxX - touched.minX)) / 2);
    const growY = Math.max(0, (FOCUS_MIN_HEIGHT - (touched.maxY - touched.minY)) / 2);
    const focused = { minX: touched.minX - growX, maxX: touched.maxX + growX, minY: touched.minY - growY, maxY: touched.maxY + growY };
    // When the region spans most of the drawing, keep its full context at a readable
    // working scale. Whole circuit still provides the separate fit-to-pane overview.
    const whole = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
    const part = (focused.maxX - focused.minX) * (focused.maxY - focused.minY);
    return part >= whole * 0.8 ? bounds : focused;
  }, [bounds, geometry, selectedNodes, gate, nets, labels]);
  const shown = region === 'signal' && focusBounds ? focusBounds : bounds;
  const values = useMemo(() => {
    const result = new Map<string, 0 | 1 | 'X' | 'Z'>();
    if (!sample) return result;
    for (const [id, entry] of geometry) {
      for (const pin of entry.geometry.pins) {
        const key = resolveSignal(id, pin.id);
        const value = key ? sample.signals[key] : undefined;
        if (value === '0' || value === '1') result.set(`${id}.${pin.id}`, Number(value) as 0 | 1);
        else if (value === 'X' || value === 'Z') result.set(`${id}.${pin.id}`, value);
      }
    }
    return result;
  }, [geometry, resolveSignal, sample]);
  const selectPort = (nodeId: string, port: string) => {
    const key = resolveSignal(nodeId, port);
    if (key) { setScope(null); onSelectSignal(key); }
  };
  const camera = { x: 0, y: 0, zoom: 1 };
  const width = shown.maxX - shown.minX + 96;
  const height = shown.maxY - shown.minY + 96;
  useEffect(() => {
    // Keep an untouched focused gate visible as the pane changes size. A wheel, scrollbar,
    // keyboard scroll or Enlarge is an explicit camera choice and stops that resize framing.
    const sheet = sheetRef.current;
    const entry = gate ? geometry.get(gate.id) : undefined;
    const svg = sheet?.querySelector('svg');
    if (!sheet || !svg) return;
    const pane = sheet.parentElement;
    cameraTouched.current = false;
    let pendingFrame = 0;
    const frame = () => {
      if (cameraTouched.current) return;
      if (!entry || region !== 'signal' || !focusBounds) {
        sheet.scrollLeft = 0; sheet.scrollTop = 0;
        if (pane) pane.scrollTop = 0;
        return;
      }
      if (pane) pane.scrollTop = 0;
      const sheetBox = sheet.getBoundingClientRect();
      const visibleHeight = Math.min(sheetBox.bottom, pane?.getBoundingClientRect().bottom ?? sheetBox.bottom) - sheetBox.top;
      const symbolHeight = entry.geometry.body.maxY - entry.geometry.body.minY;
      const fitted = Math.min(1.12, Math.max(0.25, (visibleHeight - 24) / Math.max(1, symbolHeight)));
      if (Math.abs(fitted - fitRatioRef.current) > 0.001) {
        fitRatioRef.current = fitted;
        setFitRatio(fitted);
        pendingFrame = requestAnimationFrame(frame);
        return;
      }
      const ratio = svg.getBoundingClientRect().width / width;
      sheet.scrollLeft = Math.max(0, (entry.x - shown.minX + 48) * ratio - sheet.clientWidth / 2);
      sheet.scrollTop = Math.max(0, (entry.y - shown.minY + 48) * ratio - Math.max(1, visibleHeight) / 2);
    };
    frameRef.current = frame;
    frame();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(frame);
    observer?.observe(sheet);
    if (pane) observer?.observe(pane);
    return () => {
      observer?.disconnect(); cancelAnimationFrame(pendingFrame);
      if (frameRef.current === frame) frameRef.current = null;
    };
  }, [gate?.id, geometry, region, focusBounds, shown.minX, shown.minY, width, framingRequest]);
  // Re-center after React commits a fitted drawing size, using its actual pixels.
  useEffect(() => { frameRef.current?.(); }, [fitRatio]);
  return (
    <aside className="rb-recorded-circuit rb-sim-inspector" data-testid="ide-recorded-circuit" aria-label="Recorded circuit investigation">
      <div className="rb-recorded-circuit-heading">
      <header>
        <strong>Recorded circuit</strong>
        <button type="button" onClick={onClose} aria-label="Close circuit investigation">Close</button>
      </header>
      <div className="rb-recorded-circuit-context" data-testid="ide-recorded-circuit-context">
        <span>Recording {run.sequence ?? run.runId ?? run.reportHash.slice(0, 8)} · {tick === null ? 'select a sample' : `t${tick}`} · {signal ?? 'select a signal'}</span>
      </div>
        {circuit && <div className="rb-recorded-circuit-tools">
          {scopes.length > 1 && <label>Instance <select aria-label="Recorded module instance" value={activeScope} onChange={(event) => { setScope(event.target.value); setScale(1); }}>
            {scopes.map((name) => <option key={name} value={name}>{name}</option>)}
          </select></label>}
          <div className="rb-recorded-circuit-region" role="group" aria-label="Region shown">
            <button type="button" aria-pressed={region === 'signal' && Boolean(focusBounds)} disabled={!focusBounds}
              onClick={() => { setRegion('signal'); setScale(1); }} data-testid="ide-recorded-circuit-region-signal"
              title={focusBounds ? 'Show the symbols this signal touches, large enough to read' : 'This signal already involves most of the circuit'}>
              Around {signal ?? 'signal'}
            </button>
            <button type="button" aria-pressed={region === 'whole' || !focusBounds}
              onClick={() => { setRegion('whole'); setScale(1); }} data-testid="ide-recorded-circuit-region-whole">
              Whole circuit
            </button>
          </div>
          <button type="button" onClick={() => { setScale(1); requestFraming(value => value + 1); }}>Fit circuit</button>
          <button type="button" onClick={() => { cameraTouched.current = true; setScale((value) => Math.min(4, value + 0.5)); }}>Enlarge</button>
        </div>}
      </div>
      {!circuit ? (
        <p className="rb-recorded-circuit-unavailable" role="status">This recording has no matching circuit snapshot. Its waveform remains available. Rerun the current design to investigate it with its circuit.</p>
      ) : <>
        {gate && gateReadout && <section className="rb-recorded-gate" data-testid="ide-recorded-gate" data-node-id={gate.id} aria-label="Recorded gate values">
          <header><strong>{gate.label ?? gate.id}</strong><span>{gate.type} · recorded at {tick == null ? '—' : `t${tick}`}</span></header>
          <div className="rb-recorded-gate-pins">
            {(['in', 'out'] as const).map(direction => <div key={direction}><span>{direction === 'in' ? 'Inputs' : 'Outputs'}</span>
              <dl>{gateReadout.pins.filter(pin => pin.direction === direction).map(pin => <div key={pin.id} data-recorded-pin={pin.id}>
                <dt>{pin.name}</dt><dd><code>{pin.value ?? 'unrecorded'}</code></dd>
              </div>)}</dl></div>)}
          </div>
          {gateReadout.derived && <p data-testid="ide-recorded-local-rule">Derived local rule · <code>{gateReadout.derived}</code></p>}
          {gateReadout.sequential && <div className="rb-recorded-gate-state" data-testid="ide-recorded-gate-state">
            {gateReadout.previousTick != null ? <><span>Sampled state · prior t{gateReadout.previousTick} → t{tick}</span>
              {gateReadout.outputs.map(pin => <code key={pin.id}>{pin.name}: {pin.previous ?? 'unrecorded'} → {pin.value ?? 'unrecorded'}</code>)}</> : <span>No prior sample retained.</span>}
            {gateReadout.clockEdge && <span>Sampled clock: {gateReadout.clockEdge} at t{tick}</span>}
          </div>}
        </section>}
        <div ref={sheetRef} className="rb-recorded-circuit-sheet" tabIndex={0} aria-label="Recorded schematic; scroll to inspect enlarged circuit"
          onWheel={() => { cameraTouched.current = true; }} onPointerDown={() => { cameraTouched.current = true; }}
          onKeyDown={event => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cameraTouched.current = true; }}>
          <svg className="rb-schematic" data-renderer="schematic" data-testid="ide-recorded-circuit-svg" role="group" aria-label={`Circuit recorded for ${run.scenarioName}`} data-region={region === 'signal' && focusBounds ? 'signal' : 'whole'} viewBox={`${shown.minX - 48} ${shown.minY - 48} ${width} ${height}`} style={{ width: region === 'signal' && focusBounds ? `${width * fitRatio * scale}px` : `${scale * 100}%`, height: 'auto' }}>
            {nets.flatMap((net) => net.wires.map((wire) => <g key={wire.wireId} className={!connectedRegion.has(wire.toNodeId) && connectedRegion.size ? 'is-unrelated' : undefined} data-recorded-wire-value={values.get(`${wire.fromNodeId}.${wire.fromPort}`) ?? 'unrecorded'}>
              <title>{resolveSignal(wire.fromNodeId, wire.fromPort) ?? 'Unmapped wire'} = {values.get(`${wire.fromNodeId}.${wire.fromPort}`) ?? 'unrecorded'}</title>
              <SchematicWireView wire={wire} camera={camera}
              isSelected={resolveSignal(wire.fromNodeId, wire.fromPort) === signal || resolveSignal(wire.toNodeId, wire.toPort) === signal}
              signal={values.get(`${wire.fromNodeId}.${wire.fromPort}`)}
              onSelect={() => selectPort(wire.fromNodeId, wire.fromPort)} /></g>))}
            {Array.from(geometry.values()).map((entry) => <g key={entry.node.id} role="button" tabIndex={0} aria-pressed={gate?.id === entry.node.id}
              aria-label={`Inspect recorded ${entry.node.label ?? entry.node.id}, ${entry.node.type}`}
              className={!connectedRegion.has(entry.node.id) && connectedRegion.size ? 'is-unrelated' : undefined}
              onClick={() => setSelectedGateId(entry.node.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setSelectedGateId(entry.node.id); } }}>
              <SchematicNodeView node={entry.node} geometry={entry.geometry} camera={camera} lod="edit"
              labelPosition={labels.get(entry.node.id)}
              isSelected={gate?.id === entry.node.id} isTraced={connectedRegion.has(entry.node.id)}
              signals={values} onPortClick={selectPort}
              layers={{ ...DEFAULT_SCHEMATIC_LAYERS, boardBindings: false, diagnostics: false }} /></g>)}
          </svg>
        </div>
        <details><summary>Recorded signals & connections</summary><label className="rb-recorded-circuit-signal">Inspect signal
          <select aria-label="Recorded circuit signal" value={signal ?? ''} onChange={(event) => { setScope(null); onSelectSignal(event.target.value); }}>
            <option value="" disabled>Select a recorded signal</option>
            {Array.from(new Set(run.waveform.flatMap((entry) => Object.keys(entry.signals)))).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <p className="rb-recorded-connectivity-note">Highlighted connections are the selected signal’s fan-in region, a place to inspect. They do not identify the mistake.</p>
        {explanation && <section className="rb-causal-walk" data-testid="ide-causal-walk" aria-label="Recorded upstream connections">
          <strong>Trace upstream</strong>
          {(explanation.causalLinks ?? []).map((link, index) => <button key={link.kind + ':' + link.signal + ':' + index}
            type="button" data-causal-kind={link.kind} data-causal-signal={link.signal} data-causal-tick={link.tick}
            onClick={() => { setScope(null); onSelectSignal(link.signal); onSelectTick?.(link.tick); }}>
            {link.label}
          </button>)}
          <p>{explanation.causalStop}</p>
        </section>}
        <WhyInspectorPanel explanation={explanation} />
        {onEdit && <button className="rb-recorded-circuit-edit" type="button" onClick={onEdit}>Edit current design</button>}
        </details>
      </>}
    </aside>
  );
}
