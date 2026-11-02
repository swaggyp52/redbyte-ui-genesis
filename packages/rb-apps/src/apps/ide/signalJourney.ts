import type { Circuit, EngineEvaluationObservation } from '@redbyte/rb-logic-core';
import { connectionEndpoints } from '@redbyte/rb-logic-view/scene';
import { vhdlFromNetlist, type VhdlNodeSourceSpan } from '../../export/vhdlExport';
import type { IoMapping } from '@redbyte/rb-utils';
import { buildBasys3ExportModel } from '../../fpga/boards/basys3/basys3ExportModel';
import { resolveBasys3BoardAlias, resolveBasys3PackagePin } from '../../fpga/boards/basys3/basys3Pins';
import { generateHierarchicalVhdlProject } from './hierarchicalVhdl';
import type { ProjectHierarchyDocument, ElaborationSources } from './projectHierarchy';
import type { ProjectIoRow, RuntimeVerifyRun } from './projectRuntime';
import { createRecordedPortResolver, buildRecordedCircuitGeometry } from './surfaces/verify/recordedCircuitGeometry';
import { buildFieldSignalResolver, normalizeSignalId } from './signalIdentity';

export interface JourneySelection {
  projectId: string;
  revision: string;
  runId: string;
  tick: number;
  nodeId: string;
  port: string;
  instancePath: string[];
  bit: number | null;
  busId?: string;
  eventOrder: number | null;
  /** Original inspection cone; selecting an internal object does not discard the journey. */
  anchorNodeId?: string;
  anchorPort?: string;
}
export interface JourneyGeneratedSource {
  files: Array<{ path: string; text: string }>;
  spans: Array<VhdlNodeSourceSpan & { path: string; definitionId: string }>;
  /**
   * What this source could not express (unsupported parts, missing definitions,
   * unresolved drivers). Absent on recordings made before it was retained.
   */
  diagnostics?: string[];
}
export function generateJourneySource(circuit: Circuit, hierarchy: ProjectHierarchyDocument | undefined,
  rows: readonly ProjectIoRow[], entityName: string): JourneyGeneratedSource {
  const mapping = { inputs: rows.filter(r=>r.direction==='in'), outputs: rows.filter(r=>r.direction==='out') };
  const hierarchical = generateHierarchicalVhdlProject({ circuit, hierarchy, ioMapping: mapping,
    hdl: { top: entityName, sources: [] } });
  if (hierarchical) return { files: [{path:'top.vhd',text:hierarchical.topVhd}, ...hierarchical.moduleSources], spans: hierarchical.sourceMap,
    diagnostics: hierarchical.diagnostics.filter(entry=>entry.severity==='error').map(entry=>entry.message) };
  const model = buildBasys3ExportModel(circuit, mapping);
  const emitted = vhdlFromNetlist(model.netlist, { entityName, topPorts:model.topPorts,
    topInputBindings:model.topInputBindings, topOutputBindings:model.topOutputBindings });
  return { files: [{path:'top.vhd',text:emitted.vhd}], spans: emitted.sourceMap.map(span=>({...span,path:'top.vhd',definitionId:'top'})),
    diagnostics: emitted.errors };
}

