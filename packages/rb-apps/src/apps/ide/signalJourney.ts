import type { Circuit, EngineEvaluationObservation } from '@redbyte/rb-logic-core';
import { connectionEndpoints } from '@redbyte/rb-logic-view/scene';
import { vhdlFromNetlist, type VhdlNodeSourceSpan } from '../../export/vhdlExport';
import { buildBasys3ExportModel } from '../../fpga/boards/basys3/basys3ExportModel';
import { generateHierarchicalVhdlProject } from './hierarchicalVhdl';
import type { ProjectHierarchyDocument, ElaborationSources } from './projectHierarchy';
import type { ProjectIoRow, RuntimeVerifyRun } from './projectRuntime';
import { createRecordedPortResolver, buildRecordedCircuitGeometry } from './surfaces/verify/recordedCircuitGeometry';

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
