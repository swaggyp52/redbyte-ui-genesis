import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const out=evidenceDir('scenario-partnership',process.env.RB_SHOT_LABEL??'current');const browser=await launchChromium();
try{
 const page=await browser.newPage({viewport:{width:1280,height:650}});page.setDefaultTimeout(10000);const tid=id=>page.getByTestId(id);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE_URL,{waitUntil:'networkidle'});await tid('ide-project-start-a-lab-primary').click();await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();
 await tid('mode-button-design').click();await page.locator('[data-node-id="q0_out"]').first().click();await tid('ide-design-test-design').click();
 const read=()=>page.evaluate(()=>{const s=window.__RB_PROJECT_RUNTIME__.getState();return {scenario:s.activeScenarioId,run:s.verifyLastRun?.runId??null,vectors:JSON.stringify(s.projectVectors)};});
 assert.equal((await read()).run,null);await tid('ide-vcb-run').click();const a=await read();await tid('ide-timing-check-q0-2').click();
 const selectionA=await tid('ide-time-selection').locator('strong').first().innerText();
 if(await tid('ide-show-left-dock').count())await tid('ide-show-left-dock').click();await tid('ide-scenario-create-btn').click();await page.waitForFunction(id=>window.__RB_PROJECT_RUNTIME__.getState().activeScenarioId!==id,a.scenario);
 assert.equal((await read()).run,null,'A new scenario never borrows the first recording');await tid('ide-timing-cell-en-2').click();await tid('ide-vcb-run').click();const b=await read();assert.notEqual(b.vectors,a.vectors);assert.notEqual(b.run,a.run);await tid('ide-timing-check-q1-4').click();
 const selectionB=await tid('ide-time-selection').locator('strong').first().innerText();
 const switchTo=async id=>{if(await tid('ide-show-left-dock').count())await tid('ide-show-left-dock').click();await tid('ide-testbench-document-tab-'+id).click();};
 await switchTo(a.scenario);assert.equal((await read()).run,a.run);assert.equal((await read()).vectors,a.vectors);assert.equal(await tid('ide-time-selection').locator('strong').first().innerText(),selectionA);
 await switchTo(b.scenario);assert.equal((await read()).run,b.run);assert.equal(await tid('ide-time-selection').locator('strong').first().innerText(),selectionB);
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.reload({waitUntil:'networkidle'});await tid('mode-button-verify').click();assert.equal((await read()).run,b.run);await switchTo(a.scenario);assert.equal((await read()).run,a.run);assert.equal((await read()).vectors,a.vectors);
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'two-scenarios-1280x650.png')});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({baseUrl:BASE_URL,a,b,selectionA,selectionB,errors},null,2));console.log('PASS two independent recorded scenarios and reload');
}finally{await browser.close();}