/** Resolve exact retained endpoints first, then explicit retained boundary bindings. */
export function journeyEndpoint(run: RuntimeVerifyRun, signal: string | null): {nodeId:string;port:string} | null {
  if (!run.circuitSnapshot || !signal) return null;
  const resolve = createRecordedPortResolver(run.circuitSnapshot, run.waveform);
  const fieldKey = (value:string) => value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'_');
  const matchingRows = run.executionInput?.ioRows.filter(row => row.id===signal || row.label===signal
    || fieldKey(row.id)===signal || fieldKey(row.label)===signal) ?? [];
  const io = matchingRows.length===1 ? matchingRows[0] : undefined;
  if (io?.nodeId) return { nodeId:io.nodeId, port:io.port || (io.direction==='in'?'out':'in') };
  const geometry=buildRecordedCircuitGeometry(run.circuitSnapshot.nodes);
  const outputs: {nodeId:string;port:string}[]=[];
  const inputs: {nodeId:string;port:string}[]=[];
  for (const [id,entry] of geometry) for (const pin of entry.geometry.pins) {
    if (resolve(id,pin.id)!==signal) continue;
    (pin.direction==='out'?outputs:inputs).push({nodeId:id,port:pin.id});
  }
  return outputs.length===1?outputs[0]:outputs.length===0&&inputs.length===1?inputs[0]:null;
}
export function selectJourney(run: RuntimeVerifyRun, endpoint:{nodeId:string;port:string}, tick:number): JourneySelection {
  const provenance=run.elaborationSources?.[endpoint.nodeId];
  const buses=provenance?.definitionId&&provenance.definitionId!=='top'
    ? run.hierarchySnapshot?.hierarchy?.modules.find(m=>m.id===provenance.definitionId)?.circuit.buses
    : run.circuitSnapshot?.buses ?? run.hierarchySnapshot?.topCircuit.buses;
  const bus=buses?.find(b=>b.bits.some(bit=>bit.nodeId===(provenance?.localNodeId ?? endpoint.nodeId)));
  const declaredBit=bus?.bits.find(bit=>bit.nodeId===(provenance?.localNodeId ?? endpoint.nodeId))?.index;
  const boundary=run.executionInput?.ioRows.find(r=>r.nodeId===endpoint.nodeId&&(r.port|| (r.direction==='in'?'out':'in'))===endpoint.port);
  const bit=/[\[(](\d+)[\])]$/.exec(endpoint.port) ?? (boundary?/\[(\d+)\]$/.exec(boundary.label):null);
  return { projectId:run.projectId ?? '', revision:run.identity?.design ?? run.evidence?.circuitHash ?? run.reportHash,
    runId:run.runId ?? run.reportHash, tick, ...endpoint, instancePath:run.elaborationSources?.[endpoint.nodeId]?.instancePath ?? [],
    bit:declaredBit ?? (bit?Number(bit[1]):null), busId:bus?.id,
    eventOrder:null, anchorNodeId:endpoint.nodeId, anchorPort:endpoint.port };
}
export function journeySignal(run:RuntimeVerifyRun, nodeId:string, port:string) {
  return createRecordedPortResolver(run.circuitSnapshot,run.waveform)(nodeId,port);
}
export function journeyCone(circuit:Circuit, nodeId:string, maxNodes=256, direction:'drivers'|'loads'='drivers') {
  const ids=new Set<string>(); const pending=[nodeId];
  while(pending.length&&ids.size<maxNodes){ const id=pending.pop()!;if(ids.has(id))continue;ids.add(id);
    for(const wire of circuit.connections){const {from,to}=connectionEndpoints(wire);
      if(direction==='drivers'&&to.nodeId===id)pending.push(from.nodeId);
      if(direction==='loads'&&from.nodeId===id)pending.push(to.nodeId);}
  }
  return {ids,truncated:pending.length>0};
}
export function journeyEvents(run:RuntimeVerifyRun, selected:JourneySelection) {
  if(!run.circuitSnapshot) return [];
  const anchor=selected.anchorNodeId ?? selected.nodeId;
  const type=run.circuitSnapshot.nodes.find(n=>n.id===anchor)?.type.toUpperCase() ?? '';
  const cone=journeyCone(run.circuitSnapshot,anchor,256,/^(INPUT|SWITCH|CLOCK|POWERSOURCE|GROUND)$/.test(type)?'loads':'drivers');
  return (run.evaluationTrace?.events ?? []).filter(event=>event.context.tick===selected.tick&&cone.ids.has(event.nodeId));
}
export function journeyValues(run:RuntimeVerifyRun, selected:JourneySelection, event:EngineEvaluationObservation|undefined) {
  const values = new Map<string,0|1|'X'|'Z'>();
  const put=(key:string,value:unknown)=>{if(value===0||value===1||value==='0'||value==='1')values.set(key,Number(value) as 0|1);
    else if(value==='X'||value==='Z') values.set(key,value);};
  if(!event){
    const sample=run.waveform.find(s=>s.tick===selected.tick);
    const resolve=createRecordedPortResolver(run.circuitSnapshot,run.waveform);
    for(const [id,entry] of buildRecordedCircuitGeometry(run.circuitSnapshot?.nodes??[]))for(const pin of entry.geometry.pins){
      const signal=resolve(id,pin.id);if(signal)put(`${id}.${pin.id}`,sample?.signals[signal]);
    }
  }else{
    // Only the chosen actual engine phase, never later final samples masquerading as intermediate values.
    const sameBoundary=(item:EngineEvaluationObservation)=>item.context.engineTick===event.context.engineTick
      && item.context.tick===event.context.tick && item.context.caseIndex===event.context.caseIndex
      && item.context.vectorId===event.context.vectorId;
    const phaseEvents=(run.evaluationTrace?.events??[]).filter(sameBoundary);
    // Captured register results are pending until the shared commit. Never draw them as
    // driver values consumed by another register during the same capture boundary.
    let committed=false;
    for(const item of phaseEvents)if(item.order<=event.order){
      if(item.evaluationPhase==='after-capture'&&!committed){
        for(const capture of phaseEvents.filter(e=>e.commitPhase==='after-capture'))
          for(const [port,value]of Object.entries(capture.outputs))put(`${capture.nodeId}.${port}`,value);
        committed=true;
      }
      const visible=item.commitPhase==='after-capture'&&event.evaluationPhase!=='after-capture'?item.previousOutputs:item.outputs;
      for(const [port,value]of Object.entries(visible))put(`${item.nodeId}.${port}`,value);
      for(const read of item.inputReads){put(`${item.nodeId}.${read.portName}`,read.value);
        if(read.driver&&read.origin!=='default-zero')put(`${read.driver.nodeId}.${read.driver.portName}`,read.value);}
    }
  }
  return values;
}
export interface BooleanTerm { nodeId:string;port:string;label:string;value:string|null;operator:string|null;children:BooleanTerm[];stop?:string }
/** Bounded structural derivation. Values are attached, never used to manufacture checks. */
export function journeyExpression(circuit:Circuit, nodeId:string, port:string, values:ReadonlyMap<string,unknown>, maxTerms=48):BooleanTerm {
  let count=0;
  const geometry=buildRecordedCircuitGeometry(circuit.nodes);
  const connections=circuit.connections.map(connectionEndpoints);
  const walk=(id:string,p:string,path:Set<string>):BooleanTerm=>{
    const node=circuit.nodes.find(n=>n.id===id);const value=values.get(`${id}.${p}`);
    const term:BooleanTerm={nodeId:id,port:p,label:node?.label??id,value:value==null?null:String(value),operator:null,children:[]};
    if(++count>maxTerms){term.stop='Expression limit';return term;}
    if(path.has(id)){term.stop='Feedback boundary';return term;}
    const incoming=connections.filter(w=>w.to.nodeId===id&&w.to.port===p);
    if(geometry.get(id)?.geometry.pins.some(pin=>pin.id===p&&pin.direction==='in')||incoming.length){
      term.label=`${term.label}.${p}`;
      if(!incoming.length){term.stop='No recorded driver';return term;}
      if(incoming.length>1){term.stop='Ambiguous drivers';return term;}
      term.operator='';const next=new Set(path);next.add(id);
      if(count>=maxTerms){term.stop='Expression limit';return term;}
      term.children=[walk(incoming[0].from.nodeId,incoming[0].from.port,next)];return term;
    }
    const type=node?.type.toUpperCase()??'';
    const ops:Record<string,string>={AND:'∧',AND3:'∧',OR:'∨',OR3:'∨',XOR:'⊕',XOR3:'⊕',NAND:'¬∧',NOR:'¬∨',XNOR:'¬⊕',NOT:'¬',BUFFER:'',BUF:'',OUTPUT:'',LAMP:''};
    if(!(type in ops)){term.stop=/REGISTER|FLIPFLOP|STATEBANK|LATCH/.test(type)?'State boundary':/INPUT|SWITCH|GROUND|POWERSOURCE|CLOCK/.test(type)?undefined:'Unsupported primitive';return term;}
    const wires=connections.filter(w=>w.to.nodeId===id).sort((a,b)=>a.to.port.localeCompare(b.to.port));
    if(!wires.length){term.stop='No recorded driver';return term;}
    if(new Set(wires.map(w=>w.to.port)).size!==wires.length){term.stop='Ambiguous drivers';return term;}
    term.operator=ops[type];const next=new Set(path);next.add(id);
    term.children=wires.slice(0,Math.max(0,maxTerms-count)).map(w=>walk(w.from.nodeId,w.from.port,next));
    if(term.children.length<wires.length)term.stop='Expression limit';return term;
  };
  return walk(nodeId,port,new Set());
}
export function journeySourceSpans(run:RuntimeVerifyRun,nodeId:string) {
  const source=run.elaborationSources?.[nodeId] ?? {definitionId:'top',localNodeId:nodeId};
  return run.generatedSource?.spans.filter(span=>span.definitionId===source.definitionId&&span.nodeId===source.localNodeId)??[];
}
export function journeyInstanceKey(sources:ElaborationSources|undefined,id:string){return JSON.stringify(sources?.[id]?.instancePath??[]);}

