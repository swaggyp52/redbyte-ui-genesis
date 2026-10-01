// Original enabled modulo-8 counter: UI authoring only. Runtime reads below
// locate symbols and assert semantics; they never change application state.
import { launchChromium, chromiumExecutablePath, BASE_URL, evidenceDir } from './harness.mjs';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const JSZip=createRequire(new URL('../rb-apps/package.json',import.meta.url))('jszip');

const out = evidenceDir('student-counter', process.env.RB_SHOT_LABEL ?? 'current');
const profile = fs.mkdtempSync(path.join(out, 'student-profile-'));
const launchProfile = () => chromium.launchPersistentContext(profile, {
  ...(chromiumExecutablePath() ? { executablePath: chromiumExecutablePath() } : {}),
  viewport:{width:1440,height:900},acceptDownloads:true,
});
let context = await launchProfile();
let portableBrowser;
let portableContext;
let page = await context.newPage();
page.setDefaultTimeout(15000);
const evidence = {baseUrl:BASE_URL, started:new Date().toISOString(), steps:[], errors:[], friction:[]};
const attach = p => p.on('pageerror', e => evidence.errors.push(e.message));
attach(page);
const tid = id => page.getByTestId(id);
const read = () => page.evaluate(() => {
  const s = window.__RB_PROJECT_RUNTIME__.getState();
  // Session data is JSON: absent optional fields and explicit undefined have
  // identical portable meaning. Keep all represented values and array order.
  return JSON.parse(JSON.stringify({projectId:s.projectId,name:s.projectName,circuit:s.circuit,hierarchy:s.hierarchy,
    rows:s.projectIoRows,scenarios:s.scenarios,active:s.activeScenarioId,run:s.verifyLastRun,
    archive:s.verifyRunArchive,history:s.verifyRunHistory,constraints:s.constraintSets,exports:s.exportHistory,
    mapping:s.hardwareMappingV2,sourceModel:s.sourceModel,fpga:s.fpga}));
});
const step = (name, details={}) => { evidence.steps.push({name,...details}); console.log(name, JSON.stringify(details)); };
const shot = async name => page.screenshot({path:path.join(out,`${name}.png`)});
const fileMenu = async command => { await tid('ide-menu-file').click(); await tid(`ide-menu-item-${command}`).click(); };
const save = async () => { await tid('ide-topbar-save-btn').click(); await page.locator('[data-testid="ide-save-state"][data-state="saved"]').waitFor({timeout:30000}); };
const library = async () => { if (!await tid('ide-design-search').isVisible()) await tid('ide-show-left-dock').click(); };
const select = async id => { await tid('ide-design-tool-select').click(); await page.locator(`[data-node-id="${id}"]`).first().click(); };
const rename = async (id, label) => {
  await select(id); await page.keyboard.press('F2');
  await tid('ide-design-canvas-rename-input').fill(label); await tid('ide-design-canvas-rename-input').press('Enter');
};
const place = async (type,x,y,label) => {
  await library(); await tid('ide-design-search').fill(type==='Register1'?'register':type.toLowerCase());
  const before = new Set((await read()).circuit.nodes.map(n=>n.id));
  await tid(`ide-design-palette-${type.toLowerCase()}`).first().click();
  await tid('ide-design-placement-hit-layer').click({position:{x,y}});
  const node = (await read()).circuit.nodes.find(n=>!before.has(n.id));
  assert(node,`placed ${type}`); await rename(node.id,label); return node.id;
};
const fit = async () => { await page.keyboard.press('Escape'); await tid('ide-design-fit-circuit-canvas').click(); };
const wire = async (from, fp, to, tp) => {
  await tid('ide-design-tool-wire').click();
  const beforeCue=await tid('ide-design-canvas').boundingBox();
  const before = (await read()).circuit.connections.length;
  await tid(`port-${from}-${fp}`).click();
  const afterCue=await tid('ide-design-canvas').boundingBox();
  assert.deepEqual(afterCue,beforeCue,'starting a wire keeps the canvas geometry stable');
  await tid(`port-${to}-${tp}`).click();
  assert.equal((await read()).circuit.connections.length,before+1,`wire ${from}.${fp} → ${to}.${tp}`);
};
const revealRight = async () => { if(await tid('ide-show-right-dock').count()) await tid('ide-show-right-dock').click(); };
async function disconnectVisibleWire(connection) {
  await tid('ide-design-tool-select').click();
  const wireId=connection.id??`${connection.from.nodeId}.${connection.from.portName}-${connection.to.nodeId}.${connection.to.portName}`;
  const point=await page.locator(`[data-wire-id="${wireId}"]`).first().evaluate(element=>{
    for(const line of element.querySelectorAll('path')) {
      const matrix=line.getScreenCTM(); if(!matrix) continue;
      for(let i=1;i<30;i++) {
        const p=line.getPointAtLength(line.getTotalLength()*i/30);
        const x=p.x*matrix.a+p.y*matrix.c+matrix.e,y=p.x*matrix.b+p.y*matrix.d+matrix.f;
        if(document.elementFromPoint(x,y)?.closest('[data-wire-id]')===element) return {x,y};
      }
    }
    return null;
  });
  assert(point,'wire exposes a selectable segment');
  await page.mouse.click(point.x,point.y); await revealRight();
  await tid('ide-design-context-delete-wire').click();
  assert(!(await read()).circuit.connections.some(c=>c.from.nodeId===connection.from.nodeId&&c.from.portName===connection.from.portName&&c.to.nodeId===connection.to.nodeId&&c.to.portName===connection.to.portName));
}
async function tidySymbols(ids) {
  await tid('ide-design-tool-select').click();
  for(const side of ['left','right','bottom']) if(await tid(`ide-hide-${side}-dock`).count()) await tid(`ide-hide-${side}-dock`).click();
  await tid('ide-design-zoom-readout').click(); await fit();
  const canvas=await tid('ide-design-canvas').boundingBox();
  const slots={CLK:[.12,.2],EN:[.12,.5],RST:[.12,.8]};
  for(let i=0;i<3;i++) {slots[`S${i}`]=[.4,.22+i*.27];slots[`R${i}`]=[.65,.22+i*.27];slots[`COUNT${i}`]=[.87,.22+i*.27];}
  for(const [name,id] of Object.entries(ids)) {
    const symbol=page.locator(`[data-node-id="${id}"]`).first();
    const box=await symbol.boundingBox(); assert(box,`visible ${name}`);
    const exposed=await page.evaluate(({id,box})=>{
      for(const fx of [.5,.35,.65,.2,.8]) for(const fy of [.5,.35,.65,.2,.8]) {
        const x=box.x+box.width*fx,y=box.y+box.height*fy;
        const hit=document.elementFromPoint(x,y);
        if(hit?.closest('[data-node-id]')?.getAttribute('data-node-id')===id && !hit.closest('[data-port-id]')) return {x,y};
      }
      return null;
    },{id,box});
    assert(exposed,`${name} exposes a draggable body`);
    const target={x:canvas.x+canvas.width*slots[name][0],y:canvas.y+canvas.height*slots[name][1]};
    await page.mouse.move(exposed.x,exposed.y); await page.mouse.down();
    await page.mouse.move(target.x,target.y,{steps:12}); await page.mouse.up();
  }
  await fit();
}
const download = async (command, filename) => {
  const [result]=await Promise.all([page.waitForEvent('download'),fileMenu(command)]);
  const target=path.join(out,filename); await result.saveAs(target); return target;
};

