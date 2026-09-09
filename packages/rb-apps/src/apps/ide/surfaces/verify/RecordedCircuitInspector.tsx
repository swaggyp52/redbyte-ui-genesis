import React, { useMemo, useState } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  routeCircuit, unionBounds, routeBounds,
  SchematicNodeView, SchematicWireView, DEFAULT_SCHEMATIC_LAYERS,
} from '@redbyte/rb-logic-view';
import type { RuntimeVerifyRun } from '../../projectRuntime';
import { WhyInspectorPanel } from './WhyInspectorPanel';
import type { SignalExplanation } from './signalExplainer';
import './recorded-circuit.css';
import '../design/design-schematic.css';
import { buildRecordedCircuitGeometry, buildRecordedInstanceDrawing } from './recordedCircuitGeometry';

interface Props {
  circuit: Circuit | null;
  run: RuntimeVerifyRun;
  tick: number | null;
  signal: string | null;
  explanation: SignalExplanation | null;
  resolveSignal: (nodeId: string, port: string) => string | null;
  onSelectSignal: (signal: string) => void;
  onClose: () => void;
  onEdit?: () => void;
}

/** Pure recorded presentation: the same symbols and router as Design, with no engine or
 * authoring store. Its camera is local to this inspection, and every value is a recorded sample. */
export function RecordedCircuitInspector({ circuit, run, tick, signal, explanation, resolveSignal, onSelectSignal, onClose, onEdit }: Props) {
  const [scope, setScope] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const sample = run.waveform.find((entry) => entry.tick === tick);
  const scopes = useMemo(() => Array.from(new Set((circuit?.nodes ?? []).map((node) =>
    typeof node.config?.hierarchyPath === 'string' ? node.config.hierarchyPath : 'top',
  ))).sort(), [circuit]);
  const selectedNodes = useMemo(() => new Set((circuit?.nodes ?? []).filter((node) => {
    const geometry = buildRecordedCircuitGeometry([node]).get(node.id)?.geometry;
    return geometry?.pins.some((pin) => resolveSignal(node.id, pin.id) === signal);
  }).map((node) => node.id)), [circuit, resolveSignal, signal]);
  const selectedNode = circuit?.nodes.find((node) => selectedNodes.has(node.id));
  const selectedScope = typeof selectedNode?.config?.hierarchyPath === 'string' ? selectedNode.config.hierarchyPath : 'top';
  const activeScope = scope && scopes.includes(scope) ? scope : selectedScope;
  const drawing = useMemo<Circuit>(() => {
    if (!circuit) return { nodes: [], connections: [] };
    if (scopes.length < 2) return circuit;
    return buildRecordedInstanceDrawing(circuit, activeScope);
  }, [circuit, scopes.length, activeScope]);
  const geometry = useMemo(() => buildRecordedCircuitGeometry(drawing.nodes), [drawing]);
  const nets = useMemo(() => routeCircuit(drawing, geometry), [drawing, geometry]);
  const bounds = useMemo(() => {
    const nodes = unionBounds(geometry.values());
    const wires = routeBounds(nets);
    if (!nodes) return { minX: 0, minY: 0, maxX: 400, maxY: 260 };
    return { minX: Math.min(nodes.minX, wires?.minX ?? nodes.minX), minY: Math.min(nodes.minY, wires?.minY ?? nodes.minY), maxX: Math.max(nodes.maxX, wires?.maxX ?? nodes.maxX), maxY: Math.max(nodes.maxY, wires?.maxY ?? nodes.maxY) };
  }, [geometry, nets]);
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
  const width = bounds.maxX - bounds.minX + 96;
  const height = bounds.maxY - bounds.minY + 96;
  return (
    <aside className="rb-recorded-circuit rb-sim-inspector" data-testid="ide-recorded-circuit" aria-label="Recorded circuit investigation">
      <header>
        <strong>Recorded circuit</strong>
        <button type="button" onClick={onClose} aria-label="Close circuit investigation">Close</button>
      </header>
      <div className="rb-recorded-circuit-context" data-testid="ide-recorded-circuit-context">
        <strong>{run.scenarioName}</strong>
        <span>Run {run.reportHash.slice(0, 8)} · {tick === null ? 'select a sample' : `t${tick}`} · {signal ?? 'select a signal'}</span>
        <span>{sample && signal ? `${signal} = ${sample.signals[signal] ?? 'Not recorded'}` : 'No recorded sample selected'}</span>
      </div>
      {!circuit ? (
        <p className="rb-recorded-circuit-unavailable" role="status">This recording has no matching circuit snapshot. Its waveform remains available. Rerun the current design to investigate it with its circuit.</p>
      ) : <>
        <div className="rb-recorded-circuit-tools">
          {scopes.length > 1 && <label>Instance <select aria-label="Recorded module instance" value={activeScope} onChange={(event) => { setScope(event.target.value); setScale(1); }}>
            {scopes.map((name) => <option key={name} value={name}>{name}</option>)}
          </select></label>}
          <button type="button" onClick={() => setScale(1)}>Fit circuit</button>
          <button type="button" onClick={() => setScale((value) => Math.min(4, value + 0.5))}>Enlarge</button>
          <span>{drawing.nodes.length} nodes</span>
        </div>
        <div className="rb-recorded-circuit-sheet" tabIndex={0} aria-label="Recorded schematic; scroll to inspect enlarged circuit">
          <svg className="rb-schematic" data-renderer="schematic" data-testid="ide-recorded-circuit-svg" role="img" aria-label={`Circuit recorded for ${run.scenarioName}`} viewBox={`${bounds.minX - 48} ${bounds.minY - 48} ${width} ${height}`} style={{ width: `${scale * 100}%`, height: `${scale * 100}%`, minHeight: 230 }}>
            {nets.flatMap((net) => net.wires.map((wire) => <SchematicWireView key={wire.wireId} wire={wire} camera={camera}
              isSelected={resolveSignal(wire.fromNodeId, wire.fromPort) === signal || resolveSignal(wire.toNodeId, wire.toPort) === signal}
              signal={values.get(`${wire.fromNodeId}.${wire.fromPort}`)}
              onSelect={() => selectPort(wire.fromNodeId, wire.fromPort)} />))}
            {Array.from(geometry.values()).map((entry) => <SchematicNodeView key={entry.node.id} node={entry.node} geometry={entry.geometry} camera={camera} lod="edit"
              isSelected={selectedNodes.has(entry.node.id)} isTraced={explanation?.sourceNodeIds.includes(entry.node.id)}
              signals={values} onPortClick={selectPort}
              layers={{ ...DEFAULT_SCHEMATIC_LAYERS, boardBindings: false, diagnostics: false }} />)}
          </svg>
        </div>
        <label className="rb-recorded-circuit-signal">Inspect signal
          <select aria-label="Recorded circuit signal" value={signal ?? ''} onChange={(event) => { setScope(null); onSelectSignal(event.target.value); }}>
            <option value="" disabled>Select a recorded signal</option>
            {Array.from(new Set(run.waveform.flatMap((entry) => Object.keys(entry.signals)))).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <WhyInspectorPanel explanation={explanation} />
      </>}
      {onEdit && <button className="rb-recorded-circuit-edit" type="button" onClick={onEdit}>Edit current design</button>}
    </aside>
  );
}
