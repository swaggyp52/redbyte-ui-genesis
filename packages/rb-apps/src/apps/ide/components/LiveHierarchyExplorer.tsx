import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { useEngineeringSelection } from '../engineeringSelection';
import { buildLiveHierarchy, liveScope, moduleForNode, projectLiveHierarchyValues } from '../liveHierarchy';
import type { ProjectHierarchyDocument } from '../projectHierarchy';
import type { RuntimeSimState } from '../sim/simTypes';
import { presentSignalJourney } from '../signalJourneyPresentation';
import { journeyLocalDrawing } from '../signalJourney';
import { deriveRecordedWordGroups, recordedWordAt } from '../surfaces/verify/recordedWordLanes';
import { SchematicProjection } from './SchematicProjection';
import './live-hierarchy.css';

export function LiveHierarchyExplorer({ projectId, circuit, hierarchy, sim, onSetInput }: {
  projectId: string; circuit: Circuit; hierarchy: ProjectHierarchyDocument; sim: RuntimeSimState;
  onSetInput?: (nodeId: string, value: 0 | 1) => void;
}) {
  const selected = useEngineeringSelection(state => state.liveJourney);
  const select = useEngineeringSelection(state => state.inspectLiveJourney);
  const path = selected?.projectId === projectId ? selected.instancePath : [];
  const scope = liveScope(circuit, hierarchy, path) ?? liveScope(circuit, hierarchy, [])!;
  const model = useMemo(() => buildLiveHierarchy(circuit, hierarchy), [circuit, hierarchy]);
  const values = useMemo(() => projectLiveHierarchyValues(circuit, hierarchy, model.sources, sim.signals, path), [circuit, hierarchy, model.sources, sim.signals, path]);
  const node = scope.circuit.nodes.find(item => item.id === selected?.nodeId);
  const parentSelections = useRef(new Map<string, NonNullable<typeof selected>>());
  const [enlargedScopes, setEnlargedScopes] = useState(new Set<string>());
  const scopeKey = JSON.stringify(path);
  const enlarged = enlargedScopes.has(scopeKey);
  const change = (nodeId: string | null, port = 'out', wireId: string | null = null) => select({ projectId, instancePath: [...path], nodeId, port, wireId });
  const enter = (nodeId: string) => {
    const instance = scope.circuit.nodes.find(item => item.id === nodeId);
    if (!instance || !moduleForNode(instance, hierarchy)) return;
    parentSelections.current.set(JSON.stringify(path), { projectId, instancePath: [...path], nodeId: selected?.nodeId ?? nodeId, port: selected?.port ?? 'out', wireId: selected?.wireId ?? null });
    select({ projectId, instancePath: [...path, nodeId], nodeId: null, port: 'out', wireId: null });
  };
  const returnTo = (depth: number) => {
    const nextPath = path.slice(0, depth);
    select(parentSelections.current.get(JSON.stringify(nextPath)) ?? { projectId, instancePath: nextPath, nodeId: path[depth] ?? null, port: 'out', wireId: null });
  };
  const drivable = new Set(path.length === 0 ? circuit.nodes.filter(item => ['INPUT', 'Switch'].includes(item.type) && Object.hasOwn(sim.inputs, item.id)).map(item => item.id) : []);
  const toggle = (nodeId: string) => { if (drivable.has(nodeId)) { change(nodeId); onSetInput?.(nodeId, sim.inputs[nodeId] === 1 ? 0 : 1); } };
  const selectedModule = node ? moduleForNode(node, hierarchy) : undefined;
  const presentation = node && !selectedModule ? presentSignalJourney({ node, values, selected: { nodeId: node.id, port: selected?.port ?? 'out' }, publication: 'published-sample' }) : null;
  const words = deriveRecordedWordGroups(scope.circuit.nodes.filter(item => ['INPUT', 'Switch', 'OUTPUT', 'Lamp'].includes(item.type)).map(item => ({ id: item.id, label: item.label ?? item.id })));
  const local = scope.circuit.nodes.length > 48 && node ? journeyLocalDrawing(scope.circuit, node.id) : null;
  const drawing = local?.circuit ?? scope.circuit;
  const branches = local && node ? scope.circuit.connections.flatMap(connection => {
    if (typeof connection.from === 'string' || typeof connection.to === 'string') return [];
    if (connection.from.nodeId === node.id) return [connection.to];
    if (connection.to.nodeId === node.id) return [connection.from];
    return [];
  }) : [];
  const [branchPage, setBranchPage] = useState(0);
  useEffect(() => setBranchPage(0), [scopeKey, node?.id]);
  const branchPages = Math.max(1, Math.ceil(branches.length / 24));
  const visibleBranchPage = Math.min(branchPage, branchPages - 1);
  return <section className="rb-live-hierarchy" data-testid="ide-live-hierarchy" data-instance-path={JSON.stringify(path)}>
    <div className="rb-live-hierarchy-context">
      <nav aria-label="Explored instance path"><button className="wb-btn wb-btn--ghost" onClick={() => returnTo(0)}>Whole circuit</button>
        {scope.names.map((name, index) => <React.Fragment key={`${index}:${path[index]}`}><span aria-hidden="true"> / </span><button className="wb-btn wb-btn--ghost" onClick={() => returnTo(index + 1)}>{name}</button></React.Fragment>)}</nav>
      <span>Live parent values · no recording</span>
      <button className="wb-btn wb-btn--ghost" onClick={() => setEnlargedScopes(current => {const next=new Set(current); if(next.has(scopeKey))next.delete(scopeKey);else next.add(scopeKey);return next;})}>{enlarged ? 'Fit live drawing' : 'Enlarge live drawing'}</button>
      <div className="rb-live-hierarchy-words" data-testid="ide-live-boundary-words">{words.map(group => {
        const word = recordedWordAt(group, id => { const value = values.get(`${id}.out`); return value === 0 || value === 1 ? String(value) : null; });
        return <span key={group.id}>{group.label} <strong>{word ? `${word.bits} = ${word.value}` : 'unknown'}</strong></span>;
      })}</div>
    </div>
    <div className={`rb-live-hierarchy-work${enlarged ? ' is-enlarged' : ''}`}>
      <SchematicProjection circuit={drawing} modules={hierarchy.modules} ariaLabel={`Live circuit ${scope.names.join(' / ') || 'top'}`} values={values}
        selectedNodeId={node?.id} selectedWireId={selected?.wireId} onSelectNode={id => change(id)} onOpenNode={enter}
        drivableInputIds={drivable} onToggleInput={toggle} testId="ide-live-hierarchy-drawing"
        onSelectWire={wireId => {
          // Router identity is exact, including the destination input port.
          const connection = scope.circuit.connections.find(item => typeof item.from !== 'string' && typeof item.to !== 'string' && `${item.from.nodeId}.${item.from.portName}-${item.to.nodeId}.${item.to.portName}` === wireId);
          if (connection && typeof connection.to !== 'string') change(connection.to.nodeId, connection.to.portName, wireId);
        }} />
      {node ? <aside className="rb-live-hierarchy-inspect" aria-label="Live selected object" data-testid="ide-live-local-rule">
        <strong>{node.label ?? node.type}</strong>
        {selectedModule ? <><span>{selectedModule.displayName} · this instance</span><button className="wb-btn wb-btn--primary" onClick={() => enter(node.id)}>Enter this instance</button>
          {selectedModule.ports.map(port => <span key={port.id}>{port.name} = {String(values.get(`${node.id}.${port.name}`) ?? 'unknown')}</span>)}</>
          : <><p>{presentation?.rule.text}</p><div>{presentation?.inputs.map(input => <span key={input.key}>{input.label} = {input.value.text} </span>)}</div>
            <div>{presentation?.outputs.map(output => <span key={output.key}>{output.label} = {output.value.text} </span>)}</div>
            {drivable.has(node.id) ? <button className="wb-btn wb-btn--primary" onClick={() => toggle(node.id)}>Toggle {node.label ?? node.id}</button> : null}</>}
        <details><summary>Exact live identity</summary><code>{JSON.stringify({ projectId, instancePath: path, nodeId: node.id, port: selected?.port, connection: selected?.wireId, parentIrHash: sim.irHash })}</code></details>
        {local ? <p>{local.omittedNodes} other nodes outside this local drawing. Select a connected branch below or return to the whole circuit.</p> : null}
        {local ? <details><summary>Connected branches · {branches.length}</summary>
          {branches.slice(visibleBranchPage * 24, (visibleBranchPage + 1) * 24).map((other, index) =>
            <button key={index} className="wb-btn wb-btn--ghost" onClick={() => change(other.nodeId, other.portName)}>{other.nodeId}.{other.portName}</button>)}
          {branchPages > 1 ? <div>
            <button className="wb-btn wb-btn--ghost" disabled={visibleBranchPage === 0} onClick={() => setBranchPage(visibleBranchPage - 1)}>Previous branches</button>
            <span>{visibleBranchPage + 1} / {branchPages}</span>
            <button className="wb-btn wb-btn--ghost" disabled={visibleBranchPage + 1 === branchPages} onClick={() => setBranchPage(visibleBranchPage + 1)}>Next branches</button>
          </div> : null}
        </details> : null}
      </aside> : <span className="rb-live-hierarchy-hint">{path.length
        ? 'Inspect a gate or connection. Return to the whole circuit to drive its inputs.'
        : 'Toggle a boundary input. Select a connection or enter a module to inspect this instance.'}</span>}
    </div>
  </section>;
}