// Independently defined before reading any simulator outputs.
function oracle(events) {
  let count=0, previousClock=0;
  return events.map(e=>{
    if(e.RST===1) count=0;
    else if(previousClock===0 && e.CLK===1 && e.EN===1) count=(count+1)&7;
    previousClock=e.CLK;
    return {...e,count,COUNT0:count&1,COUNT1:(count>>1)&1,COUNT2:(count>>2)&1};
  });
}
const countEvents=oracle(Array.from({length:18},(_,t)=>({t,CLK:t>=2?t%2===0?1:0:0,EN:1,RST:t===0?1:0})));
const holdEvents=oracle([
  {t:0,CLK:0,EN:1,RST:1},{t:1,CLK:0,EN:1,RST:0},{t:2,CLK:1,EN:1,RST:0},
  {t:3,CLK:0,EN:0,RST:0},{t:4,CLK:1,EN:0,RST:0},{t:5,CLK:1,EN:0,RST:1},
  {t:6,CLK:0,EN:0,RST:0},{t:7,CLK:1,EN:0,RST:0},{t:8,CLK:0,EN:1,RST:0},{t:9,CLK:1,EN:1,RST:0}
]);
const resumeEvents=oracle([
  {t:0,CLK:0,EN:0,RST:1},{t:1,CLK:0,EN:0,RST:0},{t:2,CLK:1,EN:1,RST:0},
  {t:3,CLK:1,EN:0,RST:0},{t:4,CLK:1,EN:1,RST:0},{t:5,CLK:0,EN:1,RST:0},
  {t:6,CLK:1,EN:1,RST:0},{t:7,CLK:0,EN:1,RST:1},{t:8,CLK:1,EN:1,RST:1},
  {t:9,CLK:0,EN:1,RST:0},{t:10,CLK:1,EN:1,RST:0}
]);
fs.writeFileSync(path.join(out,'independent-oracle.json'),JSON.stringify({countEvents,holdEvents,resumeEvents},null,2));