/** A recoverable local focus when the retained instance is too large to draw. */
export function journeyLocalDrawing(circuit: Circuit, nodeId: string, limit = 4) {
  const ids = new Set([nodeId]);
  const wires = circuit.connections.map(connectionEndpoints);
  // Drivers first, then loads. The omitted fan-out is reported, never silently shown as complete.
  for (const direction of ['drivers', 'loads'] as const) for (const wire of wires) {
    const neighbour = direction === 'drivers' && wire.to.nodeId === nodeId ? wire.from.nodeId
      : direction === 'loads' && wire.from.nodeId === nodeId ? wire.to.nodeId : null;
    if (neighbour && ids.size < limit) ids.add(neighbour);
  }
  const nodes = circuit.nodes.filter(node => ids.has(node.id));
  const connections = circuit.connections.filter((_, index) => ids.has(wires[index].from.nodeId) && ids.has(wires[index].to.nodeId));
  return { circuit: { ...circuit, nodes, connections }, omittedNodes: circuit.nodes.length - nodes.length,
    omittedConnections: circuit.connections.length - connections.length };
}

/**
 * The authored checks of a recording that judge this object. Report rows name a check by its run
 * signal (CARRY's is `carry`), the journey selects a port lane (`carry-out.in`) and the boundary
 * row is `carry-out`: the run's own evidence relates them, through buildFieldSignalResolver, and
 * an ambiguous or unresolved field contributes no check rather than a guessed one.
 */
