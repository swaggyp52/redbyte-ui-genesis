#!/usr/bin/env node
// One continuous local workflow. Scale cases are explicitly imported; all subsequent
// mutations use ordinary controls. Existing authoring gates prove first-use separately.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assert, clickVerifyRun, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const OUT = path.resolve(process.env.RB_INTERACTIVE_OUT ?? '.redbyte/interactive-hierarchy/continuous');
assert(process.env.RB_GATE_BASE_URL, 'Set the actual local candidate server');
await mkdir(OUT, { recursive: true });
await runIdeGate('Interactive hierarchy and cancellable Run in one continuous workflow', async ({ page, baseUrl }) => {
  const receipt = {baseUrl, node:process.version, startedAt:new Date().toISOString(), steps:[], errors:[],
    boundary:'512 labeled scale cases imported into the existing reusable adder; normal authoring is proved separately.'};
  let stage = 'load existing reusable adder';
  page.on('pageerror', error => receipt.errors.push(String(error)));
  page.on('dialog', dialog => dialog.accept().catch(() => null));
  await page.addInitScript(() => localStorage.setItem('rb-onboarding-v1-seen','1'));
  await page.setViewportSize({width:1440,height:900});
  try {
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=interactive-hierarchy-execution`,{waitUntil:'domcontentloaded'});
    await page.getByTestId('ide-mode-project').waitFor({state:'visible'});
    await loadStarterProject(page,{exactExampleId:'four-bit-adder-hierarchical'});
    const source = await page.evaluate(() => {const s=window.__RB_PROJECT_RUNTIME__.getState();return {circuit:s.circuit,hierarchy:s.hierarchy,rows:s.projectIoRows};});
    const field = id => {const row=source.rows.find(row=>row.nodeId===id);assert(row,`Missing boundary ${id}`);return row.id;};
    const vectors = Array.from({length:512},(_,tick)=>{
      const a=tick===0?7:tick%16, b=tick===0?1:Math.floor(tick/16)%16, sum=a+b;
      const inputs={},expected={};
      for(let bit=0;bit<4;bit++){inputs[field(`a${bit}`)]=(a>>bit)&1;inputs[field(`b${bit}`)]=(b>>bit)&1;expected[field(`sum${bit}`)]=(sum>>bit)&1;}
      expected[field('carry-out')]=(sum>>4)&1;
      return {tick,inputs,expected};
    });
    const fixture={kind:'rb-project',version:1,name:'Continuous hierarchy — labeled 512-case qualification',createdAt:'2026-10-07T00:00:00.000Z',updatedAt:'2026-10-07T00:00:00.000Z',
      circuit:source.circuit,hierarchy:source.hierarchy,ioMapping:{rows:source.rows},vectors,meta:{projectKind:'import',appSurface:'ide',tags:['stress-fixture']}};
    const fixturePath=path.join(OUT,'continuous.rbproj.json');
    await writeFile(fixturePath,JSON.stringify(fixture,null,2));
    await page.getByTestId('ide-project-file-input').setInputFiles(fixturePath);
    await page.waitForFunction(name=>window.__RB_PROJECT_RUNTIME__.getState().projectName===name,fixture.name);
    await workspace(page,'verify');
    await page.getByRole('checkbox',{name:'Evaluation steps',exact:true}).check();
    await completeRun(page);
    const original=await page.evaluate(()=>window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun);
    const originalBytes=await page.evaluate(id=>JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().verifyRunArchive.find(run=>run.runId===id)),original.runId);
    await writeFile(path.join(OUT,'original-recording.json'),originalBytes);
    assert(original.report.rows.length===2560 && original.report.rows.every(row=>String(row.actual)===String(row.expected)), 'All 512 cases need five independent arithmetic checks');
    const before=await owners(page);
    receipt.steps.push({step:'completed substantial parent recording',runId:original.runId,samples:original.waveform.length,checks:original.report.rows.length});

    stage='direct live hierarchy';
    await workspace(page,'design');
    const current=page.getByTestId('ide-design-current-design');
    if(await current.isVisible())await current.click();
    await page.getByTestId('ide-design-fit-circuit-canvas').first().click();
    const camera=await page.getByTestId('ide-design-canvas-stat-zoom').innerText();
    await page.getByTestId('ide-design-explore').click();
    const live=page.getByTestId('ide-live-hierarchy');
    await live.waitFor({state:'visible'});
    await page.getByTestId('ide-design-live-reset').click();
    for(const id of ['a0','a1','a2','b0'])await live.getByTestId(`switch-toggle-${id}`).click();
    assert((await live.getByTestId('ide-live-boundary-words').innerText()).includes('1000 = 8'),'Actual parent result must be 7+1=8');
    const carry=live.locator('[data-projection-wire="u-fa1.COUT-u-fa2.CIN"]');
    await carry.press('Enter');
    await live.getByRole('button',{name:'Enter this instance',exact:true}).click();
    assert(await live.getAttribute('data-instance-path')===JSON.stringify(['u-fa2']),'Exact repeated instance identity required');
    await live.locator('[data-projection-node="o1"]').click();
    assert((await live.getByTestId('ide-live-local-rule').innerText()).includes('0 OR 1 = 1'),'Internal rule must use parent values');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Control+z');
    assert(await owners(page)===before,'Live inspection and authoring keys must preserve all durable owners');
    await page.screenshot({path:path.join(OUT,'01-live-exact-carry.png')});
    await live.getByRole('button',{name:'Enlarge live drawing',exact:true}).click();
    await live.getByRole('button',{name:'Whole circuit',exact:true}).click();
    assert(await carry.getAttribute('aria-pressed')==='true','Return must restore exact parent connection');
    await page.getByTestId('ide-design-explore').click();
    assert(await page.getByTestId('ide-design-canvas-stat-zoom').innerText()===camera,'Finish must restore authoring camera');
    assert(await owners(page)===before,'Finish must restore experiment without replacing old recording');
    receipt.steps.push({step:'Explore 7+1 → exact carry instance → local rule → parent connection → Finish',ownersUnchanged:true,cameraRestored:true});

    stage='cancel actual computation';
    await workspace(page,'verify');
    await clickVerifyRun(page);
    await activeCompute(page);
    const active=await page.evaluate(()=>window.__RB_PROJECT_RUNTIME__.getState().verificationExecution);
    const cancelAt=performance.now();
    await page.getByTestId('ide-verify-cancel-execution').press('Enter');
    await page.waitForFunction(()=>window.__RB_PROJECT_RUNTIME__.getState().verificationExecution.status==='cancelled');
    const acknowledgementMs=performance.now()-cancelAt;
    assert(await owners(page)===before,'Active cancellation must preserve completed archive/authority');
    await page.screenshot({path:path.join(OUT,'02-real-computation-cancelled.png')});
    receipt.steps.push({step:'keyboard Cancel during actual sample computation',completedCases:active.completedCases,acknowledgementMs,archiveUnchanged:true});

    stage='navigation during actual computation';
    await clickVerifyRun(page);
    await activeCompute(page);
    await workspace(page,'design');
    await page.waitForFunction(()=>window.__RB_PROJECT_RUNTIME__.getState().verificationExecution.status==='cancelled');
    assert(await owners(page)===before,'Navigation cancellation must preserve completed archive');
    receipt.steps.push({step:'leave Simulate during actual compute',cancelled:true,archiveUnchanged:true});
    stage='successful retry without reload';
    await workspace(page,'verify');
    await completeRun(page);
    await page.waitForFunction(()=>Number.isFinite(window.__RB_PROJECT_RUNTIME__.getState().verificationExecution.timings?.visibleOpportunityMs));
    const recovered=await page.evaluate(()=>{const s=window.__RB_PROJECT_RUNTIME__.getState();return {run:s.verifyLastRun,old:s.verifyRunArchive[0],timings:s.verificationExecution.timings};});
    assert(recovered.run.runId!==original.runId && recovered.run.waveform.length===512,'Retry must admit a fresh complete recording');
    assert(recovered.run.report.rows.length===2560 && recovered.run.report.rows.every(row=>String(row.actual)===String(row.expected)),'Retry must preserve independently expected arithmetic');
    const old=await page.evaluate(id=>JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().verifyRunArchive.find(run=>run.runId===id)),original.runId);
    assert(old===originalBytes,'Successful retry must retain byte-identical original recording');
    await page.screenshot({path:path.join(OUT,'03-recovered-complete-recording.png')});
    receipt.steps.push({step:'successful retry without reload',runId:recovered.run.runId,oldRecordingUnchanged:true,timings:recovered.timings});
    assert(receipt.errors.length===0,`Page errors: ${JSON.stringify(receipt.errors)}`);
    receipt.status='pass';
  }catch(error){receipt.status='fail';receipt.failure={stage,error:String(error)};await page.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>null);throw error;}
  finally{receipt.finishedAt=new Date().toISOString();await writeFile(path.join(OUT,'continuous-proof.json'),JSON.stringify(receipt,null,2));}
});
async function workspace(page,mode){await page.getByTestId(`mode-button-${mode}`).click();await page.getByTestId(`ide-mode-${mode}`).waitFor({state:'visible'});}
async function activeCompute(page){await page.waitForFunction(()=>{const job=window.__RB_PROJECT_RUNTIME__.getState().verificationExecution;return job.status==='computing'&&job.completedCases>=1&&job.completedCases<512;});}
async function completeRun(page){const previous=await page.evaluate(()=>window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun?.runId);await clickVerifyRun(page);await page.waitForFunction(id=>{const s=window.__RB_PROJECT_RUNTIME__.getState();return s.verificationExecution.status==='complete'&&s.verifyLastRun?.runId!==id;},previous,{timeout:45000});}
async function owners(page){return page.evaluate(()=>{const s=window.__RB_PROJECT_RUNTIME__.getState();return JSON.stringify({circuit:s.circuit,hierarchy:s.hierarchy,vectors:s.projectVectors,scenarios:s.scenarios,archive:s.verifyRunArchive,history:s.verifyRunHistory,last:s.verifyLastRun,health:s.projectHealthCore,authority:s.scenarioAuthority});});}