async function setupScenario(name, events, create=false) {
  if(create) await tid('ide-scenario-create-btn').click();
  await page.getByLabel('Manage testbench',{exact:true}).click(); await tid('ide-scenario-rename-btn').click();
  await tid('ide-scenario-rename-input').fill(name); await tid('ide-scenario-rename-input').press('Enter');
  const generators=tid('ide-scenario-generators-disclosure');
  if(await generators.getAttribute('open')===null) await generators.locator('summary').first().click();
  const clock=tid('ide-verify-clock-policy-panel').first();
  if(await clock.getAttribute('open')===null) await clock.locator('summary').click();
  await tid('ide-verify-clock-mode-manual').click();
  const rows=(await read()).rows;
  const fields=Object.fromEntries(rows.map(r=>[r.label,r.id]));
  const active=s=>s.scenarios.find(x=>x.id===s.active);
  let vectors=active(await read()).vectors;
  // Existing starter rows, if any, are removed through the visible table.
  const table=tid('ide-scenario-table-disclosure');
  if(await table.getAttribute('open')===null) await table.locator('summary').click();
  while(vectors.length) {
    await tid(`ide-scenario-event-${vectors[0].id}`).click(); await tid('ide-scenario-delete-event').click();
    vectors=active(await read()).vectors;
  }
  for(const event of events) {
    await tid('ide-scenario-composer-add-event').click();
    const editor=tid('ide-scenario-event-editor-details');
    if(await editor.getAttribute('open')===null) await editor.locator('summary').click();
    await tid('ide-scenario-event-time').fill(String(event.t));
    for(const label of ['CLK','EN','RST']) {
      const button=tid(`ide-scenario-input-${fields[label]}`);
      assert(fields[label],`${label} logical input exists`);
      if((await button.getAttribute('aria-pressed')==='true'?1:0)!==event[label]) await button.click();
    }
    for(const label of ['COUNT0','COUNT1','COUNT2']) {
      const button=tid(`ide-scenario-check-${fields[label]}`);
      for(let attempt=0;attempt<3;attempt++) {
        const text=await button.locator('strong').innerText();
        if(text===String(event[label])) break;
        await button.click();
      }
      assert.equal(await button.locator('strong').innerText(),String(event[label]));
    }
  }
  const scenario=active(await read());
  assert.equal(scenario.vectors.length,events.length); step('authored-scenario',{name,id:scenario.id,events:events.length});
  return scenario.id;
}
async function run(expected) {
  const old=(await read()).run?.runId; await tid('ide-vcb-run').click();
  await page.waitForFunction(id=>window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun?.runId!==id,old);
  const result=(await read()).run;
  assert.equal(result.status,expected,JSON.stringify(result.report?.rows?.filter(r=>r.status==='fail').slice(0,8)));
  step('recorded-run',{id:result.runId,status:result.status,rows:result.report.rows.length}); return result;
}
async function chooseEvent(tick) {
  const state=await read();const scenario=state.scenarios.find(s=>s.id===state.active);
  const vector=scenario.vectors.find(v=>v.tick===tick); assert(vector);
  const table=tid('ide-scenario-table-disclosure');
  if(await table.getAttribute('open')===null) await table.locator('summary').click();
  await tid(`ide-scenario-event-${vector.id}`).click();
  const editor=tid('ide-scenario-event-editor-details');
  if(await editor.getAttribute('open')===null) await editor.locator('summary').click();
}
async function expectedBit(label,value) {
  const field=(await read()).rows.find(r=>r.label===label); assert(field);
  const button=tid(`ide-scenario-check-${field.id}`);
  for(let i=0;i<3 && await button.locator('strong').innerText()!==String(value);i++) await button.click();
  assert.equal(await button.locator('strong').innerText(),String(value));
}
// Portable project encoding orders graph members deterministically. Compare the
// complete graph independent of insertion order; scenario/event order stays exact.
const orderedCircuit=c=>({...c,nodes:c.nodes.map(n=>({...n,rotation:n.rotation??0})).sort((a,b)=>a.id.localeCompare(b.id)),
  connections:[...c.connections].sort((a,b)=>JSON.stringify([a.from,a.to,a.id]).localeCompare(JSON.stringify([b.from,b.to,b.id])))});