export function journeyChecks(run: RuntimeVerifyRun, nodeId: string, signal: string | null) {
  const fields = run.executionInput?.ioRows.filter(io => io.nodeId === nodeId).map(io => io.id) ?? [];
  const resolver = buildFieldSignalResolver({ fieldIds: fields, evidence: run.evidence,
    reportSignals: [...new Set(run.report.rows.map(row => row.signal))] });
  const judged = new Set([...fields, ...(signal === null ? [] : [signal]),
    ...fields.map(field => resolver.resolve(field).runSignal).filter((value): value is string => value !== null)]
    .map(normalizeSignalId));
  return run.report.rows.filter(row => judged.has(normalizeSignalId(row.signal)));
}

/**
 * The selected signal's recorded value at a tick and the last recorded change that produced it:
 * the latest earlier sample with a different value. Null fields where the recording has no
 * sample; never interpolated.
 */
export function journeyTransition(run: RuntimeVerifyRun, signal: string | null, tick: number) {
  const samples = signal ? run.waveform.filter(sample => sample.tick <= tick && sample.signals[signal] !== undefined) : [];
  const at = samples.length && samples[samples.length - 1].tick === tick ? samples[samples.length - 1] : undefined;
  if (!signal || !at) return { value: null, since: null, previous: null };
  const value = String(at.signals[signal]);
  let since = at.tick;
  for (let i = samples.length - 2; i >= 0; i -= 1) {
    if (String(samples[i].signals[signal]) !== value) return { value, since, previous: String(samples[i].signals[signal]) };
    since = samples[i].tick;
  }
  return { value, since, previous: null };
}

