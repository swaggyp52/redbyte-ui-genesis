// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildHierarchicalRippleAdder } from '../examples/hierarchicalRippleAdder';
import { elaborateProjectHierarchy, type ElaborationSources } from '../projectHierarchy';
import { generateJourneySource, journeyExpression, journeyEndpoint, selectJourney, journeyValues, journeySourceSpans, journeyCone, journeyLocalDrawing, journeyOverviewEndpoint } from '../signalJourney';
import { useProjectRuntime } from '../projectRuntime';
import { vhdlFromNetlist } from '../../../export/vhdlExport';
import { netlistFromCircuit } from '../../../export/netlistExport';
import { exportBasys3Bundle } from '../../../fpga/boards/basys3/basys3Bundle';

describe('one retained circuit and moment',()=>{
 it('bounds a large local focus and reports the omitted graph without dropping the selected connection',()=>{
   const circuit={nodes:[{id:'root',type:'INPUT'},...Array.from({length:160},(_,i)=>({id:`g${i}`,type:'BUFFER'}))],connections:Array.from({length:160},(_,i)=>({id:`w${i}`,from:{nodeId:'root',portName:'out'},to:{nodeId:`g${i}`,portName:'in'}}))};
   const local=journeyLocalDrawing(circuit,'root');expect(local.circuit.nodes).toHaveLength(4);expect(local.omittedNodes).toBe(157);expect(local.omittedConnections).toBe(157);
   expect(local.circuit.connections[0].id).toBe('w0');expect(local.circuit.nodes.some(n=>n.id==='root')).toBe(true);
   expect(circuit.nodes).toHaveLength(161);
 });
 it('resolves an overview carry through exact retained boundary refs and rejects a multi-load module input',()=>{
   const f=buildHierarchicalRippleAdder(),sources:ElaborationSources={};
   const flat=elaborateProjectHierarchy(f.circuit,f.hierarchy,sources);
   const instance=f.circuit.nodes.find(n=>n.label==='u_fa2')!;
   const run={circuitSnapshot:flat,elaborationSources:sources,hierarchySnapshot:{topCircuit:f.circuit,hierarchy:f.hierarchy}} as any;
   const endpoint=journeyOverviewEndpoint(run,instance.id,'COUT')!;
   expect(sources[endpoint.nodeId]).toMatchObject({localNodeId:'o1',instancePath:[instance.id]});expect(endpoint.port).toBe('out');
   expect(journeyOverviewEndpoint(run,instance.id,'A')).toBeNull();
 });
 it('follows the exact input driver without substituting the gate output rule or value',()=>{
   const circuit={nodes:[{id:'a',type:'INPUT',label:'A'},{id:'b',type:'INPUT',label:'B'},{id:'g',type:'AND',label:'Gate'}],connections:[
     {from:{nodeId:'a',portName:'out'},to:{nodeId:'g',portName:'a'}},
     {from:{nodeId:'b',portName:'out'},to:{nodeId:'g',portName:'b'}}]};
   const values=new Map([['a.out',1],['b.out',0],['g.a',1],['g.b',0],['g.out',0]]);
   const input=journeyExpression(circuit,'g','a',values);
   expect(input).toMatchObject({label:'Gate.a',port:'a',value:'1',operator:''});
   expect(input.children.map(term=>[term.nodeId,term.port])).toEqual([['a','out']]);
   expect(journeyExpression(circuit,'g','out',values)).toMatchObject({label:'Gate',value:'0',operator:'∧'});
   expect(journeyExpression(circuit,'g','a',new Map()).value).toBeNull();
   const ambiguous={...circuit,connections:[...circuit.connections,{from:{nodeId:'b',portName:'out'},to:{nodeId:'g',portName:'a'}}]};
   expect(journeyExpression(ambiguous,'g','a',values).stop).toBe('Ambiguous drivers');
   expect(journeyExpression({...circuit,connections:[]},'g','a',values).stop).toBe('No recorded driver');
 });
 it('follows real input fan-out and output reconvergence in either direction within a bound',()=>{
   const circuit={nodes:[],connections:[
     {from:{nodeId:'a',portName:'out'},to:{nodeId:'g1',portName:'a'}},
     {from:{nodeId:'a',portName:'out'},to:{nodeId:'g2',portName:'a'}},
     {from:{nodeId:'g1',portName:'out'},to:{nodeId:'y',portName:'a'}},
     {from:{nodeId:'g2',portName:'out'},to:{nodeId:'y',portName:'b'}}]};
   expect(journeyCone(circuit,'a',256,'loads').ids).toEqual(new Set(['a','g1','g2','y']));
   expect(journeyCone(circuit,'y').ids).toEqual(new Set(['a','g1','g2','y']));
   expect(journeyCone(circuit,'a',2,'loads').truncated).toBe(true);
 });
 it('retains the same flat source bytes as the canonical board export and maps input declarations',()=>{
   const circuit={nodes:[{id:'opaque-a',type:'INPUT',label:'same'},{id:'opaque-b',type:'INPUT',label:'same'},
     {id:'opaque-g',type:'XOR',label:'same'},{id:'opaque-y',type:'OUTPUT',label:'renamed'}],connections:[
       {from:{nodeId:'opaque-a',portName:'out'},to:{nodeId:'opaque-g',portName:'a'}},
       {from:{nodeId:'opaque-b',portName:'out'},to:{nodeId:'opaque-g',portName:'b'}},
       {from:{nodeId:'opaque-g',portName:'out'},to:{nodeId:'opaque-y',portName:'in'}}]};
   const rows=[{id:'a',nodeId:'opaque-a',port:'out',label:'A',direction:'in' as const,pin:'V17',required:true},
     {id:'b',nodeId:'opaque-b',port:'out',label:'B',direction:'in' as const,pin:'V16',required:true},
     {id:'y',nodeId:'opaque-y',port:'in',label:'Y',direction:'out' as const,pin:'U16',required:true}];
   const generated=generateJourneySource(circuit,undefined,rows,'renamed');
   const bundle=exportBasys3Bundle(circuit,{inputs:rows.slice(0,2),outputs:rows.slice(2)},{entityName:'renamed'});
   expect(generated.files[0].text).toBe(bundle.topVhd);
   const input=generated.spans.find(s=>s.nodeId==='opaque-a')!;
   expect(generated.files[0].text.split('\n')[input.startLine-1]).toMatch(/A.*in/i);
 });
 it('records repeated instance identity during expansion and keeps it after friendly renaming',()=>{
   const fixture=buildHierarchicalRippleAdder();const sources:ElaborationSources={};
   const circuit=elaborateProjectHierarchy(fixture.circuit,fixture.hierarchy,sources);
   const xor=circuit.nodes.filter(n=>n.type==='XOR');
   expect(xor).toHaveLength(8);
   expect(new Set(xor.map(n=>JSON.stringify(sources[n.id].instancePath))).size).toBe(4);
   const renamed=structuredClone(fixture.circuit);for(const n of renamed.nodes)if(n.config?.moduleDefinitionId){n.label='same';n.config.instanceName='same';}
   const next:ElaborationSources={};elaborateProjectHierarchy(renamed,fixture.hierarchy,next);
   expect(Object.entries(next).map(([id,s])=>[id,s.instancePath,s.localNodeId,s.definitionId])).toEqual(Object.entries(sources).map(([id,s])=>[id,s.instancePath,s.localNodeId,s.definitionId]));
 });
 it('maps actual emitted assignments to definition-local nodes without matching labels',()=>{
   const fixture=buildHierarchicalRippleAdder();const generated=generateJourneySource(fixture.circuit,fixture.hierarchy,fixture.ioRows,'adder');
   const assignments=generated.spans.filter(s=>s.kind==='evaluation');expect(assignments.length).toBeGreaterThan(4);
   for(const span of assignments){const text=generated.files.find(f=>f.path===span.path)!.text.split('\n').slice(span.startLine-1,span.endLine).join('\n');expect(text).toContain('<=');}
   expect(generated.spans.filter(s=>s.kind==='instance')).toHaveLength(4);
   const emitted=vhdlFromNetlist(netlistFromCircuit({nodes:[{id:'opaque-7',type:'AND',label:'duplicate'},{id:'opaque-9',type:'OR',label:'duplicate'}],connections:[]}));
   expect(emitted.sourceMap.map(s=>s.nodeId)).toEqual(['opaque-7','opaque-9']);
   expect(emitted.vhd.split('\n')[emitted.sourceMap[1].startLine-1]).toContain(' or ');
 });
 it('stops a Boolean explanation at feedback and registers and preserves unknown values',()=>{
   const circuit={nodes:[{id:'and',type:'AND'},{id:'q',type:'Register1'}],connections:[{from:{nodeId:'and',portName:'out'},to:{nodeId:'and',portName:'a'}},{from:{nodeId:'q',portName:'Q'},to:{nodeId:'and',portName:'b'}}]};
   const term=journeyExpression(circuit,'and','out',new Map([['q.Q','X']]));
   expect(term.children[0].stop).toBe('Feedback boundary');expect(term.children[1].stop).toBe('State boundary');expect(term.children[1].value).toBe('X');expect(term.value).toBeNull();
   const bounded=journeyExpression(circuit,'and','out',new Map(),1);expect(bounded.children.every(c=>c.stop==='Expression limit')).toBe(true);
 });
 it('retains trace, source, hierarchy, failure and exact phase through rename/repair and JSON reopen',()=>{
   const f=buildHierarchicalRippleAdder();
   useProjectRuntime.getState().loadFromProject({kind:'rb-project',version:1,name:'Adder',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',circuit:f.circuit,hierarchy:f.hierarchy,
     ioMapping:{inputs:f.ioRows.filter(r=>r.direction==='in'),outputs:f.ioRows.filter(r=>r.direction==='out')},vectors:[{tick:0,inputs:{a0:1,a1:1,a2:1,a3:0,b0:1,b1:0,b2:0,b3:0},expected:{sum3:0}}]});
   const state=useProjectRuntime.getState();const run=state.runVerification({scenarioId:state.activeScenarioId,scenarioName:'Carry',rows:[],deterministicHash:'test',captureEvaluations:true});
   expect(run.status).toBe('fail');expect(run.waveform[0].signals['sum3.in'],JSON.stringify(run.waveform[0])).toBe('1');expect(run.evaluationTrace?.events.length).toBeGreaterThan(30);
   const endpoint=journeyEndpoint(run,'sum_3')!;expect(endpoint.nodeId).toBe('sum3');const selected=selectJourney(run,endpoint,0);
   const busRun={...run,circuitSnapshot:{...run.circuitSnapshot!,buses:[{id:'stable-word',name:'friendly_new_name',direction:'output' as const,left:3,right:0,bits:[{nodeId:'sum3',index:3}]}]}};
   expect(selectJourney(busRun,endpoint,0)).toMatchObject({busId:'stable-word',bit:3});
   const event=run.evaluationTrace!.events.find(e=>e.context.tick===0&&e.nodeType==='INPUT')!;
   const values=journeyValues(run,selected,event);expect(values.has('sum3.in')).toBe(false);
   const internal=Object.entries(run.elaborationSources!).find(([,s])=>s.instancePath.length===1&&s.localNodeId==='x1')!;
   expect(journeySourceSpans(run,internal[0]).length).toBeGreaterThan(0);
   const bytes=JSON.stringify(useProjectRuntime.getState().verifyRunArchive.find(r=>r.runId===run.runId));
   state.setProjectIdentity({projectName:'Friendly new name'});
   const repaired=structuredClone(state.circuit);repaired.connections=repaired.connections.slice(1);state.applyCircuitMutation(repaired);
   expect(JSON.stringify(useProjectRuntime.getState().verifyRunArchive.find(r=>r.runId===run.runId))).toBe(bytes);
   const restored=JSON.parse(bytes);expect(journeyEndpoint(restored,'sum_3')).toEqual(endpoint);expect(restored.evaluationTrace.events).toEqual(run.evaluationTrace!.events);
 });
});