const authoring=s=>({circuit:orderedCircuit(s.circuit),hierarchy:s.hierarchy && {...s.hierarchy,
  modules:s.hierarchy.modules.map(m=>({...m,circuit:orderedCircuit(m.circuit)}))},scenarios:s.scenarios,constraints:s.constraints,
  mapping:s.mapping,sourceModel:s.sourceModel,fpga:s.fpga});
async function openSaved(id) {await fileMenu('project.open');await tid(`ide-load-project-${id}`).click();
  await page.waitForFunction(id=>window.__RB_PROJECT_RUNTIME__.getState().projectId===id,id);}
async function packageLab(label) {
  await tid('mode-button-export').click(); await tid('ide-export-file-top-xdc').click();
  const [file]=await Promise.all([page.waitForEvent('download',{timeout:30000}),
    page.locator('[data-testid="ide-export-draft-download-v1"], [data-testid="ide-export-package-build-v1"], [data-testid="ide-export-package-download-v1"]').click()]);
  const target=path.join(out,`${label}.zip`); await file.saveAs(target);
  const bytes=fs.readFileSync(target),hash=createHash('sha256').update(bytes).digest('hex');
  const zip=await JSZip.loadAsync(bytes);
  const find=pattern=>Object.keys(zip.files).find(name=>pattern.test(name));
  const hdl=await zip.file(find(/(?:^|\/)top\.vhd$/)).async('string');
  const tb=await zip.file(find(/testbench\.vhd$/)).async('string');
  const xdc=await zip.file(find(/(?:^|\/)top\.xdc$/)).async('string');
  const slicePath=find(/(?:^|\/)increment_slice\.vhd$/);assert(slicePath,'ZIP contains the reusable module definition');
  const slice=await zip.file(slicePath).async('string');
  assert.match(slice,/xor/i);assert.match(slice,/and/i);assert.match(hdl,/rising_edge/i);
  assert.match(hdl,/CARRY => n_incrementslice1_CARRY_OUT/);
  const xpr=await zip.file(find(/\.xpr$/)).async('string');
  const tcl=await zip.file(find(/(?:^|\/)vivado_import\.tcl$/)).async('string');
  assert.match(xpr,/sources_1\/new\/increment_slice\.vhd/);assert.match(tcl,/sources_1\/new\/increment_slice\.vhd/);
  assert.match(tb,/assert/i);
  for(const pin of ['W5','V17','U18','U16','E19','U19']) assert.match(xdc,new RegExp(`PACKAGE_PIN ${pin}\\b`));
  assert((await read()).exports.some(r=>r.packageHash===hash));
  fs.writeFileSync(path.join(out,`${label}-top.vhd`),hdl);fs.writeFileSync(path.join(out,`${label}-testbench.vhd`),tb);
  fs.writeFileSync(path.join(out,`${label}-top.xdc`),xdc);
  await shot('08-package');step('actual-package-inspected',{target,hash,files:Object.keys(zip.files)});
  return hash;
}