/** One boundary signal on the board: where the recording put it and where the project puts it now. */
export interface JourneyBoardRow {
  id: string;
  label: string;
  nodeId: string | null;
  port: string;
  direction: 'in' | 'out';
  /** Package pin and board resource (LD4) the recording ran with; null when it was unassigned. */
  recorded: { pin: string; resource: string | null } | null;
  /** The live mapping's pin and resource; null when unassigned now or the signal no longer exists. */
  current: { pin: string; resource: string | null } | null;
  /** The signal is no longer a boundary row of the project. */
  removed: boolean;
  /** Recorded and current assignments differ (including assigned versus unassigned). */
  changed: boolean;
}

function boardAssignment(pin: string | undefined | null) {
  const trimmed = (pin ?? '').trim();
  if (!trimmed) return null;
  const packagePin = resolveBasys3PackagePin(trimmed) ?? trimmed;
  return { pin: packagePin, resource: resolveBasys3BoardAlias(packagePin) };
}

/**
 * The recording's board boundary set against the project's live mapping. Recorded values stay
 * the recording's; this only says whether each signal still lands on the same board resource,
 * so the board lens never presents a recorded pin as the current one or invents a resource.
 */
export function journeyBoardBoundary(run: RuntimeVerifyRun, live: IoMapping): JourneyBoardRow[] {
  const entries = [...live.inputs.map(entry => ({ ...entry, direction: 'in' as const })),
    ...live.outputs.map(entry => ({ ...entry, direction: 'out' as const }))];
  return (run.executionInput?.ioRows ?? []).map(row => {
    const direction: 'in' | 'out' = row.direction === 'in' ? 'in' : 'out';
    const port = row.port || (direction === 'in' ? 'out' : 'in');
    const now = entries.find(entry => entry.id === row.id)
      ?? entries.find(entry => entry.direction === direction && entry.nodeId === row.nodeId && (entry.port || port) === port);
    const recorded = boardAssignment(row.pin);
    const current = now ? boardAssignment(now.pin) : null;
    return { id: row.id, label: row.label, nodeId: row.nodeId ?? null, port, direction, recorded, current,
      removed: !now, changed: !now || (recorded?.pin ?? null) !== (current?.pin ?? null) };
  });
}

/** Resolve a top-level module boundary only through its retained definition references. */
export function journeyOverviewEndpoint(run: RuntimeVerifyRun, nodeId: string, port: string) {
  if (run.circuitSnapshot?.nodes.some(node => node.id === nodeId)) return { nodeId, port };
  const instance = run.hierarchySnapshot?.topCircuit.nodes.find(node => node.id === nodeId);
  const definition = run.hierarchySnapshot?.hierarchy?.modules.find(module => module.id === instance?.config?.moduleDefinitionId);
  const refs = definition?.ports.find(boundary => boundary.name === port)?.sourceBoundary.internalRefs;
  if (refs?.length !== 1) return null; // A fan-out input has several concrete endpoints; do not pick one by label.
  const entry = Object.entries(run.elaborationSources ?? {}).find(([, source]) => source.instancePath.length === 1
    && source.instancePath[0] === nodeId && source.localNodeId === refs[0].nodeId);
  return entry ? { nodeId: entry[0], port: refs[0].portName } : null;
}