try {
  await page.goto(BASE_URL,{waitUntil:'networkidle'}); await tid('ide-project-build-fresh-primary').click();
  await page.getByRole('button',{name:'Project title Untitled Project. Click to rename.',exact:true}).click();
  const title=page.getByRole('textbox',{name:'Project title',exact:true});
  await title.fill('Enabled modulo-8 counter'); await title.press('Enter');
  await tid('ide-design-zoom-readout').click();
  const boundary={};
  boundary.Q=await place('INPUT',90,90,'BIT'); boundary.C=await place('INPUT',90,310,'CARRY');
  boundary.X=await place('XOR',390,90,'Next bit'); boundary.A=await place('AND',390,310,'Carry forward');
  boundary.N=await place('OUTPUT',700,90,'NEXT'); boundary.O=await place('OUTPUT',700,310,'CARRY_OUT');
  await fit();
  for(const gate of [boundary.X,boundary.A]) {await wire(boundary.Q,'out',gate,'a');await wire(boundary.C,'out',gate,'b');}
  await wire(boundary.X,'out',boundary.N,'in'); await wire(boundary.A,'out',boundary.O,'in');
  await select(boundary.X); await page.locator(`[data-node-id="${boundary.A}"]`).first().click({modifiers:['Shift']});
  await revealRight(); await tid('ide-design-create-module-open').click();
  await tid('ide-design-create-module-name').fill('IncrementSlice'); await tid('ide-design-create-instance-name').fill('bit_slice');
  await tid('ide-design-create-module-confirm').click();
  const definition=(await read()).hierarchy.modules.find(m=>m.name==='IncrementSlice');
  assert(definition); step('created-reusable-increment-slice',{ports:definition.ports}); await shot('01-increment-slice');
  await fit(); await tid('ide-design-tool-select').click();
  await tid('ide-design-canvas').click({position:{x:30,y:30}}); await page.keyboard.press('Control+a'); await page.keyboard.press('Delete');
  assert.equal((await read()).circuit.nodes.length,0); assert((await read()).hierarchy.modules.some(m=>m.id===definition.id));
  const ids={};
  for(const [i,label] of ['CLK','EN','RST'].entries()) ids[label]=await place('INPUT',70,100+i*190,label);
  for(let i=0;i<3;i++) {
    ids[`R${i}`]=await place('Register1',530,100+i*190,`State bit ${i}`);
    await revealRight(); await tid('ide-design-right-tab-properties').click();
    await tid('ide-design-register-has-enable').uncheck();
    await tid('ide-design-register-reset-kind').selectOption('async_clear');
    await tid('ide-design-right-tab-inspector').click();
    ids[`COUNT${i}`]=await place('OUTPUT',810,100+i*190,`COUNT${i}`);
    await library(); await tid('ide-design-search').fill('');
    const before=new Set((await read()).circuit.nodes.map(n=>n.id));
    await tid(`ide-design-palette-place-${definition.id}`).first().click();
    const instance=(await read()).circuit.nodes.find(n=>!before.has(n.id)); assert(instance);
    ids[`S${i}`]=instance.id;
  }
  await tidySymbols(ids); await shot('02a-reorganized-counter');
  const portName=(direction,name)=>definition.ports.find(p=>p.direction===direction&&p.name===name)?.name;
  for(const name of ['BIT','CARRY']) assert(portName('input',name),`module input ${name}`);
  for(const name of ['NEXT','CARRY_OUT']) assert(portName('output',name),`module output ${name}`);
  for(let i=0;i<3;i++) {
    await wire(ids.CLK,'out',ids[`R${i}`],'CLK'); await wire(ids.RST,'out',ids[`R${i}`],'RST');
    await wire(ids[`R${i}`],'Q',ids[`S${i}`],'BIT'); await wire(ids[`S${i}`],'NEXT',ids[`R${i}`],'D');
    await wire(ids[`R${i}`],'Q',ids[`COUNT${i}`],'in');
    // Genuine construction error: the high slice receives low carry, skipping bit 1.
    await wire(i===0?ids.EN:ids[`S${i===2?0:i-1}`],i===0?'out':'CARRY_OUT',ids[`S${i}`],'CARRY');
  }
  await select(ids.R2); await page.keyboard.press('Delete'); await tid('ide-design-tool-undo').click();
  await tid('ide-design-tool-redo').click(); await tid('ide-design-tool-undo').click();
  assert.equal((await read()).circuit.nodes.length,12); await fit(); await shot('02-authored-counter');
  step('blank-counter-constructed',{nodes:12,connections:(await read()).circuit.connections.length,ids});
  if(process.env.RB_LAB_PHASE==='construction') {
    await save(); await download('project.export-backup','construction.rb-session.json');
  } else {
    await tid('ide-design-test-design').click();
    const counting=await setupScenario('Count and wrap',countEvents); await run('fail'); await shot('03-logic-error');
    evidence.friction.push({scope:'construction',issue:'high carry intentionally wired to low slice',expected:'carry cascades through middle slice'});
    step('logic-failure-discovered',{scenarioId:counting});
    const failed=(await read()).run;
    await tid('ide-verify-fail-focus-trace').click(); await shot('04-logic-driver-investigation');
    await tid('ide-design-current-design').click(); await fit();
    const wrong=(await read()).circuit.connections.find(c=>c.to.nodeId===ids.S2&&c.to.portName==='CARRY');assert(wrong);
    await disconnectVisibleWire(wrong); await wire(ids.S1,'CARRY_OUT',ids.S2,'CARRY');
    await tid('ide-design-test-design').click(); const countingPass=await run('pass');
    const beforeOther=(await read()).scenarios.find(s=>s.id===counting);
    const holding=await setupScenario('Enable hold and asynchronous reset',holdEvents,true); await run('pass');
    assert.deepEqual((await read()).scenarios.find(s=>s.id===counting),beforeOther,'new scenario leaves original untouched');
    const beforeExpectation=(await read()).scenarios.find(s=>s.id===holding);
    await chooseEvent(5); await expectedBit('COUNT0',1); await run('fail'); await shot('05-wrong-expectation');
    await chooseEvent(5); await expectedBit('COUNT0',0); const holdPass=await run('pass');
    assert.deepEqual((await read()).scenarios.find(s=>s.id===holding).vectors,beforeExpectation.vectors,'expectation repair restores intended stimulus/checks');
    await setupScenario('Pause and resume without a clock edge',resumeEvents,true);await run('fail');
    // Data must settle before the active clock edge, just as in the generated HDL.
    // Move EN's first assertion to the preceding low-clock event through the editor;
    // retain the independently derived output checks and all other scenarios.
    await chooseEvent(1);const enField=(await read()).rows.find(r=>r.label==='EN');
    await tid(`ide-scenario-input-${enField.id}`).click();await run('pass');
    step('stimulus-setup-repaired',{signal:'EN',movedBeforeEdgeAt:2,assertedAt:1,expectedChecksUnchanged:true});
    assert.deepEqual((await read()).scenarios.find(s=>s.id===counting),beforeOther,'other scenario edits cannot contaminate count/wrap');
    await tid(`ide-testbench-document-tab-${counting}`).click();
    await page.getByLabel('Recorded run',{exact:true}).selectOption(failed.runId);
    assert.equal((await read()).run.status,'fail'); assert.notEqual((await read()).run.runId,countingPass.runId);
    assert.match(await tid('ide-run-identity').getAttribute('data-currency'),/historical|differs|stale/,'old wiring recording remains historical');
    await shot('06-historical-wiring-failure');
    await page.getByLabel('Recorded run',{exact:true}).selectOption(countingPass.runId);
    const fresh=await run('pass');
    await tid('mode-button-hardware').click();
    for(const [label,resource] of Object.entries({CLK:'CLK100MHZ',EN:'SW0',RST:'BTNC',COUNT0:'LD0',COUNT1:'LD1',COUNT2:'LD2'})) {
      const row=(await read()).rows.find(r=>r.label===label);assert(row);
      await tid(`ide-hw-map-row-action-${row.id}`).click();await tid('ide-hw-direct-resource-select').selectOption(resource);
      await tid('ide-hw-assign-selected-resource').click();
    }
    const constraints=tid('ide-hw-constraints-tool');if(await constraints.getAttribute('open')===null)await constraints.locator('summary').first().click();
    const sets=tid('ide-constraint-sets');if(await sets.getAttribute('open')===null)await sets.locator('summary').first().click();
    await tid('ide-constraint-sets-add-name').fill('Basys3 counter controls');await tid('ide-constraint-sets-add').click();
    await shot('07-board');await tid('mode-button-verify').click();await run('pass');
    await packageLab('counter-vivado-package');await save();
    const original=await read();const originalAuthoring=authoring(original);
    const backup=await download('project.export-backup','enabled-modulo-8-counter.rb-session.json');
    evidence.sample=backup;
    await context.close();context=await launchProfile();page=await context.newPage();attach(page);await page.goto(BASE_URL,{waitUntil:'networkidle'});
    assert.equal((await read()).projectId,original.projectId);assert.deepEqual(authoring(await read()),originalAuthoring);
    step('close-browser-process-and-reopen',{projectId:original.projectId,profile});
    await fileMenu('project.close');await tid('ide-project-build-fresh-primary').click();await save();const other=(await read()).projectId;
    assert.notEqual(other,original.projectId);await openSaved(original.projectId);assert.deepEqual(authoring(await read()),originalAuthoring);
    await fileMenu('project.save-as');await page.waitForFunction(id=>window.__RB_PROJECT_RUNTIME__.getState().projectId!==id,original.projectId);
    const copied=await read();assert.notEqual(copied.projectId,original.projectId);
    assert.deepEqual(authoring(copied),originalAuthoring);await fileMenu('project.duplicate');
    await fileMenu('project.open');await tid('ide-load-project-list').getByRole('button').filter({hasText:`${original.name} Copy`}).first().click();
    await page.waitForFunction(id=>window.__RB_PROJECT_RUNTIME__.getState().projectId!==id,copied.projectId);
    assert.deepEqual(authoring(await read()),originalAuthoring);
    await openSaved(original.projectId);assert.deepEqual(authoring(await read()),originalAuthoring);
    step('project-isolation-and-copy',{original:original.projectId,other,saveAs:copied.projectId});
    portableBrowser=await launchChromium();portableContext=await portableBrowser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    const restoredBrowser=portableBrowser,restoreContext=portableContext;
    const sourcePage=page;page=await restoreContext.newPage();attach(page);
    await page.goto(process.env.RB_SECOND_ORIGIN_URL??BASE_URL,{waitUntil:'networkidle'});
    const empty=await read();assert.notEqual(empty.projectId,original.projectId,'fresh profile has no owner identity');
    assert.equal(empty.circuit.nodes.length,0,'fresh profile has no owner circuit');assert.equal(empty.archive.length,0,'fresh profile has no owner recordings');
    await fileMenu('project.open');
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),tid('ide-load-file').click()]);await chooser.setFiles(backup);
    await page.waitForFunction(id=>window.__RB_PROJECT_RUNTIME__.getState().projectId===id,original.projectId);
    assert.deepEqual(authoring(await read()),originalAuthoring);
    assert.deepEqual((await read()).archive,original.archive);assert.deepEqual((await read()).exports,original.exports);
    await tid('mode-button-verify').click();await run('pass');await packageLab('restored-counter-vivado-package');
    await shot('09-restored-student-session');step('clean-profile-portable-restore',{recordings:original.archive.length,scenarios:original.scenarios.length});
    await restoreContext.close();await restoredBrowser.close();page=sourcePage;
    assert.deepEqual(authoring(await read()),originalAuthoring,'source profile remains intact');
    step('complete-student-assignment',{lastCorrectRun:fresh.runId,holdPass:holdPass.runId});
  }
  assert.deepEqual(evidence.errors,[]);
} catch(error) {
  evidence.failure=error.stack;
  fs.writeFileSync(path.join(out,'failure-state.json'),JSON.stringify(await read().catch(e=>({unavailable:e.message})),null,2));
  await shot('failure').catch(()=>{}); throw error;
} finally {
  evidence.ended=new Date().toISOString(); fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(evidence,null,2));
  await context.close();
  await portableContext?.close(); await portableBrowser?.close();
}
